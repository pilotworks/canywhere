import React, { useState } from "react";
import { Brain, ChevronRight, Terminal, FileCode, Check, Copy, Clock } from "lucide-react";
import { MessageBlock } from "../../types/index.js";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible.js";
import { MarkdownContent } from "./markdown-content.js";
import { DiffViewer } from "./diff-viewer.js";

export const RenderBlock: React.FC<{ block: MessageBlock }> = ({ block }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  switch (block.type) {
    case "text":
      return <MarkdownContent content={block.content} />;

    case "reasoning": {
      const isCompleted = "completed" in block ? block.completed : true;
      return (
        <Collapsible open={open} onOpenChange={setOpen} className="w-full my-1.5">
          <CollapsibleTrigger className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--secondary)] border border-[var(--border)] text-[11px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer select-none">
            <ChevronRight className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
            <Brain className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <span className="font-medium">
              {isCompleted ? "Reasoning thought process" : "Thinking..."}
            </span>
            <span className="opacity-50 text-[10px]">
              {open ? "(click to collapse)" : "(click to expand)"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1.5 p-3.5 bg-[var(--code-bg)] rounded-lg border border-[var(--code-border)] font-mono text-xs text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed select-text shadow-xs">
            {block.content}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    case "command_exec": {
      const handleCopy = () => {
        navigator.clipboard.writeText(block.command);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      };

      return (
        <div className="my-2.5 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-xs overflow-hidden shadow-xs">
          {/* Command Bar Header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 border-b border-[var(--code-border)] text-[var(--muted-foreground)]">
            <div className="flex items-center gap-2 truncate">
              <Terminal className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-[11px] font-semibold text-[var(--foreground)] truncate">$ {block.command}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                {block.status}
              </span>
              <button
                onClick={handleCopy}
                className="hover:text-[var(--foreground)] p-1 rounded cursor-pointer transition-colors"
                title="Copy Command"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Terminal Output */}
          {block.output && (
            <pre className="p-3 text-[var(--foreground)]/85 overflow-x-auto text-[11px] leading-relaxed max-h-56 select-text font-mono">
              {block.output}
            </pre>
          )}
        </div>
      );
    }

    case "file_diff":
      return (
        <div className="my-2.5 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-xs overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 border-b border-[var(--code-border)] text-[var(--muted-foreground)]">
            <div className="flex items-center gap-2 truncate">
              <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-[11px] font-semibold text-[var(--foreground)] truncate">{block.path}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
              {block.status}
            </span>
          </div>
          <DiffViewer patch={block.patch} />
        </div>
      );

    default:
      return null;
  }
};
