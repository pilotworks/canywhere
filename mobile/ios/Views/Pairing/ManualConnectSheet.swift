import SwiftUI

struct ManualConnectSheet: View {
    @Environment(\.dismiss) private var dismiss
    #if targetEnvironment(simulator)
    @State private var endpoint: String = "ws://127.0.0.1:7890/rpc"
    #else
    @State private var endpoint: String = "ws://192.168.1.x:7890/rpc"
    #endif
    @State private var token: String = ""
    @State private var hostName: String = "Canywhere Host"
    @State private var isConnecting = false
    @State private var errorMessage: String?

    let onPair: (String, String, String) async throws -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Header Description
                    VStack(spacing: 6) {
                        Image(systemName: "link.badge.plus")
                            .font(.system(size: 32))
                            .foregroundStyle(Theme.primaryGradient)
                            .padding(.top, 8)

                        Text("Direct Host Connection")
                            .font(.headline)

                        Text("Enter the WebSocket address and single-use pairing token shown in Canywhere Desktop.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 16)
                    }
                    .padding(.vertical, 8)

                    // Input Fields Card
                    VStack(spacing: 16) {
                        HStack(spacing: 12) {
                            Image(systemName: "network")
                                .foregroundStyle(.secondary)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("WEBSOCKET ENDPOINT")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.secondary)
                                TextField("ws://192.168.1.x:7890/rpc", text: $endpoint)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled(true)
                                    .keyboardType(.URL)
                                    .font(.subheadline.monospaced())
                            }
                        }

                        Divider()

                        HStack(spacing: 12) {
                            Image(systemName: "key.fill")
                                .foregroundStyle(.secondary)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("PAIRING TOKEN")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.secondary)
                                TextField("5-minute single-use token", text: $token)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled(true)
                                    .font(.subheadline.monospaced())
                            }
                        }

                        Divider()

                        HStack(spacing: 12) {
                            Image(systemName: "laptopcomputer")
                                .foregroundStyle(.secondary)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("HOST NAME")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.secondary)
                                TextField("e.g. MacBook Pro", text: $hostName)
                                    .font(.subheadline)
                            }
                        }
                    }
                    .padding(16)
                    .cardStyle(cornerRadius: 18)

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
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    // Connect Button
                    Button(action: performConnect) {
                        HStack(spacing: 8) {
                            if isConnecting {
                                ProgressView()
                                    .tint(.white)
                            }
                            Text(isConnecting ? "Connecting..." : "Connect & Pair")
                                .font(.headline)
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            token.trimmingCharacters(in: .whitespaces).isEmpty || isConnecting
                            ? LinearGradient(colors: [Color.gray.opacity(0.4), Color.gray.opacity(0.5)], startPoint: .leading, endPoint: .trailing)
                            : Theme.primaryGradient
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .shadow(color: Color.blue.opacity(token.isEmpty ? 0 : 0.25), radius: 10, y: 4)
                    }
                    .disabled(isConnecting || token.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(20)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Manual Connection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func performConnect() {
        isConnecting = true
        errorMessage = nil

        Task {
            do {
                try await onPair(endpoint, token.trimmingCharacters(in: .whitespaces), hostName)
                dismiss()
            } catch let report as PairingDiagnosticReport {
                errorMessage = report.detailedSummary
                isConnecting = false
            } catch {
                errorMessage = error.localizedDescription
                isConnecting = false
            }
        }
    }
}
