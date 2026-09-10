import SwiftUI

struct WorkspacesCarouselView: View {
    @Bindable var session = AppSessionState.shared
    @Binding var selectedWorkspaceId: String?
    let onManageWorkspaces: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("WORKSPACES")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.secondary)

                Spacer()

                Button {
                    Haptics.shared.selection()
                    onManageWorkspaces()
                } label: {
                    HStack(spacing: 4) {
                        Text("Manage")
                            .font(.caption.weight(.medium))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .foregroundStyle(Color.accentColor)
                }
            }
            .padding(.horizontal, 16)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    // "All Sessions" Chip Card
                    Button {
                        Haptics.shared.selection()
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedWorkspaceId = nil
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "square.grid.2x2.fill")
                                .font(.system(size: 13))
                                .foregroundStyle(selectedWorkspaceId == nil ? .white : .secondary)

                            VStack(alignment: .leading, spacing: 1) {
                                Text("All Sessions")
                                    .font(.subheadline.weight(selectedWorkspaceId == nil ? .bold : .medium))
                                    .foregroundStyle(selectedWorkspaceId == nil ? .white : .primary)
                                Text("\(session.chats.count) total")
                                    .font(.system(size: 10))
                                    .foregroundStyle(selectedWorkspaceId == nil ? .white.opacity(0.8) : .secondary)
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            selectedWorkspaceId == nil
                                ? Color.accentColor
                                : Color(uiColor: .secondarySystemGroupedBackground)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(Theme.subtleBorder, lineWidth: selectedWorkspaceId == nil ? 0 : 1)
                        )
                    }

                    // Individual Workspace Cards
                    ForEach(session.workspaces) { ws in
                        let isSelected = selectedWorkspaceId == ws.id
                        let chatCount = session.chats.filter { $0.workspaceId == ws.id }.count
                        let hasRunning = session.chats.contains { $0.workspaceId == ws.id && $0.status == .running }

                        Button {
                            Haptics.shared.selection()
                            withAnimation(.easeInOut(duration: 0.2)) {
                                if selectedWorkspaceId == ws.id {
                                    selectedWorkspaceId = nil
                                } else {
                                    selectedWorkspaceId = ws.id
                                }
                            }
                        } label: {
                            HStack(spacing: 8) {
                                ZStack(alignment: .topTrailing) {
                                    Image(systemName: "folder.fill")
                                        .font(.system(size: 15))
                                        .foregroundStyle(isSelected ? .white : .indigo)

                                    if hasRunning {
                                        Circle()
                                            .fill(Color.orange)
                                            .frame(width: 6, height: 6)
                                            .offset(x: 2, y: -2)
                                    }
                                }

                                VStack(alignment: .leading, spacing: 1) {
                                    Text(ws.name)
                                        .font(.subheadline.weight(isSelected ? .bold : .medium))
                                        .foregroundStyle(isSelected ? .white : .primary)
                                        .lineLimit(1)

                                    Text("\(chatCount) \(chatCount == 1 ? "chat" : "chats")")
                                        .font(.system(size: 10))
                                        .foregroundStyle(isSelected ? .white.opacity(0.8) : .secondary)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(
                                isSelected
                                    ? Color.accentColor
                                    : Color(uiColor: .secondarySystemGroupedBackground)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(Theme.subtleBorder, lineWidth: isSelected ? 0 : 1)
                            )
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }
}
