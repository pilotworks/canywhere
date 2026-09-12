import Foundation
import UserNotifications
import UIKit

@MainActor
final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()

    // Notification categories and action identifiers
    enum Category {
        static let approvalRequest = "CANYWHERE_APPROVAL_REQUEST"
        static let turnCompleted = "CANYWHERE_TURN_COMPLETED"
    }

    enum Action {
        static let approve = "ACTION_APPROVE"
        static let decline = "ACTION_DECLINE"
        static let viewChat = "ACTION_VIEW_CHAT"
    }

    private var isConfigured = false

    private override init() {
        super.init()
    }

    func configure() {
        guard !isConfigured else { return }
        isConfigured = true

        let center = UNUserNotificationCenter.current()
        center.delegate = self

        registerCategories()
        setupDarwinObserver()
    }

    private func setupDarwinObserver() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let name = "com.canywhere.intent.approval" as CFString
        CFNotificationCenterAddObserver(
            center,
            Unmanaged.passUnretained(self).toOpaque(),
            { _, observer, _, _, _ in
                guard let observer = observer else { return }
                let manager = Unmanaged<NotificationManager>.fromOpaque(observer).takeUnretainedValue()
                Task { @MainActor in
                    manager.handlePendingIntentDecision()
                }
            },
            name,
            nil,
            .deliverImmediately
        )
    }

    func handlePendingIntentDecision() {
        let defaults = UserDefaults(suiteName: "group.com.canywhere.mobile") ?? UserDefaults.standard
        if let dict = defaults.dictionary(forKey: "pending_intent_decision") as? [String: String],
           let id = dict["id"],
           let decision = dict["decision"] {
            defaults.removeObject(forKey: "pending_intent_decision")
            print("⚡ [NotificationManager] Handled LiveActivityIntent decision: \(decision) for \(id)")
            Task {
                await AppSessionState.shared.respondToApproval(approvalId: id, decision: decision)
            }
        }
    }

    func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            print("🔔 [NotificationManager] Notification permission granted: \(granted)")
            return granted
        } catch {
            print("⚠️ [NotificationManager] Failed to request authorization: \(error)")
            return false
        }
    }

    func checkAuthorizationStatus() async -> UNAuthorizationStatus {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        return settings.authorizationStatus
    }

    private func registerCategories() {
        // Approve Action (with authentication required if device protected)
        let approveAction = UNNotificationAction(
            identifier: Action.approve,
            title: "Approve Execution",
            options: [.foreground]
        )

        let declineAction = UNNotificationAction(
            identifier: Action.decline,
            title: "Decline",
            options: [.destructive]
        )

        let approvalCategory = UNNotificationCategory(
            identifier: Category.approvalRequest,
            actions: [approveAction, declineAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )

        let viewChatAction = UNNotificationAction(
            identifier: Action.viewChat,
            title: "Open Chat",
            options: [.foreground]
        )

        let turnCategory = UNNotificationCategory(
            identifier: Category.turnCompleted,
            actions: [viewChatAction],
            intentIdentifiers: [],
            options: []
        )

        UNUserNotificationCenter.current().setNotificationCategories([approvalCategory, turnCategory])
    }

    // MARK: - Scheduling Notifications

    func scheduleApprovalNotification(
        approval: ApprovalRequest,
        chatTitle: String? = nil,
        workspaceName: String? = nil
    ) {
        let content = UNMutableNotificationContent()
        let prefix = workspaceName.map { "\($0) - " } ?? ""
        content.title = "\(prefix)Action Review Required"

        if let cmd = approval.payload.command {
            content.body = "Command: \(cmd)"
        } else if let reason = approval.payload.reason ?? approval.payload.prompt {
            content.body = reason
        } else if approval.payload.diff != nil {
            content.body = "Patch awaiting review for file modifications."
        } else {
            content.body = "An agent action requires your confirmation."
        }

        if let chatTitle = chatTitle {
            content.subtitle = chatTitle
        }

        content.categoryIdentifier = Category.approvalRequest
        content.sound = .defaultCritical
        content.userInfo = [
            "approvalId": approval.id,
            "chatId": approval.chatID
        ]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        let identifier = "approval-\(approval.id)"
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("⚠️ [NotificationManager] Failed to schedule approval notification: \(error)")
            }
        }
    }

    func scheduleTurnCompletedNotification(
        chatId: String,
        status: ChatStatus,
        chatTitle: String? = nil,
        workspaceName: String? = nil,
        error: String? = nil
    ) {
        let content = UNMutableNotificationContent()
        let prefix = workspaceName.map { "\($0) - " } ?? ""
        let isSuccess = (status == .idle)

        content.title = isSuccess ? "\(prefix)Task Completed" : "\(prefix)Task Failed"
        content.subtitle = chatTitle ?? "Turn execution finished"

        if let error = error {
            content.body = error
        } else {
            content.body = isSuccess ? "Agent successfully concluded the turn." : "Turn was interrupted or failed."
        }

        content.categoryIdentifier = Category.turnCompleted
        content.sound = .default
        content.userInfo = [
            "chatId": chatId,
            "status": status.rawValue
        ]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        let identifier = "turn-\(chatId)-\(Date().timeIntervalSince1970)"
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request) { err in
            if let err = err {
                print("⚠️ [NotificationManager] Failed to schedule turn notification: \(err)")
            }
        }
    }

    func dismissApprovalNotification(approvalId: String) {
        let id = "approval-\(approvalId)"
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [id])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }

    // MARK: - UNUserNotificationCenterDelegate

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner and play sound even when app is active in foreground
        completionHandler([.banner, .sound, .badge])
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let approvalId = response.notification.request.content.userInfo["approvalId"] as? String
        let actionIdentifier = response.actionIdentifier

        if let approvalId = approvalId {
            Task { @MainActor in
                if actionIdentifier == Action.approve {
                    print("✅ [NotificationManager] User approved action from notification: \(approvalId)")
                    Haptics.shared.notification(.success)
                    await AppSessionState.shared.respondToApproval(approvalId: approvalId, decision: "accept")
                } else if actionIdentifier == Action.decline {
                    print("🚫 [NotificationManager] User declined action from notification: \(approvalId)")
                    Haptics.shared.notification(.warning)
                    await AppSessionState.shared.respondToApproval(approvalId: approvalId, decision: "decline")
                }
            }
        }

        completionHandler()
    }
}
