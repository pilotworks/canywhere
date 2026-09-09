import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible.js";
import { MessageBlock } from "../../types/index.js";
import { formatToolAction } from "./tool-formatting.js";

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
      {/* Pure Text Row - ChevronRight arrow at start, full width clickable, hover changes text color */}
      <CollapsibleTrigger className="group flex items-center gap-1 py-0.5 w-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer select-none bg-transparent border-none p-0 text-left">
        <ChevronRight
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="text-[12px] font-normal transition-colors shrink-0">
          {action.verb}
        </span>
        {action.target && (
          <span className={action.isMono ? "font-mono text-[11.5px] opacity-90 truncate" : "text-[12px] opacity-90 truncate"}>
            {action.target}
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
        {/* Arguments */}
        {argsStr && argsStr !== "null" && argsStr !== "{}" && (
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
        <div>
          <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] mb-0.5 font-semibold select-none">
            <span>Result</span>
            {output && (
              <button
                type="button"
                onClick={handleCopyOutput}
                className="hover:text-[var(--foreground)] p-0.5 transition-colors cursor-pointer bg-transparent border-none"
                title="Copy output"
              >
                <span className="text-[9px] font-normal">{copiedOutput ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>

          {output ? (
            <pre className="p-2 rounded bg-[var(--secondary)]/30 text-[11px] text-[var(--foreground)]/85 overflow-x-auto max-h-56 select-text font-mono whitespace-pre-wrap leading-relaxed border border-[var(--border)]/40">
              {output}
            </pre>
          ) : isRunning ? (
            <div className="p-1 text-[10px] text-[var(--muted-foreground)] italic font-mono">
              Executing...
            </div>
          ) : (
            <div className="p-1 text-[10px] text-[var(--muted-foreground)] italic font-mono opacity-60">
              (No output)
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
