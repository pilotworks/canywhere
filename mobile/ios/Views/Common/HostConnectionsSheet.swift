import SwiftUI

struct HostConnectionsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Bindable var session = AppSessionState.shared

    @State private var healthStatus: [String: EndpointHealth] = [:]
    @State private var isCheckingHealth: Bool = false
    @State private var checkStatusRotation: Double = 0
    @State private var showAddSheet = false
    @State private var newEndpointUrl = "ws://"
    @State private var switchingEndpoint: String? = nil
    @State private var switchErrorMessage: String? = nil
    @State private var showUnpairConfirm = false
    @State private var endpointToDelete: String? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Switch error alert banner
                    if let error = switchErrorMessage {
                        errorBanner(error)
                    }

                    // Host Status Card
                    hostStatusCard

                    // Endpoints Section
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("AVAILABLE CONNECTIONS")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.secondary)

                            Spacer()

                            // Re-check health button
                            Button {
                                Haptics.shared.selection()
                                refreshHealth()
                            } label: {
                                HStack(spacing: 5) {
                                    Image(systemName: "arrow.clockwise")
                                        .font(.system(size: 11, weight: .bold))
                                        .frame(width: 14, height: 14, alignment: .center)
                                        .rotationEffect(.degrees(checkStatusRotation), anchor: UnitPoint(x: 0.485, y: 0.525))
                                    Text("Check Status")
                                }
                                .font(.caption.bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color(uiColor: .tertiarySystemFill))
                                .foregroundStyle(.secondary)
                                .clipShape(Capsule())
                            }
                            .disabled(isCheckingHealth)

                            // Add custom endpoint
                            Button {
                                Haptics.shared.selection()
                                newEndpointUrl = "ws://"
                                showAddSheet = true
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: "plus")
                                    Text("Add")
                                }
                                .font(.caption.bold())
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Color.accentColor.opacity(0.12))
                                .foregroundStyle(Color.accentColor)
                                .clipShape(Capsule())
                            }
                        }
                        .padding(.horizontal, 4)

                        VStack(spacing: 10) {
                            if session.allEndpoints.isEmpty {
                                if let single = session.pairedEndpoint {
                                    endpointRow(single)
                                } else {
                                    Text("No endpoints configured.")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                        .padding(.vertical, 20)
                                }
                            } else {
                                ForEach(session.allEndpoints, id: \.self) { ep in
                                    let isActive = (session.pairedEndpoint == ep)
                                    let canDelete = !isActive && session.allEndpoints.count > 1

                                    SwipeToDeleteRow(canDelete: canDelete) {
                                        endpointToDelete = ep
                                    } content: {
                                        endpointRow(ep)
                                    }
                                }
                            }
                        }
                    }

                    // Guidance Card
                    HStack(spacing: 12) {
                        Image(systemName: "bolt.horizontal.fill")
                            .font(.title3)
                            .foregroundStyle(.green)

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Live Connection Guard")
                                .font(.subheadline.bold())
                            Text("Only verified online connections can be connected to prevent network dropouts. Swipe left on a connection to remove it.")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(14)
                    .cardStyle(cornerRadius: 16)

                    // Unpair Button
                    Button(role: .destructive) {
                        Haptics.shared.impact(.medium)
                        showUnpairConfirm = true
                    } label: {
                        HStack {
                            Image(systemName: "link.badge.plus")
                            Text("Unpair Host")
                        }
                        .font(.subheadline.bold())
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.red.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .padding(.top, 10)
                }
                .padding(16)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Host Connections")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .task {
                refreshHealth()
            }
            .onAppear {
                refreshHealth()
            }
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .active {
                    refreshHealth()
                }
            }
            .alert("Add Connection Endpoint", isPresented: $showAddSheet) {
                TextField("ws://192.168.1.x:7890/rpc", text: $newEndpointUrl)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                Button("Add") {
                    Haptics.shared.notification(.success)
                    session.addCustomEndpoint(newEndpointUrl)
                    refreshHealth()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Enter the WebSocket address of your Canywhere host.")
            }
            .alert(
                "Remove Connection?",
                isPresented: Binding(
                    get: { endpointToDelete != nil },
                    set: { if !$0 { endpointToDelete = nil } }
                ),
                presenting: endpointToDelete
            ) { ep in
                Button("Cancel", role: .cancel) {}
                Button("Remove", role: .destructive) {
                    Haptics.shared.notification(.warning)
                    session.removeEndpoint(ep)
                    refreshHealth()
                }
            } message: { ep in
                let info = EndpointInfo(rawUrl: ep)
                Text("Are you sure you want to remove \(info.displayAddress) from your saved connections?")
            }
            .confirmationDialog(
                "Unpair Host Device?",
                isPresented: $showUnpairConfirm,
                titleVisibility: .visible
            ) {
                Button("Unpair", role: .destructive) {
                    Haptics.shared.notification(.warning)
                    session.unpair()
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You will need to scan the QR code on your Mac again to reconnect.")
            }
        }
    }

    // MARK: - Host Status Card

    private var hostStatusCard: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(statusColor.opacity(0.15))
                        .frame(width: 44, height: 44)

                    Image(systemName: "desktopcomputer")
                        .font(.system(size: 20))
                        .foregroundStyle(statusColor)
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(session.pairedHostName ?? "Host Server")
                            .font(.headline)
                        PulsingDot(color: statusColor)
                    }

                    Text(statusText)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(statusColor)
                }

                Spacer()

                Button {
                    Haptics.shared.impact(.light)
                    session.connectToSavedHost()
                    refreshHealth()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                        .padding(8)
                        .background(Color(uiColor: .tertiarySystemFill))
                        .clipShape(Circle())
                }
                .accessibilityLabel("Reconnect")
            }

            if let active = session.pairedEndpoint {
                HStack(spacing: 6) {
                    let info = EndpointInfo(rawUrl: active)
                    Label(info.kind.rawValue, systemImage: info.kind.iconName)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(info.kind.color)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(info.kind.color.opacity(info.kind.backgroundOpacity))
                        .clipShape(Capsule())

                    Text(info.displayAddress)
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                        .lineLimit(1)

                    Spacer()

                    if session.allEndpoints.count > 1 {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.triangle.swap")
                                .font(.system(size: 10))
                            Text("Auto-Failover")
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundStyle(.indigo)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.indigo.opacity(0.12))
                        .clipShape(Capsule())
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(16)
        .cardStyle(cornerRadius: 18)
    }

    // MARK: - Endpoint Row

    private func endpointRow(_ endpoint: String) -> some View {
        let info = EndpointInfo(rawUrl: endpoint)
        let isActive = (session.pairedEndpoint == endpoint)
        let health = isActive && session.connectionStatus.isConnected
            ? EndpointHealth.online(latencyMs: 1)
            : (healthStatus[endpoint] ?? .checking)
        let isLive = health.isLive

        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Label(info.kind.rawValue, systemImage: info.kind.iconName)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(info.kind.color)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(info.kind.color.opacity(info.kind.backgroundOpacity))
                        .clipShape(Capsule())

                    if info.isLocalhost {
                        Text("(Simulator)")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }

                    // Health Indicator
                    healthBadge(health)
                }

                Text(info.displayAddress)
                    .font(.caption.monospaced())
                    .foregroundStyle(.primary)
                    .lineLimit(1)
            }

            Spacer()

            if isActive {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(.green)
                    Text("Active")
                        .font(.caption2.bold())
                        .foregroundStyle(.green)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.green.opacity(0.12))
                .clipShape(Capsule())
            } else {
                Button {
                    performSwitch(to: endpoint)
                } label: {
                    HStack(spacing: 4) {
                        if switchingEndpoint == endpoint {
                            ProgressView()
                                .scaleEffect(0.7)
                        }
                        Text(switchingEndpoint == endpoint ? "Connecting..." : (isLive ? "Connect" : "Offline"))
                            .font(.caption2.bold())
                    }
                    .foregroundStyle(isLive ? Color.accentColor : Color.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .background(isLive ? Color.accentColor.opacity(0.12) : Color(uiColor: .tertiarySystemFill))
                    .clipShape(Capsule())
                }
                .disabled(!isLive || switchingEndpoint != nil)
            }
        }
        .padding(14)
        .cardStyle(cornerRadius: 16)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(isActive ? Color.green.opacity(0.4) : Color.clear, lineWidth: 1.5)
        )
    }

    // MARK: - Health Badge

    @ViewBuilder
    private func healthBadge(_ health: EndpointHealth) -> some View {
        switch health {
        case .checking:
            HStack(spacing: 3) {
                ProgressView()
                    .scaleEffect(0.5)
                Text("Checking...")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
        case .online(let ms):
            HStack(spacing: 3) {
                Circle()
                    .fill(Color.green)
                    .frame(width: 6, height: 6)
                Text("Live (\(ms)ms)")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.green)
            }
            .padding(.horizontal, 5)
            .padding(.vertical, 1.5)
            .background(Color.green.opacity(0.1))
            .clipShape(Capsule())
        case .offline:
            HStack(spacing: 3) {
                Circle()
                    .fill(Color.red.opacity(0.7))
                    .frame(width: 6, height: 6)
                Text("Offline")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 5)
            .padding(.vertical, 1.5)
            .background(Color.secondary.opacity(0.1))
            .clipShape(Capsule())
        }
    }

    // MARK: - Error Banner

    @ViewBuilder
    private func errorBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
                .font(.subheadline)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 2) {
                Text("Connection Switch Failed")
                    .font(.caption.bold())
                    .foregroundStyle(.red)
                Text(message)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                withAnimation { switchErrorMessage = nil }
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
                    .padding(4)
            }
        }
        .padding(12)
        .background(Color.red.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var statusColor: Color {
        switch session.connectionStatus {
        case .connected: return .green
        case .connecting, .reconnecting: return .orange
        case .disconnected: return .red
        }
    }

    private var statusText: String {
        switch session.connectionStatus {
        case .connected:
            return "Connected"
        case .connecting:
            return "Connecting..."
        case .reconnecting(let attempt, _):
            return "Reconnecting (attempt \(attempt))..."
        case .disconnected:
            return "Disconnected"
        }
    }

    private func refreshHealth() {
        guard !isCheckingHealth else { return }
        isCheckingHealth = true

        var eps = session.allEndpoints
        if eps.isEmpty, let single = session.pairedEndpoint {
            eps = [single]
        }

        for ep in eps {
            healthStatus[ep] = .checking
        }

        checkStatusRotation = 0
        withAnimation(.linear(duration: 0.85).repeatForever(autoreverses: false)) {
            checkStatusRotation = 360
        }

        Task {
            let results = await EndpointHealthChecker.shared.checkAll(endpoints: eps)
            await MainActor.run {
                self.healthStatus = results
                withAnimation(.easeOut(duration: 0.2)) {
                    self.isCheckingHealth = false
                    self.checkStatusRotation = 0
                }
            }
        }
    }

    private func performSwitch(to endpoint: String) {
        switchingEndpoint = endpoint
        switchErrorMessage = nil

        Task {
            do {
                try await session.switchEndpoint(to: endpoint)
                Haptics.shared.notification(.success)
                switchingEndpoint = nil
                refreshHealth()
            } catch {
                Haptics.shared.notification(.error)
                let info = EndpointInfo(rawUrl: endpoint)
                switchErrorMessage = "Could not connect to \(info.displayAddress). Make sure the host server is running and reachable on this network."
                switchingEndpoint = nil
                refreshHealth()
            }
        }
    }
}

// MARK: - Swipe To Delete Card Component

private struct SwipeToDeleteRow<Content: View>: View {
    let canDelete: Bool
    let onDelete: () -> Void
    @ViewBuilder let content: () -> Content

    @State private var offset: CGFloat = 0
    @State private var isSwiped: Bool = false

    private let buttonWidth: CGFloat = 72

    var body: some View {
        ZStack(alignment: .trailing) {
            // Background Delete Button
            if canDelete {
                HStack {
                    Spacer()
                    Button(role: .destructive) {
                        Haptics.shared.impact(.medium)
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            offset = 0
                            isSwiped = false
                        }
                        onDelete()
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: "trash.fill")
                                .font(.system(size: 16))
                            Text("Delete")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .frame(width: buttonWidth)
                        .frame(maxHeight: .infinity)
                        .background(Color.red)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
            }

            // Foreground Card
            content()
                .offset(x: offset)
                .contentShape(Rectangle())
                .gesture(
                    canDelete ?
                    DragGesture(minimumDistance: 15, coordinateSpace: .local)
                        .onChanged { value in
                            if value.translation.width < 0 {
                                // Swiping left
                                let translation = value.translation.width
                                offset = max(-buttonWidth, translation)
                            } else if isSwiped && value.translation.width > 0 {
                                // Swiping back right
                                offset = min(0, -buttonWidth + value.translation.width)
                            }
                        }
                        .onEnded { value in
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                if value.translation.width < -30 {
                                    offset = -buttonWidth
                                    isSwiped = true
                                } else {
                                    offset = 0
                                    isSwiped = false
                                }
                            }
                        }
                    : nil
                )
        }
    }
}
