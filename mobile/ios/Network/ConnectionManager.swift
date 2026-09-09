import Foundation
import Network

enum ConnectionStatus: Equatable, Sendable {
    case disconnected
    case connecting(endpoint: String)
    case connected(endpoint: String)
    case reconnecting(attempt: Int, endpoint: String)

    var isConnected: Bool {
        if case .connected = self { return true }
        return false
    }
}

// MARK: - Network Path Observer (Interface/VPN Monitor)

private final class NetworkPathObserver: @unchecked Sendable {
    private let monitor: NWPathMonitor
    private let queue = DispatchQueue(label: "com.canywhere.pathmonitor", qos: .utility)
    var onPathUpdate: (@Sendable (NWPath) -> Void)?

    init() {
        self.monitor = NWPathMonitor()
        self.monitor.pathUpdateHandler = { [weak self] path in
            self?.onPathUpdate?(path)
        }
    }

    func start() {
        monitor.start(queue: queue)
    }

    func cancel() {
        monitor.cancel()
    }
}

// MARK: - Delegate Bridge for URLSessionWebSocketTask lifecycle

private final class WebSocketDelegateBridge: NSObject, URLSessionWebSocketDelegate, @unchecked Sendable {
    var onOpen: (@Sendable (URLSessionWebSocketTask) -> Void)?
    var onClose: (@Sendable (URLSessionWebSocketTask, Error?) -> Void)?

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        onOpen?(webSocketTask)
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        if let wsTask = task as? URLSessionWebSocketTask {
            onClose?(wsTask, error)
        }
    }
}

actor ConnectionManager {
    static let shared = ConnectionManager()

    private var currentTask: URLSessionWebSocketTask?
    private(set) var currentEndpoint: String?
    private var session: URLSession
    private let delegateBridge = WebSocketDelegateBridge()
    private let pathObserver = NetworkPathObserver()
    private var isIntentionallyDisconnected = false

    private var candidateEndpoints: [String] = []
    private var activeCandidateIndex = 0

    private var pendingRequests: [String: CheckedContinuation<Data, Error>] = [:]
    private var openContinuations: [ObjectIdentifier: CheckedContinuation<Void, Error>] = [:]

    private var notificationHandler: (@Sendable (String, Data) -> Void)?
    private var statusChangeHandler: (@Sendable (ConnectionStatus) -> Void)?
    private var activeEndpointChangedHandler: (@Sendable (String) -> Void)?

    private var reconnectAttempt = 0
    private let maxReconnectBackoffSeconds: Double = 16.0
    private var reconnectTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?

    // Token delta buffering (batch to ~40fps / 24ms to prevent flooding MainActor)
    private struct BufferedDelta {
        let chatId: String
        let messageId: String
        let type: String
        var text: String
    }
    private var deltaBuffer: [BufferedDelta] = []
    private var deltaFlushTask: Task<Void, Never>?

    private(set) var status: ConnectionStatus = .disconnected {
        didSet {
            let s = status
            statusChangeHandler?(s)
        }
    }

    private init() {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = false
        config.timeoutIntervalForRequest = 10.0
        let bridge = self.delegateBridge
        self.session = URLSession(configuration: config, delegate: bridge, delegateQueue: nil)

        bridge.onOpen = { [weak self] task in
            Task { [weak self] in
                await self?.handleTaskOpened(task)
            }
        }

        bridge.onClose = { [weak self] task, error in
            Task { [weak self] in
                await self?.handleTaskClosed(task, error: error)
            }
        }

        pathObserver.onPathUpdate = { [weak self] path in
            Task { [weak self] in
                await self?.handleNetworkPathUpdate(path)
            }
        }
        pathObserver.start()
    }

    func setHandlers(
        onNotification: @escaping @Sendable (String, Data) -> Void,
        onStatusChange: @escaping @Sendable (ConnectionStatus) -> Void,
        onActiveEndpointChanged: (@Sendable (String) -> Void)? = nil
    ) {
        self.notificationHandler = onNotification
        self.statusChangeHandler = onStatusChange
        self.activeEndpointChangedHandler = onActiveEndpointChanged
    }

    func setCandidateEndpoints(_ endpoints: [String], activeEndpoint: String? = nil) {
        self.candidateEndpoints = endpoints
        if let active = activeEndpoint, let idx = endpoints.firstIndex(of: active) {
            self.activeCandidateIndex = idx
        } else if !endpoints.isEmpty {
            self.activeCandidateIndex = 0
        }
    }

    // MARK: - Connect

    func connect(endpoint: String, timeoutSeconds: TimeInterval = 6.0, isReconnecting: Bool = false) async throws {
        self.isIntentionallyDisconnected = false
        if !isReconnecting {
            self.reconnectTask?.cancel()
            self.reconnectTask = nil
            self.reconnectAttempt = 0
        }
        self.currentEndpoint = endpoint

        if let idx = candidateEndpoints.firstIndex(of: endpoint) {
            self.activeCandidateIndex = idx
        } else if !candidateEndpoints.contains(endpoint) {
            self.candidateEndpoints.append(endpoint)
            self.activeCandidateIndex = candidateEndpoints.count - 1
        }

        // Cancel previous task cleanly
        currentTask?.cancel(with: .goingAway, reason: nil)
        currentTask = nil
        failAllPendingRequests(error: NSError(domain: "ConnectionManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Switching connection"]))

        guard let url = URL(string: endpoint) else {
            self.status = .disconnected
            throw NSError(domain: "ConnectionManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL: \(endpoint)"])
        }

        self.status = .connecting(endpoint: endpoint)
        let task = session.webSocketTask(with: url)
        let taskId = ObjectIdentifier(task)

        do {
            try await withThrowingTaskGroup(of: Void.self) { group in
                group.addTask {
                    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                        Task { [weak self] in
                            await self?.registerOpenContinuation(taskId: taskId, continuation: continuation)
                            task.resume()
                        }
                    }
                }

                group.addTask {
                    try await Task.sleep(nanoseconds: UInt64(timeoutSeconds * 1_000_000_000))
                    throw NSError(
                        domain: "ConnectionManager",
                        code: -1001,
                        userInfo: [NSLocalizedDescriptionKey: "Connection timed out after \(Int(timeoutSeconds))s"]
                    )
                }

                try await group.next()
                group.cancelAll()
            }
        } catch {
            openContinuations.removeValue(forKey: taskId)
            task.cancel(with: .abnormalClosure, reason: nil)
            let wasIntentional = self.isIntentionallyDisconnected
            self.status = .disconnected
            if !wasIntentional && !isReconnecting && !candidateEndpoints.isEmpty {
                print("⚠️ [ConnectionManager] Initial connection to \(endpoint) failed: \(error). Triggering auto-failover...")
                handleDisconnect(endpoint: endpoint, reason: error)
            }
            throw error
        }

        self.currentTask = task
        self.status = .connected(endpoint: endpoint)
        self.reconnectAttempt = 0
        startHeartbeat(endpoint: endpoint, task: task)
        listenForMessages(task: task, endpoint: endpoint)
        activeEndpointChangedHandler?(endpoint)
    }

    // MARK: - Non-destructive Switch

    func switchToEndpoint(endpoint: String, timeoutSeconds: TimeInterval = 6.0) async throws {
        // If already connected to this exact endpoint, nothing to do
        if currentEndpoint == endpoint && status.isConnected {
            return
        }

        guard let url = URL(string: endpoint) else {
            throw NSError(domain: "ConnectionManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL: \(endpoint)"])
        }

        // Create new candidate task WITHOUT canceling current active task
        let newTask = session.webSocketTask(with: url)
        let taskId = ObjectIdentifier(newTask)

        do {
            try await withThrowingTaskGroup(of: Void.self) { group in
                group.addTask {
                    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                        Task { [weak self] in
                            await self?.registerOpenContinuation(taskId: taskId, continuation: continuation)
                            newTask.resume()
                        }
                    }
                }

                group.addTask {
                    try await Task.sleep(nanoseconds: UInt64(timeoutSeconds * 1_000_000_000))
                    throw NSError(
                        domain: "ConnectionManager",
                        code: -1001,
                        userInfo: [NSLocalizedDescriptionKey: "Connection timed out after \(Int(timeoutSeconds))s"]
                    )
                }

                try await group.next()
                group.cancelAll()
            }
        } catch {
            openContinuations.removeValue(forKey: taskId)
            newTask.cancel(with: .abnormalClosure, reason: nil)
            // Existing connection remains untouched!
            throw error
        }

        // Switch succeeded: stop previous heartbeat, cancel old task and swap to new task
        stopHeartbeat()
        currentTask?.cancel(with: .goingAway, reason: nil)
        failAllPendingRequests(error: NSError(domain: "ConnectionManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Switched endpoint"]))

        self.currentTask = newTask
        self.currentEndpoint = endpoint
        self.status = .connected(endpoint: endpoint)
        self.reconnectAttempt = 0

        if let idx = candidateEndpoints.firstIndex(of: endpoint) {
            self.activeCandidateIndex = idx
        } else {
            self.candidateEndpoints.append(endpoint)
            self.activeCandidateIndex = candidateEndpoints.count - 1
        }

        startHeartbeat(endpoint: endpoint, task: newTask)
        listenForMessages(task: newTask, endpoint: endpoint)
        activeEndpointChangedHandler?(endpoint)
    }

    private func registerOpenContinuation(taskId: ObjectIdentifier, continuation: CheckedContinuation<Void, Error>) {
        openContinuations[taskId] = continuation
    }

    private func handleTaskOpened(_ task: URLSessionWebSocketTask) {
        let id = ObjectIdentifier(task)
        if let cont = openContinuations.removeValue(forKey: id) {
            cont.resume()
        }
    }

    private func handleTaskClosed(_ task: URLSessionWebSocketTask, error: Error?) {
        let id = ObjectIdentifier(task)
        if let cont = openContinuations.removeValue(forKey: id) {
            let err = error ?? NSError(domain: "ConnectionManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Socket closed before opening"])
            cont.resume(throwing: err)
        }

        if task === currentTask {
            let ep = currentEndpoint ?? "unknown"
            handleDisconnect(endpoint: ep, reason: error)
        }
    }

    func disconnect() {
        self.isIntentionallyDisconnected = true
        stopHeartbeat()
        reconnectTask?.cancel()
        reconnectTask = nil
        deltaFlushTask?.cancel()
        deltaFlushTask = nil
        deltaBuffer.removeAll()
        currentTask?.cancel(with: .normalClosure, reason: nil)
        currentTask = nil
        self.status = .disconnected
        failAllPendingRequests(error: NSError(domain: "ConnectionManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Disconnected by user"]))
    }

    func sendRequest<P: Encodable & Sendable, R: Decodable & Sendable>(
        method: String,
        params: P?,
        timeoutSeconds: TimeInterval = 8.0
    ) async throws -> R {
        guard case .connected = status, let task = currentTask else {
            throw NSError(domain: "ConnectionManager", code: -2, userInfo: [NSLocalizedDescriptionKey: "WebSocket is not connected"])
        }

        let id = UUID().uuidString
        let request = JSONRPCRequest(id: id, method: method, params: params)
        let requestData = try JSONEncoder().encode(request)

        guard let jsonString = String(data: requestData, encoding: .utf8) else {
            throw NSError(domain: "ConnectionManager", code: -3, userInfo: [NSLocalizedDescriptionKey: "Failed to encode request string"])
        }

        let timeoutTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(timeoutSeconds * 1_000_000_000))
            await self?.handleRequestTimeout(id: id, method: method, timeoutSeconds: timeoutSeconds)
        }

        let rawResponse: Data = try await withCheckedThrowingContinuation { continuation in
            self.pendingRequests[id] = continuation

            Task {
                do {
                    try await task.send(.string(jsonString))
                } catch {
                    await self.failPendingRequest(id: id, error: error)
                }
            }
        }

        timeoutTask.cancel()
        return try rawResponse.decodeAs(R.self)
    }

    private func handleRequestTimeout(id: String, method: String, timeoutSeconds: TimeInterval) {
        if let continuation = pendingRequests.removeValue(forKey: id) {
            continuation.resume(throwing: NSError(
                domain: "ConnectionManager",
                code: -1001,
                userInfo: [NSLocalizedDescriptionKey: "Request '\(method)' timed out after \(Int(timeoutSeconds))s."]
            ))
        }
    }

    private func failPendingRequest(id: String, error: Error) {
        pendingRequests.removeValue(forKey: id)?.resume(throwing: error)
    }

    // MARK: - Message Loop

    private func listenForMessages(task: URLSessionWebSocketTask, endpoint: String) {
        task.receive { [weak self] result in
            guard let self = self else { return }

            Task {
                switch result {
                case .success(let message):
                    await self.handleIncomingMessage(message)
                    if await self.currentTask === task {
                        await self.listenForMessages(task: task, endpoint: endpoint)
                    }

                case .failure(let error):
                    if await self.currentTask === task {
                        print("⚠️ [ConnectionManager] Socket read error on \(endpoint): \(error)")
                        await self.handleDisconnect(endpoint: endpoint, reason: error)
                    }
                }
            }
        }
    }

    private func handleIncomingMessage(_ message: URLSessionWebSocketTask.Message) {
        let rawData: Data
        switch message {
        case .string(let text):
            guard let data = text.data(using: .utf8) else { return }
            rawData = data
        case .data(let data):
            rawData = data
        @unknown default:
            return
        }

        if let json = try? JSONSerialization.jsonObject(with: rawData) as? [String: Any] {
            if let id = json["id"] as? String, let continuation = pendingRequests.removeValue(forKey: id) {
                if let errorObj = json["error"] as? [String: Any],
                   let message = errorObj["message"] as? String {
                    continuation.resume(throwing: NSError(
                        domain: "HostServerRPC",
                        code: errorObj["code"] as? Int ?? -1,
                        userInfo: [NSLocalizedDescriptionKey: message]
                    ))
                } else {
                    continuation.resume(returning: rawData)
                }
                return
            }

            if let method = json["method"] as? String {
                let payloadData: Data
                if let paramsObj = json["params"],
                   let data = try? JSONSerialization.data(withJSONObject: paramsObj) {
                    payloadData = data
                } else {
                    payloadData = rawData
                }

                if method == "message.delta" {
                    if let payload = try? payloadData.decodeRPCParams(MessageDeltaPayload.self),
                       let text = payload.delta.text, !text.isEmpty {
                        bufferDelta(chatId: payload.chatId, messageId: payload.messageId, type: payload.delta.type, text: text)
                        return
                    }
                }

                flushDeltas()
                notificationHandler?(method, payloadData)
            }
        }
    }

    private func bufferDelta(chatId: String, messageId: String, type: String, text: String) {
        if let lastIdx = deltaBuffer.indices.last,
           deltaBuffer[lastIdx].chatId == chatId,
           deltaBuffer[lastIdx].messageId == messageId,
           deltaBuffer[lastIdx].type == type {
            deltaBuffer[lastIdx].text += text
        } else {
            deltaBuffer.append(BufferedDelta(chatId: chatId, messageId: messageId, type: type, text: text))
        }

        if deltaFlushTask == nil {
            deltaFlushTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 24_000_000)
                await self?.flushDeltas()
            }
        }
    }

    private func flushDeltas() {
        deltaFlushTask?.cancel()
        deltaFlushTask = nil

        guard !deltaBuffer.isEmpty else { return }

        let buffered = deltaBuffer
        deltaBuffer.removeAll()

        for item in buffered {
            let payload = MessageDeltaPayload(
                chatId: item.chatId,
                messageId: item.messageId,
                delta: MessageDeltaPayload.DeltaContent(type: item.type, text: item.text)
            )
            if let data = try? JSONEncoder().encode(payload) {
                notificationHandler?("message.delta", data)
            }
        }
    }

    private func handleDisconnect(endpoint: String, reason: Error? = nil) {
        stopHeartbeat()
        deltaFlushTask?.cancel()
        deltaFlushTask = nil
        deltaBuffer.removeAll()
        let disconnectError = reason ?? NSError(domain: "ConnectionManager", code: -4, userInfo: [NSLocalizedDescriptionKey: "Connection dropped"])
        failAllPendingRequests(error: disconnectError)
        currentTask = nil

        guard !isIntentionallyDisconnected else {
            self.status = .disconnected
            return
        }

        reconnectAttempt += 1
        reconnectTask?.cancel()

        let baseDelay = min(pow(1.5, Double(min(reconnectAttempt, 5))), maxReconnectBackoffSeconds)
        let jitter = Double.random(in: 0.1...0.3)
        let delay = max(0.5, baseDelay + jitter)

        reconnectTask = Task {
            await self.attemptFailoverReconnect(fallbackEndpoint: endpoint, delay: delay)
        }
    }

    // MARK: - Heartbeat & Path Monitoring

    private func startHeartbeat(endpoint: String, task: URLSessionWebSocketTask) {
        heartbeatTask?.cancel()
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 3_000_000_000) // 3 seconds
                guard !Task.isCancelled, let self = self else { break }

                let isStillCurrent = await self.isCurrentTask(task)
                guard isStillCurrent else { break }

                let pingSuccess = await self.pingWebSocket(task: task)
                if !pingSuccess {
                    guard !Task.isCancelled else { break }
                    let stillCurrent = await self.isCurrentTask(task)
                    if stillCurrent {
                        print("💔 [ConnectionManager] Heartbeat ping failed on \(endpoint). Triggering failover...")
                        await self.handleDisconnect(
                            endpoint: endpoint,
                            reason: NSError(domain: "ConnectionManager", code: -1005, userInfo: [NSLocalizedDescriptionKey: "Heartbeat ping timeout"])
                        )
                    }
                    break
                }
            }
        }
    }

    private func stopHeartbeat() {
        heartbeatTask?.cancel()
        heartbeatTask = nil
    }

    private func isCurrentTask(_ task: URLSessionWebSocketTask) -> Bool {
        return self.currentTask === task
    }

    private func pingWebSocket(task: URLSessionWebSocketTask) async -> Bool {
        await withCheckedContinuation { continuation in
            final class ResumeGate: @unchecked Sendable {
                private var resumed = false
                private let lock = NSLock()
                func resumeOnce(_ continuation: CheckedContinuation<Bool, Never>, returning value: Bool) {
                    lock.lock()
                    defer { lock.unlock() }
                    if !resumed {
                        resumed = true
                        continuation.resume(returning: value)
                    }
                }
            }

            let gate = ResumeGate()
            task.sendPing { error in
                if let error = error {
                    print("⚠️ [ConnectionManager] Ping error: \(error)")
                    gate.resumeOnce(continuation, returning: false)
                } else {
                    gate.resumeOnce(continuation, returning: true)
                }
            }
        }
    }

    private func handleNetworkPathUpdate(_ path: NWPath) async {
        guard case .connected(let endpoint) = status, let task = currentTask else {
            return
        }

        print("🌐 [ConnectionManager] Network path changed (status: \(path.status), interfaces: \(path.availableInterfaces.map { $0.name })). Verifying connection...")

        if path.status != .satisfied {
            print("⚠️ [ConnectionManager] Network path unsatisfied. Immediate disconnect...")
            handleDisconnect(
                endpoint: endpoint,
                reason: NSError(domain: "ConnectionManager", code: -1009, userInfo: [NSLocalizedDescriptionKey: "Network path unsatisfied"])
            )
            return
        }

        // Network changed (e.g. Tailscale VPN turned off, Wi-Fi switched). Test active socket immediately
        let alive = await pingWebSocket(task: task)
        if !alive && currentTask === task {
            print("💔 [ConnectionManager] Socket unreachable after network interface change. Failing over from \(endpoint)...")
            handleDisconnect(
                endpoint: endpoint,
                reason: NSError(domain: "ConnectionManager", code: -1005, userInfo: [NSLocalizedDescriptionKey: "Unreachable after interface change"])
            )
        }
    }

    private func attemptFailoverReconnect(fallbackEndpoint: String, delay: TimeInterval) async {
        guard !isIntentionallyDisconnected && currentTask == nil else { return }

        // Probe health of all candidate endpoints concurrently (short timeout for quick failover)
        var targetEndpoint = fallbackEndpoint
        if candidateEndpoints.count > 1 {
            let healthMap = await EndpointHealthChecker.shared.checkAll(endpoints: candidateEndpoints, timeoutSeconds: 1.5)

            // Filter for endpoints that are confirmed Live
            let liveCandidates = candidateEndpoints.filter { healthMap[$0]?.isLive == true }

            if let bestLive = liveCandidates.min(by: {
                (healthMap[$0]?.latencyMs ?? 999999) < (healthMap[$1]?.latencyMs ?? 999999)
            }) {
                targetEndpoint = bestLive
                if let idx = candidateEndpoints.firstIndex(of: bestLive) {
                    activeCandidateIndex = idx
                }
                print("🔀 [ConnectionManager] Auto-failover: Found live endpoint \(targetEndpoint) (\(healthMap[bestLive]?.latencyMs.map { "\($0)ms" } ?? "live"))")
            } else {
                // If none responded to health check yet, rotate to an alternate candidate endpoint
                let otherCandidates = candidateEndpoints.filter { $0 != fallbackEndpoint }
                if let alternate = otherCandidates.first {
                    targetEndpoint = alternate
                    if let idx = candidateEndpoints.firstIndex(of: alternate) {
                        activeCandidateIndex = idx
                    }
                } else {
                    let nextIdx = (activeCandidateIndex + 1) % candidateEndpoints.count
                    activeCandidateIndex = nextIdx
                    targetEndpoint = candidateEndpoints[nextIdx]
                }
                print("🔄 [ConnectionManager] Auto-failover: No live endpoint confirmed yet, rotating to candidate: \(targetEndpoint)")
            }
        }

        self.status = .reconnecting(attempt: reconnectAttempt, endpoint: targetEndpoint)

        // For attempt 1, sleep very briefly (e.g. 0.3s) so user experiences instantaneous failover
        let actualDelay = reconnectAttempt == 1 ? min(delay, 0.3) : delay
        try? await Task.sleep(nanoseconds: UInt64(actualDelay * 1_000_000_000))

        guard !isIntentionallyDisconnected && currentTask == nil else { return }

        print("🔄 [ConnectionManager] Auto-failover / Reconnecting (attempt \(reconnectAttempt)) to \(targetEndpoint)")
        do {
            try await self.connect(endpoint: targetEndpoint, isReconnecting: true)
            print("✅ [ConnectionManager] Auto-failover / Reconnect succeeded on \(targetEndpoint)")
        } catch {
            print("⚠️ [ConnectionManager] Reconnect attempt failed on \(targetEndpoint): \(error)")
            // Retry next cycle if not intentionally disconnected
            if !isIntentionallyDisconnected && currentTask == nil {
                handleDisconnect(endpoint: targetEndpoint, reason: error)
            }
        }
    }

    private func failAllPendingRequests(error: Error) {
        for (_, continuation) in pendingRequests {
            continuation.resume(throwing: error)
        }
        pendingRequests.removeAll()
    }
}

private extension Data {
    func decodeAs<T: Decodable>(_ type: T.Type) throws -> T {
        if let json = try JSONSerialization.jsonObject(with: self) as? [String: Any],
           let resultObj = json["result"] {
            let resultData = try JSONSerialization.data(withJSONObject: resultObj)
            return try JSONDecoder().decode(T.self, from: resultData)
        }
        return try JSONDecoder().decode(T.self, from: self)
    }
}
