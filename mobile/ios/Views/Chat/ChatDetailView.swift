import SwiftUI

struct ChatDetailView: View {
    @State private var viewModel: ChatViewModel
    @State private var inputText: String = ""
    @State private var activeApproval: ApprovalRequest?

    init(chatId: String) {
        _viewModel = State(initialValue: ChatViewModel(chatId: chatId))
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color(uiColor: .systemGroupedBackground)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Messages Feed
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            if viewModel.messages.isEmpty {
                                emptyChatGreeting
                                    .padding(.top, 40)
                            } else {
                                ForEach(viewModel.messages) { message in
                                    MessageBubbleView(message: message)
                                }
                            }
                            Color.clear
                                .frame(height: 1)
                                .id("bottom_anchor")
                        }
                        .padding(.top, viewModel.pendingApprovals.first != nil ? 60 : 12)
                        .padding(.bottom, 8)
                    }
                    .onChange(of: viewModel.messages.count) { _, _ in
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo("bottom_anchor", anchor: .bottom)
                        }
                    }
                    .onChange(of: viewModel.scrollTrigger) { _, _ in
                        proxy.scrollTo("bottom_anchor", anchor: .bottom)
                    }
                }

                // Bottom Composer
                ComposerView(
                    text: $inputText,
                    selectedModel: $viewModel.selectedModel,
                    effort: $viewModel.selectedEffort,
                    models: AppSessionState.shared.models,
                    isRunning: viewModel.isRunning,
                    isSending: viewModel.isSending,
                    onSend: {
                        let text = inputText
                        inputText = ""
                        Task {
                            await viewModel.submitTurn(content: text)
                        }
                    },
                    onInterrupt: {
                        Task {
                            await viewModel.interrupt()
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
            }
        }
        .task {
            AppSessionState.shared.activeChatViewModel = viewModel
            await viewModel.loadChat()
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
}
