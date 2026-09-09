import SwiftUI

struct MessageBubbleView: View {
    let message: Message
    var durationSeconds: Int = 1

    init(message: Message, durationSeconds: Int = 1) {
        self.message = message
        self.durationSeconds = durationSeconds
    }

    var body: some View {
        HStack(spacing: 0) {
            if message.role == .user {
                Spacer(minLength: 48)
                userBubble
            } else {
                agentBubble
            }
        }
        .padding(.horizontal, message.role == .user ? 16 : 14)
        .padding(.vertical, message.role == .user ? 4 : 8)
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

    private var groupedBlocks: [RenderableMessageGroup] {
        groupMessageBlocks(message.blocks)
    }

    private var partitionedBlocks: (introBlocks: [MessageBlock], workBlocks: [MessageBlock], finalBlocks: [MessageBlock]) {
        var firstWorkIdx = -1
        var lastWorkIdx = -1

        for (idx, block) in message.blocks.enumerated() {
            let isWork = block.type == .reasoning || block.type == .toolCall || block.type == .commandExec || block.type == .fileDiff || block.type == .plan
            if isWork {
                if firstWorkIdx == -1 {
                    firstWorkIdx = idx
                }
                lastWorkIdx = idx
            }
        }

        guard firstWorkIdx >= 0 else {
            return ([], [], message.blocks)
        }

        let intro = Array(message.blocks[0..<firstWorkIdx])
        let work = Array(message.blocks[firstWorkIdx...lastWorkIdx])
        let final = Array(message.blocks[(lastWorkIdx + 1)...])
        return (intro, work, final)
    }

    private var agentBubble: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header with Codex avatar
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(Theme.primaryGradient)
                        .frame(width: 22, height: 22)

                    Image(systemName: "sparkles")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                }

                Text("Codex")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)

                Spacer()

                if message.streaming {
                    PulsingDot(color: .indigo)
                }
            }
            .padding(.bottom, 2)

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

            if message.streaming {
                // While live streaming, display blocks incrementally
                ForEach(Array(groupedBlocks.enumerated()), id: \.offset) { _, item in
                    switch item {
                    case .single(let block):
                        MessageBlockView(block: block, isStreaming: true)
                    case .toolGroup(let blocks):
                        ToolCallGroupView(blocks: blocks, isStreaming: true)
                    }
                }
            } else {
                // When turn completes, group preparatory work under WorkedForView
                let (introBlocks, workBlocks, finalBlocks) = partitionedBlocks
                if workBlocks.isEmpty {
                    ForEach(Array(groupedBlocks.enumerated()), id: \.offset) { _, item in
                        switch item {
                        case .single(let block):
                            MessageBlockView(block: block, isStreaming: false)
                        case .toolGroup(let blocks):
                            ToolCallGroupView(blocks: blocks, isStreaming: false)
                        }
                    }
                } else {
                    ForEach(Array(introBlocks.enumerated()), id: \.offset) { _, block in
                        MessageBlockView(block: block, isStreaming: false)
                    }

                    WorkedForView(
                        durationSeconds: durationSeconds,
                        blocks: workBlocks,
                        isStreaming: false
                    )

                    ForEach(Array(finalBlocks.enumerated()), id: \.offset) { _, block in
                        MessageBlockView(block: block, isStreaming: false)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

func groupMessageBlocks(_ blocks: [MessageBlock]) -> [RenderableMessageGroup] {
    var groups: [RenderableMessageGroup] = []
    var currentToolGroup: [MessageBlock] = []

    for block in blocks {
        if block.type == .toolCall || block.type == .commandExec {
            currentToolGroup.append(block)
        } else {
            if !currentToolGroup.isEmpty {
                groups.append(.toolGroup(currentToolGroup))
                currentToolGroup = []
            }
            groups.append(.single(block))
        }
    }

    if !currentToolGroup.isEmpty {
        groups.append(.toolGroup(currentToolGroup))
    }

    return groups
}

func formatWorkedDuration(_ durationSeconds: Int) -> String {
    if durationSeconds < 1 { return "Worked for 1s" }
    let hours = durationSeconds / 3600
    let minutes = (durationSeconds % 3600) / 60
    let seconds = durationSeconds % 60

    if hours > 0 {
        let minStr = minutes > 0 ? (minutes < 10 ? "0\(minutes)m" : "\(minutes)m") : ""
        return minStr.isEmpty ? "Worked for \(hours)h" : "Worked for \(hours)h \(minStr)"
    }
    if minutes > 0 {
        let secStr = seconds > 0 ? (seconds < 10 ? "0\(seconds)s" : "\(seconds)s") : ""
        return secStr.isEmpty ? "Worked for \(minutes)m" : "Worked for \(minutes)m \(secStr)"
    }
    return "Worked for \(seconds)s"
}

// MARK: - Worked For View (SwiftUI)

struct WorkedForView: View {
    let durationSeconds: Int
    let blocks: [MessageBlock]
    var isStreaming: Bool = false

    @State private var isExpanded: Bool = false

    private var durationText: String {
        formatWorkedDuration(durationSeconds)
    }

    private var groupedItems: [RenderableMessageGroup] {
        groupMessageBlocks(blocks)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                Haptics.shared.selection()
                withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.secondary.opacity(0.7))
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                        .frame(width: 10)

                    Text(durationText)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(.secondary)

                    Spacer(minLength: 4)
                }
                .padding(.vertical, 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(groupedItems.enumerated()), id: \.offset) { _, item in
                        switch item {
                        case .single(let block):
                            MessageBlockView(block: block, isStreaming: isStreaming)
                        case .toolGroup(let toolBlocks):
                            ToolCallGroupView(blocks: toolBlocks, isStreaming: isStreaming)
                        }
                    }
                }
                .padding(.leading, 8)
                .overlay(
                    Rectangle()
                        .fill(Theme.subtleBorder)
                        .frame(width: 1.5)
                        .padding(.leading, 2),
                    alignment: .leading
                )
            }
        }
    }
}

enum RenderableMessageGroup {
    case single(MessageBlock)
    case toolGroup([MessageBlock])
}

// MARK: - Shared Message Block View

struct MessageBlockView: View {
    let block: MessageBlock
    var isStreaming: Bool = false

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
            ToolCallBlockView(block: block, isStreaming: isStreaming)


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

