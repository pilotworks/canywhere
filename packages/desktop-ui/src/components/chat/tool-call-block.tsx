import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible.js";
import { FileIcon } from "../ui/file-icon.js";
import { MessageBlock } from "../../types/index.js";
import { formatToolAction } from "./tool-formatting.js";
import { parseFileLink, openFileInRightSidebar } from "../../lib/file-link.js";
import { DiffViewer } from "./diff-viewer.js";

interface ToolCallBlockProps {
  name: string;
  args: any;
  output?: string | null;
  status: "running" | "completed" | "failed";
  callId?: string;
}

export const ToolCallBlock: React.FC<ToolCallBlockProps> = ({
  name,
  args,
  output,
  status,
  callId = "",
}) => {
  const isRunning = status === "running";
  const isFailed = status === "failed";
  const [open, setOpen] = useState(false);
  const [copiedArgs, setCopiedArgs] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  // Fake a tool_call message block for the formatter
  const fakeBlock: Extract<MessageBlock, { type: "tool_call" }> = {
    type: "tool_call",
    callId,
    name,
    args,
    output: output ?? null,
    status,
  };

  const action = formatToolAction(fakeBlock);

  // Parse file link if action has filePath
  const fileLinkInfo = React.useMemo(() => {
    if (!action.filePath) return null;
    const parsed = parseFileLink(action.filePath);
    if (!parsed) return null;
    if (action.lineRange && !parsed.lineRange) {
      return {
        ...parsed,
        lineRange: action.lineRange,
      };
    }
    return parsed;
  }, [action.filePath, action.lineRange]);

  const handleFileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileLinkInfo) {
      openFileInRightSidebar(fileLinkInfo);
    }
  };

  const argsStr =
    typeof args === "object" && args !== null
      ? JSON.stringify(args, null, 2)
      : String(args ?? "");

  const handleCopyArgs = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(argsStr);
    setCopiedArgs(true);
    setTimeout(() => setCopiedArgs(false), 1500);
  };

  const handleCopyOutput = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (output) {
      navigator.clipboard.writeText(output);
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 1500);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full my-0.5 text-xs">
      <CollapsibleTrigger
        className={`group flex items-center gap-1.5 w-full transition-colors cursor-pointer select-none text-left ${
          action.isEdit
            ? "py-1 px-2 my-0.5 rounded-md bg-[var(--secondary)]/25 hover:bg-[var(--secondary)]/50 border border-[var(--border)]/35 text-[var(--foreground)]"
            : "py-0.5 bg-transparent border-none text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-0"
        }`}
      >
        <ChevronRight
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
            open ? "rotate-90" : ""
          } ${action.isEdit ? "text-[var(--foreground)] opacity-70" : ""}`}
        />
        <span
          className={`text-[12px] shrink-0 transition-colors ${
            action.isEdit ? "font-medium text-[var(--foreground)]" : "font-normal"
          }`}
        >
          {action.verb}
        </span>
        {action.target && (
          fileLinkInfo ? (
            <span
              onClick={handleFileClick}
              className={`inline-flex items-center gap-1 font-mono text-[11.5px] px-1 py-0.2 rounded transition-colors cursor-pointer group/link max-w-[calc(100%-90px)] truncate ${
                action.isEdit
                  ? "font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]/80"
                  : "text-[var(--foreground)] hover:bg-[var(--secondary)] dark:hover:bg-white/10"
              }`}
              title={`Preview ${fileLinkInfo.cleanPath}${
                fileLinkInfo.lineRange
                  ? ` (line ${fileLinkInfo.lineRange.start}${
                      fileLinkInfo.lineRange.end ? `-${fileLinkInfo.lineRange.end}` : ""
                    })`
                  : ""
              } in right sidebar`}
            >
              <FileIcon
                fileName={fileLinkInfo.fileName}
                className="w-3.5 h-3.5 inline-block shrink-0 pointer-events-none"
              />
              <span className="truncate">
                {action.target}
              </span>
              {fileLinkInfo.lineRange && !action.target.includes(":" + fileLinkInfo.lineRange.start) && (
                <span className="text-[11px] text-[var(--muted-foreground)] opacity-75 font-mono shrink-0">
                  :{fileLinkInfo.lineRange.start}
                  {fileLinkInfo.lineRange.end ? `-${fileLinkInfo.lineRange.end}` : ""}
                </span>
              )}
            </span>
          ) : (
            <span className={action.isMono ? "font-mono text-[11.5px] opacity-90 truncate" : "text-[12px] opacity-90 truncate"}>
              {action.target}
            </span>
          )
        )}
        {action.diffStats && (action.diffStats.added > 0 || action.diffStats.removed > 0) && (
          <span className="flex items-center gap-1 font-mono text-[10.5px] font-semibold ml-1 shrink-0">
            {action.diffStats.added > 0 && <span className="text-emerald-400">+{action.diffStats.added}</span>}
            {action.diffStats.removed > 0 && <span className="text-rose-400">-{action.diffStats.removed}</span>}
          </span>
        )}
        {isRunning && (
          <span className="text-amber-400/90 text-[11px] font-mono animate-pulse">
            ...
          </span>
        )}
        {isFailed && (
          <span className="text-rose-400 text-[10px] font-mono">
            (failed)
          </span>
        )}
      </CollapsibleTrigger>

      {/* Expanded Content */}
      <CollapsibleContent className="my-1.5 ml-2 pl-2 border-l border-[var(--border)]/50 space-y-2 text-[11px]">
        {/* Description / Instruction if present */}
        {action.description && (
          <div className="text-[11px] text-[var(--muted-foreground)] italic font-sans">
            {action.description}
          </div>
        )}

        {/* Diff Viewer for Edit actions with patch */}
        {action.patch ? (
          <div className="rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-xs overflow-hidden shadow-xs">
            <DiffViewer patch={action.patch} />
          </div>
        ) : null}

        {/* Arguments: show if not an edit with patch, or if no patch available */}
        {!action.patch && argsStr && argsStr !== "null" && argsStr !== "{}" && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] mb-0.5 font-semibold select-none">
              <span>Arguments</span>
              <button
                type="button"
                onClick={handleCopyArgs}
                className="hover:text-[var(--foreground)] p-0.5 transition-colors cursor-pointer bg-transparent border-none"
                title="Copy arguments"
              >
                <span className="text-[9px] font-normal">{copiedArgs ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <pre className="p-2 rounded bg-[var(--secondary)]/30 text-[11px] text-[var(--foreground)]/85 overflow-x-auto select-text font-mono max-h-40 leading-relaxed border border-[var(--border)]/40">
              {argsStr}
            </pre>
          </div>
        )}

        {/* Output */}
        {output ? (
          <div>
            <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] mb-0.5 font-semibold select-none">
              <span>Result</span>
              <button
                type="button"
                onClick={handleCopyOutput}
                className="hover:text-[var(--foreground)] p-0.5 transition-colors cursor-pointer bg-transparent border-none"
                title="Copy output"
              >
                <span className="text-[9px] font-normal">{copiedOutput ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <pre className="p-2 rounded bg-[var(--secondary)]/30 text-[11px] text-[var(--foreground)]/85 overflow-x-auto max-h-56 select-text font-mono whitespace-pre-wrap leading-relaxed border border-[var(--border)]/40">
              {output}
            </pre>
          </div>
        ) : !action.patch && (
          <div>
            {isRunning ? (
              <div className="p-1 text-[10px] text-[var(--muted-foreground)] italic font-mono">
                Executing...
              </div>
            ) : (
              <div className="p-1 text-[10px] text-[var(--muted-foreground)] italic font-mono opacity-60">
                (No output)
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
