import SwiftUI

struct ReasoningBlockView: View {
    let content: String
    let isCompleted: Bool

    @State private var isExpanded: Bool = false

    init(content: String, isCompleted: Bool) {
        self.content = content
        self.isCompleted = isCompleted
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                Haptics.shared.selection()
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    ZStack {
                        Circle()
                            .fill(Color.purple.opacity(0.15))
                            .frame(width: 24, height: 24)

                        Image(systemName: "brain.head.profile")
                            .font(.system(size: 12))
                            .foregroundStyle(.purple)
                    }

                    Text(isCompleted ? "Thought process" : "Thinking...")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.primary.opacity(0.85))

                    if !isCompleted {
                        PulsingDot(color: .purple)
                    }

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.purple.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.purple.opacity(0.12), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 6) {
                    Text(content)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(uiColor: .tertiarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(Theme.subtleBorder, lineWidth: 1)
                        )
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }
}
