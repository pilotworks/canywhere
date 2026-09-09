import Foundation

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

actor ConnectionManager {
    static let shared = ConnectionManager()

    private var currentTask: URLSessionWebSocketTask?
    private var currentEndpoint: String?
    private var session: URLSession
    private var isIntentionallyDisconnected = false

    private var pendingRequests: [String: CheckedContinuation<Data, Error>] = [:]
    private var notificationHandler: (@Sendable (String, Data) -> Void)?
    private var statusChangeHandler: (@Sendable (ConnectionStatus) -> Void)?

    private var reconnectAttempt = 0
    private let maxReconnectBackoffSeconds: Double = 16.0

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
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
    }

    func setHandlers(
        onNotification: @escaping @Sendable (String, Data) -> Void,
        onStatusChange: @escaping @Sendable (ConnectionStatus) -> Void
    ) {
        self.notificationHandler = onNotification
        self.statusChangeHandler = onStatusChange
    }

    func connect(endpoint: String) {
        self.isIntentionallyDisconnected = false
        self.currentEndpoint = endpoint
        self.reconnectAttempt = 0
        performConnect(endpoint: endpoint)
    }

    private func performConnect(endpoint: String) {
        currentTask?.cancel(with: .goingAway, reason: nil)

        guard let url = URL(string: endpoint) else {
            print("❌ [ConnectionManager] Invalid WebSocket URL: \(endpoint)")
            self.status = .disconnected
            return
        }

        self.status = .connecting(endpoint: endpoint)
        let task = session.webSocketTask(with: url)
        self.currentTask = task
        task.resume()

        listenForMessages(task: task, endpoint: endpoint)
        // Mark as connected once task is resumed; message receive loop will verify health
        self.status = .connected(endpoint: endpoint)
        self.reconnectAttempt = 0
    }

    func disconnect() {
        self.isIntentionallyDisconnected = true
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
        params: P?
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

        return try await withCheckedThrowingContinuation { continuation in
            pendingRequests[id] = continuation

            Task {
                do {
                    try await task.send(.string(jsonString))
                } catch {
                    self.pendingRequests.removeValue(forKey: id)?.resume(throwing: error)
                }
            }
        }
        .decodeAs(R.self)
    }

    // MARK: - Message Loop

    private func listenForMessages(task: URLSessionWebSocketTask, endpoint: String) {
        task.receive { [weak self] result in
            guard let self = self else { return }

            Task {
                switch result {
                case .success(let message):
                    await self.handleIncomingMessage(message)
                    // Continue listening if still the active task
                    if await self.currentTask === task {
                        await self.listenForMessages(task: task, endpoint: endpoint)
                    }

                case .failure(let error):
                    print("⚠️ [ConnectionManager] Socket error: \(error)")
                    await self.handleDisconnect(endpoint: endpoint)
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

        // Try decoding as response with ID
        if let json = try? JSONSerialization.jsonObject(with: rawData) as? [String: Any] {
            if let id = json["id"] as? String, let continuation = pendingRequests.removeValue(forKey: id) {
                if let errorObj = json["error"] as? [String: Any],
                   let message = errorObj["message"] as? String {
                    continuation.resume(throwing: NSError(domain: "HostServerRPC", code: errorObj["code"] as? Int ?? -1, userInfo: [NSLocalizedDescriptionKey: message]))
                } else {
                    continuation.resume(returning: rawData)
                }
                return
            }

            // Notification (has method, no id)
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

                // Flush pending deltas before any non-delta notification to maintain order
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
                try? await Task.sleep(nanoseconds: 24_000_000) // ~40 fps batching
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

    private func handleDisconnect(endpoint: String) {
        deltaFlushTask?.cancel()
        deltaFlushTask = nil
        deltaBuffer.removeAll()
        failAllPendingRequests(error: NSError(domain: "ConnectionManager", code: -4, userInfo: [NSLocalizedDescriptionKey: "Connection dropped"]))
        currentTask = nil

        guard !isIntentionallyDisconnected else {
            self.status = .disconnected
            return
        }

        reconnectAttempt += 1
        self.status = .reconnecting(attempt: reconnectAttempt, endpoint: endpoint)

        let baseDelay = min(pow(2.0, Double(reconnectAttempt - 1)), maxReconnectBackoffSeconds)
        let jitter = Double.random(in: 0.0...1.0)
        let delay = baseDelay + jitter

        Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            if !self.isIntentionallyDisconnected && self.currentTask == nil {
                print("🔄 [ConnectionManager] Reconnecting (attempt \(self.reconnectAttempt)) to \(endpoint)")
                self.performConnect(endpoint: endpoint)
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
        // Handle standard JSON-RPC response wrapper { "jsonrpc": "2.0", "result": ... }
        if let json = try JSONSerialization.jsonObject(with: self) as? [String: Any],
           let resultObj = json["result"] {
            let resultData = try JSONSerialization.data(withJSONObject: resultObj)
            return try JSONDecoder().decode(T.self, from: resultData)
        }
        return try JSONDecoder().decode(T.self, from: self)
    }
}
