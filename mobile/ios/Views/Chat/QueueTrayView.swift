import SwiftUI

struct QueueTrayView: View {
    let items: [QueuedMessage]
    let isRunning: Bool
    let activeTurnId: String?
    let onSteer: (String) -> Void
    let onEdit: (String, String) -> Void
    let onDelete: (String) -> Void

    @State private var editingId: String? = nil
    @State private var editText: String = ""
    @State private var contentHeight: CGFloat = 0
    @State private var isCollapsed: Bool = false

    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                // Tray Header (tappable to collapse/expand)
                Button {
                    Haptics.shared.selection()
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        isCollapsed.toggle()
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "clock")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.secondary)

                        Text("In Queue (\(items.count))")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(.primary)

                        Spacer()

                        if isCollapsed {
                            Text("Tap to expand")
                                .font(.system(size: 10))
                                .foregroundStyle(.secondary)
                        } else {
                            Text("Executes sequentially")
                                .font(.system(size: 10))
                                .foregroundStyle(.tertiary)
                        }

                        Image(systemName: isCollapsed ? "chevron.down" : "chevron.up")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.secondary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(uiColor: .secondarySystemGroupedBackground).opacity(0.85))

                if !isCollapsed {
                    Divider()

                    // Queue Items List (Dynamic height: hugs 1-3 items tightly, scrolls if taller than 140pt)
                    ScrollView(.vertical, showsIndicators: contentHeight > 140) {
                    VStack(spacing: 0) {
                        ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                            if editingId == item.id {
                                // Inline Edit Mode
                                HStack(spacing: 8) {
                                    Text("\(idx + 1).")
                                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                        .frame(width: 16, alignment: .leading)

                                    TextField("Edit prompt...", text: $editText)
                                        .font(.system(size: 12, design: .monospaced))
                                        .textFieldStyle(.plain)
                                        .padding(.vertical, 4)
                                        .padding(.horizontal, 6)
                                        .background(Color(uiColor: .tertiarySystemFill))
                                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

                                    Button {
                                        Haptics.shared.selection()
                                        let trimmed = editText.trimmingCharacters(in: .whitespacesAndNewlines)
                                        if !trimmed.isEmpty {
                                            onEdit(item.id, trimmed)
                                        } else {
                                            onDelete(item.id)
                                        }
                                        editingId = nil
                                    } label: {
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(.green)
                                            .frame(width: 26, height: 26)
                                    }
                                    .buttonStyle(.plain)

                                    Button {
                                        Haptics.shared.selection()
                                        editingId = nil
                                    } label: {
                                        Image(systemName: "xmark")
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundStyle(.secondary)
                                            .frame(width: 26, height: 26)
                                    }
                                    .buttonStyle(.plain)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color(uiColor: .secondarySystemFill).opacity(0.3))
                            } else {
                                // Normal Row
                                HStack(spacing: 8) {
                                    Text("\(idx + 1).")
                                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                        .frame(width: 16, alignment: .leading)

                                    Text(item.content)
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundStyle(.primary)
                                        .lineLimit(1)
                                        .frame(maxWidth: .infinity, alignment: .leading)

                                    // Action Buttons
                                    HStack(spacing: 6) {
                                        if isRunning {
                                            Button {
                                                Haptics.shared.impact(.medium)
                                                onSteer(item.id)
                                            } label: {
                                                HStack(spacing: 3) {
                                                    Image(systemName: "bolt.fill")
                                                        .font(.system(size: 8))
                                                    Text("Steer")
                                                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                                }
                                                .foregroundStyle(.primary)
                                                .padding(.horizontal, 7)
                                                .padding(.vertical, 3)
                                                .background(Color(uiColor: .secondarySystemFill))
                                                .clipShape(Capsule())
                                                .overlay(
                                                    Capsule().stroke(Color(uiColor: .separator).opacity(0.6), lineWidth: 1)
                                                )
                                            }
                                            .buttonStyle(.plain)
                                        }

                                        Button {
                                            Haptics.shared.selection()
                                            editingId = item.id
                                            editText = item.content
                                        } label: {
                                            Image(systemName: "pencil")
                                                .font(.system(size: 10))
                                                .foregroundStyle(.secondary)
                                                .frame(width: 22, height: 22)
                                        }
                                        .buttonStyle(.plain)

                                        Button {
                                            Haptics.shared.selection()
                                            onDelete(item.id)
                                        } label: {
                                            Image(systemName: "xmark")
                                                .font(.system(size: 10))
                                                .foregroundStyle(.secondary)
                                                .frame(width: 22, height: 22)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                            }

                            if idx < items.count - 1 {
                                Divider()
                                    .padding(.leading, 36)
                            }
                        }
                    }
                    .background(
                        GeometryReader { geo in
                            Color.clear.preference(key: QueueListHeightPreferenceKey.self, value: geo.size.height)
                        }
                    )
                }
                .frame(height: contentHeight > 0 ? min(contentHeight, 140) : nil)
                .scrollDisabled(contentHeight <= 140)
                .onPreferenceChange(QueueListHeightPreferenceKey.self) { newHeight in
                    contentHeight = newHeight
                }
                }
            }
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Theme.subtleBorder, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.06), radius: 8, x: 0, y: 3)
            .padding(.horizontal, 14)
            .padding(.bottom, 6)
            .transition(.opacity.combined(with: .move(edge: .bottom)))
        }
    }
}

private struct QueueListHeightPreferenceKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}
