import React, { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { useWorkspaceStore } from "../../store/index.js";
import { Button } from "../ui/button.js";
import { FileIcon } from "../ui/file-icon.js";

export const FileViewerModal: React.FC = () => {
  const activeFile = useWorkspaceStore((s) => s.activeFile);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const [copied, setCopied] = useState(false);

  if (!activeFile) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lines = activeFile.content.split("\n");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden text-[var(--foreground)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--secondary)]/70 border-b border-[var(--border)] select-none">
          <div className="flex items-center gap-2 truncate">
            <FileIcon fileName={activeFile.path} className="w-4 h-4 shrink-0" />
            <span className="font-mono text-xs font-semibold text-[var(--foreground)] truncate">
              {activeFile.path}
            </span>
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
              ({lines.length} lines)
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="xs"
              onClick={handleCopy}
              className="gap-1 font-mono text-[11px]"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>
            <button
              onClick={() => setActiveFile(null)}
              className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-4 bg-[var(--code-bg)] font-mono text-xs leading-relaxed select-text">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-[var(--accent)]/40 transition-colors">
                  <td className="w-10 pr-4 text-right select-none text-[10px] text-[var(--muted-foreground)] opacity-50 align-top">
                    {idx + 1}
                  </td>
                  <td className="whitespace-pre align-top text-[var(--foreground)]/90">
                    {line || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
