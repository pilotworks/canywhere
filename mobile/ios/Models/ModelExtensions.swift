import Foundation

extension Chat: Identifiable {
    var workspaceId: String? {
        workspaceID
    }
    var providerId: String {
        providerID
    }
}
extension Message: Identifiable, Equatable {
    public static func == (lhs: Message, rhs: Message) -> Bool {
        return lhs.id == rhs.id &&
            lhs.chatID == rhs.chatID &&
            lhs.role == rhs.role &&
            lhs.streaming == rhs.streaming &&
            lhs.turnID == rhs.turnID &&
            lhs.createdAt == rhs.createdAt &&
            lhs.blocks == rhs.blocks
    }
}

extension MessageBlock: Equatable {
    public static func == (lhs: MessageBlock, rhs: MessageBlock) -> Bool {
        return lhs.type == rhs.type &&
            lhs.content == rhs.content &&
            lhs.completed == rhs.completed &&
            lhs.callID == rhs.callID &&
            lhs.name == rhs.name &&
            lhs.output == rhs.output &&
            lhs.status == rhs.status &&
            lhs.patch == rhs.patch &&
            lhs.path == rhs.path &&
            lhs.command == rhs.command &&
            lhs.cwd == rhs.cwd &&
            lhs.exitCode == rhs.exitCode
    }
}
extension Workspace: Identifiable {}
extension ApprovalRequest: Identifiable {}
extension Provider: Identifiable {}

typealias ToolCallStatus = Status

extension MessageBlock {
    static func text(_ content: String) -> MessageBlock {
        MessageBlock(
            content: content,
            type: .text,
            completed: nil,
            args: nil,
            callID: nil,
            name: nil,
            output: nil,
            status: nil,
            patch: nil,
            path: nil,
            command: nil,
            cwd: nil,
            exitCode: nil
        )
    }

    static func reasoning(_ content: String, completed: Bool) -> MessageBlock {
        MessageBlock(
            content: content,
            type: .reasoning,
            completed: completed,
            args: nil,
            callID: nil,
            name: nil,
            output: nil,
            status: nil,
            patch: nil,
            path: nil,
            command: nil,
            cwd: nil,
            exitCode: nil
        )
    }
}

// MARK: - Workspace File Search & Slash Command Models

struct FuzzyFileMatchItem: Identifiable, Codable, Sendable, Equatable {
    var id: String { path }
    let path: String
    let root: String
    let fileName: String
    let matchType: String
    let score: UInt32?
    let indices: [UInt32]?
}

struct WorkspaceFileSearchResult: Codable, Sendable {
    let files: [FuzzyFileMatchItem]
}

struct SlashCommandItem: Identifiable, Sendable, Equatable {
    var id: String { cmd }
    let cmd: String
    let desc: String
    let category: String
    let iconSystemName: String
    let requiresArgs: Bool

    static func iconForName(_ icon: String?) -> String {
        switch icon {
        case "git-compare":
            return "arrow.triangle.2.circlepath"
        case "minimize":
            return "arrow.down.right.and.arrow.up.left"
        case "target":
            return "scope"
        case "book-open":
            return "book"
        case "message-circle-question":
            return "questionmark.bubble"
        case "globe":
            return "globe"
        default:
            return "terminal"
        }
    }

    static let systemCommands: [SlashCommandItem] = [
        SlashCommandItem(
            cmd: "/reset",
            desc: "Start a clean conversation thread in the current workspace",
            category: "chat",
            iconSystemName: "arrow.counterclockwise",
            requiresArgs: false
        ),
        SlashCommandItem(
            cmd: "/scratch",
            desc: "Create an ephemeral standalone scratchpad chat",
            category: "chat",
            iconSystemName: "sparkles",
            requiresArgs: false
        )
    ]

    static func buildCommands(from providerCommands: [ProviderCommand]?) -> [SlashCommandItem] {
        let dynamicList: [SlashCommandItem] = (providerCommands ?? []).map { pc in
            SlashCommandItem(
                cmd: pc.name.hasPrefix("/") ? pc.name : "/\(pc.name)",
                desc: pc.description,
                category: pc.category,
                iconSystemName: iconForName(pc.icon),
                requiresArgs: pc.requiresArgs ?? false
            )
        }
        return dynamicList + systemCommands
    }

    static let availableCommands: [SlashCommandItem] = [
        SlashCommandItem(
            cmd: "/review",
            desc: "Run automated git review on uncommitted changes",
            category: "agent",
            iconSystemName: "arrow.triangle.2.circlepath",
            requiresArgs: false
        ),
        SlashCommandItem(
            cmd: "/compact",
            desc: "Compact conversational context & summarize thread history",
            category: "agent",
            iconSystemName: "arrow.down.right.and.arrow.up.left",
            requiresArgs: false
        ),
        SlashCommandItem(
            cmd: "/reset",
            desc: "Start a clean conversation thread in the current workspace",
            category: "chat",
            iconSystemName: "arrow.counterclockwise",
            requiresArgs: false
        ),
        SlashCommandItem(
            cmd: "/scratch",
            desc: "Create an ephemeral standalone scratchpad chat",
            category: "chat",
            iconSystemName: "sparkles",
            requiresArgs: false
        )
    ]
}
