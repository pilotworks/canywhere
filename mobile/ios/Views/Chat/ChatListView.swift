import SwiftUI

struct ChatListView: View {
    @Bindable var session = AppSessionState.shared
    @State private var showNewChatSheet = false
    @State private var newChatTitle = ""
    @State private var selectedWorkspaceId: String? = nil

    @State private var showWorkspacesSheet = false
    @State private var editingWorkspace: Workspace? = nil
    @State private var editWorkspaceName = ""
    @State private var editWorkspacePath = ""
    @State private var workspaceToDelete: Workspace? = nil
    @State private var showDeleteWorkspaceAlert = false

    init() {}

    @State private var selectedFilter: ChatFilter = .all
    @State private var showUnpairConfirmation = false
    @State private var showConnectionsSheet = false

    enum ChatFilter: String, CaseIterable, Identifiable {
        case all = "All"
        case workspace = "Workspaces"
        case standalone = "Standalone"
        var id: String { rawValue }
    }

    private var filteredChats: [Chat] {
        switch selectedFilter {
        case .all:
            return session.chats
        case .workspace:
            return session.chats.filter { $0.kind == .workspace }
        case .standalone:
            return session.chats.filter { $0.kind == .standalone }
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                // Host Server Status Card
                hostHeaderCard
                    .padding(.horizontal, 16)
                    .padding(.top, 8)

                // Filter Segmented Chips
                filterBar
                    .padding(.horizontal, 16)

                // Conversation List or Empty State
                if filteredChats.isEmpty {
                    emptyStateView
                        .padding(.top, 24)
                } else {
                    LazyVStack(spacing: 10) {
                        ForEach(filteredChats) { chat in
                            NavigationLink(destination: ChatDetailView(chatId: chat.id)) {
                                chatRowCard(chat)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button(role: .destructive) {
                                    Haptics.shared.notification(.warning)
                                    Task {
                                        await session.deleteChat(chatId: chat.id)
                                    }
                                } label: {
                                    Label("Delete Conversation", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.bottom, 24)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Canywhere")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 8) {
                    Button {
                        Haptics.shared.selection()
                        showWorkspacesSheet = true
                    } label: {
                        Image(systemName: "folder")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.primary)
                            .padding(8)
                            .background(Color(uiColor: .tertiarySystemFill))
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("Workspaces")

                    Button {
                        Haptics.shared.impact(.light)
                        showNewChatSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 16, weight: .bold))
                            .padding(8)
                            .background(Color.accentColor.opacity(0.12))
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("New Chat")
                }
            }
        }
        .refreshable {
            await session.refreshAll()
        }
        .confirmationDialog(
            "Unpair this device?",
            isPresented: $showUnpairConfirmation,
            titleVisibility: .visible
        ) {
            Button("Unpair", role: .destructive) {
                Haptics.shared.notification(.warning)
                session.unpair()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You will need to re-scan the QR code on your desktop to reconnect.")
        }
        .sheet(isPresented: $showNewChatSheet) {
            newChatSheetView
        }
        .sheet(isPresented: $showWorkspacesSheet) {
            manageWorkspacesSheet
        }
        .sheet(isPresented: $showConnectionsSheet) {
            HostConnectionsSheet()
        }
        .sheet(item: $editingWorkspace) { _ in
            editWorkspaceSheet
        }
        .alert("Delete Workspace?", isPresented: $showDeleteWorkspaceAlert, presenting: workspaceToDelete) { ws in
            Button("Delete", role: .destructive) {
                Haptics.shared.notification(.warning)
                let id = ws.id
                Task {
                    try? await session.deleteWorkspace(id: id)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: { ws in
            Text("Are you sure you want to delete '\(ws.name)'? All conversations in this workspace will be deleted from Canywhere.")
        }
    }

    // MARK: - Host Header Card

    private var hostHeaderCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(connectionColor.opacity(0.12))
                    .frame(width: 44, height: 44)

                Image(systemName: "laptopcomputer")
                    .font(.system(size: 20))
                    .foregroundStyle(connectionColor)
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(session.pairedHostName ?? "Connected Host")
                        .font(.subheadline.bold())
                    PulsingDot(color: connectionColor)
                }

                if let ep = session.pairedEndpoint {
                    Text(ep)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            Menu {
                Button {
                    Haptics.shared.selection()
                    showConnectionsSheet = true
                } label: {
                    Label("Connection Settings", systemImage: "network")
                }

                Button {
                    Haptics.shared.selection()
                    showWorkspacesSheet = true
                } label: {
                    Label("Manage Workspaces", systemImage: "folder")
                }

                Divider()

                Button(role: .destructive) {
                    Haptics.shared.selection()
                    showUnpairConfirmation = true
                } label: {
                    Label("Unpair Device", systemImage: "link.badge.plus")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)
                    .padding(8)
                    .background(Color(uiColor: .tertiarySystemFill))
                    .clipShape(Circle())
            }
        }
        .padding(14)
        .cardStyle(cornerRadius: 18)
        .contentShape(Rectangle())
        .onTapGesture {
            Haptics.shared.selection()
            showConnectionsSheet = true
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        HStack(spacing: 8) {
            ForEach(ChatFilter.allCases) { filter in
                Button {
                    Haptics.shared.selection()
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedFilter = filter
                    }
                } label: {
                    Text(filter.rawValue)
                        .font(.caption.weight(selectedFilter == filter ? .bold : .medium))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(
                            selectedFilter == filter
                            ? Color.accentColor
                            : Color(uiColor: .secondarySystemGroupedBackground)
                        )
                        .foregroundStyle(selectedFilter == filter ? .white : .secondary)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().stroke(Theme.subtleBorder, lineWidth: selectedFilter == filter ? 0 : 1)
                        )
                }
            }
            Spacer()
        }
    }

    // MARK: - Chat Row Card

    private func chatRowCard(_ chat: Chat) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                Text(chat.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)

                Spacer()

                statusBadge(chat.status)
            }

            HStack(spacing: 8) {
                // Workspace / Standalone chip
                HStack(spacing: 4) {
                    Image(systemName: chat.kind == .workspace ? "folder.fill" : "bubble.left.fill")
                        .font(.system(size: 10))
                    Text(chat.kind == .workspace ? (workspaceName(for: chat.workspaceID) ?? "Workspace") : "Standalone")
                        .font(.caption2.weight(.medium))
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color(uiColor: .tertiarySystemFill))
                .clipShape(Capsule())
                .foregroundStyle(.secondary)

                Spacer()

                // Relative time
                Text(formattedDate(chat.updatedAt))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(14)
        .cardStyle(cornerRadius: 16)
    }

    // MARK: - Empty State View

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Theme.primaryGradient.opacity(0.12))
                    .frame(width: 72, height: 72)

                Image(systemName: "sparkles")
                    .font(.system(size: 30))
                    .foregroundStyle(Theme.primaryGradient)
            }
            .padding(.top, 24)

            VStack(spacing: 6) {
                Text("No Conversations Yet")
                    .font(.headline)
                Text("Start an autonomous coding session or select a prompt starter below.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            // Quick Prompt Starters
            VStack(spacing: 8) {
                promptStarterChip("Review recent git changes")
                promptStarterChip("Inspect codebase architecture")
                promptStarterChip("Write unit test suite")
            }
            .padding(.top, 8)

            Button {
                Haptics.shared.impact(.light)
                showNewChatSheet = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "plus")
                    Text("New Conversation")
                }
                .font(.subheadline.bold())
                .foregroundStyle(.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(Theme.primaryGradient)
                .clipShape(Capsule())
                .shadow(color: Color.blue.opacity(0.3), radius: 8, y: 3)
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .cardStyle(cornerRadius: 20)
        .padding(.horizontal, 16)
    }

    private func promptStarterChip(_ text: String) -> some View {
        Button {
            newChatTitle = text
            showNewChatSheet = true
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 10))
                Text(text)
                    .font(.caption.weight(.medium))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color(uiColor: .tertiarySystemFill))
            .foregroundStyle(.secondary)
            .clipShape(Capsule())
        }
    }

    // MARK: - New Chat Modal

    private var newChatSheetView: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("CONVERSATION TITLE")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.secondary)

                        TextField("e.g. Refactor login view", text: $newChatTitle)
                            .font(.body)
                            .padding(14)
                            .background(Color(uiColor: .secondarySystemGroupedBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(Theme.subtleBorder, lineWidth: 1)
                            )
                    }

                    if !session.workspaces.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("TARGET WORKSPACE")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.secondary)

                            // Standalone option
                            Button {
                                selectedWorkspaceId = nil
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: "bubble.left.and.bubble.right")
                                        .foregroundStyle(.secondary)
                                    Text("Standalone (Scratchpad)")
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    if selectedWorkspaceId == nil {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(Color.accentColor)
                                    }
                                }
                                .padding(14)
                                .cardStyle(cornerRadius: 14)
                            }

                            // Workspaces
                            ForEach(session.workspaces) { ws in
                                Button {
                                    selectedWorkspaceId = ws.id
                                } label: {
                                    HStack(spacing: 12) {
                                        Image(systemName: "folder.fill")
                                            .foregroundStyle(.indigo)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(ws.name)
                                                .font(.subheadline.weight(.medium))
                                                .foregroundStyle(.primary)
                                            Text(ws.rootPath)
                                                .font(.caption2.monospaced())
                                                .foregroundStyle(.secondary)
                                                .lineLimit(1)
                                        }
                                        Spacer()
                                        if selectedWorkspaceId == ws.id {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundStyle(Color.accentColor)
                                        }
                                    }
                                    .padding(14)
                                    .cardStyle(cornerRadius: 14)
                                }
                                .contextMenu {
                                    Button {
                                        Haptics.shared.selection()
                                        editingWorkspace = ws
                                        editWorkspaceName = ws.name
                                        editWorkspacePath = ws.rootPath
                                    } label: {
                                        Label("Edit Workspace", systemImage: "pencil")
                                    }

                                    Button(role: .destructive) {
                                        Haptics.shared.notification(.warning)
                                        workspaceToDelete = ws
                                        showDeleteWorkspaceAlert = true
                                    } label: {
                                        Label("Delete Workspace", systemImage: "trash")
                                    }
                                }
                            }
                        }
                    }

                    Button {
                        Haptics.shared.notification(.success)
                        let title = newChatTitle
                        let wsId = selectedWorkspaceId
                        newChatTitle = ""
                        selectedWorkspaceId = nil
                        showNewChatSheet = false
                        Task {
                            _ = try? await session.createChat(title: title, workspaceId: wsId)
                        }
                    } label: {
                        Text("Start Conversation")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Theme.primaryGradient)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .shadow(color: Color.blue.opacity(0.3), radius: 10, y: 4)
                    }
                    .padding(.top, 10)
                }
                .padding(20)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("New Conversation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showNewChatSheet = false
                    }
                }
            }
        }
    }

    private func workspaceName(for id: String?) -> String? {
        guard let id else { return nil }
        return session.workspaces.first(where: { $0.id == id })?.name
    }

    private var connectionColor: Color {
        switch session.connectionStatus {
        case .connected: return .green
        case .connecting, .reconnecting: return .orange
        case .disconnected: return .red
        }
    }

    @ViewBuilder
    private func statusBadge(_ status: ChatStatus) -> some View {
        switch status {
        case .running:
            HStack(spacing: 4) {
                PulsingDot(color: .orange)
                Text("Running")
                    .font(.caption2.bold())
                    .foregroundStyle(.orange)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.orange.opacity(0.12))
            .clipShape(Capsule())
        case .awaitingApproval:
            HStack(spacing: 4) {
                Image(systemName: "exclamationmark.shield.fill")
                    .font(.system(size: 10))
                Text("Action Needed")
                    .font(.caption2.bold())
            }
            .foregroundStyle(.red)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.red.opacity(0.12))
            .clipShape(Capsule())
        case .idle:
            EmptyView()
        case .error:
            Text("Error")
                .font(.caption2.bold())
                .foregroundStyle(.red)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color.red.opacity(0.12))
                .clipShape(Capsule())
        }
    }

    private func formattedDate(_ epochMs: Int) -> String {
        let date = Date(timeIntervalSince1970: Double(epochMs) / 1000.0)
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    // MARK: - Workspaces Management Sheets

    private var manageWorkspacesSheet: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    if session.workspaces.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "folder.badge.minus")
                                .font(.system(size: 44))
                                .foregroundStyle(.secondary)
                            Text("No Workspaces Added")
                                .font(.headline)
                            Text("Add workspaces on your desktop computer to organize projects.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)
                        }
                        .padding(.top, 60)
                    } else {
                        ForEach(session.workspaces) { ws in
                            HStack(spacing: 14) {
                                Image(systemName: "folder.fill")
                                    .font(.system(size: 24))
                                    .foregroundStyle(.indigo)

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(ws.name)
                                        .font(.subheadline.bold())
                                        .foregroundStyle(.primary)
                                    Text(ws.rootPath)
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                    let count = session.chats.filter { $0.workspaceId == ws.id }.count
                                    Text("\(count) \(count == 1 ? "chat" : "chats")")
                                        .font(.caption2)
                                        .foregroundStyle(.tertiary)
                                }

                                Spacer()

                                Menu {
                                    Button {
                                        Haptics.shared.selection()
                                        editingWorkspace = ws
                                        editWorkspaceName = ws.name
                                        editWorkspacePath = ws.rootPath
                                    } label: {
                                        Label("Edit Workspace", systemImage: "pencil")
                                    }

                                    Divider()

                                    Button(role: .destructive) {
                                        Haptics.shared.notification(.warning)
                                        workspaceToDelete = ws
                                        showDeleteWorkspaceAlert = true
                                    } label: {
                                        Label("Delete Workspace", systemImage: "trash")
                                    }
                                } label: {
                                    Image(systemName: "ellipsis")
                                        .font(.subheadline.bold())
                                        .foregroundStyle(.secondary)
                                        .padding(8)
                                        .background(Color(uiColor: .tertiarySystemFill))
                                        .clipShape(Circle())
                                }
                            }
                            .padding(14)
                            .cardStyle(cornerRadius: 16)
                        }
                    }
                }
                .padding(16)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Workspaces")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        showWorkspacesSheet = false
                    }
                }
            }
        }
    }

    private var editWorkspaceSheet: some View {
        NavigationStack {
            Form {
                Section("Workspace Information") {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Display Name")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("Name", text: $editWorkspaceName)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Root Directory Path")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("Path", text: $editWorkspacePath)
                            .font(.system(.body, design: .monospaced))
                    }
                }
            }
            .navigationTitle("Edit Workspace")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        editingWorkspace = nil
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let ws = editingWorkspace, !editWorkspaceName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        let id = ws.id
                        let name = editWorkspaceName.trimmingCharacters(in: .whitespaces)
                        let path = editWorkspacePath.trimmingCharacters(in: .whitespaces)
                        editingWorkspace = nil
                        Task {
                            Haptics.shared.notification(.success)
                            try? await session.updateWorkspace(id: id, name: name, rootPath: path.isEmpty ? nil : path)
                        }
                    }
                    .disabled(editWorkspaceName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
