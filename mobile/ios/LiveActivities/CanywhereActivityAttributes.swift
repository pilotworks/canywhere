import ActivityKit
import Foundation

public struct CanywhereActivityAttributes: ActivityAttributes, Sendable {
    public struct ContentState: Codable, Hashable, Sendable {
        public var status: String            // "running", "awaitingApproval", "completed", "failed"
        public var currentStepTitle: String  // e.g. "Running cargo test...", "Editing src/main.rs"
        public var activeTool: String?       // "bash", "edit", "think"
        public var pendingApprovalId: String?
        public var pendingApprovalCommand: String?
        public var toolCount: Int
        public var startedAt: Date
        public var updatedAt: Date

        public init(
            status: String = "running",
            currentStepTitle: String = "Thinking...",
            activeTool: String? = nil,
            pendingApprovalId: String? = nil,
            pendingApprovalCommand: String? = nil,
            toolCount: Int = 0,
            startedAt: Date = Date(),
            updatedAt: Date = Date()
        ) {
            self.status = status
            self.currentStepTitle = currentStepTitle
            self.activeTool = activeTool
            self.pendingApprovalId = pendingApprovalId
            self.pendingApprovalCommand = pendingApprovalCommand
            self.toolCount = toolCount
            self.startedAt = startedAt
            self.updatedAt = updatedAt
        }
    }

    public var chatId: String
    public var chatTitle: String
    public var workspaceName: String
    public var providerName: String

    public init(
        chatId: String,
        chatTitle: String,
        workspaceName: String,
        providerName: String
    ) {
        self.chatId = chatId
        self.chatTitle = chatTitle
        self.workspaceName = workspaceName
        self.providerName = providerName
    }
}
