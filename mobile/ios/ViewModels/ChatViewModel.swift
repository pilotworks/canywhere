import Foundation
import SwiftUI

struct ChatGetParams: Encodable, Sendable {
    let chatId: String
}

struct ChatGetResult: Decodable, Sendable {
    let chat: Chat
    let messages: [Message]
    let pendingApprovals: [ApprovalRequest]
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
            self.messages = result.messages
            let hasStreamingMsg = result.messages.contains(where: { $0.streaming && $0.role == .agent })
            self.isRunning = (result.chat.status == .running || result.chat.status == .awaitingApproval || hasStreamingMsg)
            self.streamingMessageId = result.messages.last(where: { $0.streaming && $0.role == .agent })?.id
            self.streamingText = ""
        } catch {
            print("⚠️ [ChatViewModel] Failed to get chat: \(error)")
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
                reasoningEffort: selectedEffort
            )

            let _: TurnSendResponseResult = try await connectionManager.sendRequest(
                method: "turn.send",
                params: params
            )
        } catch {
            print("❌ [ChatViewModel] Failed to send turn: \(error)")
            self.isRunning = false
        }
        self.isSending = false
    }

    func interrupt() async {
        struct InterruptParams: Encodable, Sendable {
            let chatId: String
        }
        do {
            struct InterruptResult: Decodable, Sendable {
                let success: Bool
            }
            let _: InterruptResult = try await connectionManager.sendRequest(
                method: "turn.interrupt",
                params: InterruptParams(chatId: chatId)
            )
            self.isRunning = false
        } catch {
            print("⚠️ [ChatViewModel] Interrupt failed: \(error)")
        }
    }

    // MARK: - Event Handlers

    func handleNotification(method: String, data: Data) {
        switch method {
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
                if let idx = messages.firstIndex(where: { $0.id == payload.messageId }) {
                    var blocks = messages[idx].blocks
                    // Finalize any in-progress reasoning blocks
                    for bIdx in blocks.indices {
                        if blocks[bIdx].type == .reasoning && !(blocks[bIdx].completed ?? true) {
                            blocks[bIdx] = .reasoning(blocks[bIdx].content ?? "", completed: true)
                        }
                    }
                    blocks.append(payload.block)
                    messages[idx] = messages[idx].with(blocks: blocks)
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
                scrollTrigger &+= 1
            } catch {
                print("❌ [ChatViewModel] Failed to decode turn.completed: \(error)")
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
