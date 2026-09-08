import SwiftUI

struct MessageBubbleView: View {
    let message: Message

    init(message: Message) {
        self.message = message
    }

    var body: some View {
        HStack {
            if message.role == .user {
                Spacer(minLength: 48)
                userBubble
            } else {
                agentBubble
                Spacer(minLength: 48)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
    }

    private var userBubble: some View {
        VStack(alignment: .trailing, spacing: 6) {
            ForEach(Array(message.blocks.enumerated()), id: \.offset) { _, block in
                if let content = block.content {
                    Text(content)
                        .font(.body)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Theme.userBubbleGradient)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .shadow(color: Color.blue.opacity(0.2), radius: 6, x: 0, y: 3)
                }
            }
        }
    }

    private var agentBubble: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with Codex avatar
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(Theme.primaryGradient)
                        .frame(width: 24, height: 24)

                    Image(systemName: "sparkles")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                }

                Text("Codex")
                    .font(.subheadline.bold())
                    .foregroundStyle(.primary)

                Spacer()

                if message.streaming {
                    PulsingDot(color: .indigo)
                }
            }

            if message.role == .agent && message.streaming {
                if message.blocks.isEmpty {
                    HStack(spacing: 8) {
                        PulsingDot(color: .indigo)
                        Text("Thinking...")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }

            ForEach(Array(message.blocks.enumerated()), id: \.offset) { _, block in
                MessageBlockView(block: block, isStreaming: message.streaming)
            }
        }
        .padding(16)
        .cardStyle(cornerRadius: 20)
    }
}

// MARK: - Shared Message Block View

struct MessageBlockView: View {
    let block: MessageBlock
    var isStreaming: Bool = false
    @State private var isOutputExpanded: Bool = true

    var body: some View {
        switch block.type {
        case .text:
            if let content = block.content, !content.isEmpty {
                if isStreaming {
                    Text(LocalizedStringKey(content))
                        .font(.body)
                } else {
                    Text(LocalizedStringKey(content))
                        .font(.body)
                        .textSelection(.enabled)
                }
            }

        case .reasoning:
            if let content = block.content {
                ReasoningBlockView(
                    content: content,
                    isCompleted: block.completed ?? false
                )
            }

        case .toolCall, .commandExec:
            let cmd = block.command ?? block.name ?? "Command"
            VStack(alignment: .leading, spacing: 0) {
                // macOS Terminal Header
                HStack(spacing: 6) {
                    Circle().fill(Color(red: 1.0, green: 0.36, blue: 0.34)).frame(width: 9, height: 9)
                    Circle().fill(Color(red: 1.0, green: 0.75, blue: 0.20)).frame(width: 9, height: 9)
                    Circle().fill(Color(red: 0.16, green: 0.80, blue: 0.38)).frame(width: 9, height: 9)

                    Text(cmd)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(1)
                        .padding(.leading, 6)

                    Spacer()

                    if let status = block.status {
                        Text(status.rawValue.uppercased())
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(statusColor(status))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(statusColor(status).opacity(0.15))
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(red: 0.14, green: 0.15, blue: 0.18))

                // Terminal Output
                if let output = block.output, !output.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        Text(output)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(Color(red: 0.85, green: 0.87, blue: 0.90))
                            .padding(12)
                    }
                    .background(Color(red: 0.08, green: 0.09, blue: 0.11))
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )

        case .fileDiff:
            if let path = block.path {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 6) {
                        Image(systemName: "doc.text.fill")
                            .font(.caption)
                            .foregroundStyle(.indigo)
                        Text(path)
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .lineLimit(1)
                        Spacer()
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(uiColor: .tertiarySystemFill))

                    if let diff = block.patch ?? block.content {
                        ScrollView(.horizontal, showsIndicators: false) {
                            Text(diff)
                                .font(.system(size: 11, design: .monospaced))
                                .padding(12)
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Theme.subtleBorder, lineWidth: 1)
                )
            }

        case .plan:
            if let content = block.content {
                HStack(spacing: 8) {
                    Image(systemName: "checklist")
                        .foregroundStyle(.purple)
                    Text(content)
                        .font(.callout)
                        .italic()
                }
                .padding(12)
                .background(Color.purple.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }

    private func statusColor(_ status: ToolCallStatus) -> Color {
        switch status {
        case .completed, .applied: return .green
        case .failed, .rejected: return .red
        case .running, .pendingApproval, .proposed: return .orange
        }
    }
}

