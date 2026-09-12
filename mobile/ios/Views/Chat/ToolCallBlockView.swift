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
        let trimmed = path.trimmingCharacters(in: CharacterSet(charactersIn: "\"'\n\r \t"))
        let normalized = trimmed.replacingOccurrences(of: "\\", with: "/")
        let components = normalized.split(separator: "/").map(String.init)
        if components.count <= 2 { return components.joined(separator: "/") }
        return components.suffix(2).joined(separator: "/")
    }

    private func truncate(_ str: String, limit: Int = 40) -> String {
        let trimmed = str.trimmingCharacters(in: CharacterSet(charactersIn: "\"'\n\r \t"))
        return trimmed.count > limit ? String(trimmed.prefix(limit)) + "..." : trimmed
    }

    private var parsedArgs: [String: Any]? {
        guard let raw = block.args?.value else { return nil }
        if let dict = raw as? [String: Any] {
            return dict
        }
        if let str = raw as? String,
           let data = str.data(using: .utf8),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return dict
        }
        return nil
    }

    private func normalizeEscapedNewlines(_ str: String) -> String {
        var s = str.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("\"") && s.hasSuffix("\"") && s.count >= 2 {
            s = String(s.dropFirst().dropLast())
        }
        if !s.contains("\n") && s.contains("\\n") {
            s = s.replacingOccurrences(of: "\\n", with: "\n")
        }
        return s
    }

    private var actionDetails: (verb: String, target: String?, isMono: Bool, icon: String?) {
        let isRunning = block.status == .running
        let lower = toolName.lowercased()
        let args = parsedArgs

        // 1. File Diff / File Editing / Writing
        if block.type == .fileDiff || lower.contains("write") || lower.contains("edit") || lower.contains("replace") || lower.contains("patch") {
            let rawPath = block.path ?? (args?["TargetFile"] as? String) ?? (args?["target_file"] as? String) ?? (args?["targetFile"] as? String) ?? (args?["AbsolutePath"] as? String) ?? (args?["path"] as? String) ?? (args?["filePath"] as? String) ?? (args?["file"] as? String)
            let target = rawPath.map { getShortPath($0) } ?? toolName
            return (isRunning ? "Editing" : "Edited", target, true, "doc.text")
        }

        // 2. Command Execution
        if block.type == .commandExec || lower.contains("command") || lower.contains("bash") || lower.contains("terminal") || lower.contains("exec") {
            let cmd = block.command ?? (args?["CommandLine"] as? String) ?? (args?["command"] as? String) ?? (args?["cmd"] as? String)
            let displayCmd = cmd.map { "$ \(truncate($0, limit: 45))" }
            return (isRunning ? "Running" : "Ran", displayCmd, true, nil)
        }

        // 3. Reading
        if lower.contains("read") || lower.contains("view") || lower == "cat" {
            let rawPath = (args?["AbsolutePath"] as? String) ?? (args?["path"] as? String) ?? (args?["TargetFile"] as? String) ?? (args?["target_file"] as? String) ?? (args?["filePath"] as? String) ?? (args?["file"] as? String) ?? block.path
            let target = rawPath.map { getShortPath($0) } ?? toolName
            return (isRunning ? "Reading" : "Read", target, true, nil)
        }

        // 4. CodeGraph Exploration
        if lower.contains("codegraph_explore") || lower.contains("explore") {
            let q = (args?["query"] as? String) ?? (args?["Query"] as? String)
            return (isRunning ? "Exploring" : "Explored", q.map { "\"\(truncate($0, limit: 35))\"" }, false, nil)
        }

        // 5. Grep / Find / Search
        if lower.contains("grep") || lower.contains("find") || lower.contains("search") {
            let q = (args?["Query"] as? String) ?? (args?["query"] as? String) ?? (args?["Pattern"] as? String)
            return (isRunning ? "Searching" : "Searched", q.map { "for \"\(truncate($0, limit: 35))\"" }, false, nil)
        }

        // 6. Web / Browse
        if let u = (args?["Url"] as? String) ?? (args?["url"] as? String) {
            return (isRunning ? "Fetching" : "Fetched", truncate(u, limit: 35), true, nil)
        }

        // Fallback
        if let q = (args?["query"] as? String) ?? (args?["Query"] as? String) {
            return (isRunning ? "Calling" : "Called", "\(toolName) \"\(truncate(q, limit: 30))\"", false, nil)
        }

        let firstVal = args?.values.compactMap { $0 as? String }.first
        let target = firstVal != nil ? "\(toolName) (\(truncate(firstVal!, limit: 25)))" : toolName
        return (isRunning ? "Calling" : "Called", target, true, nil)
    }

    private var isEditAction: Bool {
        actionDetails.verb == "Editing" || actionDetails.verb == "Edited"
    }

    private var effectivePatch: String? {
        // 1. Explicit patch on block
        if let patch = block.patch, !patch.isEmpty {
            return patch
        }
        if block.type == .fileDiff, let content = block.content, !content.isEmpty {
            return content
        }

        // 2. Diff inside block.output
        if let output = block.output, !output.isEmpty {
            if let start = output.range(of: "[diff_block_start]"),
               let end = output.range(of: "[diff_block_end]") {
                let diffSub = output[start.upperBound..<end.lowerBound]
                let clean = diffSub.trimmingCharacters(in: .whitespacesAndNewlines)
                if !clean.isEmpty {
                    return clean
                }
            }
            if output.contains("@@ -") || output.hasPrefix("---") || output.hasPrefix("diff --git") {
                return output
            }
        }

        // 3. From args dictionary
        if let args = parsedArgs {
            if let patch = (args["patch"] as? String) ?? (args["diff"] as? String) ?? (args["unified_diff"] as? String) ?? (args["unifiedDiff"] as? String), !patch.isEmpty {
                return patch
            }

            // changes array (Codex)
            let changesList = (args["changes"] as? [[String: Any]]) ?? (args["fileChanges"] as? [[String: Any]]) ?? (args["file_changes"] as? [[String: Any]])
            if let first = changesList?.first,
               let diff = (first["diff"] as? String) ?? (first["patch"] as? String),
               !diff.isEmpty {
                return diff
            }

            // Content replacement (Antigravity replace_file_content, edit_file, etc.)
            let targetContent = (args["TargetContent"] as? String) ?? (args["target_content"] as? String) ?? (args["targetContent"] as? String) ?? (args["old_string"] as? String) ?? (args["old_str"] as? String) ?? (args["oldString"] as? String) ?? (args["find"] as? String)
            let replacementContent = (args["ReplacementContent"] as? String) ?? (args["replacement_content"] as? String) ?? (args["replacementContent"] as? String) ?? (args["new_string"] as? String) ?? (args["new_str"] as? String) ?? (args["newString"] as? String) ?? (args["replace"] as? String)
            if targetContent != nil || replacementContent != nil {
                let oldText = normalizeEscapedNewlines(targetContent ?? "")
                let newText = normalizeEscapedNewlines(replacementContent ?? "")
                let oldLines = oldText.isEmpty ? [] : oldText.components(separatedBy: .newlines)
                let newLines = newText.isEmpty ? [] : newText.components(separatedBy: .newlines)
                let fileName = actionDetails.target ?? "file"
                var p = "--- a/\(fileName)\n+++ b/\(fileName)\n"
                for line in oldLines {
                    p += "-\(line)\n"
                }
                for line in newLines {
                    p += "+\(line)\n"
                }
                return p.trimmingCharacters(in: .newlines)
            }

            // File creation / Write (Antigravity write_to_file, etc.)
            if let codeContent = (args["CodeContent"] as? String) ?? (args["code_content"] as? String) ?? (args["codeContent"] as? String) ?? (args["content"] as? String) ?? (args["contents"] as? String) ?? (args["text"] as? String) {
                let newText = normalizeEscapedNewlines(codeContent)
                let newLines = newText.isEmpty ? [] : newText.components(separatedBy: .newlines)
                let fileName = actionDetails.target ?? "file"
                var p = "--- /dev/null\n+++ b/\(fileName)\n"
                for line in newLines {
                    p += "+\(line)\n"
                }
                return p.trimmingCharacters(in: .newlines)
            }
        }

        return nil
    }

    private var diffStats: (added: Int, removed: Int)? {
        guard let patch = effectivePatch, !patch.isEmpty else {
            return nil
        }
        var added = 0
        var removed = 0
        let lines = patch.components(separatedBy: .newlines)
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("+++") || trimmed.hasPrefix("---") || trimmed.hasPrefix("@@") {
                continue
            }
            if trimmed.hasPrefix("+") {
                added += 1
            } else if trimmed.hasPrefix("-") {
                removed += 1
            }
        }
        if added > 0 || removed > 0 {
            return (added, removed)
        }
        return nil
    }

    private var formattedArgsString: String? {
        guard let args = block.args else { return nil }
        if let dict = parsedArgs,
           let data = try? JSONSerialization.data(withJSONObject: dict, options: [.prettyPrinted, .sortedKeys]),
           let str = String(data: data, encoding: .utf8) {
            return str
        }
        return "\(args.value)"
    }

    var body: some View {
        if isEditAction {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .center, spacing: 5) {
                    // Left: Verb + File Icon + Target Path
                    Text(actionDetails.verb)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(.secondary)

                    if let icon = actionDetails.icon {
                        Image(systemName: icon)
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }

                    if let target = actionDetails.target {
                        Text(target)
                            .font(.system(size: 11.5, weight: .regular, design: .monospaced))
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }

                    Spacer(minLength: 4)

                    // Right: Status indicator and (+green, -red) diff stats
                    if block.status == .running {
                        Text("...")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(.orange.opacity(0.9))
                    }

                    if block.status == .failed || block.status == .rejected {
                        Text("(failed)")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(.red.opacity(0.85))
                    }

                    if let stats = diffStats {
                        Button {
                            if effectivePatch != nil {
                                Haptics.shared.selection()
                                withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                                    isExpanded.toggle()
                                }
                            }
                        } label: {
                            HStack(spacing: 3) {
                                Text("+\(stats.added)")
                                    .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(Color(red: 0.2, green: 0.78, blue: 0.35))
                                Text("-\(stats.removed)")
                                    .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(Color(red: 0.95, green: 0.35, blue: 0.35))
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture {
                    if effectivePatch != nil {
                        Haptics.shared.selection()
                        withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                            isExpanded.toggle()
                        }
                    }
                }

                if isExpanded, let patch = effectivePatch {
                    DiffContentView(patch: patch)
                        .padding(.leading, 12)
                        .padding(.top, 2)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 4) {
                // Row - Arrow at start, tap toggles expand
                Button {
                    Haptics.shared.selection()
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack(alignment: .center, spacing: 5) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(Color.secondary.opacity(0.7))
                            .rotationEffect(.degrees(isExpanded ? 90 : 0))
                            .frame(width: 10)

                        Text(actionDetails.verb)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(.secondary)

                        if let icon = actionDetails.icon {
                            Image(systemName: icon)
                                .font(.system(size: 10))
                                .foregroundStyle(.secondary)
                        }

                        if let target = actionDetails.target {
                            Text(target)
                                .font(.system(size: 11.5, weight: .regular, design: actionDetails.isMono ? .monospaced : .default))
                                .foregroundStyle(.primary)
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
                                Text("OUTPUT")
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

                            if let patch = effectivePatch, block.type == .fileDiff {
                                DiffContentView(patch: patch)
                            } else if let output = block.output, !output.isEmpty {
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
}

// MARK: - Diff Content View (Syntax-Highlighted Diff with Copy)

struct DiffContentView: View {
    let patch: String
    @State private var isCopied: Bool = false

    private var lines: [String] {
        patch.components(separatedBy: "\n")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text("DIFF")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(.tertiary)
                Spacer()
                Button {
                    UIPasteboard.general.string = patch
                    Haptics.shared.notification(.success)
                    withAnimation { isCopied = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        withAnimation { isCopied = false }
                    }
                } label: {
                    HStack(spacing: 3) {
                        Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 8))
                        Text(isCopied ? "Copied" : "Copy diff")
                            .font(.system(size: 8, design: .monospaced))
                    }
                    .foregroundStyle(isCopied ? .green : .secondary)
                }
                .buttonStyle(.plain)
            }

            ScrollView([.horizontal, .vertical], showsIndicators: true) {
                VStack(alignment: .leading, spacing: 1) {
                    ForEach(Array(lines.enumerated()), id: \.offset) { idx, line in
                        let isAdd = line.hasPrefix("+") && !line.hasPrefix("+++")
                        let isDel = line.hasPrefix("-") && !line.hasPrefix("---")
                        let isHeader = line.hasPrefix("@@")

                        HStack(alignment: .top, spacing: 6) {
                            Text("\(idx + 1)")
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundStyle(.secondary.opacity(0.4))
                                .frame(width: 22, alignment: .trailing)

                            Text(line)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(
                                    isAdd ? Color(red: 0.3, green: 0.85, blue: 0.4) :
                                    (isDel ? Color(red: 0.95, green: 0.4, blue: 0.4) :
                                    (isHeader ? Color.blue.opacity(0.85) : Color(red: 0.88, green: 0.90, blue: 0.92)))
                                )
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.horizontal, 4)
                        .padding(.vertical, 0.5)
                        .background(
                            isAdd ? Color.green.opacity(0.12) :
                            (isDel ? Color.red.opacity(0.12) :
                            (isHeader ? Color.blue.opacity(0.08) : Color.clear))
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 2))
                    }
                }
                .padding(6)
            }
            .frame(maxHeight: 200)
            .background(Color(red: 0.08, green: 0.09, blue: 0.11))
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
    }
}

// MARK: - Tool Call Group View (SwiftUI)

struct ToolCallGroupView: View {
    let blocks: [MessageBlock]
    var isStreaming: Bool = false
    var isActive: Bool = false

    @State private var isGroupExpanded: Bool

    init(blocks: [MessageBlock], isStreaming: Bool = false, isActive: Bool = false) {
        self.blocks = blocks
        self.isStreaming = isStreaming
        self.isActive = isActive
        self._isGroupExpanded = State(initialValue: isActive)
    }

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
        Group {
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
        .onChange(of: isActive) { oldValue, newValue in
            if oldValue && !newValue {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                    isGroupExpanded = false
                }
            } else if !oldValue && newValue {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                    isGroupExpanded = true
                }
            }
        }
    }
}
