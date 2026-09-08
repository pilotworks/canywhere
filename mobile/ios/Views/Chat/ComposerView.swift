import SwiftUI

struct ComposerView: View {
    @Binding var text: String
    @Binding var selectedModel: String?
    @Binding var effort: String
    let models: [ModelInfo]
    let isRunning: Bool
    let isSending: Bool
    let onSend: () -> Void
    let onInterrupt: () -> Void

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
        models: [ModelInfo] = [],
        isRunning: Bool,
        isSending: Bool,
        onSend: @escaping () -> Void,
        onInterrupt: @escaping () -> Void
    ) {
        self._text = text
        self._selectedModel = selectedModel
        self._effort = effort
        self.models = models
        self.isRunning = isRunning
        self.isSending = isSending
        self.onSend = onSend
        self.onInterrupt = onInterrupt
    }

    var body: some View {
        VStack(spacing: 8) {
            // Controls bar: Model & Reasoning effort selectors
            HStack(spacing: 8) {
                // Model Selector Menu
                Menu {
                    ForEach(availableModels) { m in
                        Button {
                            Haptics.shared.selection()
                            selectedModel = m.model
                            let newEffort = m.defaultReasoningEffort ?? effort
                            if let defEffort = m.defaultReasoningEffort {
                                effort = defEffort
                            }
                            AppSessionState.shared.updateSelectedModel(m.model, effort: newEffort)
                        } label: {
                            HStack {
                                Text(m.displayName)
                                if (selectedModel == m.model) || (selectedModel == nil && m.isDefault) {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "cpu")
                            .font(.system(size: 11))
                        Text(currentModelInfo?.displayName ?? selectedModel ?? "Model")
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 8, weight: .bold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Theme.subtleBorder, lineWidth: 1))
                }
                .foregroundStyle(.primary)

                // Reasoning effort selector (only if model supports reasoning efforts)
                if let efforts = currentModelInfo?.supportedReasoningEfforts, !efforts.isEmpty {
                    Menu {
                        ForEach(efforts, id: \.self) { eff in
                            Button {
                                Haptics.shared.selection()
                                effort = eff
                                let curModel = selectedModel ?? currentModelInfo?.model ?? "gpt-5-codex"
                                AppSessionState.shared.updateSelectedModel(curModel, effort: eff)
                            } label: {
                                HStack {
                                    Text(eff.capitalized + " Effort")
                                    if effort == eff {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "slider.horizontal.3")
                                .font(.system(size: 11))
                            Text(effort.capitalized)
                                .font(.caption.weight(.semibold))
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.system(size: 8, weight: .bold))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Theme.subtleBorder, lineWidth: 1))
                    }
                    .foregroundStyle(.primary)
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
                TextField("Ask Codex anything...", text: $text, axis: .vertical)
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
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.system(size: 16, weight: .bold))
                        }
                    }
                    .frame(width: 38, height: 38)
                    .background(
                        text.trimmingCharacters(in: .whitespaces).isEmpty
                        ? LinearGradient(colors: [Color.gray.opacity(0.25), Color.gray.opacity(0.35)], startPoint: .top, endPoint: .bottom)
                        : Theme.primaryGradient
                    )
                    .foregroundStyle(.white)
                    .clipShape(Circle())
                    .shadow(
                        color: text.trimmingCharacters(in: .whitespaces).isEmpty ? .clear : Color.blue.opacity(0.35),
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
    }
}
