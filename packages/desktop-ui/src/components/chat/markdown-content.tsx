import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { FileIcon } from "../ui/file-icon.js";
import { parseFileLink, openFileInRightSidebar } from "../../lib/file-link.js";
import { detectLanguage, tokenizeCode, type CodeToken } from "../../lib/shiki.js";
import { useThemeStore } from "../../store/theme-store.js";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

const MAX_CODE_BLOCK_LINES = 24;

const PreContext = createContext(false);

const PreBlock: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return <PreContext.Provider value={true}>{children}</PreContext.Provider>;
};

const LANG_TO_EXT: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
  rust: "rs",
  bash: "sh",
  shell: "sh",
  zsh: "sh",
  csharp: "cs",
  ruby: "rb",
  kotlin: "kt",
  golang: "go",
  markdown: "md",
  dockerfile: "dockerfile",
  makefile: "makefile",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  sql: "sql",
  swift: "swift",
  cpp: "cpp",
  c: "c",
  diff: "diff",
  patch: "diff",
  xml: "xml",
  graphql: "graphql",
};

const CodeBlock: React.FC<{
  className?: string;
  children?: React.ReactNode;
  node?: any;
}> = ({ className, children, node, ...props }) => {
  const isBlock = useContext(PreContext);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [tokens, setTokens] = useState<CodeToken[][] | null>(null);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  const match = /language-([a-zA-Z0-9_+-]+)/.exec(className || "");
  const rawLang = match ? match[1] : "";

  const codeString = useMemo(() => {
    function extractText(n: React.ReactNode): string {
      if (typeof n === "string") return n;
      if (typeof n === "number") return String(n);
      if (Array.isArray(n)) return n.map(extractText).join("");
      if (React.isValidElement(n) && (n.props as any)?.children) {
        return extractText((n.props as any).children);
      }
      return "";
    }
    const extracted = extractText(children) || (typeof children === "string" ? children : "");
    return extracted.replace(/\n$/, "");
  }, [children]);

  const lines = useMemo(() => {
    return codeString ? codeString.split("\n") : [];
  }, [codeString]);

  const totalLines = lines.length;
  const isLong = totalLines > MAX_CODE_BLOCK_LINES;

  const detectedLang = useMemo(() => {
    if (!rawLang) return "text";
    return detectLanguage(rawLang);
  }, [rawLang]);

  useEffect(() => {
    let active = true;
    if (!isBlock || !codeString || detectedLang === "text") {
      setTokens(null);
      return;
    }
    tokenizeCode(codeString, detectedLang, resolvedTheme).then((res) => {
      if (active) {
        setTokens(res);
      }
    });
    return () => {
      active = false;
    };
  }, [isBlock, codeString, detectedLang, resolvedTheme]);

  if (!isBlock) {
    return (
      <code
        className="font-mono text-[12px] text-[#a3752c] dark:text-[#e5c98d] font-normal inline align-baseline"
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const displayLang = rawLang || (detectedLang !== "text" ? detectedLang : "code");

  const iconFileName = useMemo(() => {
    if (!detectedLang || detectedLang === "text" || detectedLang === "code") {
      return "default_file.svg";
    }
    const ext = LANG_TO_EXT[detectedLang] || detectedLang;
    return `file.${ext}`;
  }, [detectedLang]);

  const displayedTokens = useMemo(() => {
    if (!tokens) return null;
    if (isLong && !isExpanded) {
      return tokens.slice(0, MAX_CODE_BLOCK_LINES);
    }
    return tokens;
  }, [tokens, isLong, isExpanded]);

  const displayedChildren = useMemo(() => {
    if (isLong && !isExpanded) {
      return lines.slice(0, MAX_CODE_BLOCK_LINES).join("\n");
    }
    return children;
  }, [isLong, isExpanded, lines, children]);

  return (
    <div className="relative my-2.5 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] overflow-hidden font-mono text-xs shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 border-b border-[var(--code-border)] text-[var(--muted-foreground)] select-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileIcon
            fileName={iconFileName}
            className="w-3.5 h-3.5 inline-block shrink-0 pointer-events-none"
          />
          <span className="text-[11px] font-mono font-medium lowercase tracking-wider text-[var(--muted-foreground)] truncate">
            {displayLang}
          </span>
          {isLong && (
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] opacity-60">
              ({totalLines} lines)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isLong && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 hover:text-[var(--foreground)] p-1 rounded transition-colors cursor-pointer text-[10px] text-[var(--muted-foreground)]"
              title={isExpanded ? "Collapse code" : "Expand code"}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Expand</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-[var(--foreground)] p-1 rounded transition-colors cursor-pointer text-[10px]"
            title="Copy snippet"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[12px] leading-relaxed text-[var(--foreground)] select-text">
        {displayedTokens && displayedTokens.length > 0 ? (
          <code>
            {displayedTokens.map((lineTokens, lineIdx) => (
              <React.Fragment key={lineIdx}>
                {lineTokens.map((tok, tokIdx) => (
                  <span
                    key={tokIdx}
                    style={{
                      color: tok.color,
                      fontStyle: tok.fontStyle === 1 ? "italic" : undefined,
                      fontWeight: tok.fontStyle === 2 ? "bold" : undefined,
                    }}
                  >
                    {tok.content}
                  </span>
                ))}
                {lineIdx < displayedTokens.length - 1 ? "\n" : ""}
              </React.Fragment>
            ))}
          </code>
        ) : (
          <code>{displayedChildren}</code>
        )}
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[var(--secondary)]/60 hover:bg-[var(--secondary)] border-t border-[var(--code-border)] text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer select-none font-mono"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Collapse code ({totalLines} lines)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Expand code (+{totalLines - MAX_CODE_BLOCK_LINES} more lines)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

const MarkdownLink: React.FC<{
  href?: string;
  children?: React.ReactNode;
}> = ({ href, children }) => {
  const fileLinkInfo = parseFileLink(href);

  if (fileLinkInfo) {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openFileInRightSidebar(fileLinkInfo);
    };

    const titleText = `Preview ${fileLinkInfo.cleanPath}${
      fileLinkInfo.lineRange
        ? ` (line ${fileLinkInfo.lineRange.start}${
            fileLinkInfo.lineRange.end ? `-${fileLinkInfo.lineRange.end}` : ""
          })`
        : ""
    } in right sidebar`;

    const childrenStr = typeof children === "string" ? children : "";
    const hasLineNumber =
      Boolean(fileLinkInfo.lineRange) &&
      (childrenStr.includes(":" + fileLinkInfo.lineRange?.start) ||
        childrenStr.includes("#L" + fileLinkInfo.lineRange?.start));

    return (
      <a
        href={href}
        onClick={handleClick}
        className="inline rounded px-1 py-0.5 font-mono text-[12.5px] text-[var(--foreground)] hover:bg-[var(--secondary)] dark:hover:bg-white/10 transition-colors cursor-pointer group no-underline align-baseline"
        title={titleText}
      >
        <FileIcon
          fileName={fileLinkInfo.fileName}
          className="w-3.5 h-3.5 inline-block mr-1 align-[-0.18em] shrink-0 pointer-events-none"
        />
        <span>
          {children}
        </span>
        {fileLinkInfo.lineRange && !hasLineNumber && (
          <span className="text-[11px] text-[var(--muted-foreground)] opacity-75 font-mono">
            :{fileLinkInfo.lineRange.start}
            {fileLinkInfo.lineRange.end ? `-${fileLinkInfo.lineRange.end}` : ""}
          </span>
        )}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--foreground)] underline underline-offset-4 hover:opacity-80 transition-opacity font-medium"
    >
      {children}
    </a>
  );
};

function autolinkFileUrls(text: string): string {
  if (!text || !text.includes("file://")) return text;
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(/(?<![<(\]])(file:\/\/\/[^\s)<>]+)/g, "<$1>");
    })
    .join("");
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = "" }) => {
  const processedContent = useMemo(() => autolinkFileUrls(content), [content]);

  return (
    <div className={`prose-neutral text-[13px] leading-relaxed select-text space-y-2.5 ${className}`}>
      <Markdown
        urlTransform={(url) => url}
        remarkPlugins={[remarkGfm]}
        components={{
          pre: PreBlock as any,
          code: CodeBlock as any,
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-1 my-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-1 my-1.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-semibold mt-3 mb-1 text-[var(--foreground)]">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold mt-2.5 mb-1 text-[var(--foreground)]">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-semibold mt-2 mb-1 text-[var(--foreground)]">{children}</h3>,
          strong: ({ children }) => <strong className="font-medium text-inherit">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--border)] pl-3 italic text-[var(--muted-foreground)] my-1.5">
              {children}
            </blockquote>
          ),
          a: MarkdownLink as any,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded border border-[var(--border)]">
              <table className="min-w-full text-xs text-left divide-y divide-[var(--border)]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="px-3 py-1.5 font-semibold bg-[var(--secondary)]">{children}</th>,
          td: ({ children }) => <td className="px-3 py-1.5 border-t border-[var(--border)]">{children}</td>,
          input: ({ type, checked }) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="rounded border-[var(--border)] text-emerald-500 mr-2 inline-block align-middle accent-emerald-500 cursor-default"
                />
              );
            }
            return null;
          },
        }}
      >
        {processedContent}
      </Markdown>
    </div>
  );
};
