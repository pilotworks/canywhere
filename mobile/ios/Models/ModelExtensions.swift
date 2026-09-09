import Foundation

extension Chat: Identifiable {
    var workspaceId: String? {
        workspaceID
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

    static let availableCommands: [SlashCommandItem] = [
        SlashCommandItem(
            cmd: "/review",
            desc: "Run automated git review on uncommitted changes via Codex app-server",
            category: "codex",
            iconSystemName: "arrow.triangle.2.circlepath"
        ),
        SlashCommandItem(
            cmd: "/compact",
            desc: "Compact conversational context & summarize thread history via Codex",
            category: "codex",
            iconSystemName: "arrow.down.right.and.arrow.up.left"
        ),
        SlashCommandItem(
            cmd: "/reset",
            desc: "Start a clean conversation thread in the current workspace",
            category: "chat",
            iconSystemName: "arrow.counterclockwise"
        ),
        SlashCommandItem(
            cmd: "/scratch",
            desc: "Create an ephemeral standalone scratchpad chat",
            category: "chat",
            iconSystemName: "sparkles"
        )
    ]
}
