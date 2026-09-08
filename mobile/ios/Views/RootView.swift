import SwiftUI

struct RootView: View {
    @Bindable var session = AppSessionState.shared

    init() {}

    var body: some View {
        Group {
            if session.pairedEndpoint == nil {
                PairingView()
            } else {
                NavigationStack {
                    ZStack(alignment: .top) {
                        ChatListView()

                        // Floating connection status banner if not connected
                        if !session.connectionStatus.isConnected {
                            floatingStatusBanner
                                .padding(.top, 8)
                                .transition(.move(edge: .top).combined(with: .opacity))
                        }
                    }
                    .animation(.spring(response: 0.35, dampingFraction: 0.8), value: session.connectionStatus)
                }
            }
        }
    }

    @ViewBuilder
    private var floatingStatusBanner: some View {
        HStack(spacing: 8) {
            switch session.connectionStatus {
            case .connecting:
                PulsingDot(color: .orange)
                Text("Connecting to host...")
                    .font(.caption.weight(.medium))
            case .reconnecting(let attempt, _):
                PulsingDot(color: .orange)
                Text("Reconnecting (\(attempt))...")
                    .font(.caption.weight(.medium))
            case .disconnected:
                PulsingDot(color: .red)
                Text("Disconnected")
                    .font(.caption.weight(.medium))
            case .connected:
                EmptyView()
            }

            Spacer()

            Button {
                Haptics.shared.impact(.light)
                session.connectToSavedHost()
            } label: {
                Text("Retry")
                    .font(.caption.bold())
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(Color.accentColor.opacity(0.15))
                    .foregroundStyle(Color.accentColor)
                    .clipShape(Capsule())
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(Theme.subtleBorder, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.08), radius: 10, y: 4)
        .padding(.horizontal, 16)
    }
}
