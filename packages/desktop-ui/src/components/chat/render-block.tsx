import React, { useState } from "react";
import { Brain, ChevronRight, Terminal, FileCode, Check, Copy } from "lucide-react";
import { MessageBlock } from "../../types/index.js";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible.js";

export const RenderBlock: React.FC<{ block: MessageBlock }> = ({ block }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  switch (block.type) {
    case "text":
      return (
        <div className="leading-relaxed text-[13px] whitespace-pre-wrap select-text font-normal">
          {block.content}
        </div>
      );

    case "reasoning":
      return (
        <Collapsible open={open} onOpenChange={setOpen} className="w-full my-1">
          <CollapsibleTrigger className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--secondary)] border border-[var(--border)] text-[11px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer">
            <ChevronRight className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
            <Brain className="w-3 h-3 text-[var(--muted-foreground)]" />
            <span>Reasoning process</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1.5 p-3 bg-[var(--code-bg)] rounded-lg border border-[var(--code-border)] font-mono text-xs text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed select-text">
            {block.content}
          </CollapsibleContent>
        </Collapsible>
      );

    case "command_exec": {
      const handleCopy = () => {
        navigator.clipboard.writeText(block.command);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      };

      return (
        <div className="my-2 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-xs overflow-hidden">
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
                className="hover:text-[var(--foreground)] p-1 rounded cursor-pointer"
                title="Copy Command"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Terminal Output */}
          {block.output && (
            <pre className="p-3 text-[var(--foreground)]/80 overflow-x-auto text-[11px] leading-relaxed max-h-52 select-text font-mono">
              {block.output}
            </pre>
          )}
        </div>
      );
    }

    case "file_diff":
      return (
        <div className="my-2 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-xs overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 border-b border-[var(--code-border)] text-[var(--muted-foreground)]">
            <div className="flex items-center gap-2 truncate">
              <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-[11px] font-semibold text-[var(--foreground)] truncate">{block.path}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
              {block.status}
            </span>
          </div>
          <pre className="p-3 text-[var(--foreground)]/90 overflow-x-auto text-[11px] leading-relaxed select-text font-mono">
            {block.patch}
          </pre>
        </div>
      );

    default:
      return null;
  }
};
