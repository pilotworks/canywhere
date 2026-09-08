import React, { useState } from "react";
import {
  Brain,
  ChevronRight,
  Terminal,
  FileCode,
  Check,
  Copy,
  Wrench,
  ListTodo,
  Loader2,
  Folder,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { MessageBlock } from "../../types/index.js";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible.js";
import { MarkdownContent } from "./markdown-content.js";
import { DiffViewer } from "./diff-viewer.js";

function getToolIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("read") || lower.includes("view")) return <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  if (lower.includes("search") || lower.includes("find") || lower.includes("grep")) return <Search className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
  if (lower.includes("dir") || lower.includes("list")) return <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  if (lower.includes("command") || lower.includes("bash") || lower.includes("terminal")) return <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  return <Wrench className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
}

export const RenderBlock: React.FC<{ block: MessageBlock }> = ({ block }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  switch (block.type) {
    case "text":
      return <MarkdownContent content={block.content} />;

    case "reasoning": {
      const isCompleted = "completed" in block ? block.completed : true;
      return (
        <Collapsible defaultOpen={!isCompleted} className="w-full my-2">
          <CollapsibleTrigger className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--secondary)] border border-[var(--border)] text-[11px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer select-none">
            <ChevronRight className="w-3 h-3 transition-transform duration-150 group-data-[state=open]:rotate-90" />
            <Brain className={`w-3.5 h-3.5 ${isCompleted ? "text-[var(--muted-foreground)]" : "text-amber-400 animate-pulse"}`} />
            <span className="font-medium">
              {isCompleted ? "Reasoning thought process" : "Thinking..."}
            </span>
            <span className="opacity-50 text-[10px]">
              {isCompleted ? "(completed)" : "(in progress)"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1.5 p-3.5 bg-[var(--code-bg)] rounded-lg border border-[var(--code-border)] font-mono text-xs text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed select-text shadow-xs">
            {block.content}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    case "plan":
      return (
        <div className="my-2.5 rounded-lg border border-indigo-500/30 bg-indigo-950/10 dark:bg-indigo-950/20 overflow-hidden shadow-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border-b border-indigo-500/20 text-indigo-400 font-mono text-xs select-none">
            <ListTodo className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-semibold tracking-wide uppercase text-[11px]">Agent Action Plan</span>
          </div>
          <div className="p-3.5 text-xs select-text leading-relaxed">
            <MarkdownContent content={block.content} />
          </div>
        </div>
      );

    case "tool_call": {
      const isRunning = block.status === "running";
      const isFailed = block.status === "failed";

      let statusBadge = (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
          <CheckCircle2 className="w-3 h-3" />
          <span>DONE</span>
        </span>
      );

      if (isRunning) {
        statusBadge = (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-400 tracking-wider">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>RUNNING</span>
          </span>
        );
      } else if (isFailed) {
        statusBadge = (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-rose-400 tracking-wider">
            <XCircle className="w-3 h-3" />
            <span>FAILED</span>
          </span>
        );
      }

      const argsStr =
        typeof block.args === "object" && block.args !== null
          ? JSON.stringify(block.args, null, 2)
          : String(block.args ?? "");

      return (
        <Collapsible open={open} onOpenChange={setOpen} className="my-2 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-xs overflow-hidden shadow-xs">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 hover:bg-[var(--secondary)] border-b border-[var(--code-border)] text-[var(--muted-foreground)] transition-colors cursor-pointer select-none">
            <div className="flex items-center gap-2 truncate pr-2">
              <ChevronRight className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
              {getToolIcon(block.name)}
              <span className="text-[11px] font-semibold text-[var(--foreground)] truncate">
                Tool: <span className="text-sky-400">{block.name}</span>
              </span>
            </div>
            <div className="shrink-0">{statusBadge}</div>
          </CollapsibleTrigger>

          <CollapsibleContent className="p-3 space-y-2 border-t border-[var(--code-border)] bg-[var(--code-bg)]">
            {argsStr && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1 font-semibold select-none">
                  Arguments:
                </div>
                <pre className="p-2 rounded bg-[var(--secondary)]/50 text-[11px] text-[var(--foreground)] overflow-x-auto select-text font-mono">
                  {argsStr}
                </pre>
              </div>
            )}

            {block.output && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1 font-semibold select-none">
                  Output:
                </div>
                <pre className="p-2 rounded bg-[var(--secondary)]/50 text-[11px] text-[var(--foreground)]/90 overflow-x-auto max-h-48 select-text font-mono whitespace-pre-wrap">
                  {block.output}
                </pre>
              </div>
            )}
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

      const isPending = block.status === "pendingApproval";
      const isRunning = block.status === "running";
      const isFailed = block.status === "failed" || (block.exitCode !== null && block.exitCode !== 0);

      let statusColor = "text-emerald-500";
      let statusText = block.exitCode !== null ? `EXIT ${block.exitCode}` : "SUCCESS";

      if (isPending) {
        statusColor = "text-amber-400";
        statusText = "APPROVAL REQUIRED";
      } else if (isRunning) {
        statusColor = "text-sky-400";
        statusText = "RUNNING";
      } else if (isFailed) {
        statusColor = "text-rose-400";
        statusText = block.exitCode !== null ? `EXIT ${block.exitCode}` : "FAILED";
      }

      return (
        <div className="my-2.5 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-xs overflow-hidden shadow-xs">
          {/* Command Bar Header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 border-b border-[var(--code-border)] text-[var(--muted-foreground)]">
            <div className="flex items-center gap-2 truncate pr-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-[11px] font-semibold text-[var(--foreground)] truncate select-text">
                $ {block.command}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] uppercase font-bold tracking-wider ${statusColor}`}>
                {statusText}
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

          {/* Working Directory info if available */}
          {block.cwd && (
            <div className="px-3 py-1 bg-[var(--secondary)]/30 border-b border-[var(--code-border)] text-[10px] text-[var(--muted-foreground)] truncate select-none">
              directory: <span className="text-[var(--foreground)]/70">{block.cwd}</span>
            </div>
          )}

          {/* Terminal Output */}
          {block.output && (
            <pre className="p-3 text-[var(--foreground)]/85 overflow-x-auto text-[11px] leading-relaxed max-h-60 select-text font-mono">
              {block.output}
            </pre>
          )}
        </div>
      );
    }

    case "file_diff": {
      const isApplied = block.status === "applied";
      const isRejected = block.status === "rejected";

      let statusStyle = "text-sky-400 border-sky-500/30 bg-sky-500/10";
      if (isApplied) statusStyle = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
      if (isRejected) statusStyle = "text-rose-400 border-rose-500/30 bg-rose-500/10";

      return (
        <div className="my-2.5 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-xs overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 border-b border-[var(--code-border)] text-[var(--muted-foreground)] select-none">
            <div className="flex items-center gap-2 truncate pr-2">
              <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-[11px] font-semibold text-[var(--foreground)] truncate select-text">
                {block.path}
              </span>
            </div>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${statusStyle}`}>
              {block.status}
            </span>
          </div>
          <DiffViewer patch={block.patch} />
        </div>
      );
    }

    default:
      return null;
  }
};
