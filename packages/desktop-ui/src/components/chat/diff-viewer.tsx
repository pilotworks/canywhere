import React, { useState, useEffect, useMemo } from "react";
import { Check, Copy } from "lucide-react";
import { useThemeStore } from "../../store/theme-store.js";
import { detectLanguage, tokenizeCode, type CodeToken } from "../../lib/shiki.js";

interface DiffViewerProps {
  patch: string;
  path?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ patch, path }) => {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const [tokens, setTokens] = useState<CodeToken[][] | null>(null);
  const [copied, setCopied] = useState(false);

  const lang = useMemo(() => (path ? detectLanguage(path) : "diff"), [path]);
  const lines = useMemo(() => patch.split(/\r?\n/), [patch]);
  const addedCount = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const removedCount = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

  useEffect(() => {
    let active = true;
    const strippedCode = lines
      .map((l) => (l.startsWith("+") || l.startsWith("-") ? l.slice(1) : l))
      .join("\n");
    tokenizeCode(strippedCode, lang, resolvedTheme).then((res) => {
      if (active && res) {
        setTokens(res);
      }
    });
    return () => {
      active = false;
    };
  }, [lines, lang, resolvedTheme]);

  const handleCopy = () => {
    navigator.clipboard.writeText(patch);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative font-mono text-xs overflow-hidden border-t border-[var(--code-border)]">
      {/* Diff Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/40 border-b border-[var(--code-border)] text-[11px] select-none">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)]">Changes</span>
          <div className="flex items-center gap-1 font-mono text-[10px]">
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
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-[var(--foreground)] px-2 py-0.5 rounded text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer"
          title="Copy raw diff"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy diff</span>
            </>
          )}
        </button>
      </div>

      {/* Diff Lines Feed */}
      <div className="overflow-x-auto p-2 leading-snug no-scrollbar bg-[var(--code-bg)]">
        {lines.map((line, idx) => {
          let lineStyle = "text-[var(--foreground)]/80";
          let bgStyle = "bg-transparent";
          let marker = " ";

          if (line.startsWith("+++") || line.startsWith("---")) {
            lineStyle = "text-[var(--muted-foreground)] font-semibold";
          } else if (line.startsWith("@@")) {
            lineStyle = "text-sky-400 font-semibold";
            bgStyle = "bg-sky-950/20";
          } else if (line.startsWith("+")) {
            lineStyle = "text-emerald-400";
            bgStyle = "bg-emerald-950/30";
            marker = "+";
          } else if (line.startsWith("-")) {
            lineStyle = "text-rose-400";
            bgStyle = "bg-rose-950/30";
            marker = "-";
          }

          return (
            <div key={idx} className={`flex items-start px-1.5 py-0.5 rounded-xs font-mono ${bgStyle} ${lineStyle}`}>
              <span className="select-none opacity-40 w-8 shrink-0 text-right pr-2 text-[10px]">
                {idx + 1}
              </span>
              <span className="select-none w-3 text-center shrink-0 font-bold opacity-60">
                {marker !== " " ? marker : ""}
              </span>
              <span className="whitespace-pre select-text flex-1 pl-1 text-[11px] leading-relaxed">
                {line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@") ? (
                  line
                ) : tokens && tokens[idx] && tokens[idx].length > 0 ? (
                  tokens[idx].map((tok, tIdx) => (
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
                  line.startsWith("+") || line.startsWith("-") ? line.slice(1) : line
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
