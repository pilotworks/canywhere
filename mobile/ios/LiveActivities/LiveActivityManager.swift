@preconcurrency import ActivityKit
import Foundation
import SwiftUI

@MainActor
final class LiveActivityManager {
    static let shared = LiveActivityManager()

    private var activeActivities: [String: Activity<CanywhereActivityAttributes>] = [:]
    private var activityStartTimes: [String: Date] = [:]
    private var toolCounts: [String: Int] = [:]

    private init() {}

    var areActivitiesEnabled: Bool {
        ActivityAuthorizationInfo().areActivitiesEnabled
    }

    // MARK: - Lifecycle Management

    func startActivity(
        chatId: String,
        chatTitle: String,
        workspaceName: String,
        providerName: String
    ) {
        guard areActivitiesEnabled else {
            print("ℹ️ [LiveActivityManager] Live Activities not enabled on this device.")
            return
        }

        // End any existing activity for this chat
        if let existing = activeActivities[chatId] {
            Task {
                await Self.performImmediateEnd(activity: existing)
            }
        }

        let attributes = CanywhereActivityAttributes(
            chatId: chatId,
            chatTitle: chatTitle,
            workspaceName: workspaceName,
            providerName: providerName
        )

        let startTime = Date()
        activityStartTimes[chatId] = startTime
        toolCounts[chatId] = 0

        let initialContentState = CanywhereActivityAttributes.ContentState(
            status: "running",
            currentStepTitle: "Agent started turn...",
            activeTool: nil,
            pendingApprovalId: nil,
            pendingApprovalCommand: nil,
            toolCount: 0,
            startedAt: startTime,
            updatedAt: startTime
        )

        do {
            let activity = try Activity<CanywhereActivityAttributes>.request(
                attributes: attributes,
                content: .init(state: initialContentState, staleDate: nil),
                pushType: nil
            )
            activeActivities[chatId] = activity
            print("🚀 [LiveActivityManager] Started Live Activity: \(activity.id) for chat: \(chatId)")
        } catch {
            print("⚠️ [LiveActivityManager] Failed to request Live Activity: \(error)")
        }
    }

    func updateStep(
        chatId: String,
        stepTitle: String,
        activeTool: String? = nil
    ) {
        guard let activity = activeActivities[chatId] else { return }

        let currentCount = (toolCounts[chatId] ?? 0) + (activeTool != nil ? 1 : 0)
        toolCounts[chatId] = currentCount
        let startTime = activityStartTimes[chatId] ?? Date()

        let state = CanywhereActivityAttributes.ContentState(
            status: "running",
            currentStepTitle: stepTitle,
            activeTool: activeTool,
            pendingApprovalId: nil,
            pendingApprovalCommand: nil,
            toolCount: currentCount,
            startedAt: startTime,
            updatedAt: Date()
        )

        Task {
            await Self.performUpdate(activity: activity, state: state, relevance: 1.0)
        }
    }

    func updateApproval(
        chatId: String,
        approvalId: String,
        command: String?
    ) {
        guard let activity = activeActivities[chatId] else { return }

        let count = toolCounts[chatId] ?? 0
        let startTime = activityStartTimes[chatId] ?? Date()

        let state = CanywhereActivityAttributes.ContentState(
            status: "awaitingApproval",
            currentStepTitle: command != nil ? "Action Review: \(command!)" : "Action Review Required",
            activeTool: "approval",
            pendingApprovalId: approvalId,
            pendingApprovalCommand: command,
            toolCount: count,
            startedAt: startTime,
            updatedAt: Date()
        )

        Task {
            await Self.performUpdate(activity: activity, state: state, relevance: 2.0)
        }
    }

    func resolveApproval(chatId: String) {
        guard let activity = activeActivities[chatId] else { return }

        let count = toolCounts[chatId] ?? 0
        let startTime = activityStartTimes[chatId] ?? Date()

        let state = CanywhereActivityAttributes.ContentState(
            status: "running",
            currentStepTitle: "Approval granted. Resuming execution...",
            activeTool: nil,
            pendingApprovalId: nil,
            pendingApprovalCommand: nil,
            toolCount: count,
            startedAt: startTime,
            updatedAt: Date()
        )

        Task {
            await Self.performUpdate(activity: activity, state: state, relevance: 1.0)
        }
    }

    func endActivity(chatId: String, status: String) {
        guard let activity = activeActivities.removeValue(forKey: chatId) else { return }

        let count = toolCounts.removeValue(forKey: chatId) ?? 0
        let startTime = activityStartTimes.removeValue(forKey: chatId) ?? Date()

        let isSuccess = (status == "completed" || status == "idle")
        let finalStatus = isSuccess ? "completed" : "failed"
        let finalTitle = isSuccess ? "Task Completed" : "Turn Failed"

        let finalState = CanywhereActivityAttributes.ContentState(
            status: finalStatus,
            currentStepTitle: finalTitle,
            activeTool: nil,
            pendingApprovalId: nil,
            pendingApprovalCommand: nil,
            toolCount: count,
            startedAt: startTime,
            updatedAt: Date()
        )

        Task {
            await Self.performEnd(activity: activity, state: finalState, dismissAfterSeconds: 5.0)
            print("🏁 [LiveActivityManager] Ended Live Activity for chat: \(chatId) (status: \(finalStatus))")
        }
    }

    func endAllActivities() {
        for (_, activity) in activeActivities {
            Task {
                await Self.performImmediateEnd(activity: activity)
            }
        }
        activeActivities.removeAll()
        activityStartTimes.removeAll()
        toolCounts.removeAll()
    }

    // MARK: - Concurrency-Safe Isolated ActivityKit Helpers

    nonisolated private static func performUpdate(
        activity: Activity<CanywhereActivityAttributes>,
        state: CanywhereActivityAttributes.ContentState,
        relevance: Double = 1.0
    ) async {
        let content = ActivityContent(state: state, staleDate: nil, relevanceScore: relevance)
        await activity.update(content)
    }

    nonisolated private static func performEnd(
        activity: Activity<CanywhereActivityAttributes>,
        state: CanywhereActivityAttributes.ContentState,
        dismissAfterSeconds: TimeInterval? = nil
    ) async {
        let content = ActivityContent(state: state, staleDate: nil)
        let policy: ActivityUIDismissalPolicy = dismissAfterSeconds != nil
            ? .after(Date().addingTimeInterval(dismissAfterSeconds!))
            : .default
        await activity.end(content, dismissalPolicy: policy)
    }

    nonisolated private static func performImmediateEnd(
        activity: Activity<CanywhereActivityAttributes>
    ) async {
        await activity.end(dismissalPolicy: .immediate)
    }
}
