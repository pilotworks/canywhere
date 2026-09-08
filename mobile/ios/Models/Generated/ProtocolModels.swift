//
// ProtocolModels.swift
// Generated automatically from @canywhere/protocol-schema via quicktype.
// DO NOT EDIT MANUALLY. Run 'pnpm run codegen' to regenerate.
//

import Foundation

// This file was generated from JSON Schema using quicktype, do not modify it directly.
// To parse the JSON, add this file to your project and do:
//
//   let provider = try Provider(json)
//   let adapterCapabilities = try AdapterCapabilities(json)
//   let workspace = try Workspace(json)
//   let workspaceCreateInput = try WorkspaceCreateInput(json)
//   let fileTreeNode = try FileTreeNode(json)
//   let chat = try Chat(json)
//   let chatCreateInput = try ChatCreateInput(json)
//   let message = try Message(json)
//   let messageBlock = try MessageBlock(json)
//   let approvalRequest = try ApprovalRequest(json)
//   let approvalResponseInput = try ApprovalResponseInput(json)
//   let approvalDecision = try? JSONDecoder().decode(ApprovalDecision.self, from: jsonData)
//   let device = try Device(json)
//   let pairingQrPayload = try PairingQrPayload(json)
//   let pairingRequest = try PairingRequest(json)
//   let pairingResponse = try PairingResponse(json)
//   let authChallenge = try AuthChallenge(json)
//   let authSolution = try AuthSolution(json)
//   let rPCRequestEnvelope = try RPCRequestEnvelope(json)
//   let rPCResponseEnvelope = try RPCResponseEnvelope(json)
//   let rPCNotificationEnvelope = try RPCNotificationEnvelope(json)
//   let turnStartedNotification = try TurnStartedNotification(json)
//   let messageDeltaNotification = try MessageDeltaNotification(json)
//   let toolStartedNotification = try ToolStartedNotification(json)
//   let toolCompletedNotification = try ToolCompletedNotification(json)
//   let approvalRequestedNotification = try ApprovalRequestedNotification(json)
//   let approvalResolvedNotification = try ApprovalResolvedNotification(json)
//   let turnCompletedNotification = try TurnCompletedNotification(json)
//   let devicePresenceNotification = try DevicePresenceNotification(json)
//   let systemInfoResult = try SystemInfoResult(json)
//   let providerListResult = try ProviderListResult(json)
//   let workspaceListResult = try WorkspaceListResult(json)
//   let workspaceTreeParams = try WorkspaceTreeParams(json)
//   let workspaceTreeResult = try WorkspaceTreeResult(json)
//   let chatListParams = try ChatListParams(json)
//   let chatListResult = try ChatListResult(json)
//   let chatGetParams = try ChatGetParams(json)
//   let chatGetResult = try ChatGetResult(json)
//   let turnSendParams = try TurnSendParams(json)
//   let turnSendResult = try TurnSendResult(json)
//   let turnSteerParams = try TurnSteerParams(json)
//   let turnInterruptParams = try TurnInterruptParams(json)
//   let deviceListResult = try DeviceListResult(json)

import Foundation

// MARK: - WorkspaceCreateInput
struct WorkspaceCreateInput: Codable, Sendable {
    let name: String
    let providerID: String
    let rootPath: String
    let subPaths: [String]?

    enum CodingKeys: String, CodingKey {
        case name = "name"
        case providerID = "providerId"
        case rootPath = "rootPath"
        case subPaths = "subPaths"
    }
}

// MARK: WorkspaceCreateInput convenience initializers and mutators

extension WorkspaceCreateInput {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(WorkspaceCreateInput.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        name: String? = nil,
        providerID: String? = nil,
        rootPath: String? = nil,
        subPaths: [String]?? = nil
    ) -> WorkspaceCreateInput {
        return WorkspaceCreateInput(
            name: name ?? self.name,
            providerID: providerID ?? self.providerID,
            rootPath: rootPath ?? self.rootPath,
            subPaths: subPaths ?? self.subPaths
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ChatCreateInput
struct ChatCreateInput: Codable, Sendable {
    let initialPrompt: String?
    let kind: ChatKind
    let providerID: String
    let title: String?
    let workspaceID: String?

    enum CodingKeys: String, CodingKey {
        case initialPrompt = "initialPrompt"
        case kind = "kind"
        case providerID = "providerId"
        case title = "title"
        case workspaceID = "workspaceId"
    }
}

// MARK: ChatCreateInput convenience initializers and mutators

extension ChatCreateInput {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ChatCreateInput.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        initialPrompt: String?? = nil,
        kind: ChatKind? = nil,
        providerID: String? = nil,
        title: String?? = nil,
        workspaceID: String?? = nil
    ) -> ChatCreateInput {
        return ChatCreateInput(
            initialPrompt: initialPrompt ?? self.initialPrompt,
            kind: kind ?? self.kind,
            providerID: providerID ?? self.providerID,
            title: title ?? self.title,
            workspaceID: workspaceID ?? self.workspaceID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum ChatKind: String, Codable, Sendable {
    case standalone = "standalone"
    case workspace = "workspace"
}

// MARK: - ApprovalResponseInput
struct ApprovalResponseInput: Codable, Sendable {
    let approvalID: String
    let decision: ApprovalDecision

    enum CodingKeys: String, CodingKey {
        case approvalID = "approvalId"
        case decision = "decision"
    }
}

// MARK: ApprovalResponseInput convenience initializers and mutators

extension ApprovalResponseInput {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ApprovalResponseInput.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        approvalID: String? = nil,
        decision: ApprovalDecision? = nil
    ) -> ApprovalResponseInput {
        return ApprovalResponseInput(
            approvalID: approvalID ?? self.approvalID,
            decision: decision ?? self.decision
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum ApprovalDecision: String, Codable, Sendable {
    case accept = "accept"
    case acceptForSession = "accept_for_session"
    case cancel = "cancel"
    case decline = "decline"
}

// MARK: - PairingQrPayload
struct PairingQrPayload: Codable, Sendable {
    let endpoints: [String]
    let expiresAt: Int
    let hostID: String
    let hostName: String
    let hostPublicKey: String
    let token: String

    enum CodingKeys: String, CodingKey {
        case endpoints = "endpoints"
        case expiresAt = "expiresAt"
        case hostID = "hostId"
        case hostName = "hostName"
        case hostPublicKey = "hostPublicKey"
        case token = "token"
    }
}

// MARK: PairingQrPayload convenience initializers and mutators

extension PairingQrPayload {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PairingQrPayload.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        endpoints: [String]? = nil,
        expiresAt: Int? = nil,
        hostID: String? = nil,
        hostName: String? = nil,
        hostPublicKey: String? = nil,
        token: String? = nil
    ) -> PairingQrPayload {
        return PairingQrPayload(
            endpoints: endpoints ?? self.endpoints,
            expiresAt: expiresAt ?? self.expiresAt,
            hostID: hostID ?? self.hostID,
            hostName: hostName ?? self.hostName,
            hostPublicKey: hostPublicKey ?? self.hostPublicKey,
            token: token ?? self.token
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PairingRequest
struct PairingRequest: Codable, Sendable {
    let deviceID: String
    let deviceName: String
    let devicePublicKey: String
    let platform: Platform
    let token: String

    enum CodingKeys: String, CodingKey {
        case deviceID = "deviceId"
        case deviceName = "deviceName"
        case devicePublicKey = "devicePublicKey"
        case platform = "platform"
        case token = "token"
    }
}

// MARK: PairingRequest convenience initializers and mutators

extension PairingRequest {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PairingRequest.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        deviceID: String? = nil,
        deviceName: String? = nil,
        devicePublicKey: String? = nil,
        platform: Platform? = nil,
        token: String? = nil
    ) -> PairingRequest {
        return PairingRequest(
            deviceID: deviceID ?? self.deviceID,
            deviceName: deviceName ?? self.deviceName,
            devicePublicKey: devicePublicKey ?? self.devicePublicKey,
            platform: platform ?? self.platform,
            token: token ?? self.token
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum Platform: String, Codable, Sendable {
    case desktop = "desktop"
    case ios = "ios"
}

// MARK: - PairingResponse
struct PairingResponse: Codable, Sendable {
    let authToken: String
    let hostID: String
    let status: PairingResponseStatus

    enum CodingKeys: String, CodingKey {
        case authToken = "authToken"
        case hostID = "hostId"
        case status = "status"
    }
}

// MARK: PairingResponse convenience initializers and mutators

extension PairingResponse {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PairingResponse.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        authToken: String? = nil,
        hostID: String? = nil,
        status: PairingResponseStatus? = nil
    ) -> PairingResponse {
        return PairingResponse(
            authToken: authToken ?? self.authToken,
            hostID: hostID ?? self.hostID,
            status: status ?? self.status
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum PairingResponseStatus: String, Codable, Sendable {
    case paired = "paired"
}

// MARK: - AuthChallenge
struct AuthChallenge: Codable, Sendable {
    let hostID: String
    let nonce: String
    let timestamp: Int

    enum CodingKeys: String, CodingKey {
        case hostID = "hostId"
        case nonce = "nonce"
        case timestamp = "timestamp"
    }
}

// MARK: AuthChallenge convenience initializers and mutators

extension AuthChallenge {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(AuthChallenge.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        hostID: String? = nil,
        nonce: String? = nil,
        timestamp: Int? = nil
    ) -> AuthChallenge {
        return AuthChallenge(
            hostID: hostID ?? self.hostID,
            nonce: nonce ?? self.nonce,
            timestamp: timestamp ?? self.timestamp
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - AuthSolution
struct AuthSolution: Codable, Sendable {
    let deviceID: String
    let signature: String

    enum CodingKeys: String, CodingKey {
        case deviceID = "deviceId"
        case signature = "signature"
    }
}

// MARK: AuthSolution convenience initializers and mutators

extension AuthSolution {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(AuthSolution.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        deviceID: String? = nil,
        signature: String? = nil
    ) -> AuthSolution {
        return AuthSolution(
            deviceID: deviceID ?? self.deviceID,
            signature: signature ?? self.signature
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - RPCRequestEnvelope
struct RPCRequestEnvelope: Codable, Sendable {
    let id: ID
    let method: String
    let params: JSONAny?

    enum CodingKeys: String, CodingKey {
        case id = "id"
        case method = "method"
        case params = "params"
    }
}

// MARK: RPCRequestEnvelope convenience initializers and mutators

extension RPCRequestEnvelope {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(RPCRequestEnvelope.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        id: ID? = nil,
        method: String? = nil,
        params: JSONAny?? = nil
    ) -> RPCRequestEnvelope {
        return RPCRequestEnvelope(
            id: id ?? self.id,
            method: method ?? self.method,
            params: params ?? self.params
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum ID: Codable, Sendable {
    case integer(Int)
    case string(String)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(Int.self) {
            self = .integer(x)
            return
        }
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        throw DecodingError.typeMismatch(ID.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for ID"))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .integer(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        }
    }
}

// MARK: - RPCResponseEnvelope
struct RPCResponseEnvelope: Codable, Sendable {
    let error: Error?
    let id: ID
    let result: JSONAny?

    enum CodingKeys: String, CodingKey {
        case error = "error"
        case id = "id"
        case result = "result"
    }
}

// MARK: RPCResponseEnvelope convenience initializers and mutators

extension RPCResponseEnvelope {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(RPCResponseEnvelope.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        error: Error?? = nil,
        id: ID? = nil,
        result: JSONAny?? = nil
    ) -> RPCResponseEnvelope {
        return RPCResponseEnvelope(
            error: error ?? self.error,
            id: id ?? self.id,
            result: result ?? self.result
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Error
struct Error: Codable, Sendable {
    let code: Int
    let data: JSONAny?
    let message: String

    enum CodingKeys: String, CodingKey {
        case code = "code"
        case data = "data"
        case message = "message"
    }
}

// MARK: Error convenience initializers and mutators

extension Error {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Error.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        code: Int? = nil,
        data: JSONAny?? = nil,
        message: String? = nil
    ) -> Error {
        return Error(
            code: code ?? self.code,
            data: data ?? self.data,
            message: message ?? self.message
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - RPCNotificationEnvelope
struct RPCNotificationEnvelope: Codable, Sendable {
    let method: String
    let params: JSONAny?

    enum CodingKeys: String, CodingKey {
        case method = "method"
        case params = "params"
    }
}

// MARK: RPCNotificationEnvelope convenience initializers and mutators

extension RPCNotificationEnvelope {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(RPCNotificationEnvelope.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        method: String? = nil,
        params: JSONAny?? = nil
    ) -> RPCNotificationEnvelope {
        return RPCNotificationEnvelope(
            method: method ?? self.method,
            params: params ?? self.params
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnStartedNotification
struct TurnStartedNotification: Codable, Sendable {
    let chatID: String
    let turnID: String
    let userMessage: UserMessage

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case turnID = "turnId"
        case userMessage = "userMessage"
    }
}

// MARK: TurnStartedNotification convenience initializers and mutators

extension TurnStartedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnStartedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        chatID: String? = nil,
        turnID: String? = nil,
        userMessage: UserMessage? = nil
    ) -> TurnStartedNotification {
        return TurnStartedNotification(
            chatID: chatID ?? self.chatID,
            turnID: turnID ?? self.turnID,
            userMessage: userMessage ?? self.userMessage
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - UserMessage
struct UserMessage: Codable, Sendable {
    let blocks: [UserMessageBlock]
    let chatID: String
    let createdAt: Int
    let id: String
    let role: Role
    let streaming: Bool
    let turnID: String?

    enum CodingKeys: String, CodingKey {
        case blocks = "blocks"
        case chatID = "chatId"
        case createdAt = "createdAt"
        case id = "id"
        case role = "role"
        case streaming = "streaming"
        case turnID = "turnId"
    }
}

// MARK: UserMessage convenience initializers and mutators

extension UserMessage {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(UserMessage.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        blocks: [UserMessageBlock]? = nil,
        chatID: String? = nil,
        createdAt: Int? = nil,
        id: String? = nil,
        role: Role? = nil,
        streaming: Bool? = nil,
        turnID: String?? = nil
    ) -> UserMessage {
        return UserMessage(
            blocks: blocks ?? self.blocks,
            chatID: chatID ?? self.chatID,
            createdAt: createdAt ?? self.createdAt,
            id: id ?? self.id,
            role: role ?? self.role,
            streaming: streaming ?? self.streaming,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - UserMessageBlock
struct UserMessageBlock: Codable, Sendable {
    let content: String?
    let type: MessageBlockType
    let completed: Bool?
    let args: [String: JSONAny]?
    let callID: String?
    let name: String?
    let output: String?
    let status: MessageBlockStatus?
    let patch: String?
    let path: String?
    let command: String?
    let cwd: String?
    let exitCode: Int?

    enum CodingKeys: String, CodingKey {
        case content = "content"
        case type = "type"
        case completed = "completed"
        case args = "args"
        case callID = "callId"
        case name = "name"
        case output = "output"
        case status = "status"
        case patch = "patch"
        case path = "path"
        case command = "command"
        case cwd = "cwd"
        case exitCode = "exitCode"
    }
}

// MARK: UserMessageBlock convenience initializers and mutators

extension UserMessageBlock {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(UserMessageBlock.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        content: String?? = nil,
        type: MessageBlockType? = nil,
        completed: Bool?? = nil,
        args: [String: JSONAny]?? = nil,
        callID: String?? = nil,
        name: String?? = nil,
        output: String?? = nil,
        status: MessageBlockStatus?? = nil,
        patch: String?? = nil,
        path: String?? = nil,
        command: String?? = nil,
        cwd: String?? = nil,
        exitCode: Int?? = nil
    ) -> UserMessageBlock {
        return UserMessageBlock(
            content: content ?? self.content,
            type: type ?? self.type,
            completed: completed ?? self.completed,
            args: args ?? self.args,
            callID: callID ?? self.callID,
            name: name ?? self.name,
            output: output ?? self.output,
            status: status ?? self.status,
            patch: patch ?? self.patch,
            path: path ?? self.path,
            command: command ?? self.command,
            cwd: cwd ?? self.cwd,
            exitCode: exitCode ?? self.exitCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum MessageBlockStatus: String, Codable, Sendable {
    case applied = "applied"
    case completed = "completed"
    case failed = "failed"
    case pendingApproval = "pending_approval"
    case proposed = "proposed"
    case rejected = "rejected"
    case running = "running"
}

enum MessageBlockType: String, Codable, Sendable {
    case commandExec = "command_exec"
    case fileDiff = "file_diff"
    case plan = "plan"
    case reasoning = "reasoning"
    case text = "text"
    case toolCall = "tool_call"
}

enum Role: String, Codable, Sendable {
    case agent = "agent"
    case system = "system"
    case user = "user"
}

// MARK: - MessageDeltaNotification
struct MessageDeltaNotification: Codable, Sendable {
    let chatID: String
    let delta: Delta
    let messageID: String
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case delta = "delta"
        case messageID = "messageId"
        case turnID = "turnId"
    }
}

// MARK: MessageDeltaNotification convenience initializers and mutators

extension MessageDeltaNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MessageDeltaNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        chatID: String? = nil,
        delta: Delta? = nil,
        messageID: String? = nil,
        turnID: String? = nil
    ) -> MessageDeltaNotification {
        return MessageDeltaNotification(
            chatID: chatID ?? self.chatID,
            delta: delta ?? self.delta,
            messageID: messageID ?? self.messageID,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Delta
struct Delta: Codable, Sendable {
    let text: String
    let type: DeltaType

    enum CodingKeys: String, CodingKey {
        case text = "text"
        case type = "type"
    }
}

// MARK: Delta convenience initializers and mutators

extension Delta {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Delta.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String? = nil,
        type: DeltaType? = nil
    ) -> Delta {
        return Delta(
            text: text ?? self.text,
            type: type ?? self.type
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum DeltaType: String, Codable, Sendable {
    case plan = "plan"
    case reasoning = "reasoning"
    case text = "text"
}

// MARK: - ToolStartedNotification
struct ToolStartedNotification: Codable, Sendable {
    let block: ToolStartedNotificationBlock
    let chatID: String
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case block = "block"
        case chatID = "chatId"
        case turnID = "turnId"
    }
}

// MARK: ToolStartedNotification convenience initializers and mutators

extension ToolStartedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ToolStartedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        block: ToolStartedNotificationBlock? = nil,
        chatID: String? = nil,
        turnID: String? = nil
    ) -> ToolStartedNotification {
        return ToolStartedNotification(
            block: block ?? self.block,
            chatID: chatID ?? self.chatID,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ToolStartedNotificationBlock
struct ToolStartedNotificationBlock: Codable, Sendable {
    let content: String?
    let type: MessageBlockType
    let completed: Bool?
    let args: [String: JSONAny]?
    let callID: String?
    let name: String?
    let output: String?
    let status: MessageBlockStatus?
    let patch: String?
    let path: String?
    let command: String?
    let cwd: String?
    let exitCode: Int?

    enum CodingKeys: String, CodingKey {
        case content = "content"
        case type = "type"
        case completed = "completed"
        case args = "args"
        case callID = "callId"
        case name = "name"
        case output = "output"
        case status = "status"
        case patch = "patch"
        case path = "path"
        case command = "command"
        case cwd = "cwd"
        case exitCode = "exitCode"
    }
}

// MARK: ToolStartedNotificationBlock convenience initializers and mutators

extension ToolStartedNotificationBlock {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ToolStartedNotificationBlock.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        content: String?? = nil,
        type: MessageBlockType? = nil,
        completed: Bool?? = nil,
        args: [String: JSONAny]?? = nil,
        callID: String?? = nil,
        name: String?? = nil,
        output: String?? = nil,
        status: MessageBlockStatus?? = nil,
        patch: String?? = nil,
        path: String?? = nil,
        command: String?? = nil,
        cwd: String?? = nil,
        exitCode: Int?? = nil
    ) -> ToolStartedNotificationBlock {
        return ToolStartedNotificationBlock(
            content: content ?? self.content,
            type: type ?? self.type,
            completed: completed ?? self.completed,
            args: args ?? self.args,
            callID: callID ?? self.callID,
            name: name ?? self.name,
            output: output ?? self.output,
            status: status ?? self.status,
            patch: patch ?? self.patch,
            path: path ?? self.path,
            command: command ?? self.command,
            cwd: cwd ?? self.cwd,
            exitCode: exitCode ?? self.exitCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ToolCompletedNotification
struct ToolCompletedNotification: Codable, Sendable {
    let block: ToolCompletedNotificationBlock
    let chatID: String
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case block = "block"
        case chatID = "chatId"
        case turnID = "turnId"
    }
}

// MARK: ToolCompletedNotification convenience initializers and mutators

extension ToolCompletedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ToolCompletedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        block: ToolCompletedNotificationBlock? = nil,
        chatID: String? = nil,
        turnID: String? = nil
    ) -> ToolCompletedNotification {
        return ToolCompletedNotification(
            block: block ?? self.block,
            chatID: chatID ?? self.chatID,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ToolCompletedNotificationBlock
struct ToolCompletedNotificationBlock: Codable, Sendable {
    let content: String?
    let type: MessageBlockType
    let completed: Bool?
    let args: [String: JSONAny]?
    let callID: String?
    let name: String?
    let output: String?
    let status: MessageBlockStatus?
    let patch: String?
    let path: String?
    let command: String?
    let cwd: String?
    let exitCode: Int?

    enum CodingKeys: String, CodingKey {
        case content = "content"
        case type = "type"
        case completed = "completed"
        case args = "args"
        case callID = "callId"
        case name = "name"
        case output = "output"
        case status = "status"
        case patch = "patch"
        case path = "path"
        case command = "command"
        case cwd = "cwd"
        case exitCode = "exitCode"
    }
}

// MARK: ToolCompletedNotificationBlock convenience initializers and mutators

extension ToolCompletedNotificationBlock {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ToolCompletedNotificationBlock.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        content: String?? = nil,
        type: MessageBlockType? = nil,
        completed: Bool?? = nil,
        args: [String: JSONAny]?? = nil,
        callID: String?? = nil,
        name: String?? = nil,
        output: String?? = nil,
        status: MessageBlockStatus?? = nil,
        patch: String?? = nil,
        path: String?? = nil,
        command: String?? = nil,
        cwd: String?? = nil,
        exitCode: Int?? = nil
    ) -> ToolCompletedNotificationBlock {
        return ToolCompletedNotificationBlock(
            content: content ?? self.content,
            type: type ?? self.type,
            completed: completed ?? self.completed,
            args: args ?? self.args,
            callID: callID ?? self.callID,
            name: name ?? self.name,
            output: output ?? self.output,
            status: status ?? self.status,
            patch: patch ?? self.patch,
            path: path ?? self.path,
            command: command ?? self.command,
            cwd: cwd ?? self.cwd,
            exitCode: exitCode ?? self.exitCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ApprovalRequestedNotification
struct ApprovalRequestedNotification: Codable, Sendable {
    let approval: Approval
    let chatID: String
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case approval = "approval"
        case chatID = "chatId"
        case turnID = "turnId"
    }
}

// MARK: ApprovalRequestedNotification convenience initializers and mutators

extension ApprovalRequestedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ApprovalRequestedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        approval: Approval? = nil,
        chatID: String? = nil,
        turnID: String? = nil
    ) -> ApprovalRequestedNotification {
        return ApprovalRequestedNotification(
            approval: approval ?? self.approval,
            chatID: chatID ?? self.chatID,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Approval
struct Approval: Codable, Sendable {
    let chatID: String
    let externalRequestID: String
    let id: String
    let kind: ApprovalRequestKind
    let payload: ApprovalPayload
    let requestedAt: Int
    let resolvedAt: Int?
    let resolvedByDeviceID: String?
    let resolvedByDeviceName: String?
    let status: ApprovalRequestStatus
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case externalRequestID = "externalRequestId"
        case id = "id"
        case kind = "kind"
        case payload = "payload"
        case requestedAt = "requestedAt"
        case resolvedAt = "resolvedAt"
        case resolvedByDeviceID = "resolvedByDeviceId"
        case resolvedByDeviceName = "resolvedByDeviceName"
        case status = "status"
        case turnID = "turnId"
    }
}

// MARK: Approval convenience initializers and mutators

extension Approval {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Approval.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        chatID: String? = nil,
        externalRequestID: String? = nil,
        id: String? = nil,
        kind: ApprovalRequestKind? = nil,
        payload: ApprovalPayload? = nil,
        requestedAt: Int? = nil,
        resolvedAt: Int?? = nil,
        resolvedByDeviceID: String?? = nil,
        resolvedByDeviceName: String?? = nil,
        status: ApprovalRequestStatus? = nil,
        turnID: String? = nil
    ) -> Approval {
        return Approval(
            chatID: chatID ?? self.chatID,
            externalRequestID: externalRequestID ?? self.externalRequestID,
            id: id ?? self.id,
            kind: kind ?? self.kind,
            payload: payload ?? self.payload,
            requestedAt: requestedAt ?? self.requestedAt,
            resolvedAt: resolvedAt ?? self.resolvedAt,
            resolvedByDeviceID: resolvedByDeviceID ?? self.resolvedByDeviceID,
            resolvedByDeviceName: resolvedByDeviceName ?? self.resolvedByDeviceName,
            status: status ?? self.status,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum ApprovalRequestKind: String, Codable, Sendable {
    case command = "command"
    case fileChange = "file_change"
    case userInput = "user_input"
}

// MARK: - ApprovalPayload
struct ApprovalPayload: Codable, Sendable {
    let command: String?
    let cwd: String?
    let diff: String?
    let isHighRisk: Bool?
    let path: String?
    let prompt: String?
    let reason: String?

    enum CodingKeys: String, CodingKey {
        case command = "command"
        case cwd = "cwd"
        case diff = "diff"
        case isHighRisk = "isHighRisk"
        case path = "path"
        case prompt = "prompt"
        case reason = "reason"
    }
}

// MARK: ApprovalPayload convenience initializers and mutators

extension ApprovalPayload {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ApprovalPayload.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        command: String?? = nil,
        cwd: String?? = nil,
        diff: String?? = nil,
        isHighRisk: Bool?? = nil,
        path: String?? = nil,
        prompt: String?? = nil,
        reason: String?? = nil
    ) -> ApprovalPayload {
        return ApprovalPayload(
            command: command ?? self.command,
            cwd: cwd ?? self.cwd,
            diff: diff ?? self.diff,
            isHighRisk: isHighRisk ?? self.isHighRisk,
            path: path ?? self.path,
            prompt: prompt ?? self.prompt,
            reason: reason ?? self.reason
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum ApprovalRequestStatus: String, Codable, Sendable {
    case approved = "approved"
    case canceled = "canceled"
    case denied = "denied"
    case pending = "pending"
}

// MARK: - ApprovalResolvedNotification
struct ApprovalResolvedNotification: Codable, Sendable {
    let approvalID: String
    let chatID: String
    let decision: ApprovalDecision
    let resolvedByDeviceID: String
    let resolvedByDeviceName: String
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case approvalID = "approvalId"
        case chatID = "chatId"
        case decision = "decision"
        case resolvedByDeviceID = "resolvedByDeviceId"
        case resolvedByDeviceName = "resolvedByDeviceName"
        case turnID = "turnId"
    }
}

// MARK: ApprovalResolvedNotification convenience initializers and mutators

extension ApprovalResolvedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ApprovalResolvedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        approvalID: String? = nil,
        chatID: String? = nil,
        decision: ApprovalDecision? = nil,
        resolvedByDeviceID: String? = nil,
        resolvedByDeviceName: String? = nil,
        turnID: String? = nil
    ) -> ApprovalResolvedNotification {
        return ApprovalResolvedNotification(
            approvalID: approvalID ?? self.approvalID,
            chatID: chatID ?? self.chatID,
            decision: decision ?? self.decision,
            resolvedByDeviceID: resolvedByDeviceID ?? self.resolvedByDeviceID,
            resolvedByDeviceName: resolvedByDeviceName ?? self.resolvedByDeviceName,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnCompletedNotification
struct TurnCompletedNotification: Codable, Sendable {
    let agentMessage: AgentMessage?
    let chatID: String
    let status: ChatStatus
    let tokensUsed: TokensUsed?
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case agentMessage = "agentMessage"
        case chatID = "chatId"
        case status = "status"
        case tokensUsed = "tokensUsed"
        case turnID = "turnId"
    }
}

// MARK: TurnCompletedNotification convenience initializers and mutators

extension TurnCompletedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnCompletedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        agentMessage: AgentMessage?? = nil,
        chatID: String? = nil,
        status: ChatStatus? = nil,
        tokensUsed: TokensUsed?? = nil,
        turnID: String? = nil
    ) -> TurnCompletedNotification {
        return TurnCompletedNotification(
            agentMessage: agentMessage ?? self.agentMessage,
            chatID: chatID ?? self.chatID,
            status: status ?? self.status,
            tokensUsed: tokensUsed ?? self.tokensUsed,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - AgentMessage
struct AgentMessage: Codable, Sendable {
    let blocks: [AgentMessageBlock]
    let chatID: String
    let createdAt: Int
    let id: String
    let role: Role
    let streaming: Bool
    let turnID: String?

    enum CodingKeys: String, CodingKey {
        case blocks = "blocks"
        case chatID = "chatId"
        case createdAt = "createdAt"
        case id = "id"
        case role = "role"
        case streaming = "streaming"
        case turnID = "turnId"
    }
}

// MARK: AgentMessage convenience initializers and mutators

extension AgentMessage {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(AgentMessage.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        blocks: [AgentMessageBlock]? = nil,
        chatID: String? = nil,
        createdAt: Int? = nil,
        id: String? = nil,
        role: Role? = nil,
        streaming: Bool? = nil,
        turnID: String?? = nil
    ) -> AgentMessage {
        return AgentMessage(
            blocks: blocks ?? self.blocks,
            chatID: chatID ?? self.chatID,
            createdAt: createdAt ?? self.createdAt,
            id: id ?? self.id,
            role: role ?? self.role,
            streaming: streaming ?? self.streaming,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - AgentMessageBlock
struct AgentMessageBlock: Codable, Sendable {
    let content: String?
    let type: MessageBlockType
    let completed: Bool?
    let args: [String: JSONAny]?
    let callID: String?
    let name: String?
    let output: String?
    let status: MessageBlockStatus?
    let patch: String?
    let path: String?
    let command: String?
    let cwd: String?
    let exitCode: Int?

    enum CodingKeys: String, CodingKey {
        case content = "content"
        case type = "type"
        case completed = "completed"
        case args = "args"
        case callID = "callId"
        case name = "name"
        case output = "output"
        case status = "status"
        case patch = "patch"
        case path = "path"
        case command = "command"
        case cwd = "cwd"
        case exitCode = "exitCode"
    }
}

// MARK: AgentMessageBlock convenience initializers and mutators

extension AgentMessageBlock {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(AgentMessageBlock.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        content: String?? = nil,
        type: MessageBlockType? = nil,
        completed: Bool?? = nil,
        args: [String: JSONAny]?? = nil,
        callID: String?? = nil,
        name: String?? = nil,
        output: String?? = nil,
        status: MessageBlockStatus?? = nil,
        patch: String?? = nil,
        path: String?? = nil,
        command: String?? = nil,
        cwd: String?? = nil,
        exitCode: Int?? = nil
    ) -> AgentMessageBlock {
        return AgentMessageBlock(
            content: content ?? self.content,
            type: type ?? self.type,
            completed: completed ?? self.completed,
            args: args ?? self.args,
            callID: callID ?? self.callID,
            name: name ?? self.name,
            output: output ?? self.output,
            status: status ?? self.status,
            patch: patch ?? self.patch,
            path: path ?? self.path,
            command: command ?? self.command,
            cwd: cwd ?? self.cwd,
            exitCode: exitCode ?? self.exitCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum ChatStatus: String, Codable, Sendable {
    case awaitingApproval = "awaiting_approval"
    case error = "error"
    case idle = "idle"
    case running = "running"
}

// MARK: - TokensUsed
struct TokensUsed: Codable, Sendable {
    let input: Int
    let output: Int
    let total: Int

    enum CodingKeys: String, CodingKey {
        case input = "input"
        case output = "output"
        case total = "total"
    }
}

// MARK: TokensUsed convenience initializers and mutators

extension TokensUsed {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TokensUsed.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        input: Int? = nil,
        output: Int? = nil,
        total: Int? = nil
    ) -> TokensUsed {
        return TokensUsed(
            input: input ?? self.input,
            output: output ?? self.output,
            total: total ?? self.total
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - DevicePresenceNotification
struct DevicePresenceNotification: Codable, Sendable {
    let deviceID: String
    let lastSeenAt: Int
    let online: Bool

    enum CodingKeys: String, CodingKey {
        case deviceID = "deviceId"
        case lastSeenAt = "lastSeenAt"
        case online = "online"
    }
}

// MARK: DevicePresenceNotification convenience initializers and mutators

extension DevicePresenceNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(DevicePresenceNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        deviceID: String? = nil,
        lastSeenAt: Int? = nil,
        online: Bool? = nil
    ) -> DevicePresenceNotification {
        return DevicePresenceNotification(
            deviceID: deviceID ?? self.deviceID,
            lastSeenAt: lastSeenAt ?? self.lastSeenAt,
            online: online ?? self.online
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - SystemInfoResult
struct SystemInfoResult: Codable, Sendable {
    let activeProviders: [String]
    let arch: String
    let hostname: String
    let pairedDeviceCount: Int
    let platform: String
    let version: String

    enum CodingKeys: String, CodingKey {
        case activeProviders = "activeProviders"
        case arch = "arch"
        case hostname = "hostname"
        case pairedDeviceCount = "pairedDeviceCount"
        case platform = "platform"
        case version = "version"
    }
}

// MARK: SystemInfoResult convenience initializers and mutators

extension SystemInfoResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SystemInfoResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        activeProviders: [String]? = nil,
        arch: String? = nil,
        hostname: String? = nil,
        pairedDeviceCount: Int? = nil,
        platform: String? = nil,
        version: String? = nil
    ) -> SystemInfoResult {
        return SystemInfoResult(
            activeProviders: activeProviders ?? self.activeProviders,
            arch: arch ?? self.arch,
            hostname: hostname ?? self.hostname,
            pairedDeviceCount: pairedDeviceCount ?? self.pairedDeviceCount,
            platform: platform ?? self.platform,
            version: version ?? self.version
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ProviderListResult
struct ProviderListResult: Codable, Sendable {
    let providers: [Provider]

    enum CodingKeys: String, CodingKey {
        case providers = "providers"
    }
}

// MARK: ProviderListResult convenience initializers and mutators

extension ProviderListResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ProviderListResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        providers: [Provider]? = nil
    ) -> ProviderListResult {
        return ProviderListResult(
            providers: providers ?? self.providers
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Provider
struct Provider: Codable, Sendable {
    let capabilities: AdapterCapabilities
    let id: String
    let name: String
    let status: ProviderStatus
    let statusMessage: String?
    let version: String

    enum CodingKeys: String, CodingKey {
        case capabilities = "capabilities"
        case id = "id"
        case name = "name"
        case status = "status"
        case statusMessage = "statusMessage"
        case version = "version"
    }
}

// MARK: Provider convenience initializers and mutators

extension Provider {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Provider.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        capabilities: AdapterCapabilities? = nil,
        id: String? = nil,
        name: String? = nil,
        status: ProviderStatus? = nil,
        statusMessage: String?? = nil,
        version: String? = nil
    ) -> Provider {
        return Provider(
            capabilities: capabilities ?? self.capabilities,
            id: id ?? self.id,
            name: name ?? self.name,
            status: status ?? self.status,
            statusMessage: statusMessage ?? self.statusMessage,
            version: version ?? self.version
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - AdapterCapabilities
struct AdapterCapabilities: Codable, Sendable {
    let approvals: Bool
    let multiRoot: Bool
    let resumeThread: Bool
    let standaloneChat: Bool
    let steering: Bool
    let workspace: Bool

    enum CodingKeys: String, CodingKey {
        case approvals = "approvals"
        case multiRoot = "multiRoot"
        case resumeThread = "resumeThread"
        case standaloneChat = "standaloneChat"
        case steering = "steering"
        case workspace = "workspace"
    }
}

// MARK: AdapterCapabilities convenience initializers and mutators

extension AdapterCapabilities {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(AdapterCapabilities.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        approvals: Bool? = nil,
        multiRoot: Bool? = nil,
        resumeThread: Bool? = nil,
        standaloneChat: Bool? = nil,
        steering: Bool? = nil,
        workspace: Bool? = nil
    ) -> AdapterCapabilities {
        return AdapterCapabilities(
            approvals: approvals ?? self.approvals,
            multiRoot: multiRoot ?? self.multiRoot,
            resumeThread: resumeThread ?? self.resumeThread,
            standaloneChat: standaloneChat ?? self.standaloneChat,
            steering: steering ?? self.steering,
            workspace: workspace ?? self.workspace
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum ProviderStatus: String, Codable, Sendable {
    case error = "error"
    case ready = "ready"
    case unavailable = "unavailable"
}

// MARK: - WorkspaceListResult
struct WorkspaceListResult: Codable, Sendable {
    let workspaces: [Workspace]

    enum CodingKeys: String, CodingKey {
        case workspaces = "workspaces"
    }
}

// MARK: WorkspaceListResult convenience initializers and mutators

extension WorkspaceListResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(WorkspaceListResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        workspaces: [Workspace]? = nil
    ) -> WorkspaceListResult {
        return WorkspaceListResult(
            workspaces: workspaces ?? self.workspaces
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Workspace
struct Workspace: Codable, Sendable {
    let createdAt: Int
    let id: String
    let lastOpenedAt: Int
    let name: String
    let providerID: String
    let rootPath: String
    let subPaths: [String]

    enum CodingKeys: String, CodingKey {
        case createdAt = "createdAt"
        case id = "id"
        case lastOpenedAt = "lastOpenedAt"
        case name = "name"
        case providerID = "providerId"
        case rootPath = "rootPath"
        case subPaths = "subPaths"
    }
}

// MARK: Workspace convenience initializers and mutators

extension Workspace {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Workspace.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        createdAt: Int? = nil,
        id: String? = nil,
        lastOpenedAt: Int? = nil,
        name: String? = nil,
        providerID: String? = nil,
        rootPath: String? = nil,
        subPaths: [String]? = nil
    ) -> Workspace {
        return Workspace(
            createdAt: createdAt ?? self.createdAt,
            id: id ?? self.id,
            lastOpenedAt: lastOpenedAt ?? self.lastOpenedAt,
            name: name ?? self.name,
            providerID: providerID ?? self.providerID,
            rootPath: rootPath ?? self.rootPath,
            subPaths: subPaths ?? self.subPaths
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - WorkspaceTreeParams
struct WorkspaceTreeParams: Codable, Sendable {
    let maxDepth: Int?
    let subPath: String?
    let workspaceID: String

    enum CodingKeys: String, CodingKey {
        case maxDepth = "maxDepth"
        case subPath = "subPath"
        case workspaceID = "workspaceId"
    }
}

// MARK: WorkspaceTreeParams convenience initializers and mutators

extension WorkspaceTreeParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(WorkspaceTreeParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        maxDepth: Int?? = nil,
        subPath: String?? = nil,
        workspaceID: String? = nil
    ) -> WorkspaceTreeParams {
        return WorkspaceTreeParams(
            maxDepth: maxDepth ?? self.maxDepth,
            subPath: subPath ?? self.subPath,
            workspaceID: workspaceID ?? self.workspaceID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - WorkspaceTreeResult
struct WorkspaceTreeResult: Codable, Sendable {
    let root: FileTreeNode

    enum CodingKeys: String, CodingKey {
        case root = "root"
    }
}

// MARK: WorkspaceTreeResult convenience initializers and mutators

extension WorkspaceTreeResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(WorkspaceTreeResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        root: FileTreeNode? = nil
    ) -> WorkspaceTreeResult {
        return WorkspaceTreeResult(
            root: root ?? self.root
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FileTreeNode
struct FileTreeNode: Codable, Sendable {
    let children: [JSONAny]?
    let isDirectory: Bool
    let name: String
    let path: String
    let size: Int?

    enum CodingKeys: String, CodingKey {
        case children = "children"
        case isDirectory = "isDirectory"
        case name = "name"
        case path = "path"
        case size = "size"
    }
}

// MARK: FileTreeNode convenience initializers and mutators

extension FileTreeNode {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FileTreeNode.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        children: [JSONAny]?? = nil,
        isDirectory: Bool? = nil,
        name: String? = nil,
        path: String? = nil,
        size: Int?? = nil
    ) -> FileTreeNode {
        return FileTreeNode(
            children: children ?? self.children,
            isDirectory: isDirectory ?? self.isDirectory,
            name: name ?? self.name,
            path: path ?? self.path,
            size: size ?? self.size
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ChatListParams
struct ChatListParams: Codable, Sendable {
    let kind: ChatKind?
    let workspaceID: String?

    enum CodingKeys: String, CodingKey {
        case kind = "kind"
        case workspaceID = "workspaceId"
    }
}

// MARK: ChatListParams convenience initializers and mutators

extension ChatListParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ChatListParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        kind: ChatKind?? = nil,
        workspaceID: String?? = nil
    ) -> ChatListParams {
        return ChatListParams(
            kind: kind ?? self.kind,
            workspaceID: workspaceID ?? self.workspaceID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ChatListResult
struct ChatListResult: Codable, Sendable {
    let chats: [ChatElement]

    enum CodingKeys: String, CodingKey {
        case chats = "chats"
    }
}

// MARK: ChatListResult convenience initializers and mutators

extension ChatListResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ChatListResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        chats: [ChatElement]? = nil
    ) -> ChatListResult {
        return ChatListResult(
            chats: chats ?? self.chats
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ChatElement
struct ChatElement: Codable, Sendable {
    let createdAt: Int
    let externalThreadID: String?
    let id: String
    let kind: ChatKind
    let providerID: String
    let status: ChatStatus
    let title: String
    let updatedAt: Int
    let workspaceID: String?

    enum CodingKeys: String, CodingKey {
        case createdAt = "createdAt"
        case externalThreadID = "externalThreadId"
        case id = "id"
        case kind = "kind"
        case providerID = "providerId"
        case status = "status"
        case title = "title"
        case updatedAt = "updatedAt"
        case workspaceID = "workspaceId"
    }
}

// MARK: ChatElement convenience initializers and mutators

extension ChatElement {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ChatElement.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        createdAt: Int? = nil,
        externalThreadID: String?? = nil,
        id: String? = nil,
        kind: ChatKind? = nil,
        providerID: String? = nil,
        status: ChatStatus? = nil,
        title: String? = nil,
        updatedAt: Int? = nil,
        workspaceID: String?? = nil
    ) -> ChatElement {
        return ChatElement(
            createdAt: createdAt ?? self.createdAt,
            externalThreadID: externalThreadID ?? self.externalThreadID,
            id: id ?? self.id,
            kind: kind ?? self.kind,
            providerID: providerID ?? self.providerID,
            status: status ?? self.status,
            title: title ?? self.title,
            updatedAt: updatedAt ?? self.updatedAt,
            workspaceID: workspaceID ?? self.workspaceID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ChatGetParams
struct ChatGetParams: Codable, Sendable {
    let chatID: String

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
    }
}

// MARK: ChatGetParams convenience initializers and mutators

extension ChatGetParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ChatGetParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        chatID: String? = nil
    ) -> ChatGetParams {
        return ChatGetParams(
            chatID: chatID ?? self.chatID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ChatGetResult
struct ChatGetResult: Codable, Sendable {
    let chat: Chat
    let messages: [Message]
    let pendingApprovals: [ApprovalRequest]

    enum CodingKeys: String, CodingKey {
        case chat = "chat"
        case messages = "messages"
        case pendingApprovals = "pendingApprovals"
    }
}

// MARK: ChatGetResult convenience initializers and mutators

extension ChatGetResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ChatGetResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        chat: Chat? = nil,
        messages: [Message]? = nil,
        pendingApprovals: [ApprovalRequest]? = nil
    ) -> ChatGetResult {
        return ChatGetResult(
            chat: chat ?? self.chat,
            messages: messages ?? self.messages,
            pendingApprovals: pendingApprovals ?? self.pendingApprovals
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Chat
struct Chat: Codable, Sendable {
    let createdAt: Int
    let externalThreadID: String?
    let id: String
    let kind: ChatKind
    let providerID: String
    let status: ChatStatus
    let title: String
    let updatedAt: Int
    let workspaceID: String?

    enum CodingKeys: String, CodingKey {
        case createdAt = "createdAt"
        case externalThreadID = "externalThreadId"
        case id = "id"
        case kind = "kind"
        case providerID = "providerId"
        case status = "status"
        case title = "title"
        case updatedAt = "updatedAt"
        case workspaceID = "workspaceId"
    }
}

// MARK: Chat convenience initializers and mutators

extension Chat {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Chat.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        createdAt: Int? = nil,
        externalThreadID: String?? = nil,
        id: String? = nil,
        kind: ChatKind? = nil,
        providerID: String? = nil,
        status: ChatStatus? = nil,
        title: String? = nil,
        updatedAt: Int? = nil,
        workspaceID: String?? = nil
    ) -> Chat {
        return Chat(
            createdAt: createdAt ?? self.createdAt,
            externalThreadID: externalThreadID ?? self.externalThreadID,
            id: id ?? self.id,
            kind: kind ?? self.kind,
            providerID: providerID ?? self.providerID,
            status: status ?? self.status,
            title: title ?? self.title,
            updatedAt: updatedAt ?? self.updatedAt,
            workspaceID: workspaceID ?? self.workspaceID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Message
struct Message: Codable, Sendable {
    let blocks: [MessageBlock]
    let chatID: String
    let createdAt: Int
    let id: String
    let role: Role
    let streaming: Bool
    let turnID: String?

    enum CodingKeys: String, CodingKey {
        case blocks = "blocks"
        case chatID = "chatId"
        case createdAt = "createdAt"
        case id = "id"
        case role = "role"
        case streaming = "streaming"
        case turnID = "turnId"
    }
}

// MARK: Message convenience initializers and mutators

extension Message {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Message.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        blocks: [MessageBlock]? = nil,
        chatID: String? = nil,
        createdAt: Int? = nil,
        id: String? = nil,
        role: Role? = nil,
        streaming: Bool? = nil,
        turnID: String?? = nil
    ) -> Message {
        return Message(
            blocks: blocks ?? self.blocks,
            chatID: chatID ?? self.chatID,
            createdAt: createdAt ?? self.createdAt,
            id: id ?? self.id,
            role: role ?? self.role,
            streaming: streaming ?? self.streaming,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - MessageBlock
struct MessageBlock: Codable, Sendable {
    let content: String?
    let type: MessageBlockType
    let completed: Bool?
    let args: [String: JSONAny]?
    let callID: String?
    let name: String?
    let output: String?
    let status: MessageBlockStatus?
    let patch: String?
    let path: String?
    let command: String?
    let cwd: String?
    let exitCode: Int?

    enum CodingKeys: String, CodingKey {
        case content = "content"
        case type = "type"
        case completed = "completed"
        case args = "args"
        case callID = "callId"
        case name = "name"
        case output = "output"
        case status = "status"
        case patch = "patch"
        case path = "path"
        case command = "command"
        case cwd = "cwd"
        case exitCode = "exitCode"
    }
}

// MARK: MessageBlock convenience initializers and mutators

extension MessageBlock {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MessageBlock.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        content: String?? = nil,
        type: MessageBlockType? = nil,
        completed: Bool?? = nil,
        args: [String: JSONAny]?? = nil,
        callID: String?? = nil,
        name: String?? = nil,
        output: String?? = nil,
        status: MessageBlockStatus?? = nil,
        patch: String?? = nil,
        path: String?? = nil,
        command: String?? = nil,
        cwd: String?? = nil,
        exitCode: Int?? = nil
    ) -> MessageBlock {
        return MessageBlock(
            content: content ?? self.content,
            type: type ?? self.type,
            completed: completed ?? self.completed,
            args: args ?? self.args,
            callID: callID ?? self.callID,
            name: name ?? self.name,
            output: output ?? self.output,
            status: status ?? self.status,
            patch: patch ?? self.patch,
            path: path ?? self.path,
            command: command ?? self.command,
            cwd: cwd ?? self.cwd,
            exitCode: exitCode ?? self.exitCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ApprovalRequest
struct ApprovalRequest: Codable, Sendable {
    let chatID: String
    let externalRequestID: String
    let id: String
    let kind: ApprovalRequestKind
    let payload: ApprovalRequestPayload
    let requestedAt: Int
    let resolvedAt: Int?
    let resolvedByDeviceID: String?
    let resolvedByDeviceName: String?
    let status: ApprovalRequestStatus
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case externalRequestID = "externalRequestId"
        case id = "id"
        case kind = "kind"
        case payload = "payload"
        case requestedAt = "requestedAt"
        case resolvedAt = "resolvedAt"
        case resolvedByDeviceID = "resolvedByDeviceId"
        case resolvedByDeviceName = "resolvedByDeviceName"
        case status = "status"
        case turnID = "turnId"
    }
}

// MARK: ApprovalRequest convenience initializers and mutators

extension ApprovalRequest {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ApprovalRequest.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        chatID: String? = nil,
        externalRequestID: String? = nil,
        id: String? = nil,
        kind: ApprovalRequestKind? = nil,
        payload: ApprovalRequestPayload? = nil,
        requestedAt: Int? = nil,
        resolvedAt: Int?? = nil,
        resolvedByDeviceID: String?? = nil,
        resolvedByDeviceName: String?? = nil,
        status: ApprovalRequestStatus? = nil,
        turnID: String? = nil
    ) -> ApprovalRequest {
        return ApprovalRequest(
            chatID: chatID ?? self.chatID,
            externalRequestID: externalRequestID ?? self.externalRequestID,
            id: id ?? self.id,
            kind: kind ?? self.kind,
            payload: payload ?? self.payload,
            requestedAt: requestedAt ?? self.requestedAt,
            resolvedAt: resolvedAt ?? self.resolvedAt,
            resolvedByDeviceID: resolvedByDeviceID ?? self.resolvedByDeviceID,
            resolvedByDeviceName: resolvedByDeviceName ?? self.resolvedByDeviceName,
            status: status ?? self.status,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ApprovalRequestPayload
struct ApprovalRequestPayload: Codable, Sendable {
    let command: String?
    let cwd: String?
    let diff: String?
    let isHighRisk: Bool?
    let path: String?
    let prompt: String?
    let reason: String?

    enum CodingKeys: String, CodingKey {
        case command = "command"
        case cwd = "cwd"
        case diff = "diff"
        case isHighRisk = "isHighRisk"
        case path = "path"
        case prompt = "prompt"
        case reason = "reason"
    }
}

// MARK: ApprovalRequestPayload convenience initializers and mutators

extension ApprovalRequestPayload {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ApprovalRequestPayload.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        command: String?? = nil,
        cwd: String?? = nil,
        diff: String?? = nil,
        isHighRisk: Bool?? = nil,
        path: String?? = nil,
        prompt: String?? = nil,
        reason: String?? = nil
    ) -> ApprovalRequestPayload {
        return ApprovalRequestPayload(
            command: command ?? self.command,
            cwd: cwd ?? self.cwd,
            diff: diff ?? self.diff,
            isHighRisk: isHighRisk ?? self.isHighRisk,
            path: path ?? self.path,
            prompt: prompt ?? self.prompt,
            reason: reason ?? self.reason
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnSendParams
struct TurnSendParams: Codable, Sendable {
    let chatID: String
    let clientMessageID: String?
    let content: String

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case clientMessageID = "clientMessageId"
        case content = "content"
    }
}

// MARK: TurnSendParams convenience initializers and mutators

extension TurnSendParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnSendParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        chatID: String? = nil,
        clientMessageID: String?? = nil,
        content: String? = nil
    ) -> TurnSendParams {
        return TurnSendParams(
            chatID: chatID ?? self.chatID,
            clientMessageID: clientMessageID ?? self.clientMessageID,
            content: content ?? self.content
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnSendResult
struct TurnSendResult: Codable, Sendable {
    let status: ChatStatus
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case status = "status"
        case turnID = "turnId"
    }
}

// MARK: TurnSendResult convenience initializers and mutators

extension TurnSendResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnSendResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        status: ChatStatus? = nil,
        turnID: String? = nil
    ) -> TurnSendResult {
        return TurnSendResult(
            status: status ?? self.status,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnSteerParams
struct TurnSteerParams: Codable, Sendable {
    let chatID: String
    let content: String
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case content = "content"
        case turnID = "turnId"
    }
}

// MARK: TurnSteerParams convenience initializers and mutators

extension TurnSteerParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnSteerParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        chatID: String? = nil,
        content: String? = nil,
        turnID: String? = nil
    ) -> TurnSteerParams {
        return TurnSteerParams(
            chatID: chatID ?? self.chatID,
            content: content ?? self.content,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnInterruptParams
struct TurnInterruptParams: Codable, Sendable {
    let chatID: String
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case turnID = "turnId"
    }
}

// MARK: TurnInterruptParams convenience initializers and mutators

extension TurnInterruptParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnInterruptParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        chatID: String? = nil,
        turnID: String? = nil
    ) -> TurnInterruptParams {
        return TurnInterruptParams(
            chatID: chatID ?? self.chatID,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - DeviceListResult
struct DeviceListResult: Codable, Sendable {
    let devices: [Device]

    enum CodingKeys: String, CodingKey {
        case devices = "devices"
    }
}

// MARK: DeviceListResult convenience initializers and mutators

extension DeviceListResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(DeviceListResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        devices: [Device]? = nil
    ) -> DeviceListResult {
        return DeviceListResult(
            devices: devices ?? self.devices
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Device
struct Device: Codable, Sendable {
    let id: String
    let lastSeenAt: Int
    let lastTransport: LastTransport
    let name: String
    let pairedAt: Int
    let platform: Platform
    let publicKey: String
    let revoked: Bool

    enum CodingKeys: String, CodingKey {
        case id = "id"
        case lastSeenAt = "lastSeenAt"
        case lastTransport = "lastTransport"
        case name = "name"
        case pairedAt = "pairedAt"
        case platform = "platform"
        case publicKey = "publicKey"
        case revoked = "revoked"
    }
}

// MARK: Device convenience initializers and mutators

extension Device {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Device.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        id: String? = nil,
        lastSeenAt: Int? = nil,
        lastTransport: LastTransport? = nil,
        name: String? = nil,
        pairedAt: Int? = nil,
        platform: Platform? = nil,
        publicKey: String? = nil,
        revoked: Bool? = nil
    ) -> Device {
        return Device(
            id: id ?? self.id,
            lastSeenAt: lastSeenAt ?? self.lastSeenAt,
            lastTransport: lastTransport ?? self.lastTransport,
            name: name ?? self.name,
            pairedAt: pairedAt ?? self.pairedAt,
            platform: platform ?? self.platform,
            publicKey: publicKey ?? self.publicKey,
            revoked: revoked ?? self.revoked
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum LastTransport: String, Codable, Sendable {
    case lan = "lan"
    case tailscale = "tailscale"
}

// MARK: - Helper functions for creating encoders and decoders

func newJSONDecoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    if #available(iOS 10.0, OSX 10.12, tvOS 10.0, watchOS 3.0, *) {
        decoder.dateDecodingStrategy = .iso8601
    }
    return decoder
}

func newJSONEncoder() -> JSONEncoder {
    let encoder = JSONEncoder()
    if #available(iOS 10.0, OSX 10.12, tvOS 10.0, watchOS 3.0, *) {
        encoder.dateEncodingStrategy = .iso8601
    }
    return encoder
}

// MARK: - Encode/decode helpers

class JSONNull: Codable, Hashable {

    public static func == (lhs: JSONNull, rhs: JSONNull) -> Bool {
            return true
    }

    public var hashValue: Int {
            return 0
    }

    public init() {}

    public required init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if !container.decodeNil() {
                    throw DecodingError.typeMismatch(JSONNull.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for JSONNull"))
            }
    }

    public func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            try container.encodeNil()
    }
}

class JSONCodingKey: CodingKey {
    let key: String

    required init?(intValue: Int) {
            return nil
    }

    required init?(stringValue: String) {
            key = stringValue
    }

    var intValue: Int? {
            return nil
    }

    var stringValue: String {
            return key
    }
}

class JSONAny: Codable {

    let value: Any

    static func decodingError(forCodingPath codingPath: [CodingKey]) -> DecodingError {
            let context = DecodingError.Context(codingPath: codingPath, debugDescription: "Cannot decode JSONAny")
            return DecodingError.typeMismatch(JSONAny.self, context)
    }

    static func encodingError(forValue value: Any, codingPath: [CodingKey]) -> EncodingError {
            let context = EncodingError.Context(codingPath: codingPath, debugDescription: "Cannot encode JSONAny")
            return EncodingError.invalidValue(value, context)
    }

    static func decode(from container: SingleValueDecodingContainer) throws -> Any {
            if let value = try? container.decode(Bool.self) {
                    return value
            }
            if let value = try? container.decode(Int64.self) {
                    return value
            }
            if let value = try? container.decode(Double.self) {
                    return value
            }
            if let value = try? container.decode(String.self) {
                    return value
            }
            if container.decodeNil() {
                    return JSONNull()
            }
            throw decodingError(forCodingPath: container.codingPath)
    }

    static func decode(from container: inout UnkeyedDecodingContainer) throws -> Any {
            if let value = try? container.decode(Bool.self) {
                    return value
            }
            if let value = try? container.decode(Int64.self) {
                    return value
            }
            if let value = try? container.decode(Double.self) {
                    return value
            }
            if let value = try? container.decode(String.self) {
                    return value
            }
            if let value = try? container.decodeNil() {
                    if value {
                            return JSONNull()
                    }
            }
            if var container = try? container.nestedUnkeyedContainer() {
                    return try decodeArray(from: &container)
            }
            if var container = try? container.nestedContainer(keyedBy: JSONCodingKey.self) {
                    return try decodeDictionary(from: &container)
            }
            throw decodingError(forCodingPath: container.codingPath)
    }

    static func decode(from container: inout KeyedDecodingContainer<JSONCodingKey>, forKey key: JSONCodingKey) throws -> Any {
            if let value = try? container.decode(Bool.self, forKey: key) {
                    return value
            }
            if let value = try? container.decode(Int64.self, forKey: key) {
                    return value
            }
            if let value = try? container.decode(Double.self, forKey: key) {
                    return value
            }
            if let value = try? container.decode(String.self, forKey: key) {
                    return value
            }
            if let value = try? container.decodeNil(forKey: key) {
                    if value {
                            return JSONNull()
                    }
            }
            if var container = try? container.nestedUnkeyedContainer(forKey: key) {
                    return try decodeArray(from: &container)
            }
            if var container = try? container.nestedContainer(keyedBy: JSONCodingKey.self, forKey: key) {
                    return try decodeDictionary(from: &container)
            }
            throw decodingError(forCodingPath: container.codingPath)
    }

    static func decodeArray(from container: inout UnkeyedDecodingContainer) throws -> [Any] {
            var arr: [Any] = []
            while !container.isAtEnd {
                    let value = try decode(from: &container)
                    arr.append(value)
            }
            return arr
    }

    static func decodeDictionary(from container: inout KeyedDecodingContainer<JSONCodingKey>) throws -> [String: Any] {
            var dict = [String: Any]()
            for key in container.allKeys {
                    let value = try decode(from: &container, forKey: key)
                    dict[key.stringValue] = value
            }
            return dict
    }

    static func encode(to container: inout UnkeyedEncodingContainer, array: [Any]) throws {
            for value in array {
                    if let value = value as? Bool {
                            try container.encode(value)
                    } else if let value = value as? Int64 {
                            try container.encode(value)
                    } else if let value = value as? Double {
                            try container.encode(value)
                    } else if let value = value as? String {
                            try container.encode(value)
                    } else if value is JSONNull {
                            try container.encodeNil()
                    } else if let value = value as? [Any] {
                            var container = container.nestedUnkeyedContainer()
                            try encode(to: &container, array: value)
                    } else if let value = value as? [String: Any] {
                            var container = container.nestedContainer(keyedBy: JSONCodingKey.self)
                            try encode(to: &container, dictionary: value)
                    } else {
                            throw encodingError(forValue: value, codingPath: container.codingPath)
                    }
            }
    }

    static func encode(to container: inout KeyedEncodingContainer<JSONCodingKey>, dictionary: [String: Any]) throws {
            for (key, value) in dictionary {
                    let key = JSONCodingKey(stringValue: key)!
                    if let value = value as? Bool {
                            try container.encode(value, forKey: key)
                    } else if let value = value as? Int64 {
                            try container.encode(value, forKey: key)
                    } else if let value = value as? Double {
                            try container.encode(value, forKey: key)
                    } else if let value = value as? String {
                            try container.encode(value, forKey: key)
                    } else if value is JSONNull {
                            try container.encodeNil(forKey: key)
                    } else if let value = value as? [Any] {
                            var container = container.nestedUnkeyedContainer(forKey: key)
                            try encode(to: &container, array: value)
                    } else if let value = value as? [String: Any] {
                            var container = container.nestedContainer(keyedBy: JSONCodingKey.self, forKey: key)
                            try encode(to: &container, dictionary: value)
                    } else {
                            throw encodingError(forValue: value, codingPath: container.codingPath)
                    }
            }
    }

    static func encode(to container: inout SingleValueEncodingContainer, value: Any) throws {
            if let value = value as? Bool {
                    try container.encode(value)
            } else if let value = value as? Int64 {
                    try container.encode(value)
            } else if let value = value as? Double {
                    try container.encode(value)
            } else if let value = value as? String {
                    try container.encode(value)
            } else if value is JSONNull {
                    try container.encodeNil()
            } else {
                    throw encodingError(forValue: value, codingPath: container.codingPath)
            }
    }

    public required init(from decoder: Decoder) throws {
            if var arrayContainer = try? decoder.unkeyedContainer() {
                    self.value = try JSONAny.decodeArray(from: &arrayContainer)
            } else if var container = try? decoder.container(keyedBy: JSONCodingKey.self) {
                    self.value = try JSONAny.decodeDictionary(from: &container)
            } else {
                    let container = try decoder.singleValueContainer()
                    self.value = try JSONAny.decode(from: container)
            }
    }

    public func encode(to encoder: Encoder) throws {
            if let arr = self.value as? [Any] {
                    var container = encoder.unkeyedContainer()
                    try JSONAny.encode(to: &container, array: arr)
            } else if let dict = self.value as? [String: Any] {
                    var container = encoder.container(keyedBy: JSONCodingKey.self)
                    try JSONAny.encode(to: &container, dictionary: dict)
            } else {
                    var container = encoder.singleValueContainer()
                    try JSONAny.encode(to: &container, value: self.value)
            }
    }
}
