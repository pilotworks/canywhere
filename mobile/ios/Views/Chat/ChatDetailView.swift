import SwiftUI

struct BottomAnchorPreferenceKey: PreferenceKey {
    static let defaultValue: CGFloat? = nil
    static func reduce(value: inout CGFloat?, nextValue: () -> CGFloat?) {
        if let next = nextValue() {
            value = next
        }
    }
}

struct ViewportHeightPreferenceKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

struct ChatDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: ChatViewModel
    @State private var inputText: String = ""
    @State private var activeApproval: ApprovalRequest?

    @State private var isAtBottom: Bool = true
    @State private var hasUnseenMessages: Bool = false
    @State private var viewportHeight: CGFloat = 0

    init(chatId: String) {
        _viewModel = State(initialValue: ChatViewModel(chatId: chatId))
    }

    private func updateScrollPosition(minY: CGFloat?) {
        guard viewportHeight > 0 else { return }
        let atBottom: Bool
        if let minY = minY {
            // When at bottom, bottom_anchor.minY aligns near viewportHeight
            atBottom = minY <= viewportHeight + 60
        } else {
            // bottom_anchor was culled by LazyVStack because user scrolled up to older messages
            atBottom = false
        }

        if atBottom != isAtBottom {
            isAtBottom = atBottom
        }
        if atBottom && hasUnseenMessages {
            hasUnseenMessages = false
        }
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color(uiColor: .systemGroupedBackground)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Messages Feed
                ScrollViewReader { proxy in
                    ZStack(alignment: .bottomTrailing) {
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                if viewModel.messages.isEmpty {
                                    emptyChatGreeting
                                        .padding(.top, 40)
                                } else {
                                    ForEach(Array(viewModel.messages.enumerated()), id: \.element.id) { idx, message in
                                        MessageBubbleView(
                                            message: message,
                                            durationSeconds: viewModel.durationFor(message: message, at: idx)
                                        )
                                        .equatable()
                                    }
                                }
                                Color.clear
                                    .frame(height: 1)
                                    .id("bottom_anchor")
                                    .allowsHitTesting(false)
                                    .background(
                                        GeometryReader { geo in
                                            Color.clear.preference(
                                                key: BottomAnchorPreferenceKey.self,
                                                value: geo.frame(in: .named("ChatScrollViewSpace")).minY
                                            )
                                        }
                                    )
                            }
                            .padding(.top, viewModel.pendingApprovals.first != nil ? 60 : 12)
                            .padding(.bottom, 8)
                        }
                        .scrollDismissesKeyboard(.interactively)
                        .defaultScrollAnchor(.bottom)
                        .coordinateSpace(name: "ChatScrollViewSpace")
                        .background(
                            GeometryReader { geo in
                                Color.clear
                                    .contentShape(Rectangle())
                                    .preference(
                                        key: ViewportHeightPreferenceKey.self,
                                        value: geo.size.height
                                    )
                                    .onTapGesture {
                                        hideKeyboard()
                                    }
                            }
                        )
                        .onPreferenceChange(BottomAnchorPreferenceKey.self) { minY in
                            updateScrollPosition(minY: minY)
                        }
                        .onPreferenceChange(ViewportHeightPreferenceKey.self) { height in
                            if abs(viewportHeight - height) > 1 {
                                viewportHeight = height
                            }
                        }

                        // Floating Jump to Bottom Button
                        if !isAtBottom {
                            Button {
                                Haptics.shared.impact(.light)
                                withAnimation(.easeOut(duration: 0.25)) {
                                    proxy.scrollTo("bottom_anchor", anchor: .bottom)
                                }
                                isAtBottom = true
                                hasUnseenMessages = false
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "arrow.down")
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(.secondary)

                                    Text(hasUnseenMessages ? "New messages below" : "Scroll to bottom")
                                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                                        .foregroundStyle(.primary)

                                    if hasUnseenMessages {
                                        PulsingDot(color: .green)
                                    }
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(.ultraThinMaterial)
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule().stroke(Color(uiColor: .separator).opacity(0.6), lineWidth: 1)
                                )
                                .shadow(color: .black.opacity(0.12), radius: 8, x: 0, y: 4)
                            }
                            .buttonStyle(.plain)
                            .padding(.trailing, 16)
                            .padding(.bottom, 12)
                            .transition(.opacity.combined(with: .scale(scale: 0.92)))
                        }
                    }
                    .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isAtBottom)
                    .animation(.spring(response: 0.3, dampingFraction: 0.8), value: hasUnseenMessages)
                    .onChange(of: viewModel.messages.count) { oldCount, newCount in
                        if oldCount == 0 && newCount > 0 {
                            proxy.scrollTo("bottom_anchor", anchor: .bottom)
                            isAtBottom = true
                            hasUnseenMessages = false
                        } else if isAtBottom {
                            withAnimation(.easeOut(duration: 0.2)) {
                                proxy.scrollTo("bottom_anchor", anchor: .bottom)
                            }
                        } else {
                            hasUnseenMessages = true
                        }
                    }
                    .onChange(of: viewModel.scrollTrigger) { _, _ in
                        if isAtBottom {
                            proxy.scrollTo("bottom_anchor", anchor: .bottom)
                        } else {
                            hasUnseenMessages = true
                        }
                    }
                }

                // Floating Queue Tray
                QueueTrayView(
                    items: viewModel.queuedMessages,
                    isRunning: viewModel.isRunning,
                    activeTurnId: viewModel.activeTurnId,
                    onSteer: { queueId in
                        Task {
                            await viewModel.steerQueuedPrompt(id: queueId)
                        }
                    },
                    onEdit: { queueId, newText in
                        viewModel.updateQueuedPrompt(id: queueId, newContent: newText)
                    },
                    onDelete: { queueId in
                        viewModel.removeQueuedPrompt(id: queueId)
                    }
                )

                // Bottom Composer
                ComposerView(
                    text: $inputText,
                    selectedModel: $viewModel.selectedModel,
                    effort: $viewModel.selectedEffort,
                    permissionMode: $viewModel.permissionMode,
                    models: AppSessionState.shared.models,
                    commands: {
                        let pId = viewModel.chat?.providerID ?? AppSessionState.shared.selectedProviderId
                        return AppSessionState.shared.providers.first(where: { $0.id == pId })?.commands ?? nil
                    }(),
                    actions: {
                        let pId = viewModel.chat?.providerID ?? AppSessionState.shared.selectedProviderId
                        return AppSessionState.shared.providers.first(where: { $0.id == pId })?.actions ?? nil
                    }(),
                    isRunning: viewModel.isRunning,
                    isSending: viewModel.isSending,
                    hasWorkspace: viewModel.chat?.workspaceID != nil,
                    providerName: {
                        let pId = viewModel.chat?.providerID ?? AppSessionState.shared.selectedProviderId
                        let p = AppSessionState.shared.providers.first(where: { $0.id == pId })
                        return p?.name ?? (pId == "agy" ? "Antigravity" : "Codex")
                    }(),
                    supportsApprovals: {
                        let pId = viewModel.chat?.providerID ?? AppSessionState.shared.selectedProviderId
                        let p = AppSessionState.shared.providers.first(where: { $0.id == pId })
                        return p?.capabilities.supportsApprovals ?? (pId != "agy")
                    }(),
                    onSend: {
                        let text = inputText
                        inputText = ""
                        isAtBottom = true
                        hasUnseenMessages = false
                        if viewModel.isRunning {
                            viewModel.enqueuePrompt(content: text)
                        } else {
                            // Check if text is a slash command
                            let words = text.split(separator: " ")
                            if let first = words.first, first.hasPrefix("/") {
                                let cmd = String(first)
                                let args = words.count > 1 ? words.dropFirst().joined(separator: " ") : nil

                                if cmd == "/reset" {
                                    let wsId = viewModel.chat?.workspaceID
                                    Task {
                                        _ = try? await AppSessionState.shared.createChat(title: "New Chat", workspaceId: wsId)
                                    }
                                    return
                                }
                                if cmd == "/scratch" {
                                    Task {
                                        _ = try? await AppSessionState.shared.createChat(title: "Scratchpad", workspaceId: nil)
                                    }
                                    return
                                }

                                let pId = viewModel.chat?.providerID ?? AppSessionState.shared.selectedProviderId
                                let providerCmds = AppSessionState.shared.providers.first(where: { $0.id == pId })?.commands ?? []
                                let isKnownCommand = providerCmds.contains(where: {
                                    $0.name == cmd || "/\($0.name)" == cmd || $0.name == String(cmd.dropFirst())
                                }) || cmd == "/review" || cmd == "/compact"

                                if isKnownCommand {
                                    Task {
                                        await viewModel.executeCommand(command: cmd, args: args)
                                    }
                                    return
                                }
                            }
                            Task {
                                await viewModel.submitTurn(content: text)
                            }
                        }
                    },
                    onInterrupt: {
                        Task {
                            await viewModel.interrupt()
                        }
                    },
                    onPermissionChange: { mode in
                        Task {
                            await viewModel.setPermissionMode(mode)
                        }
                    },
                    onSearchFiles: { query in
                        await viewModel.searchWorkspaceFiles(query: query)
                    },
                    onExecuteCommand: { cmd, args in
                        Task {
                            await viewModel.executeCommand(command: cmd, args: args)
                        }
                    },
                    onReview: {
                        Task {
                            await viewModel.executeCommand(command: "/review")
                        }
                    },
                    onCompact: {
                        Task {
                            await viewModel.executeCommand(command: "/compact")
                        }
                    },
                    onReset: {
                        let wsId = viewModel.chat?.workspaceID
                        Task {
                            _ = try? await AppSessionState.shared.createChat(title: "New Chat", workspaceId: wsId)
                            dismiss()
                        }
                    },
                    onScratch: {
                        Task {
                            _ = try? await AppSessionState.shared.createChat(title: "Scratchpad", workspaceId: nil)
                            dismiss()
                        }
                    }
                )
            }

            // Floating Pending Approval Banner
            if let pending = viewModel.pendingApprovals.first {
                Button {
                    Haptics.shared.impact(.medium)
                    activeApproval = pending
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.shield.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(.orange)

                        VStack(alignment: .leading, spacing: 1) {
                            Text("Approval Required")
                                .font(.caption.bold())
                                .foregroundStyle(.primary)
                            Text(pending.payload.command ?? "Command execution requested")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }

                        Spacer()

                        Text("Review")
                            .font(.caption.bold())
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.orange)
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(Color.orange.opacity(0.3), lineWidth: 1)
                    )
                    .shadow(color: Color.black.opacity(0.08), radius: 10, y: 4)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .animation(.spring(response: 0.35, dampingFraction: 0.8), value: viewModel.pendingApprovals.count)
            }
        }
        .navigationTitle(viewModel.chat?.title ?? "Chat")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 2) {
                    Text(viewModel.chat?.title ?? "Chat")
                        .font(.headline)
                        .lineLimit(1)
                    if let model = viewModel.selectedModel {
                        Text("\(model) • \(viewModel.selectedEffort.capitalized)")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 8) {
                    if viewModel.isRunning {
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
                    }

                    let currentProviderForTopBar = AppSessionState.shared.providers.first(where: { $0.id == (viewModel.chat?.providerID ?? AppSessionState.shared.selectedProviderId) })
                    let supportsApprovalsTopBar = currentProviderForTopBar?.capabilities.supportsApprovals ?? ((viewModel.chat?.providerID ?? AppSessionState.shared.selectedProviderId) != "agy")

                    if supportsApprovalsTopBar {
                        Menu {
                            Button {
                                Haptics.shared.selection()
                                Task {
                                    await viewModel.setPermissionMode(.onRequest)
                                }
                            } label: {
                                HStack {
                                    Label("Ask for Approval", systemImage: "shield.checkered")
                                    if viewModel.permissionMode == .onRequest {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }

                            Button {
                                Haptics.shared.selection()
                                Task {
                                    await viewModel.setPermissionMode(.readOnly)
                                }
                            } label: {
                                HStack {
                                    Label("Plan Only (Read-Only)", systemImage: "eye")
                                    if viewModel.permissionMode == .readOnly {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }

                            Button {
                                Haptics.shared.selection()
                                Task {
                                    await viewModel.setPermissionMode(.auto)
                                }
                            } label: {
                                HStack {
                                    Label("Full Auto (YOLO)", systemImage: "flame.fill")
                                    if viewModel.permissionMode == .auto {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        } label: {
                            Image(systemName: permissionIconName(viewModel.permissionMode))
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(permissionColor(viewModel.permissionMode))
                                .frame(width: 28, height: 28)
                                .background(permissionColor(viewModel.permissionMode).opacity(0.12))
                                .clipShape(Circle())
                        }
                    } else {
                        let currentEffectiveMode: PermissionMode = (viewModel.permissionMode == .readOnly) ? .readOnly : .auto
                        Menu {
                            Button {
                                Haptics.shared.selection()
                                Task {
                                    await viewModel.setPermissionMode(.auto)
                                }
                            } label: {
                                HStack {
                                    Label("Full Auto (YOLO)", systemImage: "flame.fill")
                                    if currentEffectiveMode == .auto {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }

                            Button {
                                Haptics.shared.selection()
                                Task {
                                    await viewModel.setPermissionMode(.readOnly)
                                }
                            } label: {
                                HStack {
                                    Label("Plan Only", systemImage: "eye")
                                    if currentEffectiveMode == .readOnly {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        } label: {
                            Image(systemName: currentEffectiveMode == .readOnly ? "eye" : "flame.fill")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(currentEffectiveMode == .readOnly ? Color.purple : Color.orange)
                                .frame(width: 28, height: 28)
                                .background((currentEffectiveMode == .readOnly ? Color.purple : Color.orange).opacity(0.12))
                                .clipShape(Circle())
                        }
                    }

                    // Dynamic Provider Actions Menu
                    let pId = viewModel.chat?.providerID ?? AppSessionState.shared.selectedProviderId
                    let providerActions = AppSessionState.shared.providers.first(where: { $0.id == pId })?.actions ?? []
                    let toolbarActions = providerActions.filter { $0.placement == "toolbar" }
                    if !toolbarActions.isEmpty {
                        Menu {
                            ForEach(toolbarActions, id: \.id) { act in
                                Button {
                                    Haptics.shared.selection()
                                    Task {
                                        await viewModel.executeCommand(command: act.id)
                                    }
                                } label: {
                                    Label(act.label, systemImage: SlashCommandItem.iconForName(act.icon))
                                }
                                .disabled(viewModel.isRunning)
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.primary)
                                .frame(width: 28, height: 28)
                                .background(Color(uiColor: .secondarySystemGroupedBackground))
                                .clipShape(Circle())
                        }
                    }
                }
            }
        }
        .task {
            AppSessionState.shared.activeChatViewModel = viewModel
            await viewModel.loadChat()
            if let pId = viewModel.chat?.providerID {
                await AppSessionState.shared.loadModels(for: pId)
            }
        }
        .onDisappear {
            if AppSessionState.shared.activeChatViewModel === viewModel {
                AppSessionState.shared.activeChatViewModel = nil
            }
        }
        .sheet(item: $activeApproval) { request in
            ApprovalSheetView(request: request) { decision in
                activeApproval = nil
                Task {
                    await AppSessionState.shared.respondToApproval(
                        approvalId: request.id,
                        decision: decision
                    )
                    await viewModel.loadChat()
                }
            }
        }
    }

    private var emptyChatGreeting: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(Theme.primaryGradient.opacity(0.12))
                    .frame(width: 64, height: 64)

                Image(systemName: "sparkles")
                    .font(.system(size: 26))
                    .foregroundStyle(Theme.primaryGradient)
            }

            VStack(spacing: 4) {
                Text("How can I help you today?")
                    .font(.headline)
                Text("Send a prompt to start coding, inspecting files, or running tests.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            VStack(spacing: 8) {
                greetingChip("Explain the architecture of this project")
                greetingChip("Find and fix any syntax or compile errors")
                greetingChip("Draft unit tests for critical paths")
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
    }

    private func greetingChip(_ text: String) -> some View {
        Button {
            Haptics.shared.impact(.light)
            inputText = text
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "lightbulb.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(.orange)
                Text(text)
                    .font(.caption.weight(.medium))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Theme.subtleBorder, lineWidth: 1))
            .foregroundStyle(.primary)
        }
    }

    private func permissionIconName(_ mode: PermissionMode) -> String {
        switch mode {
        case .onRequest:
            return "shield.checkered"
        case .readOnly:
            return "eye"
        case .auto:
            return "flame.fill"
        }
    }

    private func permissionColor(_ mode: PermissionMode) -> Color {
        switch mode {
        case .onRequest:
            return .green
        case .readOnly:
            return .blue
        case .auto:
            return .orange
        }
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}
