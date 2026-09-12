import React, { useState, useEffect, useMemo } from "react";
import { Copy, Check, WrapText, GitCompare } from "lucide-react";
import { FileIcon } from "../ui/file-icon.js";
import { Button } from "../ui/button.js";
import { useThemeStore } from "../../store/theme-store.js";
import { detectLanguage, getLanguageLabel, tokenizeCode, type CodeToken } from "../../lib/shiki.js";
import { openDiffInRightSidebar } from "../../lib/file-link.js";

export interface FilePreviewPaneProps {
  path: string;
  content: string;
  highlightLine?: number | { start: number; end?: number };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FilePreviewPane: React.FC<FilePreviewPaneProps> = ({
  path,
  content,
  highlightLine,
}) => {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const [tokens, setTokens] = useState<CodeToken[][] | null>(null);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);

  const lang = useMemo(() => detectLanguage(path), [path]);
  const langLabel = useMemo(() => getLanguageLabel(lang), [lang]);
  const lines = useMemo(() => content.split("\n"), [content]);
  const byteSize = useMemo(() => new Blob([content]).size, [content]);

  // Tokenize using Shiki whenever content, lang, or resolvedTheme changes
  useEffect(() => {
    let active = true;
    tokenizeCode(content, lang, resolvedTheme).then((res) => {
      if (active && res) {
        setTokens(res);
      }
    });
    return () => {
      active = false;
    };
  }, [content, lang, resolvedTheme]);

  // Auto-scroll to highlighted line
  useEffect(() => {
    if (highlightLine) {
      const lineStart = typeof highlightLine === "number" ? highlightLine : highlightLine.start;
      if (lineStart) {
        const timer = setTimeout(() => {
          const el = document.getElementById(`preview-line-${lineStart}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightLine, path, content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lineRangeStart = typeof highlightLine === "number" ? highlightLine : highlightLine?.start;
  const lineRangeEnd = typeof highlightLine === "number" ? undefined : highlightLine?.end;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background)]">
      {/* File Header Bar */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-[var(--border)] bg-[var(--secondary)]/30 font-mono text-xs shrink-0 select-none">
        {/* Left info: Icon, Path, Language Badge, Line/Size stats */}
        <div className="flex items-center gap-2 truncate min-w-0">
          <FileIcon fileName={path} className="w-4 h-4 shrink-0" />
          <span className="truncate font-semibold text-[var(--foreground)] text-[12px]" title={path}>
            {path}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[var(--secondary)] border border-[var(--border)]/50 text-[10px] text-[var(--muted-foreground)] shrink-0">
            {langLabel}
          </span>
          {highlightLine && lineRangeStart && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] font-semibold shrink-0">
              Line {lineRangeStart}
              {lineRangeEnd && lineRangeEnd !== lineRangeStart ? `-${lineRangeEnd}` : ""}
            </span>
          )}
          <span className="text-[10px] text-[var(--muted-foreground)] opacity-70 shrink-0 hidden sm:inline">
            {lines.length} lines · {formatBytes(byteSize)}
          </span>
        </div>

        {/* Right actions: Diff, Word Wrap & Copy */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => openDiffInRightSidebar({ filePath: path })}
            className="h-7 px-2 font-mono text-[10px] gap-1 cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            title="Open diff view for this file"
          >
            <GitCompare className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Diff</span>
          </Button>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => setWordWrap(!wordWrap)}
            className={`h-7 px-2 font-mono text-[10px] gap-1 cursor-pointer transition-colors ${
              wordWrap
                ? "bg-[var(--secondary)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
          >
            <WrapText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{wordWrap ? "Wrap: On" : "Wrap"}</span>
          </Button>

          <Button
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            className="h-7 px-2 font-mono text-[10px] gap-1 cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            title="Copy file content"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
      </div>

      {/* Code Viewer Table with Shiki Syntax Highlighting */}
      <div className="flex-1 overflow-auto py-2 bg-[var(--code-bg)] font-mono text-[12px] leading-relaxed select-text">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((rawLine, idx) => {
              const lineNum = idx + 1;
              const isHighlighted =
                Boolean(highlightLine) &&
                (typeof highlightLine === "number"
                  ? lineNum === highlightLine
                  : lineNum >= (highlightLine?.start || 0) && lineNum <= (highlightLine?.end || highlightLine?.start || 0));

              const lineTokens = tokens ? tokens[idx] : null;

              return (
                <tr
                  key={idx}
                  id={`preview-line-${lineNum}`}
                  className={`group transition-colors ${
                    isHighlighted ? "font-medium" : ""
                  }`}
                >
                  <td
                    className={`sticky left-0 z-10 w-12 min-w-[3rem] px-2 text-right select-none text-[10px] align-top transition-colors border-r border-[var(--border)] ${
                      isHighlighted
                        ? "bg-[var(--sidebar-bg)] text-amber-500 font-bold border-r-amber-500"
                        : "bg-[var(--sidebar-bg)] group-hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {lineNum}
                  </td>
                  <td
                    className={`align-top pl-3 pr-4 text-[var(--foreground)]/90 transition-colors ${
                      isHighlighted
                        ? "bg-amber-500/15 dark:bg-amber-400/15"
                        : "group-hover:bg-[var(--accent)]/35"
                    } ${
                      wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"
                    }`}
                  >
                    {lineTokens && lineTokens.length > 0 ? (
                      lineTokens.map((tok, tIdx) => (
                        <span
                          key={tIdx}
                          style={{
                            color: tok.color,
                            fontStyle: tok.fontStyle === 1 ? "italic" : undefined,
                            fontWeight: tok.fontStyle === 2 ? "bold" : undefined,
                          }}
                        >
                          {tok.content}
                        </span>
                      ))
                    ) : (
                      rawLine || " "
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
