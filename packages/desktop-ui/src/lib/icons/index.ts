import themeData from "./theme-manifest.json";

export interface IconThemeManifest {
  defaultFile: string;
  defaultFolder: string;
  defaultFolderOpened: string;
  fileNames: Record<string, string>;
  fileExtensions: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesOpened: Record<string, string>;
}

const theme: IconThemeManifest = themeData as IconThemeManifest;

/**
 * Resolves the SVG icon filename for a given file name or path.
 * e.g. "App.tsx" -> "file_type_reactts.svg"
 *      "main.rs"  -> "file_type_rust.svg"
 *      "Dockerfile" -> "file_type_docker.svg"
 */
export function resolveFileIcon(fileName: string): string {
  if (!fileName) return theme.defaultFile;

  // Strip path prefixes if full path was given
  const baseName = fileName.split(/[/\\]/).pop() || fileName;
  const lower = baseName.toLowerCase();

  // 1. Exact file name match (e.g. "package.json", "dockerfile", "cargo.toml")
  if (theme.fileNames[lower]) {
    return theme.fileNames[lower];
  }

  // 2. Extension match (supports multi-part extensions e.g. "spec.tsx", "d.ts", "test.js")
  const parts = lower.split(".");
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join(".");
    if (theme.fileExtensions[ext]) {
      return theme.fileExtensions[ext];
    }
  }

  // 3. Check stem as extension (e.g. "makefile")
  if (theme.fileExtensions[lower]) {
    return theme.fileExtensions[lower];
  }

  return theme.defaultFile;
}

/**
 * Resolves the SVG icon filename for a folder name or path.
 * e.g. "src" (closed) -> "folder_type_src.svg"
 *      "src" (open)   -> "folder_type_src_opened.svg"
 */
export function resolveFolderIcon(folderName: string, isOpen: boolean = false): string {
  if (!folderName) {
    return isOpen ? theme.defaultFolderOpened : theme.defaultFolder;
  }

  const baseName = folderName.split(/[/\\]/).pop() || folderName;
  const lower = baseName.toLowerCase();

  if (isOpen && theme.folderNamesOpened[lower]) {
    return theme.folderNamesOpened[lower];
  }
  if (!isOpen && theme.folderNames[lower]) {
    return theme.folderNames[lower];
  }

  return isOpen ? theme.defaultFolderOpened : theme.defaultFolder;
}

/**
 * Computes the public asset URL for an icon SVG file.
 */
export function getIconUrl(iconFileName: string): string {
  const base = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}icons/${iconFileName}`;
}
