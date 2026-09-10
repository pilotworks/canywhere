import SwiftUI

struct ActiveAgentPulseCard: View {
    let chat: Chat
    @Bindable var session = AppSessionState.shared
    @State private var isInterrupting = false

    var body: some View {
        NavigationLink(destination: ChatDetailView(chatId: chat.id)) {
            HStack(spacing: 12) {
                // Animated pulse badge
                ZStack {
                    Circle()
                        .fill(Color.orange.opacity(0.18))
                        .frame(width: 36, height: 36)
                    PulsingDot(color: .orange)
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text("AGENT ACTIVE")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(.orange)

                        if let wsId = chat.workspaceId,
                           let wsName = session.workspaces.first(where: { $0.id == wsId })?.name {
                            Text("• \(wsName)")
                                .font(.caption2.weight(.medium))
                                .foregroundStyle(.secondary)
                        }
                    }

                    Text(chat.title)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                }

                Spacer()

                // Emergency interrupt button
                Button {
                    Haptics.shared.notification(.warning)
                    isInterrupting = true
                    Task {
                        await session.interruptTurn(chatId: chat.id)
                        isInterrupting = false
                    }
                } label: {
                    HStack(spacing: 4) {
                        if isInterrupting {
                            ProgressView()
                                .scaleEffect(0.7)
                        } else {
                            Image(systemName: "stop.fill")
                                .font(.system(size: 10))
                        }
                        Text("Stop")
                            .font(.caption2.bold())
                    }
                    .foregroundStyle(.red)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.red.opacity(0.12))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(uiColor: .secondarySystemGroupedBackground))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(Color.orange.opacity(0.25), lineWidth: 1)
                    )
            )
            .shadow(color: Color.black.opacity(0.04), radius: 6, y: 2)
        }
        .buttonStyle(.plain)
    }
}
