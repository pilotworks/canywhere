import SwiftUI

struct ApprovalSheetView: View {
    let request: ApprovalRequest
    let onDecision: (String) -> Void

    init(request: ApprovalRequest, onDecision: @escaping (String) -> Void) {
        self.request = request
        self.onDecision = onDecision
    }

    @State private var copiedCommand = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Risk banner if high-risk command
                    if request.payload.isHighRisk == true || isDangerousCommand(request.payload.command) {
                        HStack(spacing: 12) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.title3)
                                .foregroundStyle(.red)

                            VStack(alignment: .leading, spacing: 3) {
                                Text("High-Risk Command Detected")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.red)
                                Text("This command can modify system files, delete directories, or execute destructive actions.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.red.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(Color.red.opacity(0.35), lineWidth: 1)
                        )
                    }

                    // Shell Command Execution Terminal
                    if let command = request.payload.command {
                        VStack(alignment: .leading, spacing: 0) {
                            HStack {
                                HStack(spacing: 6) {
                                    Circle().fill(Color.red.opacity(0.8)).frame(width: 8, height: 8)
                                    Circle().fill(Color.orange.opacity(0.8)).frame(width: 8, height: 8)
                                    Circle().fill(Color.green.opacity(0.8)).frame(width: 8, height: 8)
                                }
                                Text("BASH COMMAND")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.white.opacity(0.7))
                                    .padding(.leading, 4)

                                Spacer()

                                Button {
                                    UIPasteboard.general.string = command
                                    Haptics.shared.notification(.success)
                                    copiedCommand = true
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                        copiedCommand = false
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: copiedCommand ? "checkmark" : "doc.on.doc")
                                            .font(.system(size: 10))
                                        Text(copiedCommand ? "Copied" : "Copy")
                                            .font(.caption2.weight(.medium))
                                    }
                                    .foregroundStyle(.white.opacity(0.8))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color.white.opacity(0.12))
                                    .clipShape(Capsule())
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Color(red: 0.14, green: 0.15, blue: 0.18))

                            Text(command)
                                .font(.system(size: 13, design: .monospaced))
                                .foregroundStyle(Color(red: 0.88, green: 0.90, blue: 0.93))
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color(red: 0.08, green: 0.09, blue: 0.11))
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(Color.white.opacity(0.1), lineWidth: 1)
                        )
                    }

                    // Working Directory
                    if let cwd = request.payload.cwd {
                        HStack(spacing: 8) {
                            Image(systemName: "folder.fill")
                                .foregroundStyle(.indigo)
                                .font(.caption)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("WORKING DIRECTORY")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.secondary)
                                Text(cwd)
                                    .font(.system(size: 12, design: .monospaced))
                                    .foregroundStyle(.primary)
                            }
                        }
                        .padding(12)
                        .cardStyle(cornerRadius: 12)
                    }

                    // Diff view if file change
                    if let diff = request.payload.diff {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("FILE CHANGES (DIFF)")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.secondary)

                            ScrollView(.horizontal, showsIndicators: false) {
                                Text(diff)
                                    .font(.system(size: 11, design: .monospaced))
                                    .padding(12)
                            }
                            .background(Color(red: 0.08, green: 0.09, blue: 0.11))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }

                    // Reason or Prompt
                    if let reason = request.payload.reason ?? request.payload.prompt {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("PURPOSE")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.secondary)

                            Text(reason)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .padding(14)
                        .cardStyle(cornerRadius: 12)
                    }
                }
                .padding(20)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Action Review")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 10) {
                    Button {
                        Haptics.shared.notification(.success)
                        onDecision("accept")
                    } label: {
                        Text("Approve Execution")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Theme.primaryGradient)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .shadow(color: Color.blue.opacity(0.3), radius: 10, y: 4)
                    }

                    HStack(spacing: 12) {
                        Button {
                            Haptics.shared.impact(.light)
                            onDecision("acceptForSession")
                        } label: {
                            Text("Always Allow")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color(uiColor: .secondarySystemGroupedBackground))
                                .foregroundStyle(.primary)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(Theme.subtleBorder, lineWidth: 1)
                                )
                        }

                        Button(role: .destructive) {
                            Haptics.shared.notification(.warning)
                            onDecision("decline")
                        } label: {
                            Text("Decline")
                                .font(.subheadline.bold())
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.red.opacity(0.12))
                                .foregroundStyle(.red)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                }
                .padding(16)
                .background(.ultraThinMaterial)
                .overlay(
                    Rectangle().frame(height: 1).foregroundStyle(Theme.subtleBorder),
                    alignment: .top
                )
            }
        }
    }

    private func isDangerousCommand(_ cmd: String?) -> Bool {
        guard let cmd = cmd?.lowercased() else { return false }
        let highRiskPatterns = ["rm -rf", "sudo ", "mkfs", "dd ", "> /dev/sd", "chmod -r 777"]
        return highRiskPatterns.contains(where: { cmd.contains($0) })
    }
}
