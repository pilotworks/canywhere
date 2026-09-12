import SwiftUI
import UIKit

// MARK: - File Icon Theme Manifest

struct FileIconManifest: Decodable {
    let defaultFile: String
    let fileNames: [String: String]
    let fileExtensions: [String: String]
}

// MARK: - File Icon Resolver

@MainActor
final class FileIconResolver {
    static let shared = FileIconResolver()

    private var manifest: FileIconManifest?
    private var resolveCache: [String: String] = [:]

    private init() {
        loadManifest()
    }

    private func loadManifest() {
        guard let data = NSDataAsset(name: "FileIconTheme")?.data else {
            return
        }
        do {
            manifest = try JSONDecoder().decode(FileIconManifest.self, from: data)
        } catch {
            print("[FileIconResolver] Failed to decode FileIconTheme: \(error)")
        }
    }

    func resolve(fileName: String) -> String {
        let trimmed = fileName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return manifest?.defaultFile ?? "default_file"
        }

        if let cached = resolveCache[trimmed] {
            return cached
        }

        let baseName = trimmed.split(whereSeparator: { $0 == "/" || $0 == "\\" }).last.map(String.init) ?? trimmed
        let lower = baseName.lowercased()

        // 1. Exact file name match (e.g. "package.json", "dockerfile", "cargo.toml")
        if let icon = manifest?.fileNames[lower] {
            resolveCache[trimmed] = icon
            return icon
        }

        // 2. Extension match (supports compound extensions e.g. "spec.tsx", "d.ts")
        let parts = lower.split(separator: ".").map(String.init)
        if parts.count > 1 {
            for i in 1..<parts.count {
                let ext = parts[i..<parts.count].joined(separator: ".")
                if let icon = manifest?.fileExtensions[ext] {
                    resolveCache[trimmed] = icon
                    return icon
                }
            }
        }

        // 3. Check stem as extension (e.g. "makefile")
        if let icon = manifest?.fileExtensions[lower] {
            resolveCache[trimmed] = icon
            return icon
        }

        let fallback = manifest?.defaultFile ?? "default_file"
        resolveCache[trimmed] = fallback
        return fallback
    }

    func resolveLanguage(_ language: String) -> String {
        let trimmed = language.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty, trimmed != "code", trimmed != "text", trimmed != "txt" else {
            return manifest?.defaultFile ?? "default_file"
        }

        let langMap: [String: String] = [
            "ts": "ts", "typescript": "ts", "tsx": "tsx",
            "js": "js", "javascript": "js", "jsx": "jsx",
            "py": "py", "python": "py",
            "rs": "rs", "rust": "rs",
            "swift": "swift",
            "sh": "sh", "bash": "sh", "zsh": "sh", "shell": "sh",
            "json": "json", "yaml": "yaml", "yml": "yaml", "toml": "toml",
            "md": "md", "markdown": "md",
            "sql": "sql",
            "html": "html", "css": "css", "scss": "scss",
            "go": "go", "golang": "go",
            "c": "c", "cpp": "cpp", "c++": "cpp", "h": "c", "hpp": "cpp",
            "diff": "diff", "patch": "diff",
            "dockerfile": "dockerfile", "makefile": "makefile"
        ]

        let ext = langMap[trimmed] ?? trimmed
        return resolve(fileName: "file.\(ext)")
    }

    private var imageCache: [String: UIImage] = [:]

    func iconImage(fileName: String, targetSize: CGFloat = 13) -> UIImage? {
        let iconName = resolve(fileName: fileName)
        return loadResizedImage(named: iconName, targetSize: targetSize)
    }

    func iconImage(language: String, targetSize: CGFloat = 13) -> UIImage? {
        let iconName = resolveLanguage(language)
        return loadResizedImage(named: iconName, targetSize: targetSize)
    }

    private func loadResizedImage(named name: String, targetSize: CGFloat) -> UIImage? {
        let cacheKey = "\(name):\(Int(targetSize * 2))"
        if let cached = imageCache[cacheKey] {
            return cached
        }

        guard let original = UIImage(named: name) else {
            return nil
        }

        let size = CGSize(width: targetSize, height: targetSize)
        let format = UIGraphicsImageRendererFormat.default()
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let resized = renderer.image { _ in
            original.draw(in: CGRect(origin: .zero, size: size))
        }.withRenderingMode(.alwaysOriginal)

        imageCache[cacheKey] = resized
        return resized
    }
}

// MARK: - SwiftUI FileIconView

struct FileIconView: View {
    let iconName: String
    var size: CGFloat = 14
    var fallbackSystemName: String = "doc.text"

    init(fileName: String, size: CGFloat = 14, fallbackSystemName: String = "doc.text") {
        self.iconName = FileIconResolver.shared.resolve(fileName: fileName)
        self.size = size
        self.fallbackSystemName = fallbackSystemName
    }

    init(language: String, size: CGFloat = 14, fallbackSystemName: String = "chevron.left.forwardslash.chevron.right") {
        self.iconName = FileIconResolver.shared.resolveLanguage(language)
        self.size = size
        self.fallbackSystemName = fallbackSystemName
    }

    init(resolvedIconName: String, size: CGFloat = 14, fallbackSystemName: String = "doc.text") {
        self.iconName = resolvedIconName
        self.size = size
        self.fallbackSystemName = fallbackSystemName
    }

    var body: some View {
        if let uiImage = UIImage(named: iconName) {
            Image(uiImage: uiImage)
                .renderingMode(.original)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
        } else {
            Image(systemName: fallbackSystemName)
                .font(.system(size: size * 0.85))
                .foregroundStyle(.secondary)
                .frame(width: size, height: size)
        }
    }
}
