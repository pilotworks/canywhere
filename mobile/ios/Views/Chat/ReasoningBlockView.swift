import SwiftUI

struct ReasoningBlockView: View {
    let content: String
    let isCompleted: Bool

    @State private var isExpanded: Bool
    @State private var isCopied: Bool = false
    @State private var contentHeight: CGFloat = 0
    private let maxHeight: CGFloat = 260

    private struct ContentHeightPreferenceKey: PreferenceKey {
        static let defaultValue: CGFloat = 0
        static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
            value = max(value, nextValue())
        }
    }

    init(content: String, isCompleted: Bool) {
        self.content = content
        self.isCompleted = isCompleted
        self._isExpanded = State(initialValue: !isCompleted)
    }

    private var wordCount: Int {
        content.split(whereSeparator: \.isWhitespace).count
    }

    private static let boldRegex = try? NSRegularExpression(pattern: #"\*\*([^*]+)\*\*"#, options: [])

    private var reasoningHeader: String? {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if let regex = Self.boldRegex,
           let match = regex.firstMatch(in: trimmed, range: NSRange(location: 0, length: trimmed.utf16.count)),
           let range = Range(match.range(at: 1), in: trimmed) {
            let boldText = String(trimmed[range]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !boldText.isEmpty { return boldText }
        }

        let firstLine = trimmed.components(separatedBy: .newlines).first ?? ""
        if !firstLine.isEmpty && firstLine.count <= 80 && !firstLine.contains("```") {
            let clean = firstLine.replacingOccurrences(of: #"^[#*\-\s]+"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            if !clean.isEmpty { return clean }
        }

        return nil
    }

    private var headerTitle: String {
        if isCompleted {
            return reasoningHeader ?? "Thought process"
        } else if let header = reasoningHeader {
            return "Thinking: \(header)"
        } else {
            return "Thinking..."
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Button {
                    Haptics.shared.selection()
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .rotationEffect(.degrees(isExpanded ? 90 : 0))

                        Image(systemName: "brain")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)

                        Text(headerTitle)
                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)

                        if !isCompleted {
                            Circle()
                                .fill(Color.orange.opacity(0.8))
                                .frame(width: 5, height: 5)
                        } else if wordCount > 0 {
                            Text("(\(wordCount) words)")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(.tertiary)
                        }

                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 3)
                    .padding(.horizontal, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    .background(Color(uiColor: .secondarySystemFill).opacity(0.4))
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                }
                .buttonStyle(.plain)

                if !content.isEmpty && isExpanded {
                    Button {
                        UIPasteboard.general.string = content
                        Haptics.shared.notification(.success)
                        withAnimation {
                            isCopied = true
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            withAnimation {
                                isCopied = false
                            }
                        }
                    } label: {
                        Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 10))
                            .foregroundStyle(isCopied ? .green : .secondary)
                            .frame(width: 22, height: 22)
                    }
                    .buttonStyle(.plain)
                }

                Spacer()
            }

            if isExpanded {
                ScrollView(.vertical, showsIndicators: true) {
                    MarkdownContentView(
                        content: content,
                        isStreaming: !isCompleted,
                        isReasoning: true
                    )
                    .padding(.vertical, 4)
                    .padding(.trailing, 4)
                    .background(
                        GeometryReader { geo in
                            Color.clear.preference(key: ContentHeightPreferenceKey.self, value: geo.size.height)
                        }
                    )
                }
                .frame(height: contentHeight > 0 ? min(contentHeight, maxHeight) : nil)
                .frame(maxHeight: maxHeight)
                .scrollDisabled(contentHeight <= maxHeight)
                .onPreferenceChange(ContentHeightPreferenceKey.self) { newHeight in
                    contentHeight = newHeight
                }
                .padding(.leading, 12)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(Color(uiColor: .separator).opacity(0.6))
                        .frame(width: 2)
                        .padding(.vertical, 2)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .onChange(of: isCompleted) { completed in
            if completed {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    isExpanded = false
                }
            }
        }
    }
}

