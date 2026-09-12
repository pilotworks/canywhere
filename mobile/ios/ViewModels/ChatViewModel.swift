import Foundation
import SwiftUI

struct ChatGetParams: Encodable, Sendable {
    let chatId: String
}

struct ChatGetResult: Decodable, Sendable {
    let chat: Chat
    let messages: [Message]
    let pendingApprovals: [ApprovalRequest]
    let queuedMessages: [QueuedMessage]?
}

@Observable
@MainActor
final class ChatViewModel {
    let chatId: String
    var chat: Chat?
    var messages: [Message] = []
    var pendingApprovals: [ApprovalRequest] = []
    var isSending: Bool = false
    var isRunning: Bool = false
    var selectedModel: String?
    var selectedEffort: String = "medium"
    var permissionMode: PermissionMode = .onRequest
    var queuedMessages: [QueuedMessage] = []
    var activeTurnId: String? = nil

    // Scoped active streaming state to prevent full-list re-renders
    var streamingMessageId: String? = nil
    var streamingText: String = ""
    var scrollTrigger: Int = 0
    private var lastScrollTime: Double = 0

    private let connectionManager = ConnectionManager.shared

    init(chatId: String) {
        self.chatId = chatId
        self.selectedModel = AppSessionState.shared.selectedModel
        self.selectedEffort = AppSessionState.shared.selectedEffort
    }

    func loadChat() async {
        do {
            let result: ChatGetResult = try await connectionManager.sendRequest(
                method: "chat.get",
                params: ChatGetParams(chatId: chatId)
            )
            self.chat = result.chat
            self.permissionMode = result.chat.permissionMode ?? .onRequest
            self.messages = result.messages
            self.queuedMessages = result.queuedMessages ?? []
            let hasStreamingMsg = result.messages.contains(where: { $0.streaming && $0.role == .agent })
            self.isRunning = (result.chat.status == .running || result.chat.status == .awaitingApproval || hasStreamingMsg)
            let streamingMsg = result.messages.last(where: { $0.streaming && $0.role == .agent })
            self.streamingMessageId = streamingMsg?.id
            self.activeTurnId = streamingMsg?.turnID
            self.streamingText = ""
        } catch {
            print("⚠️ [ChatViewModel] Failed to get chat: \(error)")
        }
    }

    func setPermissionMode(_ mode: PermissionMode) async {
        self.permissionMode = mode
        if let currentChat = self.chat {
            self.chat = currentChat.with(permissionMode: .some(mode))
        }

        struct SetPermissionParams: Encodable, Sendable {
            let chatId: String
            let permissionMode: PermissionMode
        }
        struct SetPermissionResult: Decodable, Sendable {
            let success: Bool
            let permissionMode: PermissionMode
        }

        do {
            let _: SetPermissionResult = try await connectionManager.sendRequest(
                method: "chat.setPermission",
                params: SetPermissionParams(chatId: chatId, permissionMode: mode)
            )
        } catch {
            print("⚠️ [ChatViewModel] Failed to set permission mode: \(error)")
        }
    }

    func submitTurn(content: String) async {
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        self.isRunning = true
        self.isSending = true

        do {
            struct TurnSendRequestParams: Encodable, Sendable {
                let chatId: String
                let content: String
                let clientMessageId: String?
                let model: String?
                let reasoningEffort: String?
                let permissionMode: PermissionMode?
            }

            struct TurnSendResponseResult: Decodable, Sendable {
                let turnId: String
                let status: String
            }

            let params = TurnSendRequestParams(
                chatId: chatId,
                content: content,
                clientMessageId: nil,
                model: selectedModel,
                reasoningEffort: selectedEffort,
                permissionMode: permissionMode
            )

            let res: TurnSendResponseResult = try await connectionManager.sendRequest(
                method: "turn.send",
                params: params
            )
            self.activeTurnId = res.turnId
        } catch {
            print("❌ [ChatViewModel] Failed to send turn: \(error)")
            self.isRunning = false
            self.activeTurnId = nil
        }
        self.isSending = false
    }

    func interrupt() async {
        struct InterruptParams: Encodable, Sendable {
            let chatId: String
            let turnId: String?
        }
        do {
            struct InterruptResult: Decodable, Sendable {
                let success: Bool
            }
            let _: InterruptResult = try await connectionManager.sendRequest(
                method: "turn.interrupt",
                params: InterruptParams(chatId: chatId, turnId: activeTurnId)
            )
            self.isRunning = false
            self.activeTurnId = nil
        } catch {
            print("⚠️ [ChatViewModel] Interrupt failed: \(error)")
            self.isRunning = false
            self.activeTurnId = nil
        }
    }

    // MARK: - Message Queue & Steer

    func enqueuePrompt(content: String) {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let tempItem = QueuedMessage(
            chatId: chatId,
            content: trimmed,
            model: selectedModel,
            reasoningEffort: selectedEffort,
            permissionMode: permissionMode
        )
        queuedMessages.append(tempItem)

        struct QueueAddParams: Encodable, Sendable {
            let chatId: String
            let content: String
            let model: String?
            let reasoningEffort: String?
            let permissionMode: PermissionMode?
        }

        Task {
            do {
                let _: QueuedMessage = try await connectionManager.sendRequest(
                    method: "queue.add",
                    params: QueueAddParams(
                        chatId: chatId,
                        content: trimmed,
                        model: selectedModel,
                        reasoningEffort: selectedEffort,
                        permissionMode: permissionMode
                    )
                )
            } catch {
                print("⚠️ [ChatViewModel] Failed to add message to queue: \(error)")
            }
        }
    }

    func removeQueuedPrompt(id: String) {
        queuedMessages.removeAll(where: { $0.id == id })

        struct QueueRemoveParams: Encodable, Sendable {
            let chatId: String
            let queueId: String
        }

        Task {
            do {
                struct RemoveResult: Decodable, Sendable { let success: Bool }
                let _: RemoveResult = try await connectionManager.sendRequest(
                    method: "queue.remove",
                    params: QueueRemoveParams(chatId: chatId, queueId: id)
                )
            } catch {
                print("⚠️ [ChatViewModel] Failed to remove message from queue: \(error)")
            }
        }
    }

    func updateQueuedPrompt(id: String, newContent: String) {
        let trimmed = newContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            removeQueuedPrompt(id: id)
            return
        }
        if let idx = queuedMessages.firstIndex(where: { $0.id == id }) {
            queuedMessages[idx].content = trimmed
        }

        struct QueueUpdateParams: Encodable, Sendable {
            let chatId: String
            let queueId: String
            let content: String
        }

        Task {
            do {
                struct UpdateResult: Decodable, Sendable { let success: Bool }
                let _: UpdateResult = try await connectionManager.sendRequest(
                    method: "queue.update",
                    params: QueueUpdateParams(chatId: chatId, queueId: id, content: trimmed)
                )
            } catch {
                print("⚠️ [ChatViewModel] Failed to update message in queue: \(error)")
            }
        }
    }

    func steerQueuedPrompt(id: String) async {
        queuedMessages.removeAll(where: { $0.id == id })

        struct QueueSteerParams: Encodable, Sendable {
            let chatId: String
            let queueId: String
        }

        do {
            struct SteerResult: Decodable, Sendable {
                let success: Bool
                let turnId: String?
                let status: String?
            }
            let res: SteerResult = try await connectionManager.sendRequest(
                method: "queue.steer",
                params: QueueSteerParams(chatId: chatId, queueId: id)
            )
            if let tId = res.turnId {
                self.activeTurnId = tId
            }
            self.isRunning = true
        } catch {
            print("⚠️ [ChatViewModel] Failed to steer queued message: \(error)")
        }
    }

    func steerTurn(turnId: String, content: String) async {
        struct SteerParams: Encodable, Sendable {
            let chatId: String
            let turnId: String
            let content: String
        }
        struct SteerResult: Decodable, Sendable {
            let turnId: String
            let status: String
        }
        do {
            let res: SteerResult = try await connectionManager.sendRequest(
                method: "turn.steer",
                params: SteerParams(chatId: chatId, turnId: turnId, content: content)
            )
            self.activeTurnId = res.turnId
            self.isRunning = true
        } catch {
            print("❌ [ChatViewModel] Failed to steer turn: \(error)")
        }
    }

    func processNextQueuedItem() async {
        // Host Server auto-dispatches queued messages on turn.completed autonomously
    }

    // MARK: - Workspace File Search & Slash Commands

    func searchWorkspaceFiles(query: String) async -> [FuzzyFileMatchItem] {
        guard let wsId = chat?.workspaceID else { return [] }
        struct SearchParams: Encodable, Sendable {
            let workspaceId: String
            let query: String
            let cancellationToken: String?
        }
        do {
            let res: WorkspaceFileSearchResult = try await connectionManager.sendRequest(
                method: "workspace.searchFiles",
                params: SearchParams(workspaceId: wsId, query: query, cancellationToken: nil)
            )
            return res.files
        } catch {
            print("⚠️ [ChatViewModel] workspace.searchFiles failed: \(error)")
            return []
        }
    }

    func reviewChat() async {
        struct ReviewParams: Encodable, Sendable {
            let chatId: String
        }
        do {
            struct ReviewResult: Decodable, Sendable {
                let success: Bool?
            }
            let _: ReviewResult = try await connectionManager.sendRequest(
                method: "chat.review",
                params: ReviewParams(chatId: chatId)
            )
        } catch {
            print("⚠️ [ChatViewModel] chat.review failed: \(error)")
        }
    }

    func compactChat() async {
        struct CompactParams: Encodable, Sendable {
            let chatId: String
        }
        do {
            struct CompactResult: Decodable, Sendable {
                let success: Bool?
            }
            let _: CompactResult = try await connectionManager.sendRequest(
                method: "chat.compact",
                params: CompactParams(chatId: chatId)
            )
        } catch {
            print("⚠️ [ChatViewModel] chat.compact failed: \(error)")
        }
    }

    func executeCommand(command: String, args: String? = nil) async {
        struct ExecuteCommandParams: Encodable, Sendable {
            let chatId: String
            let command: String
            let args: String?
        }
        struct ExecuteCommandResult: Decodable, Sendable {
            let success: Bool
            let message: String?
        }
        do {
            self.isRunning = true
            let _: ExecuteCommandResult = try await connectionManager.sendRequest(
                method: "chat.executeCommand",
                params: ExecuteCommandParams(chatId: chatId, command: command, args: args)
            )
        } catch {
            print("⚠️ [ChatViewModel] chat.executeCommand failed for \(command): \(error)")
            self.isRunning = false
        }
    }

    // MARK: - Event Handlers

    func handleNotification(method: String, data: Data) {
        switch method {
        case "chat.updated", "title.updated":
            do {
                let payload = try data.decodeRPCParams(ChatUpdatedPayload.self)
                print("📩 [ChatViewModel] chat.updated for \(payload.chatId) (current=\(chatId)): perm=\(String(describing: payload.permissionMode))")
                guard payload.chatId == chatId else { return }
                if let title = payload.title {
                    self.chat = self.chat?.with(title: title)
                }
                if let perm = payload.permissionMode {
                    self.permissionMode = perm
                    self.chat = self.chat?.with(permissionMode: .some(perm))
                }
            } catch {
                print("⚠️ [ChatViewModel] Failed to decode chat.updated: \(error)")
            }

        case "message.created":
            do {
                let payload = try data.decodeRPCParams(MessageCreatedPayload.self)
                guard payload.chatId == chatId else { return }
                if let idx = messages.firstIndex(where: { $0.id == payload.message.id }) {
                    messages[idx] = payload.message
                } else {
                    messages.append(payload.message)
                }
                if payload.message.role == .agent && payload.message.streaming {
                    self.streamingMessageId = payload.message.id
                    self.activeTurnId = payload.message.turnID ?? self.activeTurnId
                    self.streamingText = ""
                    self.isRunning = true
                    self.scrollTrigger &+= 1
                }
            } catch {
                print("❌ [ChatViewModel] Failed to decode message.created: \(error)")
            }

        case "message.delta":
            do {
                let payload = try data.decodeRPCParams(MessageDeltaPayload.self)
                guard payload.chatId == chatId, let text = payload.delta.text, !text.isEmpty else { return }

                let targetIndex: Int?
                if let idx = messages.firstIndex(where: { $0.id == payload.messageId }) {
                    targetIndex = idx
                } else if let sId = streamingMessageId, let idx = messages.firstIndex(where: { $0.id == sId }) {
                    targetIndex = idx
                } else if let idx = messages.lastIndex(where: { $0.role == .agent && $0.streaming }) {
                    targetIndex = idx
                } else {
                    targetIndex = nil
                }

                if let idx = targetIndex {
                    var blocks = messages[idx].blocks
                    if payload.delta.type == "reasoning" {
                        if let lastIdx = blocks.indices.last, blocks[lastIdx].type == .reasoning && !(blocks[lastIdx].completed ?? true) {
                            let existing = blocks[lastIdx].content ?? ""
                            blocks[lastIdx] = .reasoning(existing + text, completed: false)
                        } else {
                            // Finalize any earlier uncompleted reasoning blocks
                            for bIdx in blocks.indices {
                                if blocks[bIdx].type == .reasoning && !(blocks[bIdx].completed ?? true) {
                                    blocks[bIdx] = .reasoning(blocks[bIdx].content ?? "", completed: true)
                                }
                            }
                            blocks.append(.reasoning(text, completed: false))
                        }
                    } else {
                        // text delta: finalize any in-progress reasoning block
                        if let lastIdx = blocks.indices.last, blocks[lastIdx].type == .reasoning, !(blocks[lastIdx].completed ?? true) {
                            let existing = blocks[lastIdx].content ?? ""
                            blocks[lastIdx] = .reasoning(existing, completed: true)
                        }
                        if let lastIdx = blocks.indices.last, blocks[lastIdx].type == .text {
                            let existing = blocks[lastIdx].content ?? ""
                            blocks[lastIdx] = .text(existing + text)
                        } else {
                            blocks.append(.text(text))
                        }
                    }
                    messages[idx] = messages[idx].with(blocks: blocks)
                    self.streamingMessageId = messages[idx].id
                }

                // Throttle scroll triggers to at most once per 100ms
                let now = CACurrentMediaTime()
                if now - lastScrollTime > 0.1 {
                    lastScrollTime = now
                    scrollTrigger &+= 1
                }
            } catch {
                print("❌ [ChatViewModel] Failed to decode message.delta: \(error)")
            }

        case "tool.started":
            do {
                let payload = try data.decodeRPCParams(ToolStartedPayload.self)
                guard payload.chatId == chatId else { return }
                
                let targetIndex: Int?
                if let idx = messages.firstIndex(where: { $0.id == payload.messageId }) {
                    targetIndex = idx
                } else if let sId = streamingMessageId, let idx = messages.firstIndex(where: { $0.id == sId }) {
                    targetIndex = idx
                } else if let idx = messages.lastIndex(where: { $0.role == .agent && $0.streaming }) {
                    targetIndex = idx
                } else if let idx = messages.lastIndex(where: { $0.role == .agent }) {
                    targetIndex = idx
                } else {
                    targetIndex = nil
                }

                if let idx = targetIndex {
                    var blocks = messages[idx].blocks
                    // Finalize any in-progress reasoning blocks
                    for bIdx in blocks.indices {
                        if blocks[bIdx].type == .reasoning && !(blocks[bIdx].completed ?? true) {
                            blocks[bIdx] = .reasoning(blocks[bIdx].content ?? "", completed: true)
                        }
                    }
                    blocks.append(payload.block)
                    messages[idx] = messages[idx].with(blocks: blocks, streaming: true)
                    self.streamingMessageId = messages[idx].id
                    self.isRunning = true
                } else {
                    // No agent message found; synthesize a streaming placeholder message immediately
                    let newMsg = Message(
                        blocks: [payload.block],
                        chatID: chatId,
                        createdAt: Int(Date().timeIntervalSince1970 * 1000),
                        id: payload.messageId,
                        role: .agent,
                        streaming: true,
                        turnID: activeTurnId
                    )
                    messages.append(newMsg)
                    self.streamingMessageId = payload.messageId
                    self.isRunning = true
                }
                scrollTrigger &+= 1
            } catch {
                print("⚠️ [ChatViewModel] Failed to decode tool.started: \(error)")
            }

        case "tool.completed":
            do {
                let payload = try data.decodeRPCParams(ToolCompletedPayload.self)
                guard payload.chatId == chatId else { return }
                let targetMsgIdx: Int?
                if let idx = messages.firstIndex(where: { $0.id == payload.messageId }) {
                    targetMsgIdx = idx
                } else if let sId = streamingMessageId, let idx = messages.firstIndex(where: { $0.id == sId }) {
                    targetMsgIdx = idx
                } else {
                    targetMsgIdx = messages.indices.last
                }

                if let msgIdx = targetMsgIdx {
                    var blocks = messages[msgIdx].blocks
                    var matched = false
                    let blockId = payload.block?.id ?? payload.block?.callId

                    if let bId = blockId, !bId.isEmpty {
                        for bIdx in blocks.indices {
                            if blocks[bIdx].callID == bId {
                                let newStatus = payload.block?.status ?? .completed
                                blocks[bIdx] = blocks[bIdx].with(
                                    output: payload.block?.output ?? blocks[bIdx].output,
                                    status: newStatus
                                )
                                matched = true
                                break
                            }
                        }
                    }

                    if !matched {
                        // Fallback: match the last running block of matching type or any running tool/command block
                        let targetType = payload.block?.type
                        for bIdx in blocks.indices.reversed() {
                            let b = blocks[bIdx]
                            if b.status == .running {
                                if targetType == nil || b.type.rawValue == targetType {
                                    let newStatus = payload.block?.status ?? .completed
                                    blocks[bIdx] = blocks[bIdx].with(
                                        output: payload.block?.output ?? blocks[bIdx].output,
                                        status: newStatus,
                                        exitCode: payload.block?.exitCode ?? blocks[bIdx].exitCode
                                    )
                                    matched = true
                                    break
                                }
                            }
                        }
                    }

                    messages[msgIdx] = messages[msgIdx].with(blocks: blocks)
                }
            } catch {
                print("⚠️ [ChatViewModel] Failed to decode tool.completed: \(error)")
            }

        case "turn.completed":
            do {
                let payload = try data.decodeRPCParams(TurnCompletedPayload.self)
                guard payload.chatId == chatId else { return }
                self.streamingMessageId = nil
                self.streamingText = ""
                self.isRunning = false
                self.activeTurnId = nil
                for i in messages.indices {
                    if messages[i].streaming || i == messages.indices.last {
                        var blocks = messages[i].blocks
                        for bIdx in blocks.indices {
                            if blocks[bIdx].type == .reasoning && !(blocks[bIdx].completed ?? true) {
                                blocks[bIdx] = blocks[bIdx].with(completed: true)
                            }
                            if blocks[bIdx].status == .running {
                                blocks[bIdx] = blocks[bIdx].with(status: .completed)
                            }
                        }
                        messages[i] = messages[i].with(blocks: blocks, streaming: false)
                    }
                }
                if let err = payload.error, !err.isEmpty, payload.status == .error {
                    if let lastIdx = messages.indices.last, messages[lastIdx].role == .agent {
                        var blocks = messages[lastIdx].blocks
                        let hasErr = blocks.contains { b in
                            b.type == .text && (b.content?.contains(err) ?? false)
                        }
                        if !hasErr {
                            blocks.append(MessageBlock.text("❌ **Error:** \(err)"))
                            messages[lastIdx] = messages[lastIdx].with(blocks: blocks)
                        }
                    } else {
                        let errorBlock = MessageBlock.text("❌ **Error:** \(err)")
                        let errorMsg = Message(
                            blocks: [errorBlock],
                            chatID: chatId,
                            createdAt: Int(Date().timeIntervalSince1970 * 1000),
                            id: "err-msg-\(UUID().uuidString)",
                            role: .agent,
                            streaming: false,
                            turnID: payload.turnId
                        )
                        messages.append(errorMsg)
                    }
                }
                scrollTrigger &+= 1
            } catch {
                print("❌ [ChatViewModel] Failed to decode turn.completed: \(error)")
            }

        case "queue.updated":
            do {
                let payload = try data.decodeRPCParams(QueueUpdatedPayload.self)
                guard payload.chatId == chatId else { return }
                print("📋 [ChatViewModel] queue.updated received for \(chatId): \(payload.items.count) items")
                self.queuedMessages = payload.items
            } catch {
                print("❌ [ChatViewModel] Failed to decode queue.updated: \(error)")
            }

        case "approval.requested":
            do {
                let payload = try data.decodeRPCParams(ApprovalRequestedPayload.self)
                guard payload.chatId == chatId else { return }
                if !pendingApprovals.contains(where: { $0.id == payload.approval.id }) {
                    self.pendingApprovals.append(payload.approval)
                }
            } catch {
                print("❌ [ChatViewModel] Failed to decode approval.requested: \(error)")
            }

        default:
            break
        }
    }

    func durationFor(message: Message, at index: Int) -> Int {
        guard index < messages.count else { return 1 }
        for i in stride(from: index - 1, through: 0, by: -1) {
            if messages[i].role == .user {
                let diff = (message.createdAt - messages[i].createdAt) / 1000
                return max(1, diff)
            }
        }
        return 1
    }
}
