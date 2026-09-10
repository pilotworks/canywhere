import { createHighlighter, type Highlighter, type ThemedToken } from "shiki";

export interface CodeToken {
  content: string;
  color?: string;
  fontStyle?: number;
}

const CORE_THEMES = ["github-dark", "github-light"] as const;

const CORE_LANGUAGES = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "rust",
  "python",
  "go",
  "json",
  "toml",
  "yaml",
  "markdown",
  "bash",
  "css",
  "html",
  "sql",
  "dockerfile",
] as const;

const EXTENSION_TO_LANG: Record<string, string> = {
  typescript: "typescript",
  javascript: "javascript",
  rust: "rust",
  python: "python",
  python3: "python",
  shell: "bash",
  ruby: "ruby",
  kotlin: "kotlin",
  golang: "go",
  csharp: "csharp",
  cs: "csharp",
  "c++": "cpp",
  docker: "dockerfile",
  make: "makefile",
  makefile: "makefile",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  rs: "rust",
  py: "python",
  go: "go",
  json: "json",
  jsonc: "json",
  toml: "toml",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  markdown: "markdown",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  rb: "ruby",
  php: "php",
  lua: "lua",
  diff: "diff",
  patch: "diff",
  xml: "xml",
  svg: "xml",
  graphql: "graphql",
  gql: "graphql",
  proto: "protobuf",
};

const FILENAME_TO_LANG: Record<string, string> = {
  dockerfile: "dockerfile",
  containerfile: "dockerfile",
  makefile: "makefile",
  gnumakefile: "makefile",
  justfile: "makefile",
  gemfile: "ruby",
  rakefile: "ruby",
  brewfile: "ruby",
  podfile: "ruby",
  "cargo.lock": "toml",
  "bun.lock": "json",
  "package.json": "json",
  "tsconfig.json": "json",
  ".gitignore": "bash",
  ".env": "bash",
  ".bashrc": "bash",
  ".zshrc": "bash",
  ".profile": "bash",
};

const LANG_DISPLAY_NAMES: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  tsx: "TSX",
  jsx: "JSX",
  rust: "Rust",
  python: "Python",
  go: "Go",
  json: "JSON",
  toml: "TOML",
  yaml: "YAML",
  markdown: "Markdown",
  bash: "Shell",
  css: "CSS",
  scss: "SCSS",
  less: "Less",
  html: "HTML",
  sql: "SQL",
  swift: "Swift",
  c: "C",
  cpp: "C++",
  java: "Java",
  kotlin: "Kotlin",
  ruby: "Ruby",
  php: "PHP",
  lua: "Lua",
  dockerfile: "Dockerfile",
  makefile: "Makefile",
  xml: "XML",
  graphql: "GraphQL",
  protobuf: "Protobuf",
  diff: "Diff",
};

/**
 * Resolves the language identifier for Shiki based on a file path or language name.
 */
export function detectLanguage(filePath: string): string {
  if (!filePath) return "text";
  const baseName = filePath.split(/[/\\]/).pop() || filePath;
  const lowerBase = baseName.toLowerCase().trim();

  // 1. Direct language name or alias match
  if (EXTENSION_TO_LANG[lowerBase]) {
    return EXTENSION_TO_LANG[lowerBase];
  }

  // 2. Check exact filename match
  if (FILENAME_TO_LANG[lowerBase]) {
    return FILENAME_TO_LANG[lowerBase];
  }

  // 3. Check extension match (supports multi-part e.g. .d.ts)
  const parts = lowerBase.split(".");
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join(".");
    if (EXTENSION_TO_LANG[ext]) {
      return EXTENSION_TO_LANG[ext];
    }
  }

  // 4. Check single extension
  const singleExt = parts[parts.length - 1];
  if (singleExt && EXTENSION_TO_LANG[singleExt]) {
    return EXTENSION_TO_LANG[singleExt];
  }

  return "text";
}

/**
 * Returns a human-friendly display name for the language (e.g. "TypeScript", "Rust").
 */
export function getLanguageLabel(lang: string): string {
  return LANG_DISPLAY_NAMES[lang] || lang.toUpperCase();
}

let highlighterPromise: Promise<Highlighter> | null = null;

export function getHighlighterInstance(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [...CORE_THEMES],
      langs: [...CORE_LANGUAGES],
    });
  }
  return highlighterPromise;
}

/**
 * Tokenizes code into syntax-colored tokens using Shiki.
 * If language is not preloaded, dynamically loads it on the fly.
 */
export async function tokenizeCode(
  code: string,
  lang: string,
  theme: "light" | "dark"
): Promise<CodeToken[][] | null> {
  try {
    const highlighter = await getHighlighterInstance();
    const themeName = theme === "dark" ? "github-dark" : "github-light";

    const resolved = detectLanguage(lang);
    const targetLang = resolved !== "text" ? resolved : (lang || "text");

    // Load language if not yet available
    if (targetLang !== "text" && !highlighter.getLoadedLanguages().includes(targetLang)) {
      try {
        await highlighter.loadLanguage(targetLang as any);
      } catch (err) {
        console.warn(`[Shiki] Could not load language ${targetLang}, falling back to plain text`, err);
      }
    }

    const effectiveLang = highlighter.getLoadedLanguages().includes(targetLang) ? targetLang : "text";
    const result = highlighter.codeToTokens(code, {
      lang: effectiveLang as any,
      theme: themeName,
    });

    return result.tokens.map((lineTokens: ThemedToken[]) =>
      lineTokens.map((t: ThemedToken) => ({
        content: t.content,
        color: t.color,
        fontStyle: t.fontStyle,
      }))
    );
  } catch (err) {
    console.error("[Shiki] Tokenization failed:", err);
    return null;
  }
}
