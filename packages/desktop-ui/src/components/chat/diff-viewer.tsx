import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface DiffViewerProps {
  patch: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ patch }) => {
  const [copied, setCopied] = useState(false);

  const lines = patch.split("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(patch);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative font-mono text-xs overflow-hidden">
      <div className="absolute right-2 top-2 z-10">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 bg-[var(--secondary)]/80 backdrop-blur-xs border border-[var(--border)] px-1.5 py-0.5 rounded text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
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

      <div className="overflow-x-auto p-2 leading-snug">
        {lines.map((line, idx) => {
          let lineStyle = "text-[var(--foreground)]/80";
          let bgStyle = "bg-transparent";

          if (line.startsWith("+++") || line.startsWith("---")) {
            lineStyle = "text-[var(--muted-foreground)] font-semibold";
          } else if (line.startsWith("@@")) {
            lineStyle = "text-sky-400 font-semibold";
            bgStyle = "bg-sky-950/20";
          } else if (line.startsWith("+")) {
            lineStyle = "text-emerald-400";
            bgStyle = "bg-emerald-950/25";
          } else if (line.startsWith("-")) {
            lineStyle = "text-rose-400";
            bgStyle = "bg-rose-950/25";
          }

          return (
            <div key={idx} className={`flex px-1.5 py-0.5 rounded-xs ${bgStyle} ${lineStyle}`}>
              <span className="select-none opacity-40 w-8 shrink-0 text-right pr-3 font-mono text-[10px]">
                {idx + 1}
              </span>
              <span className="whitespace-pre select-text flex-1">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
