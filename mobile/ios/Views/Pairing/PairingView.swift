import SwiftUI

struct PairingView: View {
    @Bindable var session = AppSessionState.shared
    @ObservedObject var bonjour = BonjourBrowser.shared

    @State private var showManualSheet = false
    @State private var isPairing = false
    @State private var errorMessage: String?

    @State private var scanLaserOffset: CGFloat = -110

    init() {}

    var body: some View {
        NavigationStack {
            ZStack {
                Color(uiColor: .systemGroupedBackground)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header with gradient badge
                    VStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(Theme.primaryGradient.opacity(0.12))
                                .frame(width: 80, height: 80)

                            Image(systemName: "desktopcomputer.and.arrow.down")
                                .font(.system(size: 36, weight: .semibold))
                                .foregroundStyle(Theme.primaryGradient)
                        }
                        .padding(.top, 20)

                        Text("Pair with Canywhere")
                            .font(.title2.bold())
                            .fontDesign(.rounded)

                        Text("Scan the QR code on your Canywhere Desktop client to connect securely.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 36)
                    }
                    .padding(.bottom, 20)

                    // Modern QR Scanner Frame
                    ZStack {
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .fill(Color(uiColor: .secondarySystemGroupedBackground))
                            .frame(width: 280, height: 280)
                            .overlay(
                                RoundedRectangle(cornerRadius: 24, style: .continuous)
                                    .stroke(Theme.subtleBorder, lineWidth: 1)
                            )
                            .shadow(color: Color.black.opacity(0.06), radius: 16, y: 6)

                        QRScannerView(isPaused: isPairing) { code in
                            Haptics.shared.notification(.success)
                            handleScannedPayload(code)
                        }
                        .frame(width: 250, height: 250)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                        // Cyber Viewfinder Brackets & Laser
                        viewfinderOverlay
                            .frame(width: 250, height: 250)

                        if isPairing {
                            Color.black.opacity(0.65)
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                            VStack(spacing: 12) {
                                ProgressView()
                                    .scaleEffect(1.2)
                                    .tint(.white)
                                Text("Pairing with host...")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.white)
                            }
                        }
                    }
                    .padding(.vertical, 8)

                    if let error = errorMessage {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .padding(.top, 2)
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .multilineTextAlignment(.leading)
                        }
                        .padding(12)
                        .background(Color.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .padding(.horizontal, 20)
                        .padding(.top, 8)
                    }

                    // Discovered Hosts via Bonjour
                    if !bonjour.discoveredHosts.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 6) {
                                Image(systemName: "network")
                                    .font(.caption.bold())
                                    .foregroundStyle(.secondary)
                                Text("NEARBY HOSTS DETECTED")
                                    .font(.caption2.bold())
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 20)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(bonjour.discoveredHosts) { host in
                                        Button {
                                            Haptics.shared.selection()
                                            showManualSheet = true
                                        } label: {
                                            HStack(spacing: 10) {
                                                PulsingDot(color: .green)

                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(host.name)
                                                        .font(.subheadline.weight(.semibold))
                                                        .foregroundStyle(.primary)
                                                    Text("Tap to pair")
                                                        .font(.caption2)
                                                        .foregroundStyle(.secondary)
                                                }

                                                Image(systemName: "chevron.right")
                                                    .font(.caption2.bold())
                                                    .foregroundStyle(.tertiary)
                                            }
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 10)
                                            .cardStyle(cornerRadius: 14)
                                        }
                                    }
                                }
                                .padding(.horizontal, 20)
                            }
                        }
                        .padding(.top, 20)
                    }

                    Spacer()

                    // Manual connection button
                    Button {
                        Haptics.shared.selection()
                        showManualSheet = true
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "keyboard")
                                .font(.subheadline)
                            Text("Enter Details Manually")
                                .font(.subheadline.weight(.medium))
                        }
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().stroke(Theme.subtleBorder, lineWidth: 1)
                        )
                    }
                    .sheet(isPresented: $showManualSheet) {
                        ManualConnectSheet { ep, token, hostName in
                            try await session.pair(endpoints: [ep], token: token, hostName: hostName)
                        }
                    }
                    .padding(.bottom, 24)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                bonjour.startDiscovery()
                withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                    scanLaserOffset = 110
                }
            }
            .onDisappear {
                bonjour.stopDiscovery()
            }
        }
    }

    // Viewfinder Corner Brackets & Laser Line
    private var viewfinderOverlay: some View {
        ZStack {
            // Laser beam
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [Color.accentColor.opacity(0), Color.accentColor.opacity(0.8), Color.accentColor.opacity(0)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(height: 2)
                .offset(y: scanLaserOffset)

            // 4 Corner Brackets
            GeometryReader { geo in
                let w = geo.size.width
                let h = geo.size.height
                let len: CGFloat = 20
                let thick: CGFloat = 3

                Path { p in
                    // Top-Left
                    p.move(to: CGPoint(x: 0, y: len))
                    p.addLine(to: CGPoint(x: 0, y: 0))
                    p.addLine(to: CGPoint(x: len, y: 0))

                    // Top-Right
                    p.move(to: CGPoint(x: w - len, y: 0))
                    p.addLine(to: CGPoint(x: w, y: 0))
                    p.addLine(to: CGPoint(x: w, y: len))

                    // Bottom-Left
                    p.move(to: CGPoint(x: 0, y: h - len))
                    p.addLine(to: CGPoint(x: 0, y: h))
                    p.addLine(to: CGPoint(x: len, y: h))

                    // Bottom-Right
                    p.move(to: CGPoint(x: w - len, y: h))
                    p.addLine(to: CGPoint(x: w, y: h))
                    p.addLine(to: CGPoint(x: w, y: h - len))
                }
                .stroke(Color.accentColor, lineWidth: thick)
            }
        }
    }

    private func handleScannedPayload(_ rawPayload: String) {
        guard !isPairing else { return }
        errorMessage = nil

        do {
            guard let data = rawPayload.data(using: .utf8) else {
                throw NSError(domain: "QR", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid QR code encoding"])
            }

            struct QRPayload: Decodable {
                let host_name: String?
                let hostName: String?
                let token: String
                let endpoints: [String]
                let host_public_key: String?
                let hostPublicKey: String?
            }

            let payload = try JSONDecoder().decode(QRPayload.self, from: data)
            let host = payload.hostName ?? payload.host_name ?? "Canywhere Host"

            isPairing = true
            Task {
                do {
                    try await session.pair(
                        endpoints: payload.endpoints,
                        token: payload.token,
                        hostName: host
                    )
                } catch {
                    errorMessage = "Pairing failed: \(error.localizedDescription)"
                }
                isPairing = false
            }
        } catch {
            errorMessage = "Pairing failed: \(error.localizedDescription)"
        }
    }
}
