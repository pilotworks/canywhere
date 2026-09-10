import SwiftUI

struct PendingApprovalsBanner: View {
    @Bindable var session = AppSessionState.shared
    @State private var selectedApprovalForSheet: ApprovalRequest? = nil
    @State private var currentIndex: Int = 0

    var body: some View {
        if !session.pendingApprovals.isEmpty {
            let count = session.pendingApprovals.count
            let safeIndex = min(currentIndex, count - 1)
            let current = session.pendingApprovals[safeIndex]

            VStack(alignment: .leading, spacing: 12) {
                // Header row
                HStack(spacing: 8) {
                    ZStack {
                        Circle()
                            .fill(Color.orange.opacity(0.2))
                            .frame(width: 28, height: 28)
                        Image(systemName: "exclamationmark.shield.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.orange)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text("ACTION REQUIRED")
                                .font(.system(size: 11, weight: .black))
                                .foregroundStyle(.orange)

                            if count > 1 {
                                Text("(\(safeIndex + 1)/\(count))")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(.secondary)
                            }
                        }

                        Text(current.payload.command != nil ? "Shell Command Approval" : "Patch Review Needed")
                            .font(.subheadline.bold())
                            .foregroundStyle(.primary)
                    }

                    Spacer()

                    // Pager if multiple
                    if count > 1 {
                        HStack(spacing: 4) {
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    currentIndex = (currentIndex - 1 + count) % count
                                }
                            } label: {
                                Image(systemName: "chevron.left")
                                    .font(.caption2.bold())
                                    .padding(6)
                                    .background(Color(uiColor: .tertiarySystemFill))
                                    .clipShape(Circle())
                            }

                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    currentIndex = (currentIndex + 1) % count
                                }
                            } label: {
                                Image(systemName: "chevron.right")
                                    .font(.caption2.bold())
                                    .padding(6)
                                    .background(Color(uiColor: .tertiarySystemFill))
                                    .clipShape(Circle())
                            }
                        }
                    }
                }

                // Command or Diff Preview Snippet
                if let cmd = current.payload.command {
                    VStack(alignment: .leading, spacing: 4) {
                        if let cwd = current.payload.cwd {
                            HStack(spacing: 4) {
                                Image(systemName: "folder")
                                    .font(.system(size: 9))
                                Text(shortenPath(cwd))
                                    .font(.system(size: 10, design: .monospaced))
                            }
                            .foregroundStyle(.secondary)
                        }

                        Text(cmd)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundStyle(.primary)
                            .lineLimit(2)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(uiColor: .secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                } else if let reason = current.payload.reason ?? current.payload.prompt {
                    Text(reason)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                // Action Buttons Row
                HStack(spacing: 10) {
                    Button {
                        Haptics.shared.notification(.success)
                        let id = current.id
                        Task {
                            await session.respondToApproval(approvalId: id, decision: "accept")
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                            Text("Approve")
                                .font(.subheadline.bold())
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(Color.green)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }

                    Button {
                        Haptics.shared.impact(.light)
                        selectedApprovalForSheet = current
                    } label: {
                        Text("Inspect")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(Color(uiColor: .tertiarySystemFill))
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }

                    Button(role: .destructive) {
                        Haptics.shared.notification(.warning)
                        let id = current.id
                        Task {
                            await session.respondToApproval(approvalId: id, decision: "decline")
                        }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.red)
                            .padding(10)
                            .background(Color.red.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color(uiColor: .secondarySystemGroupedBackground))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color.orange.opacity(0.4), lineWidth: 1.5)
                    )
            )
            .shadow(color: Color.orange.opacity(0.12), radius: 8, y: 3)
            .sheet(item: $selectedApprovalForSheet) { req in
                ApprovalSheetView(request: req) { decision in
                    selectedApprovalForSheet = nil
                    Task {
                        await session.respondToApproval(approvalId: req.id, decision: decision)
                    }
                }
            }
        }
    }

    private func shortenPath(_ path: String) -> String {
        let components = path.split(separator: "/")
        if components.count > 3 {
            return ".../" + components.suffix(2).joined(separator: "/")
        }
        return path
    }
}
