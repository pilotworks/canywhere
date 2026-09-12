import SwiftUI
import UIKit

// MARK: - Markdown Models

enum MarkdownBlock: Equatable {
    case code(language: String, code: String)
    case heading(level: Int, text: String)
    case paragraph(text: String)
    case bulletList(items: [String])
    case orderedList(items: [(number: Int, text: String)])
    case taskList(items: [(isDone: Bool, text: String)])
    case quote(text: String)
    case divider
    case table(headers: [String], rows: [[String]])

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
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                switch block {
                case .code(let language, let code):
                    CodeBlockView(
                        language: language,
                        code: code,
                        isStreaming: isStreaming,
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
    var isStreaming: Bool = false
    var isReasoning: Bool = false

    @State private var isCopied: Bool = false
    @State private var isExpanded: Bool = false

    private let maxLines: Int = 24

    private var codeLines: [String] {
        code.components(separatedBy: .newlines)
    }

    private var isLong: Bool {
        codeLines.count > maxLines
    }

    private var displayedCode: String {
        if isLong && !isExpanded {
            return codeLines.prefix(maxLines).joined(separator: "\n")
        }
        return code
    }

    private var displayLanguage: String {
        let trimmed = language.trimmingCharacters(in: .whitespaces).lowercased()
        return trimmed.isEmpty ? "code" : trimmed
    }

    private var languageIcon: String {
        switch displayLanguage {
        case "swift":
            return "swift"
        case "sh", "bash", "shell", "zsh":
            return "terminal"
        case "json", "yaml", "yml", "toml":
            return "curlybraces"
        case "md", "markdown":
            return "text.alignleft"
        case "sql":
            return "cylinder.split.1x2"
        case "diff", "patch":
            return "plus.forwardslash.minus"
        default:
            return "chevron.left.forwardslash.chevron.right"
        }
    }

    private var highlightedCode: AttributedString {
        CodeSyntaxHighlighter.highlight(displayedCode, language: language, isStreaming: isStreaming)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header Bar
            HStack(spacing: 8) {
                HStack(spacing: 5) {
                    FileIconView(
                        language: displayLanguage,
                        size: isReasoning ? 11 : 13,
                        fallbackSystemName: languageIcon
                    )

                    Text(displayLanguage)
                        .font(.system(size: isReasoning ? 10 : 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .textCase(.lowercase)

                    if isLong {
                        Text("(\(codeLines.count) lines)")
                            .font(.system(size: isReasoning ? 9 : 10, design: .monospaced))
                            .foregroundStyle(.secondary.opacity(0.8))
                    }
                }

                Spacer()

                if isLong {
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            isExpanded.toggle()
                        }
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                                .font(.system(size: isReasoning ? 8 : 9))
                            Text(isExpanded ? "Collapse" : "Expand")
                                .font(.system(size: isReasoning ? 10 : 11, weight: .medium))
                        }
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 2)
                        .padding(.horizontal, 6)
                        .background(Color(uiColor: .tertiarySystemFill).opacity(0.6))
                        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }

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

            // Code Content without vertical scrolling
            ScrollView(.horizontal, showsIndicators: false) {
                Text(highlightedCode)
                    .font(.system(size: isReasoning ? 11 : 12, design: .monospaced))
                    .lineSpacing(2)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }

            if isLong {
                Divider()

                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: isReasoning ? 9 : 10))
                        Text(isExpanded ? "Collapse code (\(codeLines.count) lines)" : "Expand code (+\(codeLines.count - maxLines) more lines)")
                            .font(.system(size: isReasoning ? 10 : 11, weight: .medium, design: .monospaced))
                    }
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, isReasoning ? 6 : 7)
                    .background(Color(uiColor: .secondarySystemFill).opacity(0.4))
                }
                .buttonStyle(.plain)
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

// MARK: - High-Performance Syntax Highlighter for iOS
 
private final class AttributedStringBox: @unchecked Sendable {
    let value: AttributedString
    init(_ value: AttributedString) { self.value = value }
}

@MainActor
enum CodeSyntaxHighlighter {
    private static let cache = NSCache<NSString, AttributedStringBox>()

    // Pre-compiled regular expressions (compiled ONCE statically, avoiding per-frame regex compilation)
    private static let numberRegex = try? NSRegularExpression(pattern: #"\b\d+(\.\d+)?\b"#, options: [.anchorsMatchLines])
    private static let typeRegex = try? NSRegularExpression(pattern: #"\b[A-Z][a-zA-Z0-9_]*\b"#, options: [.anchorsMatchLines])
    private static let funcRegex = try? NSRegularExpression(pattern: #"\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()"#, options: [.anchorsMatchLines])
    private static let stringRegex = try? NSRegularExpression(pattern: #"\"([^\"\\]|\\.)*\"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`"#, options: [.anchorsMatchLines])
    private static let hashCommentRegex = try? NSRegularExpression(pattern: #"#.*$"#, options: [.anchorsMatchLines])
    private static let slashCommentRegex = try? NSRegularExpression(pattern: #"//.*$"#, options: [.anchorsMatchLines])
    private static let blockCommentRegex = try? NSRegularExpression(pattern: #"/\*[\s\S]*?\*/"#, options: [.anchorsMatchLines])
    private static let keywordRegex: NSRegularExpression? = {
        let keywords = [
            "func", "fn", "def", "function", "const", "let", "var", "val", "mut",
            "class", "struct", "enum", "protocol", "interface", "type", "impl", "trait",
            "return", "if", "else", "switch", "case", "default", "for", "while", "loop",
            "match", "in", "of", "import", "export", "from", "package", "use", "pub",
            "async", "await", "try", "catch", "throw", "throws", "guard", "defer",
            "self", "this", "super", "new", "true", "false", "nil", "null", "None",
            "where", "static", "final", "public", "private", "protected", "override",
            "yield", "break", "continue", "as", "is", "extern", "crate", "mod"
        ]
        let pattern = #"\b("# + keywords.joined(separator: "|") + #")\b"#
        return try? NSRegularExpression(pattern: pattern, options: [.anchorsMatchLines])
    }()

    static func highlight(_ code: String, language: String, isStreaming: Bool = false) -> AttributedString {
        let trimmedLang = language.trimmingCharacters(in: .whitespaces).lowercased()
        guard !code.isEmpty, trimmedLang != "text", trimmedLang != "txt" else {
            return AttributedString(code)
        }

        // Cache key: combined language + hash
        let cacheKey = "\(trimmedLang):\(code.hashValue)" as NSString
        if let cached = cache.object(forKey: cacheKey) {
            return cached.value
        }

        // When actively streaming long code blocks (>400 chars), bypass regex highlighting to maintain 60/120 FPS
        if isStreaming && code.count > 400 {
            return AttributedString(code)
        }

        var attributed = AttributedString(code)
        let nsCode = code as NSString
        let fullRange = NSRange(location: 0, length: nsCode.length)

        // Palette matching modern developer themes
        let keywordColor = Color(red: 0.95, green: 0.45, blue: 0.55) // Pink / Magenta
        let stringColor = Color(red: 0.42, green: 0.78, blue: 0.60)  // Mint / Green
        let numberColor = Color(red: 0.95, green: 0.68, blue: 0.38)  // Orange / Amber
        let commentColor = Color.secondary.opacity(0.7)               // Muted Gray
        let typeColor = Color(red: 0.90, green: 0.78, blue: 0.45)    // Warm Yellow
        let funcColor = Color(red: 0.45, green: 0.70, blue: 0.98)    // Sky Blue

        func apply(_ regex: NSRegularExpression?, color: Color) {
            guard let regex = regex else { return }
            let matches = regex.matches(in: code, options: [], range: fullRange)
            for match in matches {
                if let range = Range(match.range, in: code),
                   let lower = AttributedString.Index(range.lowerBound, within: attributed),
                   let upper = AttributedString.Index(range.upperBound, within: attributed) {
                    attributed[lower..<upper].foregroundColor = color
                }
            }
        }

        // 1. Numbers
        apply(numberRegex, color: numberColor)

        // 2. Types / Capitalized Identifiers
        apply(typeRegex, color: typeColor)

        // 3. Keywords
        apply(keywordRegex, color: keywordColor)

        // 4. Function call identifiers (foo())
        apply(funcRegex, color: funcColor)

        // 5. Strings ("...", '...', `...`)
        apply(stringRegex, color: stringColor)

        // 6. Comments (//..., #..., /*...*/) - applied last so comments override everything inside
        if ["py", "python", "sh", "bash", "zsh", "shell", "yaml", "yml", "rb", "ruby"].contains(trimmedLang) {
            apply(hashCommentRegex, color: commentColor)
        }
        apply(slashCommentRegex, color: commentColor)
        apply(blockCommentRegex, color: commentColor)

        // Cache the result for subsequent evaluations
        cache.setObject(AttributedStringBox(attributed), forKey: cacheKey)

        return attributed
    }
}

struct HeadingView: View {
    let level: Int
    let text: String
    var isReasoning: Bool = false

    var body: some View {
        MarkdownInlineTextView(
            text: text,
            isReasoning: isReasoning,
            baseFont: headingFont,
            baseFontSize: headingFontSize
        )
        .foregroundStyle(isReasoning ? .secondary : .primary)
        .padding(.top, isReasoning ? 2 : 4)
        .padding(.bottom, 1)
        .textSelection(.enabled)
    }

    private var headingFontSize: CGFloat {
        if isReasoning {
            switch level {
            case 1: return 13
            case 2: return 12
            default: return 11
            }
        } else {
            switch level {
            case 1: return 17
            case 2: return 15
            default: return 14
            }
        }
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
        MarkdownInlineTextView(text: text, isReasoning: isReasoning)
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

                    MarkdownInlineTextView(text: item, isReasoning: isReasoning)
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

                    MarkdownInlineTextView(text: item.text, isReasoning: isReasoning)
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

                    MarkdownInlineTextView(text: item.text, isReasoning: isReasoning)
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

            MarkdownInlineTextView(text: text, isReasoning: isReasoning)
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
                        MarkdownInlineTextView(
                            text: header,
                            isReasoning: isReasoning,
                            baseFont: .system(size: isReasoning ? 10 : 12, weight: .semibold),
                            baseFontSize: isReasoning ? 10 : 12
                        )
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
                            MarkdownInlineTextView(
                                text: cell,
                                isReasoning: isReasoning,
                                baseFont: .system(size: isReasoning ? 10 : 12),
                                baseFontSize: isReasoning ? 10 : 12
                            )
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

// MARK: - Inline Markdown & File Link Formatting

struct InlineFileDetection {
    let cleanPath: String
    let fileName: String
    let lineRange: String?
}

@MainActor
enum InlineFileDetector {
    private static let knownExtensionlessFiles: Set<String> = [
        "dockerfile", "containerfile", "makefile", "gnumakefile", "justfile",
        "procfile", "gemfile", "rakefile", "brewfile", "vagrantfile", "tiltfile",
        "caddyfile", "jenkinsfile", "fastfile", "podfile", "cartfile", "artisan",
        "gradlew", "mvnw", "license", "licence", "copying", "readme", "changelog",
        "contributing", "security", "code_of_conduct", "cargo.lock", "bun.lock",
        "yarn.lock", "package-lock.json", "pnpm-lock.yaml", "poetry.lock"
    ]

    private static let trailingLineRegex = try? NSRegularExpression(
        pattern: #"(?::|#L?)(\d+)(?:[-–]L?(\d+))?$"#,
        options: []
    )

    static func detect(from raw: String) -> InlineFileDetection? {
        var str = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if (str.hasPrefix("\"") && str.hasSuffix("\"")) || (str.hasPrefix("'") && str.hasSuffix("'")) {
            str = String(str.dropFirst().dropLast())
        }
        guard !str.isEmpty else { return nil }

        if str.hasPrefix("http://") || str.hasPrefix("https://") {
            return nil
        }

        // Avoid method calls / expressions like .equatable(), foo(), bar()
        if str.hasSuffix("()") || str.hasSuffix(")") || str.hasSuffix("]") || str.hasSuffix("}") {
            return nil
        }

        var isExplicitFile = false
        if str.hasPrefix("file://") {
            isExplicitFile = true
            str = String(str.dropFirst(7))
            if str.hasPrefix("///") {
                str = String(str.dropFirst(2))
            }
        }

        var lineRange: String? = nil
        var withoutLine = str
        let nsStr = str as NSString
        let fullRange = NSRange(location: 0, length: nsStr.length)
        if let regex = trailingLineRegex, let match = regex.firstMatch(in: str, options: [], range: fullRange) {
            if let matchRange = Range(match.range, in: str) {
                let startRange = match.range(at: 1)
                let endRange = match.range(at: 2)
                let start = (startRange.location != NSNotFound) ? nsStr.substring(with: startRange) : ""
                let end = (endRange.location != NSNotFound) ? nsStr.substring(with: endRange) : ""
                if !start.isEmpty {
                    lineRange = end.isEmpty ? ":\(start)" : ":\(start)-\(end)"
                }
                withoutLine = String(str[..<matchRange.lowerBound])
            }
        }

        // Handle query params like ?line=10 or ?line=10&end=20
        if let qIdx = withoutLine.firstIndex(of: "?") {
            let queryStr = String(withoutLine[withoutLine.index(after: qIdx)...])
            withoutLine = String(withoutLine[..<qIdx])
            if lineRange == nil {
                if let qRegex = try? NSRegularExpression(pattern: #"(?:line|L)=(\d+)(?:&(?:end|to)=(\d+))?"#, options: [.caseInsensitive]),
                   let qMatch = qRegex.firstMatch(in: queryStr, options: [], range: NSRange(location: 0, length: queryStr.utf16.count)) {
                    let startRange = qMatch.range(at: 1)
                    let endRange = qMatch.range(at: 2)
                    let nsQ = queryStr as NSString
                    let start = (startRange.location != NSNotFound) ? nsQ.substring(with: startRange) : ""
                    let end = (endRange.location != NSNotFound) ? nsQ.substring(with: endRange) : ""
                    if !start.isEmpty {
                        lineRange = end.isEmpty ? ":\(start)" : ":\(start)-\(end)"
                    }
                }
            }
        }

        let baseName = withoutLine.split(whereSeparator: { $0 == "/" || $0 == "\\" }).last.map(String.init) ?? withoutLine
        guard !baseName.isEmpty else { return nil }
        let lowerName = baseName.lowercased()

        var isFile = isExplicitFile

        if !isFile {
            if knownExtensionlessFiles.contains(lowerName) {
                isFile = true
            } else if baseName.hasPrefix(".") && baseName.count > 1 && !baseName.hasSuffix(".") {
                let ext = String(baseName.dropFirst()).lowercased()
                if ["gitignore", "gitattributes", "editorconfig", "env", "npmrc", "dockerignore", "prettierrc", "eslintrc"].contains(ext) {
                    isFile = true
                }
            } else if baseName.range(of: #"\.[a-zA-Z0-9_-]{1,10}$"#, options: .regularExpression) != nil {
                if !lowerName.allSatisfy({ $0.isNumber || $0 == "." }) && !lowerName.contains("()") {
                    isFile = true
                }
            } else if (str.hasPrefix("./") || str.hasPrefix("../") || str.hasPrefix("/") || str.contains("/")) &&
                        !str.contains(" ") &&
                        str.count > 2 {
                isFile = true
            } else {
                let resolved = FileIconResolver.shared.resolve(fileName: baseName)
                if resolved != "default_file" {
                    isFile = true
                }
            }
        }

        guard isFile else { return nil }

        return InlineFileDetection(
            cleanPath: withoutLine,
            fileName: baseName,
            lineRange: lineRange
        )
    }
}

@MainActor
final class FileIconImageCache {
    static let shared = FileIconImageCache()
    private var cache = NSCache<NSString, UIImage>()

    private init() {
        cache.countLimit = 200
    }

    func icon(for fileName: String, size: CGFloat = 13) -> UIImage? {
        let cacheKey = "\(fileName):\(Int(size * 2))" as NSString
        if let cached = cache.object(forKey: cacheKey) {
            return cached
        }

        if let img = FileIconResolver.shared.iconImage(fileName: fileName, targetSize: size) {
            cache.setObject(img, forKey: cacheKey)
            return img
        }

        let lower = fileName.lowercased()
        let sysName: String
        let tintColor: UIColor
        if lower.hasSuffix(".swift") {
            sysName = "swift"
            tintColor = .systemOrange
        } else if lower.hasSuffix(".json") || lower.hasSuffix(".toml") || lower.hasSuffix(".yaml") || lower.hasSuffix(".yml") {
            sysName = "curlybraces"
            tintColor = .systemYellow
        } else if lower.hasSuffix(".ts") || lower.hasSuffix(".tsx") || lower.hasSuffix(".js") || lower.hasSuffix(".jsx") {
            sysName = "chevron.left.forwardslash.chevron.right"
            tintColor = .systemBlue
        } else if lower.hasSuffix(".rs") {
            sysName = "gearshape.2"
            tintColor = .systemOrange
        } else if lower.hasSuffix(".py") {
            sysName = "chevron.left.forwardslash.chevron.right"
            tintColor = .systemGreen
        } else if lower.hasSuffix(".sh") || lower.hasSuffix(".bash") || lower.hasSuffix(".zsh") {
            sysName = "terminal"
            tintColor = .systemGray
        } else {
            sysName = "doc.text"
            tintColor = .secondaryLabel
        }

        let config = UIImage.SymbolConfiguration(pointSize: size * 0.85, weight: .medium)
        let sysImg = UIImage(systemName: sysName, withConfiguration: config)?
            .withTintColor(tintColor, renderingMode: .alwaysOriginal)

        let imgSize = CGSize(width: size, height: size)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 3.0
        let renderer = UIGraphicsImageRenderer(size: imgSize, format: format)
        let rasterized = renderer.image { _ in
            sysImg?.draw(in: CGRect(origin: .zero, size: imgSize))
        }.withRenderingMode(.alwaysOriginal)

        cache.setObject(rasterized, forKey: cacheKey)
        return rasterized
    }
}

final class TextWrapper: @unchecked Sendable {
    let text: Text
    init(_ text: Text) { self.text = text }
}

@MainActor
final class MarkdownInlineCache {
    static let shared = MarkdownInlineCache()
    private var cache = NSCache<NSString, TextWrapper>()

    private init() {
        cache.countLimit = 500
    }

    func get(key: String) -> Text? {
        cache.object(forKey: key as NSString)?.text
    }

    func set(key: String, text: Text) {
        cache.setObject(TextWrapper(text), forKey: key as NSString)
    }
}

fileprivate extension NSTextCheckingResult {
    func safeRange(at index: Int) -> NSRange {
        guard index >= 0 && index < numberOfRanges else {
            return NSRange(location: NSNotFound, length: 0)
        }
        return range(at: index)
    }
}

enum MarkdownTheme {
    // Web inline code color: #a3752c (light) / #e5c98d (dark)
    static let inlineCodeColor = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 229/255.0, green: 201/255.0, blue: 141/255.0, alpha: 1.0)
            : UIColor(red: 163/255.0, green: 117/255.0, blue: 44/255.0, alpha: 1.0)
    })
}

struct MarkdownInlineTextView: View {
    let text: String
    var isReasoning: Bool = false
    var baseFont: Font? = nil
    var baseFontSize: CGFloat? = nil
    var badgeColor: Color? = nil
    var foregroundColor: Color? = nil

    var body: some View {
        renderText()
    }

    @MainActor
    private func renderText() -> Text {
        let defaultSize: CGFloat = isReasoning ? 11 : 14
        let fontSize = baseFontSize ?? defaultSize
        let codeFontSize = max(10, fontSize - 1.5)
        let normalFont = baseFont ?? (isReasoning ? .system(size: 11, design: .monospaced) : .system(size: fontSize))
        let codeColor: Color = foregroundColor ?? (isReasoning ? MarkdownTheme.inlineCodeColor.opacity(0.85) : MarkdownTheme.inlineCodeColor)

        let cacheKey = "\(isReasoning ? "1" : "0"):\(fontSize):\(foregroundColor != nil ? "f" : "d"):\(text)"
        if let cached = MarkdownInlineCache.shared.get(key: cacheKey) {
            return cached
        }

        // Fast path: if no markdown formatting characters, return directly
        if !text.contains("`") && !text.contains("*") && !text.contains("_") && !text.contains("~") && !text.contains("[") && !text.contains("file://") {
            let plain = Text(text).font(normalFont)
            MarkdownInlineCache.shared.set(key: cacheKey, text: plain)
            return plain
        }

        // Autolink bare file URLs if not already enclosed
        var processedText = text
        if processedText.contains("file://") {
            processedText = processedText.replacingOccurrences(
                of: #"(?<![<(\]])(file:\/\/\/[^\s)<>]+)"#,
                with: "<$1>",
                options: .regularExpression
            )
        }

        var options = AttributedString.MarkdownParsingOptions()
        options.interpretedSyntax = .inlineOnlyPreservingWhitespace

        guard var attr = try? AttributedString(markdown: processedText, options: options) else {
            let fallback = Text(LocalizedStringKey(text)).font(normalFont)
            MarkdownInlineCache.shared.set(key: cacheKey, text: fallback)
            return fallback
        }

        // Pass 1: Apply fonts and colors across all runs
        for run in attr.runs {
            let range = run.range
            let intent = run.inlinePresentationIntent ?? []
            let isCode = intent.contains(.code)
            let isBold = intent.contains(.stronglyEmphasized)
            let isItalic = intent.contains(.emphasized)
            let isFileLink = (run.link?.scheme == "file")

            if isCode || isFileLink {
                attr[range].font = .system(
                    size: codeFontSize,
                    weight: isBold ? .bold : .regular,
                    design: .monospaced
                )
                attr[range].foregroundColor = codeColor
            } else if isBold && isItalic {
                attr[range].font = .system(size: fontSize, weight: .bold).italic()
            } else if isBold {
                attr[range].font = .system(size: fontSize, weight: .bold)
            } else if isItalic {
                attr[range].font = .system(size: fontSize).italic()
            } else {
                if isReasoning {
                    attr[range].font = .system(size: fontSize, design: .monospaced)
                } else if baseFont != nil {
                    attr[range].font = .system(size: fontSize)
                }
            }
        }

        // Pass 2: Check if any run represents a file needing an icon
        var hasFileRun = false
        for run in attr.runs {
            let content = String(attr[run.range].characters)
            if run.link?.scheme == "file" || (run.inlinePresentationIntent?.contains(.code) == true && InlineFileDetector.detect(from: content) != nil) {
                hasFileRun = true
                break
            }
        }

        if !hasFileRun {
            let res = Text(attr).font(normalFont)
            MarkdownInlineCache.shared.set(key: cacheKey, text: res)
            return res
        }

        // Pass 3: Build composite Text with file icons
        var composite: Text? = nil
        func append(_ next: Text) {
            if let cur = composite {
                composite = cur + next
            } else {
                composite = next
            }
        }

        for run in attr.runs {
            let content = String(attr[run.range].characters)
            var fileInfo: InlineFileDetection? = nil

            if let link = run.link, link.scheme == "file" {
                fileInfo = InlineFileDetector.detect(from: link.absoluteString) ?? InlineFileDetector.detect(from: content)
            } else if run.inlinePresentationIntent?.contains(.code) == true {
                fileInfo = InlineFileDetector.detect(from: content)
            }

            if let file = fileInfo,
               let icon = FileIconImageCache.shared.icon(for: file.fileName, size: codeFontSize) {
                let iconText = Text(Image(uiImage: icon).renderingMode(.original)).baselineOffset(-1.2) + Text("\u{00A0}")
                append(iconText)
            }

            append(Text(AttributedString(attr[run.range])))
        }

        let res = composite ?? Text(attr).font(normalFont)
        MarkdownInlineCache.shared.set(key: cacheKey, text: res)
        return res
    }
}
