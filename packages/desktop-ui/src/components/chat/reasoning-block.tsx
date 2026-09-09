import React, { useState, useEffect } from "react";
import { ChevronRight, Brain, Copy, Check } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible.js";
import { MarkdownContent } from "./markdown-content.js";

interface ReasoningBlockProps {
  content: string;
  completed?: boolean;
}

export function extractReasoningHeader(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  // 1. Look for markdown bold **...**
  const boldMatch = trimmed.match(/\*\*([^*]+)\*\*/);
  if (boldMatch && boldMatch[1].trim()) {
    return boldMatch[1].trim();
  }

  // 2. Look for first line if short (e.g. "Planning parallel command execution")
  const firstLine = trimmed.split("\n")[0].replace(/^[#*-\s]+/, "").trim();
  if (firstLine && firstLine.length <= 80 && !firstLine.includes("```")) {
    return firstLine;
  }

  return null;
}

export const ReasoningBlock: React.FC<ReasoningBlockProps> = ({ content, completed = true }) => {
  const isCompleted = completed !== false;
  const [open, setOpen] = useState(!isCompleted);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOpen(!isCompleted);
  }, [isCompleted]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const header = extractReasoningHeader(content);
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full my-2">
      <div className="flex items-center justify-between gap-1.5 text-xs text-[var(--muted-foreground)] w-full">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group/reasoning flex items-center gap-1.5 py-1 px-1.5 -ml-1.5 rounded hover:bg-[var(--secondary)]/60 text-[11px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer select-none flex-1 text-left min-w-0"
          >
            <ChevronRight
              className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
                open ? "rotate-90" : ""
              }`}
            />
            <Brain className="w-3.5 h-3.5 shrink-0 opacity-60 group-hover/reasoning:opacity-100 transition-opacity" />
            <span className="font-medium truncate">
              {isCompleted
                ? header || "Thought process"
                : header
                ? `Thinking: ${header}`
                : "Thinking..."}
            </span>
            {isCompleted && wordCount > 0 && (
              <span className="opacity-50 text-[10px] shrink-0">({wordCount} words)</span>
            )}
            {!isCompleted && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>

        {content && open && (
          <button
            onClick={handleCopy}
            className="p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer shrink-0"
            title="Copy thought process"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
            )}
          </button>
        )}
      </div>

      <CollapsibleContent className="mt-1 pl-3.5 ml-1 border-l border-[var(--border)]">
        <div className="py-1 text-[12px] text-[var(--muted-foreground)] select-text max-h-80 overflow-y-auto pr-1">
          <MarkdownContent
            content={content}
            className="text-[12px] text-[var(--muted-foreground)] space-y-2 leading-relaxed"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

