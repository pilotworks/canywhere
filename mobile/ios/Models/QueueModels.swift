import Foundation

struct QueuedMessage: Identifiable, Equatable, Sendable, Codable {
    let id: String
    let chatId: String
    var content: String
    let model: String?
    let reasoningEffort: String?
    let permissionMode: PermissionMode?
    let sequence: Int?
    let createdAt: Int64

    var effort: String? {
        reasoningEffort
    }

    init(
        id: String = UUID().uuidString,
        chatId: String,
        content: String,
        model: String? = nil,
        reasoningEffort: String? = nil,
        permissionMode: PermissionMode? = nil,
        sequence: Int? = nil,
        createdAt: Int64 = Int64(Date().timeIntervalSince1970 * 1000)
    ) {
        self.id = id
        self.chatId = chatId
        self.content = content
        self.model = model
        self.reasoningEffort = reasoningEffort
        self.permissionMode = permissionMode
        self.sequence = sequence
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case chatId
        case content
        case model
        case reasoningEffort
        case effort
        case permissionMode
        case sequence
        case createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        chatId = try container.decode(String.self, forKey: .chatId)
        content = try container.decode(String.self, forKey: .content)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        reasoningEffort = try container.decodeIfPresent(String.self, forKey: .reasoningEffort)
            ?? container.decodeIfPresent(String.self, forKey: .effort)
        permissionMode = try container.decodeIfPresent(PermissionMode.self, forKey: .permissionMode)
        sequence = try container.decodeIfPresent(Int.self, forKey: .sequence)
        createdAt = try container.decodeIfPresent(Int64.self, forKey: .createdAt) ?? Int64(Date().timeIntervalSince1970 * 1000)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(chatId, forKey: .chatId)
        try container.encode(content, forKey: .content)
        try container.encodeIfPresent(model, forKey: .model)
        try container.encodeIfPresent(reasoningEffort, forKey: .reasoningEffort)
        try container.encodeIfPresent(permissionMode, forKey: .permissionMode)
        try container.encodeIfPresent(sequence, forKey: .sequence)
        try container.encode(createdAt, forKey: .createdAt)
    }
}
