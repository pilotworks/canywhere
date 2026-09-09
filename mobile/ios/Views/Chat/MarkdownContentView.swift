import SwiftUI
import UIKit

// MARK: - Markdown Models

enum MarkdownBlock: Identifiable, Equatable {
    case code(language: String, code: String)
    case heading(level: Int, text: String)
    case paragraph(text: String)
    case bulletList(items: [String])
    case orderedList(items: [(number: Int, text: String)])
    case taskList(items: [(isDone: Bool, text: String)])
    case quote(text: String)
    case divider
    case table(headers: [String], rows: [[String]])

    var id: String {
        switch self {
        case .code(let lang, let code):
            return "code_\(lang)_\(code.hashValue)"
        case .heading(let level, let text):
            return "h\(level)_\(text.hashValue)"
        case .paragraph(let text):
            return "p_\(text.hashValue)"
        case .bulletList(let items):
            return "ul_\(items.count)_\(items.first?.hashValue ?? 0)"
        case .orderedList(let items):
            return "ol_\(items.count)_\(items.first?.text.hashValue ?? 0)"
        case .taskList(let items):
            return "task_\(items.count)_\(items.first?.text.hashValue ?? 0)"
        case .quote(let text):
            return "quote_\(text.hashValue)"
        case .divider:
            return "divider"
        case .table(let headers, let rows):
            return "table_\(headers.joined())_\(rows.count)"
        }
    }

    static func == (lhs: MarkdownBlock, rhs: MarkdownBlock) -> Bool {
        switch (lhs, rhs) {
        case (.code(let l1, let c1), .code(let l2, let c2)):
            return l1 == l2 && c1 == c2
        case (.heading(let lv1, let t1), .heading(let lv2, let t2)):
            return lv1 == lv2 && t1 == t2
        case (.paragraph(let t1), .paragraph(let t2)):
            return t1 == t2
        case (.bulletList(let i1), .bulletList(let i2)):
            return i1 == i2
        case (.orderedList(let i1), .orderedList(let i2)):
            guard i1.count == i2.count else { return false }
            return zip(i1, i2).allSatisfy { $0.number == $1.number && $0.text == $1.text }
        case (.taskList(let i1), .taskList(let i2)):
            guard i1.count == i2.count else { return false }
            return zip(i1, i2).allSatisfy { $0.isDone == $1.isDone && $0.text == $1.text }
        case (.quote(let t1), .quote(let t2)):
            return t1 == t2
        case (.divider, .divider):
            return true
        case (.table(let h1, let r1), .table(let h2, let r2)):
            return h1 == h2 && r1 == r2
        default:
            return false
        }
    }
}

// MARK: - Markdown Parser

enum MarkdownParser {
    static func parse(_ rawContent: String) -> [MarkdownBlock] {
        let lines = rawContent.components(separatedBy: .newlines)
        var blocks: [MarkdownBlock] = []
        var lineIndex = 0
        let total = lines.count

        while lineIndex < total {
            let line = lines[lineIndex]
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // 1. Fenced Code Block
            if trimmed.hasPrefix("```") {
                let language = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                lineIndex += 1
                var codeLines: [String] = []

                while lineIndex < total {
                    let cLine = lines[lineIndex]
                    if cLine.trimmingCharacters(in: .whitespaces).hasPrefix("```") {
                        lineIndex += 1
                        break
                    }
                    codeLines.append(cLine)
                    lineIndex += 1
                }

                let code = codeLines.joined(separator: "\n")
                blocks.append(.code(language: language, code: code))
                continue
            }

            // 2. Horizontal Divider (---, ***, ___)
            if isDivider(trimmed) {
                blocks.append(.divider)
                lineIndex += 1
                continue
            }

            // 3. Headings (#, ##, ###, ...)
            if let heading = parseHeading(line) {
                blocks.append(heading)
                lineIndex += 1
                continue
            }

            // 4. Blockquotes (> ...)
            if trimmed.hasPrefix(">") {
                var quoteLines: [String] = []
                while lineIndex < total {
                    let qLine = lines[lineIndex].trimmingCharacters(in: .whitespaces)
                    if qLine.hasPrefix(">") {
                        let text = String(qLine.dropFirst()).trimmingCharacters(in: .whitespaces)
                        quoteLines.append(text)
                        lineIndex += 1
                    } else {
                        break
                    }
                }
                blocks.append(.quote(text: quoteLines.joined(separator: "\n")))
                continue
            }

            // 5. Table (| ... |)
            if isTableLine(trimmed), lineIndex + 1 < total && isTableSeparator(lines[lineIndex + 1].trimmingCharacters(in: .whitespaces)) {
                let headerLine = trimmed
                lineIndex += 2 // skip header and separator
                var tableRows: [[String]] = []

                while lineIndex < total {
                    let rLine = lines[lineIndex].trimmingCharacters(in: .whitespaces)
                    if isTableLine(rLine) {
                        tableRows.append(parseTableRow(rLine))
                        lineIndex += 1
                    } else {
                        break
                    }
                }

                let headers = parseTableRow(headerLine)
                blocks.append(.table(headers: headers, rows: tableRows))
                continue
            }

            // 6. Task List (- [ ] or - [x])
            if isTaskListItem(trimmed) {
                var taskItems: [(isDone: Bool, text: String)] = []
                while lineIndex < total {
                    let tLine = lines[lineIndex].trimmingCharacters(in: .whitespaces)
                    if let task = parseTaskListItem(tLine) {
                        taskItems.append(task)
                        lineIndex += 1
                    } else {
                        break
                    }
                }
                blocks.append(.taskList(items: taskItems))
                continue
            }

            // 7. Bullet List (- item, * item, + item)
            if isBulletListItem(trimmed) {
                var items: [String] = []
                while lineIndex < total {
                    let bLine = lines[lineIndex].trimmingCharacters(in: .whitespaces)
                    if isBulletListItem(bLine) {
                        items.append(stripBulletPrefix(bLine))
                        lineIndex += 1
                    } else {
                        break
                    }
                }
                blocks.append(.bulletList(items: items))
                continue
            }

            // 8. Ordered List (1. item, 2. item)
            if isOrderedListItem(trimmed) {
                var items: [(number: Int, text: String)] = []
                while lineIndex < total {
                    let oLine = lines[lineIndex].trimmingCharacters(in: .whitespaces)
                    if let (num, text) = parseOrderedListItem(oLine) {
                        items.append((num, text))
                        lineIndex += 1
                    } else {
                        break
                    }
                }
                blocks.append(.orderedList(items: items))
                continue
            }

            // 9. Blank line
            if trimmed.isEmpty {
                lineIndex += 1
                continue
            }

            // 10. Paragraph (accumulate normal lines until blank line or special block)
            var pLines: [String] = []
            while lineIndex < total {
                let pLine = lines[lineIndex]
                let pTrimmed = pLine.trimmingCharacters(in: .whitespaces)
                if pTrimmed.isEmpty ||
                    pTrimmed.hasPrefix("```") ||
                    isDivider(pTrimmed) ||
                    parseHeading(pLine) != nil ||
                    pTrimmed.hasPrefix(">") ||
                    isTableLine(pTrimmed) ||
                    isTaskListItem(pTrimmed) ||
                    isBulletListItem(pTrimmed) ||
                    isOrderedListItem(pTrimmed) {
                    break
                }
                pLines.append(pLine)
                lineIndex += 1
            }

            if !pLines.isEmpty {
                blocks.append(.paragraph(text: pLines.joined(separator: "\n")))
            }
        }

        return blocks
    }

    private static func isDivider(_ line: String) -> Bool {
        let pattern = #"^(\-{3,}|\*{3,}|_{3,})$"#
        return line.range(of: pattern, options: .regularExpression) != nil
    }

    private static func parseHeading(_ line: String) -> MarkdownBlock? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.hasPrefix("#") else { return nil }

        var level = 0
        for char in trimmed {
            if char == "#" { level += 1 } else { break }
        }

        guard level >= 1 && level <= 6 else { return nil }
        let remainder = trimmed.dropFirst(level)
        guard remainder.first == " " else { return nil }

        let text = remainder.trimmingCharacters(in: .whitespaces)
        return .heading(level: level, text: text)
    }

    private static func isBulletListItem(_ line: String) -> Bool {
        guard !line.hasPrefix("- [") && !line.hasPrefix("* [") else { return false }
        return line.hasPrefix("- ") || line.hasPrefix("* ") || line.hasPrefix("+ ")
    }

    private static func stripBulletPrefix(_ line: String) -> String {
        if line.hasPrefix("- ") || line.hasPrefix("* ") || line.hasPrefix("+ ") {
            return String(line.dropFirst(2)).trimmingCharacters(in: .whitespaces)
        }
        return line
    }

    private static func isOrderedListItem(_ line: String) -> Bool {
        return line.range(of: #"^\d+[\.)]\s+"#, options: .regularExpression) != nil
    }

    private static func parseOrderedListItem(_ line: String) -> (number: Int, text: String)? {
        guard let match = line.range(of: #"^(\d+)[\.)]\s+"#, options: .regularExpression) else {
            return nil
        }
        let prefix = String(line[match])
        let digits = prefix.filter(\.isNumber)
        let num = Int(digits) ?? 1
        let text = String(line[match.upperBound...]).trimmingCharacters(in: .whitespaces)
        return (num, text)
    }

    private static func isTaskListItem(_ line: String) -> Bool {
        return line.range(of: #"^[-*+]\s+\[[ xX]\]\s+"#, options: .regularExpression) != nil
    }

    private static func parseTaskListItem(_ line: String) -> (isDone: Bool, text: String)? {
        guard let match = line.range(of: #"^[-*+]\s+\[([ xX])\]\s+"#, options: .regularExpression) else {
            return nil
        }
        let matchStr = String(line[match])
        let isDone = matchStr.contains("[x]") || matchStr.contains("[X]")
        let text = String(line[match.upperBound...]).trimmingCharacters(in: .whitespaces)
        return (isDone, text)
    }

    private static func isTableLine(_ line: String) -> Bool {
        return line.hasPrefix("|") && line.hasSuffix("|") && line.contains("|")
    }

    private static func isTableSeparator(_ line: String) -> Bool {
        return line.range(of: #"^\|[\s\-:|]+\|$"#, options: .regularExpression) != nil
    }

    private static func parseTableRow(_ line: String) -> [String] {
        let stripped = line.trimmingCharacters(in: CharacterSet(charactersIn: "|"))
        return stripped.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
    }
}

// MARK: - Markdown Content View

struct MarkdownContentView: View {
    let content: String
    var isStreaming: Bool = false
    var isReasoning: Bool = false

    private var blocks: [MarkdownBlock] {
        MarkdownParser.parse(content)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: isReasoning ? 6 : 10) {
            ForEach(blocks) { block in
                switch block {
                case .code(let language, let code):
                    CodeBlockView(
                        language: language,
                        code: code,
                        isReasoning: isReasoning
                    )

                case .heading(let level, let text):
                    HeadingView(
                        level: level,
                        text: text,
                        isReasoning: isReasoning
                    )

                case .paragraph(let text):
                    ParagraphView(
                        text: text,
                        isReasoning: isReasoning
                    )

                case .bulletList(let items):
                    BulletListView(
                        items: items,
                        isReasoning: isReasoning
                    )

                case .orderedList(let items):
                    OrderedListView(
                        items: items,
                        isReasoning: isReasoning
                    )

                case .taskList(let items):
                    TaskListView(
                        items: items,
                        isReasoning: isReasoning
                    )

                case .quote(let text):
                    BlockquoteView(
                        text: text,
                        isReasoning: isReasoning
                    )

                case .divider:
                    Divider()
                        .padding(.vertical, isReasoning ? 2 : 4)

                case .table(let headers, let rows):
                    TableBlockView(
                        headers: headers,
                        rows: rows,
                        isReasoning: isReasoning
                    )
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Subcomponents

struct CodeBlockView: View {
    let language: String
    let code: String
    var isReasoning: Bool = false

    @State private var isCopied: Bool = false

    private var displayLanguage: String {
        let trimmed = language.trimmingCharacters(in: .whitespaces).lowercased()
        return trimmed.isEmpty ? "code" : trimmed
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header Bar
            HStack(spacing: 8) {
                Text(displayLanguage)
                    .font(.system(size: isReasoning ? 10 : 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .textCase(.lowercase)

                Spacer()

                Button {
                    UIPasteboard.general.string = code
                    Haptics.shared.notification(.success)
                    withAnimation(.easeInOut(duration: 0.15)) {
                        isCopied = true
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            isCopied = false
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: isReasoning ? 9 : 10))
                        Text(isCopied ? "Copied" : "Copy")
                            .font(.system(size: isReasoning ? 10 : 11, weight: .medium))
                    }
                    .foregroundStyle(isCopied ? Color.green : Color.secondary)
                    .padding(.vertical, 2)
                    .padding(.horizontal, 6)
                    .background(Color(uiColor: .tertiarySystemFill).opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, isReasoning ? 5 : 6)
            .background(Color(uiColor: .secondarySystemFill).opacity(0.6))

            Divider()

            // Code Content
            ScrollView(.horizontal, showsIndicators: false) {
                Text(code)
                    .font(.system(size: isReasoning ? 11 : 12, design: .monospaced))
                    .lineSpacing(2)
                    .foregroundStyle(.primary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
        }
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color(uiColor: .separator).opacity(0.5), lineWidth: 1)
        )
        .padding(.vertical, isReasoning ? 2 : 4)
    }
}

struct HeadingView: View {
    let level: Int
    let text: String
    var isReasoning: Bool = false

    var body: some View {
        Text(LocalizedStringKey(text))
            .font(headingFont)
            .foregroundStyle(isReasoning ? .secondary : .primary)
            .padding(.top, isReasoning ? 2 : 4)
            .padding(.bottom, 1)
            .textSelection(.enabled)
    }

    private var headingFont: Font {
        if isReasoning {
            switch level {
            case 1: return .system(size: 13, weight: .bold)
            case 2: return .system(size: 12, weight: .semibold)
            default: return .system(size: 11, weight: .semibold)
            }
        } else {
            switch level {
            case 1: return .system(size: 17, weight: .bold)
            case 2: return .system(size: 15, weight: .semibold)
            default: return .system(size: 14, weight: .semibold)
            }
        }
    }
}

struct ParagraphView: View {
    let text: String
    var isReasoning: Bool = false

    var body: some View {
        Text(LocalizedStringKey(text))
            .font(isReasoning ? .system(size: 11, design: .monospaced) : .body)
            .foregroundStyle(isReasoning ? .secondary : .primary)
            .lineSpacing(isReasoning ? 2 : 3)
            .textSelection(.enabled)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct BulletListView: View {
    let items: [String]
    var isReasoning: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: isReasoning ? 3 : 5) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 6) {
                    Text("•")
                        .font(isReasoning ? .system(size: 11, weight: .bold) : .system(size: 14, weight: .bold))
                        .foregroundStyle(.secondary)
                        .frame(width: 10, alignment: .center)

                    Text(LocalizedStringKey(item))
                        .font(isReasoning ? .system(size: 11, design: .monospaced) : .body)
                        .foregroundStyle(isReasoning ? .secondary : .primary)
                        .lineSpacing(isReasoning ? 2 : 3)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.leading, 2)
    }
}

struct OrderedListView: View {
    let items: [(number: Int, text: String)]
    var isReasoning: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: isReasoning ? 3 : 5) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 6) {
                    Text("\(item.number).")
                        .font(isReasoning ? .system(size: 11, weight: .medium, design: .monospaced) : .system(size: 13, weight: .medium, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .frame(minWidth: 16, alignment: .leading)

                    Text(LocalizedStringKey(item.text))
                        .font(isReasoning ? .system(size: 11, design: .monospaced) : .body)
                        .foregroundStyle(isReasoning ? .secondary : .primary)
                        .lineSpacing(isReasoning ? 2 : 3)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.leading, 2)
    }
}

struct TaskListView: View {
    let items: [(isDone: Bool, text: String)]
    var isReasoning: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: isReasoning ? 3 : 5) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: item.isDone ? "checkmark.square.fill" : "square")
                        .font(.system(size: isReasoning ? 11 : 13))
                        .foregroundStyle(item.isDone ? Color.green : Color.secondary)
                        .frame(width: 14, height: 14)
                        .padding(.top, 2)

                    Text(LocalizedStringKey(item.text))
                        .font(isReasoning ? .system(size: 11, design: .monospaced) : .body)
                        .foregroundStyle(item.isDone ? .secondary : (isReasoning ? .secondary : .primary))
                        .strikethrough(item.isDone, color: .secondary)
                        .lineSpacing(isReasoning ? 2 : 3)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.leading, 2)
    }
}

struct BlockquoteView: View {
    let text: String
    var isReasoning: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Rectangle()
                .fill(Color(uiColor: .separator).opacity(0.8))
                .frame(width: 3)
                .clipShape(Capsule())

            Text(LocalizedStringKey(text))
                .font(isReasoning ? .system(size: 11, design: .monospaced) : .body)
                .italic()
                .foregroundStyle(.secondary)
                .lineSpacing(isReasoning ? 2 : 3)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.leading, 2)
        .padding(.vertical, 2)
    }
}

struct TableBlockView: View {
    let headers: [String]
    let rows: [[String]]
    var isReasoning: Bool = false

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                // Header Row
                HStack(spacing: 0) {
                    ForEach(Array(headers.enumerated()), id: \.offset) { idx, header in
                        Text(LocalizedStringKey(header))
                            .font(.system(size: isReasoning ? 10 : 12, weight: .semibold))
                            .foregroundStyle(.primary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .frame(minWidth: 80, alignment: .leading)
                        if idx < headers.count - 1 {
                            Divider()
                        }
                    }
                }
                .background(Color(uiColor: .secondarySystemFill).opacity(0.6))

                Divider()

                // Data Rows
                ForEach(Array(rows.enumerated()), id: \.offset) { rIdx, row in
                    HStack(spacing: 0) {
                        ForEach(Array(row.enumerated()), id: \.offset) { cIdx, cell in
                            Text(LocalizedStringKey(cell))
                                .font(.system(size: isReasoning ? 10 : 12))
                                .foregroundStyle(isReasoning ? .secondary : .primary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .frame(minWidth: 80, alignment: .leading)
                            if cIdx < row.count - 1 {
                                Divider()
                            }
                        }
                    }
                    if rIdx < rows.count - 1 {
                        Divider()
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(Color(uiColor: .separator).opacity(0.5), lineWidth: 1)
            )
        }
        .padding(.vertical, isReasoning ? 2 : 4)
    }
}
