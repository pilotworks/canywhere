import SwiftUI

struct ComposerView: View {
    @Binding var text: String
    @Binding var selectedModel: String?
    @Binding var effort: String
    @Binding var permissionMode: PermissionMode
    let models: [ModelInfo]
    let isRunning: Bool
    let isSending: Bool
    var hasWorkspace: Bool = false
    let onSend: () -> Void
    let onInterrupt: () -> Void
    let onPermissionChange: ((PermissionMode) -> Void)?
    var onSearchFiles: ((String) async -> [FuzzyFileMatchItem])? = nil
    var onReview: (() -> Void)? = nil
    var onCompact: (() -> Void)? = nil
    var onReset: (() -> Void)? = nil
    var onScratch: (() -> Void)? = nil

    @State private var showFileMenu = false
    @State private var fileQuery = ""
    @State private var fileResults: [FuzzyFileMatchItem] = []
    @State private var isSearchingFiles = false
    @State private var searchTask: Task<Void, Never>? = nil
    @State private var atTokenRange: NSRange? = nil

    @State private var showSlashMenu = false
    @State private var slashFilter = ""

    static let fallbackModels: [ModelInfo] = [
        ModelInfo(
            id: "gpt-5-codex",
            model: "gpt-5-codex",
            displayName: "GPT-5 Codex",
            description: "Frontier autonomous coding",
            isDefault: true,
            supportedReasoningEfforts: ["low", "medium", "high"],
            defaultReasoningEffort: "medium"
        ),
        ModelInfo(
            id: "o3-mini",
            model: "o3-mini",
            displayName: "o3-mini",
            description: "Fast reasoning",
            isDefault: false,
            supportedReasoningEfforts: ["low", "medium", "high"],
            defaultReasoningEffort: "medium"
        ),
        ModelInfo(
            id: "gpt-4o",
            model: "gpt-4o",
            displayName: "GPT-4o",
            description: "General purpose",
            isDefault: false,
            supportedReasoningEfforts: [],
            defaultReasoningEffort: nil
        )
    ]

    private var availableModels: [ModelInfo] {
        models.isEmpty ? Self.fallbackModels : models
    }

    private var currentModelInfo: ModelInfo? {
        availableModels.first(where: { $0.model == selectedModel })
            ?? availableModels.first(where: { $0.isDefault })
            ?? availableModels.first
    }

    init(
        text: Binding<String>,
        selectedModel: Binding<String?>,
        effort: Binding<String>,
        permissionMode: Binding<PermissionMode>,
        models: [ModelInfo] = [],
        isRunning: Bool,
        isSending: Bool,
        hasWorkspace: Bool = false,
        onSend: @escaping () -> Void,
        onInterrupt: @escaping () -> Void,
        onPermissionChange: ((PermissionMode) -> Void)? = nil,
        onSearchFiles: ((String) async -> [FuzzyFileMatchItem])? = nil,
        onReview: (() -> Void)? = nil,
        onCompact: (() -> Void)? = nil,
        onReset: (() -> Void)? = nil,
        onScratch: (() -> Void)? = nil
    ) {
        self._text = text
        self._selectedModel = selectedModel
        self._effort = effort
        self._permissionMode = permissionMode
        self.models = models
        self.isRunning = isRunning
        self.isSending = isSending
        self.hasWorkspace = hasWorkspace
        self.onSend = onSend
        self.onInterrupt = onInterrupt
        self.onPermissionChange = onPermissionChange
        self.onSearchFiles = onSearchFiles
        self.onReview = onReview
        self.onCompact = onCompact
        self.onReset = onReset
        self.onScratch = onScratch
    }

    var body: some View {
        VStack(spacing: 8) {
            // File search popover (@)
            if showFileMenu {
                FileSearchPopupView(
                    files: fileResults,
                    query: fileQuery,
                    isLoading: isSearchingFiles,
                    onSelect: handleSelectFile,
                    onDismiss: {
                        withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                            showFileMenu = false
                        }
                    }
                )
            }

            // Slash command popover (/)
            if showSlashMenu {
                SlashCommandPopupView(
                    commands: SlashCommandItem.availableCommands,
                    filter: slashFilter,
                    onSelect: handleSelectSlash,
                    onDismiss: {
                        withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                            showSlashMenu = false
                        }
                    }
                )
            }

            // Controls bar: Model & Reasoning effort selectors
            HStack(spacing: 8) {
                // Unified Model & Reasoning Effort Combo
                ModelEffortComboView(
                    models: availableModels,
                    selectedModel: $selectedModel,
                    effort: $effort
                )

                // Permission Mode Selector Menu
                Menu {
                    Button {
                        Haptics.shared.selection()
                        permissionMode = .onRequest
                        onPermissionChange?(.onRequest)
                    } label: {
                        HStack {
                            Label("Ask for Approval", systemImage: "shield.checkered")
                            if permissionMode == .onRequest {
                                Image(systemName: "checkmark")
                            }
                        }
                    }

                    Button {
                        Haptics.shared.selection()
                        permissionMode = .readOnly
                        onPermissionChange?(.readOnly)
                    } label: {
                        HStack {
                            Label("Plan Only (Read-Only)", systemImage: "eye")
                            if permissionMode == .readOnly {
                                Image(systemName: "checkmark")
                            }
                        }
                    }

                    Button {
                        Haptics.shared.selection()
                        permissionMode = .auto
                        onPermissionChange?(.auto)
                    } label: {
                        HStack {
                            Label("Full Auto (YOLO)", systemImage: "flame.fill")
                            if permissionMode == .auto {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: permissionIconName(permissionMode))
                            .font(.system(size: 11))
                            .foregroundStyle(permissionColor(permissionMode))
                        Text(permissionLabel(permissionMode))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(permissionColor(permissionMode))
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(permissionColor(permissionMode).opacity(0.35), lineWidth: 1))
                }

                Spacer()

                if isRunning {
                    Button {
                        Haptics.shared.notification(.warning)
                        onInterrupt()
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "stop.fill")
                                .font(.system(size: 9))
                            Text("Stop")
                                .font(.caption.bold())
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.red)
                        .clipShape(Capsule())
                        .shadow(color: Color.red.opacity(0.35), radius: 6, y: 2)
                    }
                }
            }
            .padding(.horizontal, 14)

            // Input bar
            HStack(alignment: .bottom, spacing: 10) {
                TextField(isRunning ? "Add to queue..." : "Ask Codex anything... (@ file, / command)", text: $text, axis: .vertical)
                    .lineLimit(1...6)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .stroke(Theme.subtleBorder, lineWidth: 1)
                    )

                Button {
                    Haptics.shared.impact(.medium)
                    onSend()
                } label: {
                    ZStack {
                        if isSending {
                            ProgressView()
                                .tint(.white)
                        } else if isRunning {
                            Image(systemName: "clock.arrow.circlepath")
                                .font(.system(size: 15, weight: .bold))
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.system(size: 16, weight: .bold))
                        }
                    }
                    .frame(width: 38, height: 38)
                    .background(
                        text.trimmingCharacters(in: .whitespaces).isEmpty
                        ? LinearGradient(colors: [Color.gray.opacity(0.25), Color.gray.opacity(0.35)], startPoint: .top, endPoint: .bottom)
                        : (isRunning ? Theme.purpleGradient : Theme.primaryGradient)
                    )
                    .foregroundStyle(.white)
                    .clipShape(Circle())
                    .shadow(
                        color: text.trimmingCharacters(in: .whitespaces).isEmpty ? .clear : (isRunning ? Color.purple.opacity(0.35) : Color.blue.opacity(0.35)),
                        radius: 8,
                        y: 3
                    )
                }
                .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty || isSending)
                .scaleEffect(text.trimmingCharacters(in: .whitespaces).isEmpty ? 0.95 : 1.0)
                .animation(.spring(response: 0.25, dampingFraction: 0.7), value: text.isEmpty)
            }
            .padding(.horizontal, 14)
        }
        .padding(.top, 8)
        .padding(.bottom, 12)
        .background(.ultraThinMaterial)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundStyle(Theme.subtleBorder),
            alignment: .top
        )
        .onChange(of: text) { _, newText in
            handleTextChange(newText)
        }
    }

    private func handleTextChange(_ val: String) {
        // 1. Check for / slash command on first line
        let lines = val.components(separatedBy: "\n")
        let firstLine = lines.first ?? ""
        if firstLine.hasPrefix("/") && !firstLine.contains(" ") {
            let filter = String(firstLine.dropFirst()).lowercased()
            slashFilter = filter
            withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                showSlashMenu = true
                showFileMenu = false
            }
            return
        } else {
            if showSlashMenu {
                withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
                    showSlashMenu = false
                }
            }
        }

        // 2. Check for @ file mention
        if hasWorkspace {
            let pattern = #"(?:^|\s)@([^\s]*)$"#
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: val, range: NSRange(location: 0, length: val.utf16.count)) {
                let queryRange = match.range(at: 1)
                if let swiftRange = Range(queryRange, in: val) {
                    let query = String(val[swiftRange])
                    fileQuery = query
                    atTokenRange = match.range
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                        showFileMenu = true
                    }

                    // Debounced search
                    searchTask?.cancel()
                    searchTask = Task {
                        try? await Task.sleep(nanoseconds: 120_000_000)
                        if Task.isCancelled { return }
                        if let searcher = onSearchFiles {
                            await MainActor.run { isSearchingFiles = true }
                            let results = await searcher(query)
                            if !Task.isCancelled {
                                await MainActor.run {
                                    fileResults = results
                                    isSearchingFiles = false
                                }
                            }
                        }
                    }
                    return
                }
            }
        }

        if showFileMenu {
            withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
                showFileMenu = false
            }
        }
    }

    private func handleSelectFile(_ file: FuzzyFileMatchItem) {
        Haptics.shared.selection()
        let path = file.path
        let formatted = path.contains(" ") ? "\"\(path)\"" : path

        if let range = atTokenRange,
           let swiftRange = Range(range, in: text) {
            let matchedStr = String(text[swiftRange])
            let prefix = matchedStr.hasPrefix(" ") ? " " : ""
            text.replaceSubrange(swiftRange, with: "\(prefix)@\(formatted) ")
        } else {
            text += "@\(formatted) "
        }

        withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
            showFileMenu = false
            atTokenRange = nil
            fileResults = []
        }
    }

    private func handleSelectSlash(_ cmd: SlashCommandItem) {
        Haptics.shared.selection()
        withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
            showSlashMenu = false
        }

        switch cmd.cmd {
        case "/review":
            text = ""
            onReview?()
        case "/compact":
            text = ""
            onCompact?()
        case "/reset":
            text = ""
            onReset?()
        case "/scratch":
            text = ""
            onScratch?()
        default:
            text = "\(cmd.cmd) "
        }
    }

    private func permissionLabel(_ mode: PermissionMode) -> String {
        switch mode {
        case .onRequest:
            return "Safe"
        case .readOnly:
            return "Plan Only"
        case .auto:
            return "Full Auto"
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
}

// MARK: - Model & Effort Combo View (iOS)

struct ModelEffortComboView: View {
    let models: [ModelInfo]
    @Binding var selectedModel: String?
    @Binding var effort: String

    @State private var isPresented = false

    private var activeModel: ModelInfo? {
        models.first(where: { $0.model == selectedModel })
            ?? models.first(where: { $0.isDefault })
            ?? models.first
    }

    private var supportedEfforts: [String] {
        activeModel?.supportedReasoningEfforts ?? []
    }

    private var currentEffort: String {
        if !effort.isEmpty { return effort }
        return activeModel?.defaultReasoningEffort ?? supportedEfforts.first ?? ""
    }

    private var formattedEffort: String {
        formatEffortLabel(currentEffort)
    }

    private var steps: [String] {
        supportedEfforts.isEmpty ? ["none"] : supportedEfforts
    }

    private var currentIndex: Int {
        let idx = steps.firstIndex(of: currentEffort) ?? 0
        return max(0, min(idx, steps.count - 1))
    }

    var body: some View {
        Button {
            Haptics.shared.selection()
            isPresented = true
        } label: {
            HStack(spacing: 4) {
                Image(systemName: modelIcon(for: activeModel?.model ?? selectedModel ?? ""))
                    .font(.system(size: 11))
                    .foregroundStyle(Color.accentColor)

                Text(formattedEffort)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.primary)

                Text("·")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Text(activeModel?.displayName ?? selectedModel ?? "5.6 Luna")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.primary.opacity(0.85))
                    .lineLimit(1)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.accentColor.opacity(0.35), lineWidth: 1))
        }
        .sheet(isPresented: $isPresented) {
            NavigationStack {
                List {
                    // MARK: Model Selection Section
                    Section {
                        NavigationLink {
                            ModelSelectionListView(
                                models: models,
                                selectedModel: $selectedModel,
                                effort: $effort,
                                onDismiss: { isPresented = false }
                            )
                        } label: {
                            HStack {
                                Text(activeModel?.displayName ?? selectedModel ?? "5.6 Luna")
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)

                                Spacer()
                            }
                            .frame(height: 32)
                        }
                    } header: {
                        Text("Model")
                    }

                    // MARK: Reasoning Effort Section
                    if !supportedEfforts.isEmpty {
                        Section {
                            VStack(alignment: .leading, spacing: 14) {
                                HStack {
                                    Text("Effort Level")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)

                                    Spacer()

                                    Text(formattedEffort)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.primary)

                                    Button {
                                        Haptics.shared.selection()
                                        let defEffort = activeModel?.defaultReasoningEffort ?? steps[steps.count / 2]
                                        effort = defEffort
                                        let curModel = selectedModel ?? activeModel?.model ?? "gpt-5-codex"
                                        AppSessionState.shared.updateSelectedModel(curModel, effort: defEffort)
                                    } label: {
                                        Image(systemName: "arrow.counterclockwise")
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundStyle(.secondary)
                                            .padding(4)
                                    }
                                    .buttonStyle(.plain)
                                }

                                SteppedEffortSlider(
                                    steps: steps,
                                    currentIndex: currentIndex,
                                    onSelectIndex: { nextIdx in
                                        guard nextIdx >= 0 && nextIdx < steps.count else { return }
                                        let nextEffort = steps[nextIdx]
                                        effort = nextEffort
                                        let curModel = selectedModel ?? activeModel?.model ?? "gpt-5-codex"
                                        AppSessionState.shared.updateSelectedModel(curModel, effort: nextEffort)
                                    }
                                )
                                .frame(height: 24)
                                .padding(.vertical, 2)
                            }
                            .padding(.vertical, 4)
                        } header: {
                            Text("Reasoning Effort")
                        } footer: {
                            Text("Controls how much compute and reasoning Codex allocates before responding.")
                                .font(.caption2)
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .navigationTitle("Model & Reasoning")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") {
                            isPresented = false
                        }
                        .font(.body.weight(.semibold))
                    }
                }
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
    }

    private func formatEffortLabel(_ str: String) -> String {
        if str.isEmpty || str == "none" { return "None" }
        if str.lowercased() == "extra_high" { return "Extra High" }
        return str.prefix(1).uppercased() + str.dropFirst().lowercased()
    }

    private func modelIcon(for modelId: String) -> String {
        let lower = modelId.lowercased()
        if lower.contains("codex") {
            return "chevron.left.forwardslash.chevron.right"
        } else if lower.contains("mini") || lower.contains("sol") {
            return "bolt.fill"
        } else if lower.contains("astra") || lower.contains("plus") || lower.contains("pro") {
            return "sparkles"
        } else {
            return "cpu"
        }
    }
}

// MARK: - Native iOS Model Selection List View

private struct ModelSelectionListView: View {
    let models: [ModelInfo]
    @Binding var selectedModel: String?
    @Binding var effort: String
    let onDismiss: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            Section {
                ForEach(models) { m in
                    let isSelected = (selectedModel == m.model) || (selectedModel == nil && m.isDefault)
                    Button {
                        Haptics.shared.selection()
                        selectedModel = m.model
                        let newEffort = m.defaultReasoningEffort ?? effort
                        if let defEffort = m.defaultReasoningEffort {
                            effort = defEffort
                        }
                        AppSessionState.shared.updateSelectedModel(m.model, effort: newEffort)
                        dismiss()
                    } label: {
                        HStack(spacing: 8) {
                            Text(m.displayName)
                                .font(.body.weight(isSelected ? .semibold : .regular))
                                .foregroundStyle(Color.primary)
                                .lineLimit(1)

                            if m.isDefault {
                                Text("DEFAULT")
                                    .font(.system(size: 9, weight: .bold))
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1.5)
                                    .background(Color.secondary.opacity(0.15))
                                    .clipShape(Capsule())
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            if isSelected {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(Color.accentColor)
                            }
                        }
                        .frame(height: 32)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Select Model")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Stepped Effort Slider (Matching Web 20px Track + 22px Centered Thumb)

private struct SteppedEffortSlider: View {
    let steps: [String]
    let currentIndex: Int
    let onSelectIndex: (Int) -> Void

    private let trackHeight: CGFloat = 20
    private let thumbDiameter: CGFloat = 22

    var body: some View {
        GeometryReader { proxy in
            let totalWidth = proxy.size.width
            let thumbRadius = thumbDiameter / 2
            let totalSteps = steps.count
            let centerY = proxy.size.height / 2

            // Fraction and position calculation matching web's getSliderStepPosition
            let fraction: CGFloat = totalSteps <= 1 ? 0.5 : CGFloat(currentIndex) / CGFloat(totalSteps - 1)
            let usableWidth = max(0, totalWidth - thumbDiameter)
            let thumbCenter = thumbRadius + fraction * usableWidth
            let progressWidth = totalSteps <= 1 ? totalWidth : (currentIndex >= totalSteps - 1 ? totalWidth : thumbCenter)

            ZStack(alignment: .leading) {
                // Background Track (20px pill, centered vertically)
                Capsule()
                    .fill(Color(uiColor: .secondarySystemFill))
                    .frame(height: trackHeight)
                    .overlay(Capsule().stroke(Color.secondary.opacity(0.2), lineWidth: 1))
                    .position(x: totalWidth / 2, y: centerY)

                // Active Progress Fill (within 20px pill)
                Capsule()
                    .fill(Color.primary.opacity(0.18))
                    .frame(width: max(trackHeight, progressWidth), height: trackHeight)
                    .position(x: max(trackHeight, progressWidth) / 2, y: centerY)

                // Tick Dots
                ForEach(0..<totalSteps, id: \.self) { idx in
                    let stepFraction: CGFloat = totalSteps <= 1 ? 0.5 : CGFloat(idx) / CGFloat(totalSteps - 1)
                    let stepCenter = thumbRadius + stepFraction * usableWidth

                    Circle()
                        .fill(idx <= currentIndex ? Color.primary.opacity(0.7) : Color.secondary.opacity(0.35))
                        .frame(width: 4, height: 4)
                        .position(x: stepCenter, y: centerY)
                }

                // Thumb (22px diameter, strictly centered both horizontally & vertically)
                Circle()
                    .fill(Color.white)
                    .frame(width: thumbDiameter, height: thumbDiameter)
                    .shadow(color: Color.black.opacity(0.25), radius: 3, x: 0, y: 1.5)
                    .overlay(Circle().stroke(Color.black.opacity(0.1), lineWidth: 0.5))
                    .position(x: thumbCenter, y: centerY)
            }
            .frame(width: totalWidth, height: proxy.size.height)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let locationX = value.location.x
                        let relativeX = max(0, min(usableWidth, locationX - thumbRadius))
                        let stepFraction = usableWidth > 0 ? (relativeX / usableWidth) : 0
                        let nearestStep = Int(round(stepFraction * CGFloat(totalSteps - 1)))
                        let clamped = max(0, min(totalSteps - 1, nearestStep))
                        if clamped != currentIndex {
                            Haptics.shared.selection()
                            onSelectIndex(clamped)
                        }
                    }
            )
        }
    }
}

// MARK: - File Search Popup View (@)

struct FileSearchPopupView: View {
    let files: [FuzzyFileMatchItem]
    let query: String
    let isLoading: Bool
    let onSelect: (FuzzyFileMatchItem) -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Header bar
            HStack(spacing: 6) {
                Image(systemName: "folder.badge.gearshape")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)

                Text(query.isEmpty ? "Workspace Files" : "Files matching @\(query)")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.secondary)

                Spacer()

                if isLoading {
                    ProgressView()
                        .scaleEffect(0.6)
                }

                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary.opacity(0.6))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(uiColor: .tertiarySystemGroupedBackground))

            Divider()

            // List
            if files.isEmpty {
                VStack(spacing: 4) {
                    if isLoading {
                        Text("Searching workspace files...")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(.secondary)
                    } else {
                        Text(query.isEmpty ? "Type to search files..." : "No files found for \"@\(query)\"")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(files) { file in
                            let isDir = file.matchType == "directory"
                            Button {
                                onSelect(file)
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: isDir ? "folder.fill" : "doc.text")
                                        .font(.system(size: 12))
                                        .foregroundStyle(isDir ? .orange : .indigo)
                                        .frame(width: 16)

                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(file.fileName)
                                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                            .foregroundStyle(.primary)
                                            .lineLimit(1)

                                        if file.path != file.fileName {
                                            Text(file.path)
                                                .font(.system(size: 9.5, design: .monospaced))
                                                .foregroundStyle(.secondary)
                                                .lineLimit(1)
                                                .truncationMode(.middle)
                                        }
                                    }

                                    Spacer()

                                    Text(isDir ? "dir" : "file")
                                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1.5)
                                        .background(Color(uiColor: .tertiarySystemFill))
                                        .clipShape(Capsule())
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)

                            Divider()
                                .padding(.leading, 36)
                        }
                    }
                }
                .frame(maxHeight: 200)
            }
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.subtleBorder, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.15), radius: 10, y: -4)
        .padding(.horizontal, 14)
        .transition(.asymmetric(
            insertion: .opacity.combined(with: .move(edge: .bottom).combined(with: .scale(scale: 0.95))),
            removal: .opacity.combined(with: .scale(scale: 0.95))
        ))
    }
}

// MARK: - Slash Command Popup View (/)

struct SlashCommandPopupView: View {
    let commands: [SlashCommandItem]
    let filter: String
    let onSelect: (SlashCommandItem) -> Void
    let onDismiss: () -> Void

    private var filteredCommands: [SlashCommandItem] {
        if filter.isEmpty { return commands }
        return commands.filter {
            $0.cmd.lowercased().contains(filter) || $0.desc.lowercased().contains(filter)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header bar
            HStack(spacing: 6) {
                Image(systemName: "command")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)

                Text(filter.isEmpty ? "Commands" : "Commands (/\(filter))")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.secondary)

                Spacer()

                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary.opacity(0.6))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(uiColor: .tertiarySystemGroupedBackground))

            Divider()

            if filteredCommands.isEmpty {
                Text("No slash command matching \"/\(filter)\"")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(filteredCommands) { cmd in
                            Button {
                                onSelect(cmd)
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: cmd.iconSystemName)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(Color.accentColor)
                                        .frame(width: 20)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(cmd.cmd)
                                            .font(.system(size: 12.5, weight: .bold, design: .monospaced))
                                            .foregroundStyle(.primary)

                                        Text(cmd.desc)
                                            .font(.system(size: 10.5))
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }

                                    Spacer()

                                    Text(cmd.category)
                                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1.5)
                                        .background(Color(uiColor: .tertiarySystemFill))
                                        .clipShape(Capsule())
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 9)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)

                            Divider()
                                .padding(.leading, 42)
                        }
                    }
                }
                .frame(maxHeight: 220)
            }
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.subtleBorder, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.15), radius: 10, y: -4)
        .padding(.horizontal, 14)
        .transition(.asymmetric(
            insertion: .opacity.combined(with: .move(edge: .bottom).combined(with: .scale(scale: 0.95))),
            removal: .opacity.combined(with: .scale(scale: 0.95))
        ))
    }
}
