import React, { useState } from "react";
import { Check, Copy, ChevronDown, ChevronUp } from "lucide-react";

interface DiffViewerProps {
  patch: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ patch }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const lines = patch.split("\n");
  const addedCount = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const removedCount = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

  const isLong = lines.length > 28;
  const displayedLines = isLong && !isExpanded ? lines.slice(0, 24) : lines;

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
        {displayedLines.map((line, idx) => {
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
                {line.startsWith("+") || line.startsWith("-") ? line.slice(1) : line}
              </span>
            </div>
          );
        })}
      </div>

      {/* Expand/Collapse Button for Long Diffs */}
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[var(--secondary)]/60 hover:bg-[var(--secondary)] border-t border-[var(--code-border)] text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer select-none font-mono"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Collapse diff ({lines.length} lines)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Show full diff (+{lines.length - 24} more lines)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
