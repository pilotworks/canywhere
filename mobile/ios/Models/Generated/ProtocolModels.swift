// This file was generated from JSON Schema using quicktype, do not modify it directly.
// To parse the JSON, add this file to your project and do:
//
//   let chat = try Chat(json)

import Foundation

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
        case createdAt
        case externalThreadID = "externalThreadId"
        case id, kind
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

enum ChatKind: String, Codable, Sendable {
    case standalone = "standalone"
    case workspace = "workspace"
}

enum ChatStatus: String, Codable, Sendable {
    case awaitingApproval = "awaitingApproval"
    case error = "error"
    case idle = "idle"
    case running = "running"
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
