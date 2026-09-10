// This file was generated from JSON Schema using quicktype, do not modify it directly.
// To parse the JSON, add this file to your project and do:
//
//   let device = try Device(json)
//   let provider = try Provider(json)
//   let pairingResponse = try PairingResponse(json)
//   let pairingQrPayload = try PairingQrPayload(json)
//   let chat = try Chat(json)
//   let workspace = try Workspace(json)
//   let approvalRequest = try ApprovalRequest(json)
//   let message = try Message(json)

import Foundation

// MARK: - Device
struct Device: Codable, Sendable {
    let id: String
    let lastSeenAt: Int
    let lastTransport: DeviceTransport
    let name: String
    let pairedAt: Int
    let platform: DevicePlatform
    let publicKey: String
    let revoked: Bool
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
        lastTransport: DeviceTransport? = nil,
        name: String? = nil,
        pairedAt: Int? = nil,
        platform: DevicePlatform? = nil,
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

enum DeviceTransport: String, Codable, Sendable {
    case lan = "lan"
    case tailscale = "tailscale"
}

enum DevicePlatform: String, Codable, Sendable {
    case desktop = "desktop"
    case ios = "ios"
}

// MARK: - Provider
struct Provider: Codable, Sendable {
    let actions: [ProviderAction]?
    let capabilities: AdapterCapabilities
    let commands: [ProviderCommand]?
    let description: String
    let icon: String?
    let id: String
    let isConfigured: Bool
    let name: String
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
        actions: [ProviderAction]?? = nil,
        capabilities: AdapterCapabilities? = nil,
        commands: [ProviderCommand]?? = nil,
        description: String? = nil,
        icon: String?? = nil,
        id: String? = nil,
        isConfigured: Bool? = nil,
        name: String? = nil
    ) -> Provider {
        return Provider(
            actions: actions ?? self.actions,
            capabilities: capabilities ?? self.capabilities,
            commands: commands ?? self.commands,
            description: description ?? self.description,
            icon: icon ?? self.icon,
            id: id ?? self.id,
            isConfigured: isConfigured ?? self.isConfigured,
            name: name ?? self.name
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ProviderAction
struct ProviderAction: Codable, Sendable {
    let icon: String?
    let id, label, placement: String
}

// MARK: ProviderAction convenience initializers and mutators

extension ProviderAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ProviderAction.self, from: data)
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
        icon: String?? = nil,
        id: String? = nil,
        label: String? = nil,
        placement: String? = nil
    ) -> ProviderAction {
        return ProviderAction(
            icon: icon ?? self.icon,
            id: id ?? self.id,
            label: label ?? self.label,
            placement: placement ?? self.placement
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
    let supportedModes: [String]?
    let supportsApprovals: Bool?
    let supportsFileDiffs, supportsInterrupt, supportsReasoningStream, supportsSessionResumption: Bool
    let supportsSteering: Bool
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
        supportedModes: [String]?? = nil,
        supportsApprovals: Bool?? = nil,
        supportsFileDiffs: Bool? = nil,
        supportsInterrupt: Bool? = nil,
        supportsReasoningStream: Bool? = nil,
        supportsSessionResumption: Bool? = nil,
        supportsSteering: Bool? = nil
    ) -> AdapterCapabilities {
        return AdapterCapabilities(
            supportedModes: supportedModes ?? self.supportedModes,
            supportsApprovals: supportsApprovals ?? self.supportsApprovals,
            supportsFileDiffs: supportsFileDiffs ?? self.supportsFileDiffs,
            supportsInterrupt: supportsInterrupt ?? self.supportsInterrupt,
            supportsReasoningStream: supportsReasoningStream ?? self.supportsReasoningStream,
            supportsSessionResumption: supportsSessionResumption ?? self.supportsSessionResumption,
            supportsSteering: supportsSteering ?? self.supportsSteering
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ProviderCommand
struct ProviderCommand: Codable, Sendable {
    let category, description: String
    let icon: String?
    let name: String
    let requiresArgs: Bool?
}

// MARK: ProviderCommand convenience initializers and mutators

extension ProviderCommand {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ProviderCommand.self, from: data)
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
        category: String? = nil,
        description: String? = nil,
        icon: String?? = nil,
        name: String? = nil,
        requiresArgs: Bool?? = nil
    ) -> ProviderCommand {
        return ProviderCommand(
            category: category ?? self.category,
            description: description ?? self.description,
            icon: icon ?? self.icon,
            name: name ?? self.name,
            requiresArgs: requiresArgs ?? self.requiresArgs
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PairingResponse
struct PairingResponse: Codable, Sendable {
    let authToken, hostID, status: String

    enum CodingKeys: String, CodingKey {
        case authToken
        case hostID = "hostId"
        case status
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
        status: String? = nil
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

// MARK: - PairingQrPayload
struct PairingQrPayload: Codable, Sendable {
    let endpoints: [String]
    let expiresAt: Int
    let hostID, hostName, hostPublicKey, token: String

    enum CodingKeys: String, CodingKey {
        case endpoints, expiresAt
        case hostID = "hostId"
        case hostName, hostPublicKey, token
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

// MARK: - Chat
struct Chat: Codable, Sendable {
    let createdAt: Int
    let externalThreadID: String?
    let id: String
    let kind: ChatKind
    let permissionMode: PermissionMode?
    let providerID: String
    let status: ChatStatus
    let title: String
    let updatedAt: Int
    let workspaceID: String?

    enum CodingKeys: String, CodingKey {
        case createdAt
        case externalThreadID = "externalThreadId"
        case id, kind, permissionMode
        case providerID = "providerId"
        case status, title, updatedAt
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
        permissionMode: PermissionMode?? = nil,
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
            permissionMode: permissionMode ?? self.permissionMode,
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

enum ChatKind: String, Codable, Sendable {
    case standalone = "standalone"
    case workspace = "workspace"
}

enum PermissionMode: String, Codable, Sendable {
    case auto = "auto"
    case onRequest = "onRequest"
    case readOnly = "readOnly"
}

enum ChatStatus: String, Codable, Sendable {
    case awaitingApproval = "awaitingApproval"
    case error = "error"
    case idle = "idle"
    case running = "running"
}

// MARK: - Workspace
struct Workspace: Codable, Sendable {
    let createdAt: Int
    let id: String
    let lastOpenedAt: Int
    let name, providerID, rootPath: String
    let subPaths: [String]

    enum CodingKeys: String, CodingKey {
        case createdAt, id, lastOpenedAt, name
        case providerID = "providerId"
        case rootPath, subPaths
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

// MARK: - ApprovalRequest
struct ApprovalRequest: Codable, Sendable {
    let chatID, externalRequestID, id: String
    let kind: ApprovalKind
    let payload: ApprovalPayload
    let requestedAt: Int
    let resolvedAt: Int?
    let resolvedByDeviceID, resolvedByDeviceName: String?
    let status: ApprovalStatus
    let turnID: String

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case externalRequestID = "externalRequestId"
        case id, kind, payload, requestedAt, resolvedAt
        case resolvedByDeviceID = "resolvedByDeviceId"
        case resolvedByDeviceName, status
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
        kind: ApprovalKind? = nil,
        payload: ApprovalPayload? = nil,
        requestedAt: Int? = nil,
        resolvedAt: Int?? = nil,
        resolvedByDeviceID: String?? = nil,
        resolvedByDeviceName: String?? = nil,
        status: ApprovalStatus? = nil,
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

enum ApprovalKind: String, Codable, Sendable {
    case command = "command"
    case fileChange = "file_change"
    case userInput = "user_input"
}

// MARK: - ApprovalPayload
struct ApprovalPayload: Codable, Sendable {
    let command, cwd, diff: String?
    let isHighRisk: Bool?
    let path, prompt, reason: String?
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

enum ApprovalStatus: String, Codable, Sendable {
    case approved = "approved"
    case canceled = "canceled"
    case denied = "denied"
    case pending = "pending"
}

// MARK: - Message
struct Message: Codable, Sendable {
    let blocks: [MessageBlock]
    let chatID: String
    let createdAt: Int
    let id: String
    let role: MessageRole
    let streaming: Bool
    let turnID: String?

    enum CodingKeys: String, CodingKey {
        case blocks
        case chatID = "chatId"
        case createdAt, id, role, streaming
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
        role: MessageRole? = nil,
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
    let type: TypeEnum
    let completed: Bool?
    let args: JSONAny?
    let callID, name: String?
    let output: String?
    let status: Status?
    let patch, path, command, cwd: String?
    let exitCode: Int?

    enum CodingKeys: String, CodingKey {
        case content, type, completed, args
        case callID = "callId"
        case name, output, status, patch, path, command, cwd, exitCode
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
        type: TypeEnum? = nil,
        completed: Bool?? = nil,
        args: JSONAny?? = nil,
        callID: String?? = nil,
        name: String?? = nil,
        output: String?? = nil,
        status: Status?? = nil,
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

enum Status: String, Codable, Sendable {
    case applied = "applied"
    case completed = "completed"
    case failed = "failed"
    case pendingApproval = "pendingApproval"
    case proposed = "proposed"
    case rejected = "rejected"
    case running = "running"
}

enum TypeEnum: String, Codable, Sendable {
    case commandExec = "command_exec"
    case fileDiff = "file_diff"
    case plan = "plan"
    case reasoning = "reasoning"
    case text = "text"
    case toolCall = "tool_call"
}

enum MessageRole: String, Codable, Sendable {
    case agent = "agent"
    case system = "system"
    case user = "user"
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

final class JSONNull: Codable, Hashable, @unchecked Sendable {

    public static func == (lhs: JSONNull, rhs: JSONNull) -> Bool {
        return true
    }

    public var hashValue: Int {
        return 0
    }

    public func hash(into hasher: inout Hasher) {
        // No-op
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

final class JSONCodingKey: CodingKey, @unchecked Sendable {
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

final class JSONAny: Codable, @unchecked Sendable {

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
