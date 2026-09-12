import { client } from "../network/client.js";
import { useUiStore, useWorkspaceStore, useChatStore } from "../store/index.js";
import themeData from "./icons/theme-manifest.json";

export interface LineRange {
  start: number;
  end?: number;
}

export interface ParsedFileLink {
  isFile: boolean;
  originalHref: string;
  cleanPath: string; // decoded, without file://, query, or line hashes
  fileName: string;
  lineRange?: LineRange;
}

const KNOWN_EXTENSIONLESS_FILES = new Set([
  // Build systems, task runners & containers
  "dockerfile",
  "containerfile",
  "makefile",
  "gnumakefile",
  "kbuild",
  "justfile",
  "procfile",
  "gemfile",
  "rakefile",
  "brewfile",
  "vagrantfile",
  "tiltfile",
  "earthfile",
  "caddyfile",
  "jenkinsfile",
  "fastfile",
  "appfile",
  "matchfile",
  "deliverfile",
  "gymfile",
  "scanfile",
  "snapfile",
  "podfile",
  "cartfile",
  "capfile",
  "berksfile",
  "thorfile",
  "guardfile",
  "snakefile",
  "nextflow",
  "build",
  "workspace",
  "module",
  "buck",
  "sublime-project",

  // CLI binaries, scripts & package managers
  "artisan",
  "gradlew",
  "mvnw",
  "rebar",
  "rebar3",
  "alembic",
  "pipfile",

  // Documentation, licenses & project root metadata
  "license",
  "licence",
  "copying",
  "copyright",
  "unlicense",
  "readme",
  "changelog",
  "changes",
  "contributing",
  "authors",
  "contributors",
  "patents",
  "notice",
  "version",
  "todo",
  "code_of_conduct",
  "security",
  "roadmap",
  "history",
  "release",
  "faq",
  "install",
  "news",
  "thanks",
  "maintainers",

  // Lockfiles
  "cargo.lock",
  "bun.lock",
  "bun.lockb",
  "yarn.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "pipfile.lock",
  "composer.lock",
  "gemfile.lock",
  "flake.lock",

  // Common root dotfiles
  ".gitignore",
  ".gitattributes",
  ".gitmodules",
  ".gitkeep",
  ".gitconfig",
  ".editorconfig",
  ".dockerignore",
  ".containerignore",
  ".gcloudignore",
  ".npmignore",
  ".eslintignore",
  ".prettierignore",
  ".stylelintignore",
  ".vercelignore",
  ".bashrc",
  ".zshrc",
  ".profile",
  ".bash_profile",
  ".bash_aliases",
  ".zprofile",
  ".zshenv",
  ".zlogin",
  ".zlogout",
  ".npmrc",
  ".yarnrc",
  ".nvmrc",
  ".node-version",
  ".ruby-version",
  ".python-version",
  ".go-version",
  ".tool-versions",
  ".clang-format",
  ".clang-tidy",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.staging",
  ".env.test",
  ".env.example",
  ".env.defaults",
]);

/**
 * Detects if a URL or href leads to a local file, and extracts metadata.
 */
export function parseFileLink(href?: string | null): ParsedFileLink | null {
  if (!href || typeof href !== "string") return null;

  const trimmed = href.trim();
  if (!trimmed) return null;

  // Reject external web protocols and non-file schemes
  if (/^(https?:\/\/|mailto:|javascript:|tel:|data:|conversation:\/\/)/i.test(trimmed)) {
    return null;
  }

  // Reject pure in-page hash anchors (e.g. #summary, #heading-1)
  if (trimmed.startsWith("#")) {
    return null;
  }

  let raw = trimmed;
  let isExplicitFile = false;

  if (/^file:\/\//i.test(raw)) {
    isExplicitFile = true;
    raw = raw.replace(/^file:\/\//i, "");
    // If Windows path like /C:/Users/..., strip the leading slash
    if (/^\/[a-zA-Z]:[/\\]/.test(raw)) {
      raw = raw.slice(1);
    }
  }

  try {
    raw = decodeURIComponent(raw);
  } catch {}

  // 1. Extract hash line numbers (#L10-L20, #L10-20, #L10, #10-20, #10)
  let lineRange: LineRange | undefined;
  const hashIdx = raw.indexOf("#");
  let withoutHash = raw;
  if (hashIdx !== -1) {
    const hash = raw.slice(hashIdx + 1);
    withoutHash = raw.slice(0, hashIdx);

    const m = hash.match(/^L?(\d+)(?:[-–]L?(\d+))?$/i);
    if (m) {
      const start = parseInt(m[1], 10);
      let end = m[2] ? parseInt(m[2], 10) : undefined;
      if (end === start) {
        end = undefined;
      }
      if (!isNaN(start)) {
        lineRange = { start, end };
      }
    }
  }

  // 2. Extract query params (?line=10&end=20)
  const qIdx = withoutHash.indexOf("?");
  let withoutQuery = withoutHash;
  if (qIdx !== -1) {
    const queryStr = withoutHash.slice(qIdx + 1);
    withoutQuery = withoutHash.slice(0, qIdx);
    if (!lineRange) {
      const lineMatch = queryStr.match(/(?:line|L)=(\d+)(?:&(?:end|to)=(\d+))?/i);
      if (lineMatch) {
        const start = parseInt(lineMatch[1], 10);
        let end = lineMatch[2] ? parseInt(lineMatch[2], 10) : undefined;
        if (end === start) {
          end = undefined;
        }
        if (!isNaN(start)) {
          lineRange = { start, end };
        }
      }
    }
  }

  // 3. Extract trailing colon line numbers (e.g. path/to/file.ts:15 or :15:5 or :15-20)
  const colonMatch = withoutQuery.match(/:(\d+)(?:[-–](\d+)|:(\d+))?$/);
  let cleanPath = withoutQuery;
  if (colonMatch) {
    if (!lineRange) {
      const start = parseInt(colonMatch[1], 10);
      let end = colonMatch[2] ? parseInt(colonMatch[2], 10) : undefined;
      if (end === start) {
        end = undefined;
      }
      if (!isNaN(start)) {
        lineRange = { start, end };
      }
    }
    cleanPath = withoutQuery.slice(0, colonMatch.index);
  }

  // Extract base filename
  const parts = cleanPath.split(/[/\\]/);
  const fileName = parts[parts.length - 1] || cleanPath;

  if (!fileName) return null;

  if (isExplicitFile) {
    return {
      isFile: true,
      originalHref: trimmed,
      cleanPath,
      fileName,
      lineRange,
    };
  }

  const lowerName = fileName.toLowerCase();

  // 1. Check VS Code Material icon database of known filenames (hundreds of exact project files)
  if ((themeData.fileNames as Record<string, string>)[lowerName]) {
    return {
      isFile: true,
      originalHref: trimmed,
      cleanPath,
      fileName,
      lineRange,
    };
  }

  // 2. Check comprehensive extensionless files set
  if (KNOWN_EXTENSIONLESS_FILES.has(lowerName)) {
    return {
      isFile: true,
      originalHref: trimmed,
      cleanPath,
      fileName,
      lineRange,
    };
  }

  // 3. Any dotfile (e.g. .npmrc, .zshrc, .env.staging, .dockerignore, etc.)
  if (fileName.startsWith(".") && fileName.length > 1 && fileName !== ".." && !fileName.endsWith(".")) {
    return {
      isFile: true,
      originalHref: trimmed,
      cleanPath,
      fileName,
      lineRange,
    };
  }

  // 4. Check file extension (e.g. .ts, .tsx, .js, .rs, .md, .json, .toml, .py, etc.)
  const hasExt = /\.[a-zA-Z0-9_-]{1,10}$/.test(fileName);
  if (hasExt) {
    return {
      isFile: true,
      originalHref: trimmed,
      cleanPath,
      fileName,
      lineRange,
    };
  }

  // 5. Explicit relative/absolute path or script/binary directory path
  if (
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("/") ||
    /^(bin|scripts|tools|cmd|pkg|src|internal)\//i.test(cleanPath)
  ) {
    return {
      isFile: true,
      originalHref: trimmed,
      cleanPath,
      fileName,
      lineRange,
    };
  }

  return null;
}

/**
 * Resolves a file link against active workspaces, fetches its content, and opens it
 * in the right sidebar's File Preview tab.
 */
export async function openFileInRightSidebar(linkInfo: ParsedFileLink): Promise<void> {
  const workspaces = useWorkspaceStore.getState().workspaces;
  const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  const activeChatId = useChatStore.getState().activeChatId;
  const chats = useChatStore.getState().chats;
  const activeChat = chats.find((c) => c.id === activeChatId);
  const currentWsId = activeChat ? activeChat.workspaceId : activeWorkspaceId;

  let targetWorkspace = workspaces.find((w) => w.id === currentWsId) || workspaces[0];
  let relativePath = linkInfo.cleanPath;

  // If path is absolute, check if it matches any workspace root path
  for (const ws of workspaces) {
    if (ws.rootPath && (relativePath.startsWith(ws.rootPath + "/") || relativePath === ws.rootPath)) {
      targetWorkspace = ws;
      relativePath = relativePath.slice(ws.rootPath.length).replace(/^[/\\]+/, "");
      break;
    }
  }

  // Also check if relativePath is prefixed by targetWorkspace.rootPath
  if (targetWorkspace?.rootPath && relativePath.startsWith(targetWorkspace.rootPath)) {
    relativePath = relativePath.slice(targetWorkspace.rootPath.length).replace(/^[/\\]+/, "");
  }

  // Ensure relativePath has no leading slashes
  relativePath = relativePath.replace(/^[/\\]+/, "");

  const tabId = `file:${relativePath || linkInfo.fileName}`;
  const openOrFocusTab = useUiStore.getState().openOrFocusTab;
  const tabs = useUiStore.getState().rightSidebarTabs;
  const existingTab = tabs.find((t) => t.id === tabId);

  // If tab is already open with content, switch to it immediately and update highlight
  if (existingTab && existingTab.data?.content) {
    openOrFocusTab({
      id: tabId,
      type: "filePreview",
      title: linkInfo.fileName,
      data: {
        ...existingTab.data,
        highlightLine: linkInfo.lineRange,
      },
    });
    return;
  }

  // Open right sidebar immediately with loading state
  openOrFocusTab({
    id: tabId,
    type: "filePreview",
    title: linkInfo.fileName,
    data: {
      workspaceId: targetWorkspace?.id,
      path: relativePath,
      loading: true,
      highlightLine: linkInfo.lineRange,
    },
  });

  if (!targetWorkspace) {
    openOrFocusTab({
      id: tabId,
      type: "filePreview",
      title: linkInfo.fileName,
      data: {
        error: "No active workspace found to read this file",
        loading: false,
      },
    });
    return;
  }

  try {
    let fileData: { path: string; content: string; size: number };
    try {
      fileData = await client.readWorkspaceFile(targetWorkspace.id, relativePath);
    } catch (firstErr) {
      // If direct relative path fails, try searching for the file name in the workspace
      try {
        const searchRes = await client.searchWorkspaceFiles(targetWorkspace.id, linkInfo.fileName);
        const match = searchRes.files.find(
          (f) => f.path.endsWith("/" + linkInfo.fileName) || f.path === linkInfo.fileName || f.path.includes(relativePath)
        );
        if (match) {
          fileData = await client.readWorkspaceFile(targetWorkspace.id, match.path);
          relativePath = match.path;
        } else {
          throw firstErr;
        }
      } catch {
        throw firstErr;
      }
    }

    openOrFocusTab({
      id: tabId,
      type: "filePreview",
      title: linkInfo.fileName,
      data: {
        workspaceId: targetWorkspace.id,
        path: fileData.path,
        content: fileData.content,
        loading: false,
        highlightLine: linkInfo.lineRange,
      },
    });
  } catch (err: any) {
    console.error("Failed to read file for preview:", err);
    openOrFocusTab({
      id: tabId,
      type: "filePreview",
      title: linkInfo.fileName,
      data: {
        workspaceId: targetWorkspace.id,
        path: relativePath,
        loading: false,
        error: err?.message || "Failed to load file contents",
      },
    });
  }
}

/**
 * Opens a file diff patch in the right sidebar's Diff tab.
 */
export async function openDiffInRightSidebar(opts: {
  filePath: string;
  patch?: string;
}): Promise<void> {
  const cleanPath = opts.filePath.replace(/^file:\/\//, "").replace(/\\/g, "/");
  const fileName = cleanPath.split("/").pop() || cleanPath;
  const tabId = `diff:${cleanPath}`;

  const workspaces = useWorkspaceStore.getState().workspaces;
  const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  const activeChatId = useChatStore.getState().activeChatId;
  const chats = useChatStore.getState().chats;
  const activeChat = chats.find((c) => c.id === activeChatId);
  const currentWsId = activeChat ? activeChat.workspaceId : activeWorkspaceId;
  const targetWorkspace = workspaces.find((w) => w.id === currentWsId) || workspaces[0];

  let patch = opts.patch;

  if (!patch && targetWorkspace) {
    let relativePath = cleanPath;
    if (targetWorkspace.rootPath && relativePath.startsWith(targetWorkspace.rootPath)) {
      relativePath = relativePath.slice(targetWorkspace.rootPath.length).replace(/^[/\\]+/, "");
    }
    relativePath = relativePath.replace(/^[/\\]+/, "");
    try {
      const res = await client.gitDiff(targetWorkspace.id, relativePath, false);
      if (res?.diff) {
        patch = res.diff;
      }
    } catch (err) {
      console.warn("Could not fetch git diff for file preview", err);
    }
  }

  useUiStore.getState().openOrFocusTab({
    id: tabId,
    type: "diff",
    title: `${fileName} (Diff)`,
    data: {
      patch: patch || "",
      filePath: cleanPath,
      path: cleanPath,
      workspaceId: targetWorkspace?.id,
    },
  });
}
