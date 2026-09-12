import ActivityKit
import WidgetKit
import SwiftUI
import AppIntents

struct CanywhereLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CanywhereActivityAttributes.self) { context in
            // MARK: - Lock Screen & StandBy Banner
            LockScreenLiveActivityView(context: context)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            // MARK: - Dynamic Island Presentations
            DynamicIsland {
                // EXPANDED PRESENTATION
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: context.state.status == "awaitingApproval" ? "exclamationmark.triangle.fill" : "sparkles")
                            .foregroundStyle(context.state.status == "awaitingApproval" ? Color.amber : Color.blue)
                            .font(.system(size: 14, weight: .bold))

                        VStack(alignment: .leading, spacing: 1) {
                            Text(context.attributes.workspaceName)
                                .font(.system(size: 11, weight: .bold))
                                .lineLimit(1)
                                .foregroundStyle(.secondary)
                            Text(context.attributes.chatTitle)
                                .font(.system(size: 13, weight: .semibold))
                                .lineLimit(1)
                                .foregroundStyle(.white)
                        }
                    }
                    .padding(.leading, 4)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(timerInterval: context.state.startedAt...Date.distantFuture, countsDown: false)
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundStyle(.white.opacity(0.85))

                        if context.state.toolCount > 0 {
                            Text("\(context.state.toolCount) tool\(context.state.toolCount > 1 ? "s" : "")")
                                .font(.system(size: 10))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.trailing, 4)
                }

                DynamicIslandExpandedRegion(.center) {
                    HStack(spacing: 6) {
                        if let tool = context.state.activeTool, !tool.isEmpty {
                            Text(tool.uppercased())
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(Color.blue.opacity(0.2))
                                .foregroundStyle(.blue)
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }

                        Text(context.state.currentStepTitle)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)
                    }
                    .padding(.vertical, 4)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    if context.state.status == "awaitingApproval", let approvalId = context.state.pendingApprovalId {
                        HStack(spacing: 12) {
                            Button(intent: ApproveLiveActivityIntent(approvalId: approvalId)) {
                                HStack(spacing: 4) {
                                    Image(systemName: "checkmark")
                                    Text("Approve")
                                }
                                .font(.system(size: 12, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(Color.emeraldGreen)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }

                            Button(intent: DeclineLiveActivityIntent(approvalId: approvalId)) {
                                HStack(spacing: 4) {
                                    Image(systemName: "xmark")
                                    Text("Decline")
                                }
                                .font(.system(size: 12, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(Color.roseRed.opacity(0.2))
                                .foregroundStyle(Color.roseRed)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                        }
                        .padding(.horizontal, 4)
                        .padding(.top, 4)
                    } else {
                        HStack {
                            Label(context.attributes.providerName.capitalized, systemImage: "cpu")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(context.state.status.capitalized)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(context.state.status == "completed" ? Color.green : Color.blue)
                        }
                        .padding(.horizontal, 4)
                        .padding(.top, 2)
                    }
                }
            } compactLeading: {
                // COMPACT LEADING
                Image(systemName: context.state.status == "awaitingApproval" ? "exclamationmark.triangle.fill" : "terminal.fill")
                    .foregroundStyle(context.state.status == "awaitingApproval" ? Color.amber : Color.blue)
                    .font(.system(size: 12, weight: .bold))
            } compactTrailing: {
                // COMPACT TRAILING
                if context.state.status == "awaitingApproval" {
                    Text("REVIEW")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.amber)
                } else if context.state.status == "completed" {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.green)
                } else {
                    Text(timerInterval: context.state.startedAt...Date.distantFuture, countsDown: false)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.white)
                }
            } minimal: {
                // MINIMAL
                Image(systemName: context.state.status == "awaitingApproval" ? "exclamationmark.triangle.fill" : "sparkles")
                    .foregroundStyle(context.state.status == "awaitingApproval" ? Color.amber : Color.blue)
                    .font(.system(size: 12, weight: .bold))
            }
        }
    }
}

// MARK: - Lock Screen Card View
struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<CanywhereActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "laptopcomputer")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.blue)
                    Text(context.attributes.workspaceName)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                HStack(spacing: 6) {
                    Text(timerInterval: context.state.startedAt...Date.distantFuture, countsDown: false)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.9))

                    StatusBadge(status: context.state.status)
                }
            }

            // Task title
            Text(context.attributes.chatTitle)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)

            // Current Step / Active command
            HStack(spacing: 8) {
                if let tool = context.state.activeTool {
                    Text(tool.uppercased())
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.25))
                        .foregroundStyle(.blue)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }

                Text(context.state.currentStepTitle)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(2)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 8))

            // Action Review Buttons (if awaiting approval)
            if context.state.status == "awaitingApproval", let approvalId = context.state.pendingApprovalId {
                HStack(spacing: 12) {
                    Button(intent: ApproveLiveActivityIntent(approvalId: approvalId)) {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark")
                            Text("Approve Execution")
                        }
                        .font(.system(size: 13, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.emeraldGreen)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    Button(intent: DeclineLiveActivityIntent(approvalId: approvalId)) {
                        HStack(spacing: 6) {
                            Image(systemName: "xmark")
                            Text("Decline")
                        }
                        .font(.system(size: 13, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.roseRed.opacity(0.2))
                        .foregroundStyle(Color.roseRed)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(16)
    }
}

private struct StatusBadge: View {
    let status: String

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text(status == "awaitingApproval" ? "APPROVAL" : status.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(color.opacity(0.15))
        .clipShape(Capsule())
    }

    private var color: Color {
        switch status {
        case "awaitingApproval": return .amber
        case "completed": return .green
        case "failed": return .red
        default: return .blue
        }
    }
}

// Color helpers
private extension Color {
    static let emeraldGreen = Color(red: 16/255, green: 185/255, blue: 129/255)
    static let roseRed = Color(red: 244/255, green: 63/255, blue: 94/255)
    static let amber = Color(red: 245/255, green: 158/255, blue: 11/255)
}
