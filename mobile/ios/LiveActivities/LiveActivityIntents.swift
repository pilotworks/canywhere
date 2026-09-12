import AppIntents
import Foundation

@available(iOS 17.0, *)
public struct ApproveLiveActivityIntent: LiveActivityIntent {
    public static let title: LocalizedStringResource = "Approve Action"
    public static let description = IntentDescription("Approve the pending agent command or patch execution")

    @Parameter(title: "Approval ID")
    public var approvalId: String

    public init() {}

    public init(approvalId: String) {
        self.approvalId = approvalId
    }

    public func perform() async throws -> some IntentResult {
        // Post Darwin notification or update shared state for daemon dispatch
        let defaults = UserDefaults(suiteName: "group.com.canywhere.mobile") ?? UserDefaults.standard
        defaults.set(["id": approvalId, "decision": "accept"], forKey: "pending_intent_decision")
        let name = CFNotificationName("com.canywhere.intent.approval" as CFString)
        CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), name, nil, nil, true)
        return .result()
    }
}

@available(iOS 17.0, *)
public struct DeclineLiveActivityIntent: LiveActivityIntent {
    public static let title: LocalizedStringResource = "Decline Action"
    public static let description = IntentDescription("Decline the pending agent command or patch execution")

    @Parameter(title: "Approval ID")
    public var approvalId: String

    public init() {}

    public init(approvalId: String) {
        self.approvalId = approvalId
    }

    public func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: "group.com.canywhere.mobile") ?? UserDefaults.standard
        defaults.set(["id": approvalId, "decision": "decline"], forKey: "pending_intent_decision")
        let name = CFNotificationName("com.canywhere.intent.approval" as CFString)
        CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), name, nil, nil, true)
        return .result()
    }
}
