import Foundation

// MARK: - JSON-RPC Wire Envelopes

struct RPCErrorData: Codable, Sendable {
    let code: Int
    let message: String
}

struct JSONRPCRequest<T: Encodable & Sendable>: Encodable, Sendable {
    let jsonrpc: String = "2.0"
    let id: String
    let method: String
    let params: T?

    init(id: String = UUID().uuidString, method: String, params: T? = nil) {
        self.id = id
        self.method = method
        self.params = params
    }
}

struct AnyJSONRPCResponse: Decodable, Sendable {
    let id: String?
    let result: JSONAny?
    let error: RPCErrorData?
}

struct JSONRPCNotification: Decodable, Sendable {
    let method: String
    let params: JSONAny
}

// MARK: - Notification Event Payloads

struct MessageCreatedPayload: Decodable, Sendable {
    let chatId: String
    let message: Message
}

struct MessageDeltaPayload: Codable, Sendable {
    let chatId: String
    let messageId: String
    let delta: DeltaContent

    struct DeltaContent: Codable, Sendable {
        let type: String
        let text: String?
    }
}

struct ToolStartedPayload: Decodable, Sendable {
    let chatId: String
    let messageId: String
    let block: MessageBlock
}

struct ToolCompletedPayload: Decodable, Sendable {
    let chatId: String
    let messageId: String
    let block: CompletedBlockRef?

    struct CompletedBlockRef: Decodable, Sendable {
        let id: String?
        let callId: String?
        let type: String?
        let status: Status?
        let output: String?
        let exitCode: Int?
    }
}

struct ApprovalRequestedPayload: Decodable, Sendable {
    let chatId: String
    let approval: ApprovalRequest
}

struct TurnCompletedPayload: Decodable, Sendable {
    let chatId: String
    let turnId: String
    let status: ChatStatus
    let textContent: String?
}

struct ChatUpdatedPayload: Decodable, Sendable {
    let chatId: String
    let title: String?
    let permissionMode: PermissionMode?
}

typealias ChatTitleUpdatedPayload = ChatUpdatedPayload

struct ChatCreatedPayload: Decodable, Sendable {
    let chat: Chat
}

struct ChatDeletedPayload: Decodable, Sendable {
    let chatId: String
}

// MARK: - Model RPC Payloads

struct ModelInfo: Codable, Identifiable, Sendable, Hashable {
    let id: String
    let model: String
    let displayName: String
    let description: String?
    let isDefault: Bool
    let supportedReasoningEfforts: [String]
    let defaultReasoningEffort: String?
}

struct ModelListResult: Decodable, Sendable {
    let models: [ModelInfo]
    let currentModel: String?
    let currentReasoningEffort: String?
}

struct ModelUpdatedPayload: Decodable, Sendable {
    let model: String
    let reasoningEffort: String?
}

struct WorkspaceUpdatedPayload: Decodable, Sendable {
    let workspace: Workspace
}

struct WorkspaceDeletedPayload: Decodable, Sendable {
    let workspaceId: String
}

struct QueueUpdatedPayload: Decodable, Sendable {
    let chatId: String
    let items: [QueuedMessage]
}

struct ApprovalListResult: Decodable, Sendable {
    let approvals: [ApprovalRequest]
}

struct ApprovalResolvedPayload: Decodable, Sendable {
    let approvalId: String
    let chatId: String?
    let decision: String
}

struct HostInfoResult: Decodable, Sendable {
    let hostName: String
    let os: String
    let codexVersion: String?
    let activeTurnsCount: Int
    let uptimeSeconds: Int
}

// MARK: - RPC Data Decoding Helpers

extension Data {
    func decodeRPCParams<T: Decodable>(_ type: T.Type) throws -> T {
        if let json = try? JSONSerialization.jsonObject(with: self) as? [String: Any],
           let paramsObj = json["params"] {
            let paramsData = try JSONSerialization.data(withJSONObject: paramsObj)
            return try JSONDecoder().decode(T.self, from: paramsData)
        }
        return try JSONDecoder().decode(T.self, from: self)
    }
}
