import Foundation
import SwiftUI

@Observable
@MainActor
final class AppSessionState {
    static let shared = AppSessionState()

    var connectionStatus: ConnectionStatus = .disconnected
    var pairedHostName: String?
    var pairedEndpoint: String?
    var hostPublicKey: String?

    var chats: [Chat] = []
    var workspaces: [Workspace] = []
    var models: [ModelInfo] = []
    var selectedModel: String? = "gpt-5-codex"
    var selectedEffort: String = "medium"
    var pendingApprovals: [ApprovalRequest] = []
    var errorMessage: String?

    private let connectionManager = ConnectionManager.shared

    private init() {
        if let savedEndpoint = UserDefaults.standard.string(forKey: "paired_endpoint"),
           let savedHost = UserDefaults.standard.string(forKey: "paired_host_name") {
            self.pairedEndpoint = savedEndpoint
            self.pairedHostName = savedHost
        }

        setupConnectionHandlers()
    }

    private func setupConnectionHandlers() {
        Task {
            await connectionManager.setHandlers(
                onNotification: { [weak self] method, data in
                    Task { @MainActor in
                        self?.handleNotification(method: method, data: data)
                    }
                },
                onStatusChange: { [weak self] status in
                    Task { @MainActor in
                        self?.connectionStatus = status
                        if case .connected = status {
                            Task {
                                await self?.refreshAll()
                            }
                        }
                    }
                }
            )

            if let endpoint = pairedEndpoint {
                await connectionManager.connect(endpoint: endpoint)
            }
        }
    }

    func connectToSavedHost() {
        guard let endpoint = pairedEndpoint else { return }
        Task {
            await connectionManager.connect(endpoint: endpoint)
        }
    }

    func pair(
        endpoints: [String],
        token: String,
        hostName: String
    ) async throws {
        let pubKey = try KeyManager.shared.publicKeyHex()
        let signature = try KeyManager.shared.signToken(token)
        let deviceName = UIDevice.current.name

        var lastError: Error?

        for ep in endpoints {
            do {
                print("🔌 [Pairing] Trying endpoint: \(ep)")
                await connectionManager.connect(endpoint: ep)

                try await Task.sleep(nanoseconds: 500_000_000)

                struct PairParams: Encodable, Sendable {
                    let token: String
                    let clientPublicKey: String
                    let signature: String
                    let deviceName: String
                    let platform: String
                }

                struct PairResult: Decodable, Sendable {
                    let status: String
                    let hostPublicKey: String?
                }

                let params = PairParams(
                    token: token,
                    clientPublicKey: pubKey,
                    signature: signature,
                    deviceName: deviceName,
                    platform: "ios"
                )

                let result: PairResult = try await connectionManager.sendRequest(
                    method: "pairing.exchange",
                    params: params
                )

                if result.status == "paired" {
                    self.pairedEndpoint = ep
                    self.pairedHostName = hostName
                    self.hostPublicKey = result.hostPublicKey

                    UserDefaults.standard.set(ep, forKey: "paired_endpoint")
                    UserDefaults.standard.set(hostName, forKey: "paired_host_name")

                    await refreshAll()
                    return
                }
            } catch {
                print("⚠️ [Pairing] Failed on \(ep): \(error)")
                lastError = error
            }
        }

        throw lastError ?? NSError(domain: "Pairing", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to pair on any host endpoint"])
    }

    func unpair() {
        Task {
            await connectionManager.disconnect()
            UserDefaults.standard.removeObject(forKey: "paired_endpoint")
            UserDefaults.standard.removeObject(forKey: "paired_host_name")
            self.pairedEndpoint = nil
            self.pairedHostName = nil
            self.chats = []
            self.workspaces = []
            self.models = []
            self.pendingApprovals = []
        }
    }

    func refreshAll() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadChats() }
            group.addTask { await self.loadWorkspaces() }
            group.addTask { await self.loadModels() }
        }
    }

    func loadChats() async {
        do {
            struct EmptyParams: Encodable, Sendable {}
            struct ChatListResult: Decodable, Sendable {
                let chats: [Chat]
            }

            let result: ChatListResult = try await connectionManager.sendRequest(
                method: "chat.list",
                params: EmptyParams()
            )
            self.chats = result.chats
        } catch {
            print("⚠️ [AppSessionState] Failed to load chats: \(error)")
        }
    }

    func loadWorkspaces() async {
        do {
            struct EmptyParams: Encodable, Sendable {}
            struct WorkspaceListResult: Decodable, Sendable {
                let workspaces: [Workspace]
            }

            let result: WorkspaceListResult = try await connectionManager.sendRequest(
                method: "workspace.list",
                params: EmptyParams()
            )
            self.workspaces = result.workspaces
        } catch {
            print("⚠️ [AppSessionState] Failed to load workspaces: \(error)")
        }
    }

    func updateWorkspace(id: String, name: String?, rootPath: String?) async throws {
        struct WorkspaceUpdateParams: Encodable, Sendable {
            let workspaceId: String
            let name: String?
            let rootPath: String?
        }
        struct WorkspaceUpdateResult: Decodable, Sendable {
            let workspace: Workspace
        }

        let params = WorkspaceUpdateParams(
            workspaceId: id,
            name: name,
            rootPath: rootPath
        )
        let result: WorkspaceUpdateResult = try await connectionManager.sendRequest(
            method: "workspace.update",
            params: params
        )
        if let idx = self.workspaces.firstIndex(where: { $0.id == id }) {
            self.workspaces[idx] = result.workspace
        }
    }

    func deleteWorkspace(id: String) async throws {
        struct WorkspaceDeleteParams: Encodable, Sendable {
            let workspaceId: String
        }
        struct WorkspaceDeleteResult: Decodable, Sendable {
            let success: Bool
        }

        let _: WorkspaceDeleteResult = try await connectionManager.sendRequest(
            method: "workspace.delete",
            params: WorkspaceDeleteParams(workspaceId: id)
        )
        self.workspaces.removeAll { $0.id == id }
        self.chats.removeAll { $0.workspaceId == id }
    }

    func loadModels() async {
        do {
            struct EmptyParams: Encodable, Sendable {}
            let result: ModelListResult = try await connectionManager.sendRequest(
                method: "model.list",
                params: EmptyParams()
            )
            if !result.models.isEmpty {
                self.models = result.models
                if let cur = result.currentModel {
                    self.selectedModel = cur
                } else if selectedModel == nil || !result.models.contains(where: { $0.model == selectedModel }) {
                    if let def = result.models.first(where: { $0.isDefault }) {
                        self.selectedModel = def.model
                    } else if let first = result.models.first {
                        self.selectedModel = first.model
                    }
                }
                if let curEffort = result.currentReasoningEffort {
                    self.selectedEffort = curEffort
                }
                if let active = activeChatViewModel {
                    if let sel = self.selectedModel {
                        active.selectedModel = sel
                    }
                    active.selectedEffort = self.selectedEffort
                }
            }
        } catch {
            print("⚠️ [AppSessionState] Failed to load models: \(error)")
        }
    }

    func updateSelectedModel(_ model: String, effort: String?) {
        self.selectedModel = model
        if let effort {
            self.selectedEffort = effort
        }
        if let active = activeChatViewModel {
            active.selectedModel = model
            if let effort {
                active.selectedEffort = effort
            }
        }
        Task {
            struct ModelSetParams: Encodable, Sendable {
                let model: String
                let reasoningEffort: String?
            }
            struct ModelSetResult: Decodable, Sendable {
                let success: Bool
            }
            do {
                let _: ModelSetResult = try await connectionManager.sendRequest(
                    method: "model.set",
                    params: ModelSetParams(model: model, reasoningEffort: effort)
                )
            } catch {
                print("⚠️ [AppSessionState] Failed to set model remotely: \(error)")
            }
        }
    }

    func createChat(title: String, workspaceId: String?) async throws -> Chat {
        struct CreateChatParams: Encodable, Sendable {
            let kind: String
            let title: String
            let workspaceId: String?
            let providerId: String
        }

        struct CreateChatResult: Decodable, Sendable {
            let chat: Chat
        }

        let params = CreateChatParams(
            kind: workspaceId != nil ? "workspace" : "standalone",
            title: title.isEmpty ? "New Chat" : title,
            workspaceId: workspaceId,
            providerId: "codex"
        )

        let result: CreateChatResult = try await connectionManager.sendRequest(
            method: "chat.create",
            params: params
        )
        if !self.chats.contains(where: { $0.id == result.chat.id }) {
            self.chats.insert(result.chat, at: 0)
        }
        return result.chat
    }

    func deleteChat(chatId: String) async {
        struct DeleteParams: Encodable, Sendable {
            let chatId: String
        }
        do {
            struct DeleteResult: Decodable, Sendable {
                let success: Bool
            }
            let _: DeleteResult = try await connectionManager.sendRequest(
                method: "chat.delete",
                params: DeleteParams(chatId: chatId)
            )
            self.chats.removeAll { $0.id == chatId }
        } catch {
            print("⚠️ [AppSessionState] Failed to delete chat: \(error)")
        }
    }

    func respondToApproval(approvalId: String, decision: String) async {
        struct ApprovalParams: Encodable, Sendable {
            let approvalId: String
            let decision: String
        }
        do {
            struct ApprovalResult: Decodable, Sendable {
                let status: String
            }
            let _: ApprovalResult = try await connectionManager.sendRequest(
                method: "approval.respond",
                params: ApprovalParams(approvalId: approvalId, decision: decision)
            )
            self.pendingApprovals.removeAll { $0.id == approvalId }
        } catch {
            print("⚠️ [AppSessionState] Failed to respond to approval: \(error)")
        }
    }

    var activeChatViewModel: ChatViewModel?

    // MARK: - Notifications

    private func handleNotification(method: String, data: Data) {
        // Forward event to active chat screen
        activeChatViewModel?.handleNotification(method: method, data: data)

        switch method {
        case "approval.requested":
            if let payload = try? data.decodeRPCParams(ApprovalRequestedPayload.self) {
                if !pendingApprovals.contains(where: { $0.id == payload.approval.id }) {
                    self.pendingApprovals.append(payload.approval)
                }
            }

        case "chat.created":
            if let payload = try? data.decodeRPCParams(ChatCreatedPayload.self) {
                if !chats.contains(where: { $0.id == payload.chat.id }) {
                    chats.insert(payload.chat, at: 0)
                }
            }

        case "chat.updated", "title.updated":
            if let payload = try? data.decodeRPCParams(ChatTitleUpdatedPayload.self) {
                if let idx = chats.firstIndex(where: { $0.id == payload.chatId }) {
                    chats[idx] = chats[idx].with(title: payload.title)
                }
            }

        case "chat.deleted":
            if let payload = try? data.decodeRPCParams(ChatDeletedPayload.self) {
                chats.removeAll { $0.id == payload.chatId }
            }

        case "turn.completed":
            if let payload = try? data.decodeRPCParams(TurnCompletedPayload.self) {
                if let idx = chats.firstIndex(where: { $0.id == payload.chatId }) {
                    chats[idx] = chats[idx].with(status: payload.status)
                }
            }

        case "message.created":
            if let payload = try? data.decodeRPCParams(MessageCreatedPayload.self) {
                if payload.message.role == .agent && payload.message.streaming {
                    if let idx = chats.firstIndex(where: { $0.id == payload.chatId }) {
                        chats[idx] = chats[idx].with(status: .running)
                    }
                }
            }

        case "model.updated":
            if let payload = try? data.decodeRPCParams(ModelUpdatedPayload.self) {
                self.selectedModel = payload.model
                if let eff = payload.reasoningEffort {
                    self.selectedEffort = eff
                }
                if let active = activeChatViewModel {
                    active.selectedModel = payload.model
                    if let eff = payload.reasoningEffort {
                        active.selectedEffort = eff
                    }
                }
            }

        case "workspace.updated":
            if let payload = try? data.decodeRPCParams(WorkspaceUpdatedPayload.self) {
                if let idx = workspaces.firstIndex(where: { $0.id == payload.workspace.id }) {
                    workspaces[idx] = payload.workspace
                } else {
                    workspaces.insert(payload.workspace, at: 0)
                }
            }

        case "workspace.deleted":
            if let payload = try? data.decodeRPCParams(WorkspaceDeletedPayload.self) {
                workspaces.removeAll { $0.id == payload.workspaceId }
                chats.removeAll { $0.workspaceId == payload.workspaceId }
            }

        default:
            break
        }
    }
}
