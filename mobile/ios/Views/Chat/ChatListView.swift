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

    @State private var selectedFilter: ChatFilter = .all
    @State private var showUnpairConfirmation = false
    @State private var showConnectionsSheet = false
    @State private var searchText = ""

    init() {}

    enum ChatFilter: String, CaseIterable, Identifiable {
        case all = "All"
        case workspace = "Workspaces"
        case standalone = "Standalone"
        var id: String { rawValue }
    }

    private var filteredChats: [Chat] {
        var result = session.chats

        // Filter by workspace carousel selection
        if let wsId = selectedWorkspaceId {
            result = result.filter { $0.workspaceId == wsId }
        } else {
            // Filter by segmented chips if no workspace is selected
            switch selectedFilter {
            case .all:
                break
            case .workspace:
                result = result.filter { $0.kind == .workspace }
            case .standalone:
                result = result.filter { $0.kind == .standalone }
            }
        }

        // Search text filtering
        if !searchText.trimmingCharacters(in: .whitespaces).isEmpty {
            let query = searchText.lowercased()
            result = result.filter { chat in
                chat.title.lowercased().contains(query)
            }
        }

        return result
    }

    struct ChatDateGroup: Identifiable {
        let title: String
        let chats: [Chat]
        var id: String { title }
    }

    private var groupedChats: [ChatDateGroup] {
        let calendar = Calendar.current
        let now = Date()
        let todayStart = calendar.startOfDay(for: now)
        let yesterdayStart = calendar.date(byAdding: .day, value: -1, to: todayStart) ?? todayStart
        let weekStart = calendar.date(byAdding: .day, value: -7, to: todayStart) ?? todayStart

        var today: [Chat] = []
        var yesterday: [Chat] = []
        var thisWeek: [Chat] = []
        var earlier: [Chat] = []

        for chat in filteredChats {
            let date = Date(timeIntervalSince1970: Double(chat.updatedAt) / 1000.0)
            if date >= todayStart {
                today.append(chat)
            } else if date >= yesterdayStart {
                yesterday.append(chat)
            } else if date >= weekStart {
                thisWeek.append(chat)
            } else {
                earlier.append(chat)
            }
        }

        var groups: [ChatDateGroup] = []
        if !today.isEmpty { groups.append(ChatDateGroup(title: "Today", chats: today)) }
        if !yesterday.isEmpty { groups.append(ChatDateGroup(title: "Yesterday", chats: yesterday)) }
        if !thisWeek.isEmpty { groups.append(ChatDateGroup(title: "This Week", chats: thisWeek)) }
        if !earlier.isEmpty { groups.append(ChatDateGroup(title: "Earlier", chats: earlier)) }
        return groups
    }

    private var runningChats: [Chat] {
        session.chats.filter { $0.status == .running }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                LazyVStack(spacing: 16) {
                    // Host Server Status Card
                    hostHeaderCard
                        .padding(.horizontal, 16)
                        .padding(.top, 8)

                    // Hero: Priority 0 Pending Approvals Banner
                    if !session.pendingApprovals.isEmpty {
                        PendingApprovalsBanner()
                            .padding(.horizontal, 16)
                            .transition(.asymmetric(
                                insertion: .scale(scale: 0.95).combined(with: .opacity),
                                removal: .opacity
                            ))
                    }

                    // Live Active Agent Pulse Cards
                    if !runningChats.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(runningChats) { runningChat in
                                ActiveAgentPulseCard(chat: runningChat)
                            }
                        }
                        .padding(.horizontal, 16)
                    }

                    // Workspaces Horizontal Carousel
                    WorkspacesCarouselView(
                        selectedWorkspaceId: $selectedWorkspaceId,
                        onManageWorkspaces: { showWorkspacesSheet = true }
                    )

                    // Filter Bar (only if no specific workspace is filtered)
                    if selectedWorkspaceId == nil && searchText.isEmpty {
                        filterBar
                            .padding(.horizontal, 16)
                    }

                    // Conversation List or Empty State
                    if filteredChats.isEmpty {
                        emptyStateView
                            .padding(.top, 16)
                    } else {
                        LazyVStack(alignment: .leading, spacing: 18) {
                            ForEach(groupedChats) { group in
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(group.title)
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 4)

                                    LazyVStack(spacing: 8) {
                                        ForEach(group.chats) { chat in
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
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
                .padding(.bottom, 90) // Extra padding for bottom floating action dock
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .searchable(text: $searchText, prompt: "Search conversations...")

            // Bottom Floating Action Dock
            floatingActionDock
                .padding(.bottom, 16)
        }
        .navigationTitle("Canywhere")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 8) {
                    Button {
                        Haptics.shared.selection()
                        showWorkspacesSheet = true
                    } label: {
                        Image(systemName: "folder")
                            .font(.system(size: 14, weight: .semibold))
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
                            .font(.system(size: 15, weight: .bold))
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

    // MARK: - Floating Action Dock

    private var floatingActionDock: some View {
        Button {
            Haptics.shared.impact(.light)
            showNewChatSheet = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.system(size: 14, weight: .semibold))

                Text("New Session")
                    .font(.subheadline.bold())

                if let model = session.selectedModel {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 5, height: 5)
                        Text(model)
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.white.opacity(0.15))
                    .clipShape(Capsule())
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(Theme.primaryGradient)
            .clipShape(Capsule())
            .shadow(color: Color.blue.opacity(0.35), radius: 12, y: 5)
        }
    }

    // MARK: - Host Header Card

    private var hostHeaderCard: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(connectionColor.opacity(0.12))
                    .frame(width: 42, height: 42)

                Image(systemName: "laptopcomputer")
                    .font(.system(size: 19))
                    .foregroundStyle(connectionColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(session.hostInfo?.hostName ?? session.pairedHostName ?? "Connected Host")
                        .font(.subheadline.bold())
                        .lineLimit(1)
                    PulsingDot(color: connectionColor)
                }

                HStack(spacing: 6) {
                    if let ep = session.pairedEndpoint {
                        let info = EndpointInfo(rawUrl: ep)
                        Text(info.kind.rawValue)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(info.kind.color)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1.5)
                            .background(info.kind.color.opacity(0.12))
                            .clipShape(Capsule())
                    }

                    if let os = session.hostInfo?.os {
                        Text(os)
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            Menu {
                Button {
                    Haptics.shared.selection()
                    showConnectionsSheet = true
                } label: {
                    Label("Connection Diagnostics", systemImage: "network")
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
        .padding(12)
        .cardStyle(cornerRadius: 16)
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
        HStack(alignment: .top, spacing: 12) {
            // Status Icon Indicator
            ZStack {
                Circle()
                    .fill(chatStatusColor(chat.status).opacity(0.12))
                    .frame(width: 32, height: 32)

                switch chat.status {
                case .running:
                    PulsingDot(color: .orange)
                case .awaitingApproval:
                    Image(systemName: "exclamationmark.shield.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.orange)
                case .error:
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.red)
                case .idle:
                    Image(systemName: "bubble.left.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.accentColor)
                }
            }
            .padding(.top, 2)

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    Text(chat.title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .lineLimit(2)

                    Spacer()

                    Text(formattedDate(chat.updatedAt))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }

                HStack(spacing: 6) {
                    // Workspace / Standalone chip
                    if chat.kind == .workspace {
                        HStack(spacing: 3) {
                            Image(systemName: "folder.fill")
                                .font(.system(size: 9))
                            Text(workspaceName(for: chat.workspaceId) ?? "Workspace")
                                .font(.system(size: 10, weight: .medium))
                        }
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2.5)
                        .background(Color.indigo.opacity(0.12))
                        .foregroundStyle(.indigo)
                        .clipShape(Capsule())
                    } else {
                        HStack(spacing: 3) {
                            Image(systemName: "pencil")
                                .font(.system(size: 9))
                            Text("Standalone")
                                .font(.system(size: 10, weight: .medium))
                        }
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2.5)
                        .background(Color(uiColor: .tertiarySystemFill))
                        .foregroundStyle(.secondary)
                        .clipShape(Capsule())
                    }

                    if chat.status == .running {
                        HStack(spacing: 3) {
                            PulsingDot(color: .orange)
                            Text("Running")
                                .font(.system(size: 10, weight: .bold))
                        }
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2.5)
                        .background(Color.orange.opacity(0.12))
                        .foregroundStyle(.orange)
                        .clipShape(Capsule())
                    }

                    if chat.status == .awaitingApproval {
                        HStack(spacing: 3) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 9))
                            Text("Action Needed")
                                .font(.system(size: 10, weight: .bold))
                        }
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2.5)
                        .background(Color.red.opacity(0.12))
                        .foregroundStyle(.red)
                        .clipShape(Capsule())
                    }

                    Spacer()
                }
            }
        }
        .padding(14)
        .cardStyle(cornerRadius: 16)
    }

    private func chatStatusColor(_ status: ChatStatus) -> Color {
        switch status {
        case .running: return .orange
        case .awaitingApproval: return .red
        case .error: return .red
        case .idle: return Color.accentColor
        }
    }

    // MARK: - Empty State View

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Theme.primaryGradient.opacity(0.12))
                    .frame(width: 68, height: 68)

                Image(systemName: "sparkles")
                    .font(.system(size: 28))
                    .foregroundStyle(Theme.primaryGradient)
            }
            .padding(.top, 16)

            VStack(spacing: 6) {
                Text("No Conversations")
                    .font(.headline)
                Text("Start a coding session or pick a prompt starter below.")
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
