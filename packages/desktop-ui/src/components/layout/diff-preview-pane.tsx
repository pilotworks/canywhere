import React, { useState, useEffect, useMemo } from "react";
import { Copy, Check, WrapText, FileCode } from "lucide-react";
import { FileIcon } from "../ui/file-icon.js";
import { Button } from "../ui/button.js";
import { parseFileLink, openFileInRightSidebar } from "../../lib/file-link.js";
import { useThemeStore } from "../../store/theme-store.js";
import { detectLanguage, getLanguageLabel, tokenizeCode, type CodeToken } from "../../lib/shiki.js";

export interface DiffPreviewPaneProps {
  path: string;
  patch: string;
  workspaceId?: string;
}

interface ParsedDiffLine {
  raw: string;
  type: "header" | "hunk" | "add" | "del" | "ctx";
  marker: string;
  text: string;
  oldLine?: number;
  newLine?: number;
}

export const DiffPreviewPane: React.FC<DiffPreviewPaneProps> = ({
  path,
  patch,
}) => {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const [tokens, setTokens] = useState<CodeToken[][] | null>(null);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);

  const lang = useMemo(() => detectLanguage(path), [path]);
  const langLabel = useMemo(() => getLanguageLabel(lang), [lang]);

  // Parse diff lines with line numbers for old and new files
  const parsedLines = useMemo<ParsedDiffLine[]>(() => {
    const rawLines = patch.split(/\r?\n/);
    const result: ParsedDiffLine[] = [];
    let oldNum = 0;
    let newNum = 0;

    for (const raw of rawLines) {
      if (raw.startsWith("+++") || raw.startsWith("---") || raw.startsWith("diff --git")) {
        result.push({ raw, type: "header", marker: " ", text: raw });
      } else if (raw.startsWith("@@")) {
        const match = raw.match(/@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
        if (match) {
          oldNum = parseInt(match[1], 10);
          newNum = parseInt(match[2], 10);
        }
        result.push({ raw, type: "hunk", marker: "@", text: raw });
      } else if (raw.startsWith("+")) {
        result.push({
          raw,
          type: "add",
          marker: "+",
          text: raw.slice(1),
          newLine: newNum,
        });
        newNum++;
      } else if (raw.startsWith("-")) {
        result.push({
          raw,
          type: "del",
          marker: "-",
          text: raw.slice(1),
          oldLine: oldNum,
        });
        oldNum++;
      } else {
        const text = raw.startsWith(" ") ? raw.slice(1) : raw;
        result.push({
          raw,
          type: "ctx",
          marker: " ",
          text,
          oldLine: oldNum > 0 ? oldNum : undefined,
          newLine: newNum > 0 ? newNum : undefined,
        });
        if (oldNum > 0) oldNum++;
        if (newNum > 0) newNum++;
      }
    }
    return result;
  }, [patch]);

  const addedCount = useMemo(
    () => parsedLines.filter((l) => l.type === "add").length,
    [parsedLines]
  );
  const removedCount = useMemo(
    () => parsedLines.filter((l) => l.type === "del").length,
    [parsedLines]
  );

  // Tokenize using Shiki shared stack
  useEffect(() => {
    let active = true;
    const codeContent = parsedLines.map((l) => l.text).join("\n");
    tokenizeCode(codeContent, lang, resolvedTheme).then((res) => {
      if (active && res) {
        setTokens(res);
      }
    });
    return () => {
      active = false;
    };
  }, [parsedLines, lang, resolvedTheme]);

  const handleCopy = () => {
    navigator.clipboard.writeText(patch);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSwitchToFile = () => {
    const linkInfo = parseFileLink(path) || {
      isFile: true,
      originalHref: path,
      cleanPath: path,
      fileName: path.split("/").pop() || path,
    };
    openFileInRightSidebar(linkInfo);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background)]">
      {/* File Header Bar matching FilePreviewPane exactly */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-[var(--border)] bg-[var(--secondary)]/30 font-mono text-xs shrink-0 select-none">
        {/* Left info: Icon, Path, Badges, Language */}
        <div className="flex items-center gap-2 truncate min-w-0">
          <FileIcon fileName={path} className="w-4 h-4 shrink-0" />
          <span className="truncate font-semibold text-[var(--foreground)] text-[12px]" title={path}>
            {path}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[var(--secondary)] border border-[var(--border)]/50 text-[10px] text-[var(--muted-foreground)] shrink-0">
            {langLabel}
          </span>
          <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
            {addedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-semibold">
                +{addedCount}
              </span>
            )}
            {removedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400 font-semibold">
                -{removedCount}
              </span>
            )}
          </div>
          <span className="text-[10px] text-[var(--muted-foreground)] opacity-70 shrink-0 hidden sm:inline">
            {parsedLines.length} lines
          </span>
        </div>

        {/* Right actions: Switch to File View, Word Wrap, Copy */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleSwitchToFile}
            className="h-7 px-2 font-mono text-[10px] gap-1 cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            title="Open full file view without diff"
          >
            <FileCode className="w-3.5 h-3.5 mr-0.5 text-sky-400" />
            <span className="hidden sm:inline">File View</span>
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
            title="Copy diff patch"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Code Viewer Table with Shared Shiki Syntax Highlighting & Line Numbers */}
      <div className="flex-1 overflow-auto py-2 bg-[var(--code-bg)] font-mono text-[12px] leading-relaxed select-text">
        <table className="w-full border-collapse">
          <tbody>
            {parsedLines.map((line, idx) => {
              const lineTokens = tokens ? tokens[idx] : null;

              let rowBg = "hover:bg-white/5";
              let markerColor = "text-[var(--muted-foreground)] opacity-40";
              let lineNumClass = "text-[var(--muted-foreground)] opacity-50";

              if (line.type === "header") {
                rowBg = "bg-white/2 text-[var(--muted-foreground)] font-semibold";
              } else if (line.type === "hunk") {
                rowBg = "bg-sky-500/10 text-sky-400 font-semibold";
                markerColor = "text-sky-400 font-bold opacity-80";
              } else if (line.type === "add") {
                rowBg = "bg-emerald-500/15 dark:bg-emerald-500/10 hover:bg-emerald-500/20";
                markerColor = "text-emerald-400 font-bold";
                lineNumClass = "text-emerald-400/80 font-medium";
              } else if (line.type === "del") {
                rowBg = "bg-rose-500/15 dark:bg-rose-500/10 hover:bg-rose-500/20";
                markerColor = "text-rose-400 font-bold";
                lineNumClass = "text-rose-400/80 font-medium";
              }

              return (
                <tr
                  key={idx}
                  className={`group transition-colors ${rowBg}`}
                >
                  {/* Old Line Number */}
                  <td className={`sticky left-0 z-10 w-9 min-w-[2.25rem] px-1 text-right select-none text-[10px] align-top bg-[var(--sidebar-bg)] border-r border-[var(--border)]/40 ${lineNumClass}`}>
                    {line.oldLine ?? ""}
                  </td>
                  {/* New Line Number */}
                  <td className={`sticky left-9 z-10 w-9 min-w-[2.25rem] px-1 text-right select-none text-[10px] align-top bg-[var(--sidebar-bg)] border-r border-[var(--border)] ${lineNumClass}`}>
                    {line.newLine ?? ""}
                  </td>
                  {/* Diff Marker (+, -, @, space) */}
                  <td className={`w-5 min-w-[1.25rem] text-center select-none text-[11px] align-top px-0.5 ${markerColor}`}>
                    {line.marker !== " " ? line.marker : ""}
                  </td>
                  {/* Code Content with Shiki Tokens */}
                  <td
                    className={`align-top pl-2 pr-4 text-[var(--foreground)]/90 ${
                      wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"
                    }`}
                  >
                    {line.type === "header" || line.type === "hunk" ? (
                      <span className={line.type === "hunk" ? "text-sky-400" : "text-[var(--muted-foreground)]"}>
                        {line.text}
                      </span>
                    ) : lineTokens && lineTokens.length > 0 ? (
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
                      line.text || " "
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
