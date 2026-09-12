import SwiftUI
import LocalAuthentication

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var session = AppSessionState.shared

    @State private var showConnectionsSheet = false
    @State private var showUnpairConfirmation = false
    @State private var isSavingHostSettings = false

    // Local copy of editable host settings
    @State private var defaultProviderId: String = "codex"
    @State private var defaultModel: String = "gpt-5-codex"
    @State private var defaultEffort: String = "medium"
    @State private var autoApproveReadOnly: Bool = false
    @State private var defaultPermissionMode: PermissionMode = .onRequest

    var body: some View {
        NavigationStack {
            Form {
                // MARK: - Host Connection & Status
                Section("Host Connection") {
                    HStack(spacing: 12) {
                        Image(systemName: "laptopcomputer")
                            .font(.system(size: 20))
                            .foregroundStyle(session.connectionStatus.isConnected ? .green : .orange)
                            .frame(width: 32, height: 32)
                            .background((session.connectionStatus.isConnected ? Color.green : Color.orange).opacity(0.12))
                            .clipShape(Circle())

                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.hostInfo?.hostName ?? session.pairedHostName ?? "Workstation")
                                .font(.subheadline.weight(.semibold))

                            if let ep = session.pairedEndpoint {
                                let info = EndpointInfo(rawUrl: ep)
                                HStack(spacing: 6) {
                                    Text(info.kind.rawValue)
                                        .font(.caption2.bold())
                                        .foregroundStyle(info.kind.color)
                                    Text(ep.replacingOccurrences(of: "ws://", with: "").replacingOccurrences(of: "/rpc", with: ""))
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .padding(.vertical, 2)

                    Button {
                        if session.hapticsEnabled { Haptics.shared.selection() }
                        showConnectionsSheet = true
                    } label: {
                        HStack {
                            Label("Connection Diagnostics & Endpoints", systemImage: "network")
                                .font(.subheadline)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .foregroundStyle(.primary)
                }

                // MARK: - AI & Model Defaults (Host SSOT)
                Section {
                    Picker("Default Provider", selection: $defaultProviderId) {
                        ForEach(session.providers, id: \.id) { p in
                            Text(p.name).tag(p.id)
                        }
                        if !session.providers.contains(where: { $0.id == defaultProviderId }) && !defaultProviderId.isEmpty {
                            Text(defaultProviderId == "agy" ? "Antigravity CLI" : defaultProviderId.capitalized).tag(defaultProviderId)
                        }
                    }
                    .onChange(of: defaultProviderId) { _, newProvider in
                        Task {
                            await session.loadModels(for: newProvider)
                            if let def = session.models.first(where: { $0.isDefault }) {
                                defaultModel = def.model
                            } else if let first = session.models.first {
                                defaultModel = first.model
                            }
                            saveHostSettings()
                        }
                    }

                    Picker("Default Model", selection: $defaultModel) {
                        ForEach(session.models, id: \.id) { m in
                            Text(m.displayName).tag(m.model)
                        }
                        if !session.models.contains(where: { $0.model == defaultModel }) && !defaultModel.isEmpty {
                            Text(defaultModel).tag(defaultModel)
                        }
                    }
                    .onChange(of: defaultModel) { _, _ in
                        saveHostSettings()
                    }

                    Picker("Default Reasoning Effort", selection: $defaultEffort) {
                        Text("Low").tag("low")
                        Text("Medium").tag("medium")
                        Text("High").tag("high")
                        if !["low", "medium", "high"].contains(defaultEffort) && !defaultEffort.isEmpty {
                            Text(defaultEffort.capitalized).tag(defaultEffort)
                        }
                    }
                    .onChange(of: defaultEffort) { _, _ in
                        saveHostSettings()
                    }
                } header: {
                    Text("AI & Provider Defaults")
                } footer: {
                    Text("Configured on your host workstation and shared across all connected clients.")
                }

                // MARK: - Security & Approvals
                Section {
                    Toggle(isOn: $autoApproveReadOnly) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Auto-Approve Read-Only")
                                .font(.subheadline)
                            Text("Safe inspection commands (git status, diff, ls, cat) run automatically without prompt.")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .onChange(of: autoApproveReadOnly) { _, _ in
                        saveHostSettings()
                    }

                    Picker("Default Permission Mode", selection: $defaultPermissionMode) {
                        Text("On Request").tag(PermissionMode.onRequest)
                        Text("Full Auto").tag(PermissionMode.auto)
                        Text("Read Only").tag(PermissionMode.readOnly)
                    }
                    .onChange(of: defaultPermissionMode) { _, _ in
                        saveHostSettings()
                    }

                    Toggle(isOn: Binding(
                        get: { session.requireFaceIdOnApproval },
                        set: { val in
                            if session.hapticsEnabled { Haptics.shared.selection() }
                            session.requireFaceIdOnApproval = val
                        }
                    )) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Biometrics on Approval")
                                .font(.subheadline)
                            Text("Require Face ID / Touch ID before confirming sensitive shell commands.")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("Security & Guardrails")
                } footer: {
                    Text("Destructive commands (sudo, rm -rf, hard reset) will always require explicit confirmation.")
                }

                // MARK: - Client Preferences (iOS)
                Section {
                    Picker("Appearance", selection: Binding(
                        get: { session.appTheme },
                        set: { val in
                            if session.hapticsEnabled { Haptics.shared.selection() }
                            session.appTheme = val
                        }
                    )) {
                        Text("System").tag("system")
                        Text("Dark").tag("dark")
                        Text("Light").tag("light")
                    }

                    Toggle("Haptic Feedback", isOn: Binding(
                        get: { session.hapticsEnabled },
                        set: { val in
                            session.hapticsEnabled = val
                            if val { Haptics.shared.impact(.medium) }
                        }
                    ))

                    Toggle("Code Word Wrap", isOn: Binding(
                        get: { session.codeWordWrap },
                        set: { val in
                            if session.hapticsEnabled { Haptics.shared.selection() }
                            session.codeWordWrap = val
                        }
                    ))

                    Toggle("Require Face ID on Open", isOn: Binding(
                        get: { session.requireFaceIdOnOpen },
                        set: { val in
                            if val {
                                Task {
                                    let success = await testBiometrics()
                                    if success {
                                        session.requireFaceIdOnOpen = true
                                    }
                                }
                            } else {
                                session.requireFaceIdOnOpen = false
                            }
                        }
                    ))
                } header: {
                    Text("iPhone Preferences")
                }

                // MARK: - Notifications & Live Activities
                Section {
                    Toggle("Enable Notifications", isOn: Binding(
                        get: { session.notificationsEnabled },
                        set: { val in
                            if val {
                                Task {
                                    _ = await NotificationManager.shared.requestAuthorization()
                                    session.notificationsEnabled = true
                                }
                            } else {
                                session.notificationsEnabled = false
                            }
                        }
                    ))

                    if session.notificationsEnabled {
                        Toggle("Action Review Alerts", isOn: $session.notifyOnApproval)
                        Toggle("Task Completion Alerts", isOn: $session.notifyOnTurnCompleted)
                    }

                    Toggle("Live Activities (Dynamic Island)", isOn: $session.liveActivitiesEnabled)
                } header: {
                    Text("Notifications & Live Activities")
                } footer: {
                    Text("Real-time progress streaming on Dynamic Island and Lock Screen. Alerts notify you when shell execution or file patches require your confirmation.")
                }

                // MARK: - System & About
                Section("About") {
                    HStack {
                        Text("Canywhere iOS Client")
                        Spacer()
                        Text("v0.1.0").foregroundStyle(.secondary)
                    }

                    if let os = session.hostInfo?.os {
                        HStack {
                            Text("Host Platform")
                            Spacer()
                            Text(os).foregroundStyle(.secondary)
                        }
                    }

                    if let port = session.hostSettings?.serverPort {
                        HStack {
                            Text("Daemon Port")
                            Spacer()
                            Text("\(port)").foregroundStyle(.secondary).monospaced()
                        }
                    }
                }

                // MARK: - Danger Zone
                Section {
                    Button(role: .destructive) {
                        if session.hapticsEnabled { Haptics.shared.notification(.warning) }
                        showUnpairConfirmation = true
                    } label: {
                        HStack {
                            Spacer()
                            Label("Unpair from This Host", systemImage: "link.badge.plus")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        if session.hapticsEnabled { Haptics.shared.selection() }
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                syncFromSessionSettings()
            }
            .sheet(isPresented: $showConnectionsSheet) {
                HostConnectionsSheet()
            }
            .confirmationDialog(
                "Unpair from Host?",
                isPresented: $showUnpairConfirmation,
                titleVisibility: .visible
            ) {
                Button("Unpair", role: .destructive) {
                    session.unpair()
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your pairing key will be deleted. You will need to scan a new QR code from your desktop to reconnect.")
            }
        }
    }

    private func syncFromSessionSettings() {
        if let s = session.hostSettings {
            defaultProviderId = s.defaultProviderID
            defaultModel = s.defaultModel
            defaultEffort = s.defaultReasoningEffort ?? "medium"
            autoApproveReadOnly = s.autoApproveReadOnly
            defaultPermissionMode = s.defaultPermissionMode

            Task {
                await session.loadModels(for: s.defaultProviderID)
            }
        }
    }

    private func saveHostSettings() {
        Task {
            isSavingHostSettings = true
            do {
                try await session.updateHostSettings(
                    defaultProviderId: defaultProviderId,
                    defaultModel: defaultModel,
                    defaultReasoningEffort: defaultEffort,
                    autoApproveReadOnly: autoApproveReadOnly,
                    defaultPermissionMode: defaultPermissionMode
                )
                if session.hapticsEnabled { Haptics.shared.notification(.success) }
            } catch {
                print("⚠️ [SettingsView] Failed to save settings: \(error)")
                if session.hapticsEnabled { Haptics.shared.notification(.error) }
            }
            isSavingHostSettings = false
        }
    }

    private func testBiometrics() async -> Bool {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return false
        }
        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Confirm Face ID / Touch ID to enable protection"
            )
        } catch {
            return false
        }
    }
}
