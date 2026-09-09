import SwiftUI

// MARK: - Tool Call Block View (Minimal Single-Line Collapsed)

struct ToolCallBlockView: View {
    let block: MessageBlock
    var isStreaming: Bool = false

    @State private var isExpanded: Bool
    @State private var isArgsCopied: Bool = false
    @State private var isOutputCopied: Bool = false

    init(block: MessageBlock, isStreaming: Bool = false) {
        self.block = block
        self.isStreaming = isStreaming
        self._isExpanded = State(initialValue: false)
    }

    private var toolName: String {
        block.name ?? block.command ?? "tool"
    }

    private func getShortPath(_ path: String) -> String {
        let normalized = path.replacingOccurrences(of: "\\", with: "/")
        let components = normalized.split(separator: "/").map(String.init)
        if components.count <= 2 { return components.joined(separator: "/") }
        return components.suffix(2).joined(separator: "/")
    }

    private func truncate(_ str: String, limit: Int = 40) -> String {
        str.count > limit ? String(str.prefix(limit)) + "..." : str
    }

    private var actionDetails: (verb: String, target: String?, isMono: Bool) {
        let isRunning = block.status == .running
        let lower = toolName.lowercased()
        let args = block.args?.value as? [String: Any]

        // 1. Command Execution
        if block.type == .commandExec || lower.contains("command") || lower.contains("bash") || lower.contains("terminal") || lower.contains("exec") {
            let cmd = block.command ?? (args?["CommandLine"] as? String) ?? (args?["command"] as? String)
            let displayCmd = cmd.map { "$ \(truncate($0, limit: 45))" }
            return (isRunning ? "Running" : "Ran", displayCmd, true)
        }

        // 2. Reading
        if lower.contains("read") || lower.contains("view") || lower == "cat" {
            let rawPath = (args?["AbsolutePath"] as? String) ?? (args?["path"] as? String) ?? (args?["TargetFile"] as? String) ?? block.path
            let target = rawPath.map { getShortPath($0) } ?? toolName
            return (isRunning ? "Reading" : "Read", target, true)
        }

        // 3. Editing / Writing
        if lower.contains("write") || lower.contains("edit") || lower.contains("replace") || lower.contains("patch") {
            let rawPath = (args?["TargetFile"] as? String) ?? (args?["AbsolutePath"] as? String) ?? (args?["path"] as? String) ?? block.path
            let target = rawPath.map { getShortPath($0) } ?? toolName
            return (isRunning ? "Editing" : "Edited", target, true)
        }

        // 4. CodeGraph Exploration
        if lower.contains("codegraph_explore") || lower.contains("explore") {
            let q = (args?["query"] as? String) ?? (args?["Query"] as? String)
            return (isRunning ? "Exploring" : "Explored", q.map { "\"\(truncate($0, limit: 35))\"" }, false)
        }

        // 5. Grep / Find / Search
        if lower.contains("grep") || lower.contains("find") || lower.contains("search") {
            let q = (args?["Query"] as? String) ?? (args?["query"] as? String) ?? (args?["Pattern"] as? String)
            return (isRunning ? "Searching" : "Searched", q.map { "for \"\(truncate($0, limit: 35))\"" }, false)
        }

        // 6. Web / Browse
        if let u = (args?["Url"] as? String) ?? (args?["url"] as? String) {
            return (isRunning ? "Fetching" : "Fetched", truncate(u, limit: 35), true)
        }

        // Fallback
        if let q = (args?["query"] as? String) ?? (args?["Query"] as? String) {
            return (isRunning ? "Calling" : "Called", "\(toolName) \"\(truncate(q, limit: 30))\"", false)
        }

        let firstVal = args?.values.compactMap { $0 as? String }.first
        let target = firstVal != nil ? "\(toolName) (\(truncate(firstVal!, limit: 25)))" : toolName
        return (isRunning ? "Calling" : "Called", target, true)
    }

    private var formattedArgsString: String? {
        guard let args = block.args else { return nil }
        if let dict = args.value as? [String: Any],
           let data = try? JSONSerialization.data(withJSONObject: dict, options: [.prettyPrinted, .sortedKeys]),
           let str = String(data: data, encoding: .utf8) {
            return str
        }
        return "\(args.value)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Pure Text Row - Arrow at start, tap toggles expand
            Button {
                Haptics.shared.selection()
                withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.secondary.opacity(0.7))
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                        .frame(width: 10)

                    Text(actionDetails.verb)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(.secondary)

                    if let target = actionDetails.target {
                        Text(target)
                            .font(.system(size: 11.5, design: actionDetails.isMono ? .monospaced : .default))
                            .foregroundStyle(.primary.opacity(0.85))
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }

                    if block.status == .running {
                        Text("...")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(.orange.opacity(0.9))
                    }

                    if block.status == .failed || block.status == .rejected {
                        Text("(failed)")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(.red.opacity(0.85))
                    } else if let code = block.exitCode, code != 0 {
                        Text("EXIT \(code)")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(.red.opacity(0.85))
                    }

                    Spacer(minLength: 4)
                }
                .padding(.vertical, 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // Expanded Detail View
            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    // Command (if commandExec)
                    if let cmd = block.command, !cmd.isEmpty {
                        HStack {
                            Text("$ \(cmd)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(.primary)
                                .textSelection(.enabled)
                            Spacer()
                        }
                        .padding(8)
                        .background(Color(uiColor: .tertiarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    }

                    // Arguments
                    if let argsStr = formattedArgsString, !argsStr.isEmpty, argsStr != "null" && argsStr != "{}" {
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text("ARGUMENTS")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .foregroundStyle(.tertiary)
                                Spacer()
                                Button {
                                    UIPasteboard.general.string = argsStr
                                    Haptics.shared.notification(.success)
                                    withAnimation { isArgsCopied = true }
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                        withAnimation { isArgsCopied = false }
                                    }
                                } label: {
                                    HStack(spacing: 3) {
                                        Image(systemName: isArgsCopied ? "checkmark" : "doc.on.doc")
                                            .font(.system(size: 8))
                                        Text(isArgsCopied ? "Copied" : "Copy")
                                            .font(.system(size: 8, design: .monospaced))
                                    }
                                    .foregroundStyle(isArgsCopied ? .green : .secondary)
                                }
                                .buttonStyle(.plain)
                            }

                            ScrollView(.horizontal, showsIndicators: false) {
                                Text(argsStr)
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundStyle(.primary.opacity(0.85))
                                    .textSelection(.enabled)
                                    .padding(6)
                            }
                            .background(Color(uiColor: .tertiarySystemGroupedBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        }
                    }

                    // Output / Result
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text("RESULT")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundStyle(.tertiary)
                            Spacer()
                            if let output = block.output, !output.isEmpty {
                                Button {
                                    UIPasteboard.general.string = output
                                    Haptics.shared.notification(.success)
                                    withAnimation { isOutputCopied = true }
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                        withAnimation { isOutputCopied = false }
                                    }
                                } label: {
                                    HStack(spacing: 3) {
                                        Image(systemName: isOutputCopied ? "checkmark" : "doc.on.doc")
                                            .font(.system(size: 8))
                                        Text(isOutputCopied ? "Copied" : "Copy")
                                            .font(.system(size: 8, design: .monospaced))
                                    }
                                    .foregroundStyle(isOutputCopied ? .green : .secondary)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        if let output = block.output, !output.isEmpty {
                            ScrollView([.horizontal, .vertical], showsIndicators: true) {
                                Text(output)
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundStyle(Color(red: 0.88, green: 0.90, blue: 0.92))
                                    .textSelection(.enabled)
                                    .padding(8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .frame(maxHeight: 180)
                            .background(Color(red: 0.08, green: 0.09, blue: 0.11))
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        } else if block.status == .running {
                            HStack(spacing: 4) {
                                ProgressView().scaleEffect(0.6)
                                Text("Executing...")
                                    .font(.system(size: 10, design: .monospaced))
                                    .italic()
                                    .foregroundStyle(.secondary)
                            }
                            .padding(6)
                        } else {
                            Text("(No output)")
                                .font(.system(size: 10, design: .monospaced))
                                .italic()
                                .foregroundStyle(.tertiary)
                                .padding(4)
                        }
                    }
                }
                .padding(.leading, 18)
                .padding(.vertical, 4)
                .overlay(
                    Rectangle()
                        .fill(Theme.subtleBorder)
                        .frame(width: 1.5)
                        .padding(.leading, 12),
                    alignment: .leading
                )
            }
        }
    }
}

// MARK: - Tool Call Group View (SwiftUI)

struct ToolCallGroupView: View {
    let blocks: [MessageBlock]
    var isStreaming: Bool = false

    @State private var isGroupExpanded: Bool = false

    private var groupSummary: String {
        var filesRead = 0
        var filesEdited = 0
        var commands = 0
        var searches = 0
        var explores = 0
        var fetches = 0
        var other = 0

        for block in blocks {
            if block.type == .commandExec {
                commands += 1
                continue
            }
            let lower = (block.name ?? block.command ?? "").lowercased()
            if lower.contains("command") || lower.contains("bash") || lower.contains("exec") || lower.contains("terminal") || lower.contains("shell") {
                commands += 1
            } else if lower.contains("read") || lower.contains("view") || lower == "cat" {
                filesRead += 1
            } else if lower.contains("write") || lower.contains("edit") || lower.contains("replace") || lower.contains("patch") {
                filesEdited += 1
            } else if lower.contains("codegraph_explore") || lower.contains("explore") {
                explores += 1
            } else if lower.contains("grep") || lower.contains("find") || lower.contains("search") {
                searches += 1
            } else if lower.contains("web") || lower.contains("browse") || lower.contains("fetch") || lower.contains("url") {
                fetches += 1
            } else {
                other += 1
            }
        }

        var parts: [String] = []
        if explores > 0 && filesRead == 0 {
            parts.append(explores == 1 ? "explored 1 file" : "explored \(explores) files")
        } else if filesRead > 0 && explores == 0 {
            parts.append(filesRead == 1 ? "read 1 file" : "read \(filesRead) files")
        } else if filesRead > 0 && explores > 0 {
            parts.append("explored \(filesRead + explores) files")
        }

        if searches > 0 {
            parts.append(searches == 1 ? "1 search" : "\(searches) searches")
        }

        if commands > 0 {
            parts.append(commands == 1 ? "ran 1 command" : "ran \(commands) commands")
        }

        if filesEdited > 0 {
            parts.append(filesEdited == 1 ? "edited 1 file" : "edited \(filesEdited) files")
        }

        if fetches > 0 {
            parts.append(fetches == 1 ? "1 fetch" : "\(fetches) fetches")
        }

        if other > 0 && parts.isEmpty {
            parts.append(other == 1 ? "1 action" : "\(other) actions")
        }

        guard !parts.isEmpty else { return "" }
        let joined = parts.joined(separator: ", ")
        return joined.prefix(1).uppercased() + joined.dropFirst()
    }

    var body: some View {
        if blocks.isEmpty {
            EmptyView()
        } else if blocks.count == 1 {
            ToolCallBlockView(block: blocks[0], isStreaming: isStreaming)
        } else {
            VStack(alignment: .leading, spacing: 2) {
                // Group Header button with chevron arrow at start (tap toggles expand/collapse)
                Button {
                    Haptics.shared.selection()
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                        isGroupExpanded.toggle()
                    }
                } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(.secondary.opacity(0.7))
                            .rotationEffect(.degrees(isGroupExpanded ? 90 : 0))
                            .frame(width: 10)

                        Text(groupSummary)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(.secondary)

                        Spacer(minLength: 4)
                    }
                    .padding(.vertical, 2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if isGroupExpanded {
                    // List of tool calls with subtle vertical timeline border
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                            ToolCallBlockView(block: block, isStreaming: isStreaming)
                        }
                    }
                    .padding(.leading, 8)
                    .overlay(
                        Rectangle()
                            .fill(Theme.subtleBorder)
                            .frame(width: 1.5)
                            .padding(.leading, 2),
                        alignment: .leading
                    )
                }
            }
        }
    }
}
