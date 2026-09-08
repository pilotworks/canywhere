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
