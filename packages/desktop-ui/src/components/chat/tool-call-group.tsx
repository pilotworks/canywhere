import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { MessageBlock } from "../../types/index.js";
import { ToolCallBlock } from "./tool-call-block.js";
import { formatToolAction, summarizeToolGroup } from "./tool-formatting.js";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible.js";
import { FileIcon } from "../ui/file-icon.js";
import { DiffViewer } from "./diff-viewer.js";

export type ToolActionBlock = Extract<MessageBlock, { type: "tool_call" | "command_exec" }>;

export const CommandExecItem: React.FC<{
  block: Extract<MessageBlock, { type: "command_exec" }>;
}> = ({ block }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const action = formatToolAction(block);
  const isRunning = block.status === "running";
  const isPending = block.status === "pendingApproval";
  const isFailed =
    block.status === "failed" || (block.exitCode !== null && block.exitCode !== 0);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(block.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyOutput = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (block.output) {
      navigator.clipboard.writeText(block.output);
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 1500);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full my-0.5 text-xs">
      {/* Pure text row - chevron arrow at start, full width clickable, hover changes text color */}
      <CollapsibleTrigger className="group flex items-center gap-1 py-0.5 w-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer select-none bg-transparent border-none p-0 text-left">
        <ChevronRight
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="text-[12px] font-normal transition-colors shrink-0">
          {action.verb}
        </span>
        <span className="font-mono text-[11.5px] opacity-90 truncate">
          {action.target}
        </span>
        {isRunning && (
          <span className="text-sky-400 text-[10px] font-mono ml-1">
            RUNNING
          </span>
        )}
        {isPending && (
          <span className="text-amber-400 text-[10px] font-mono ml-1">
            (approval required)
          </span>
        )}
        {!isRunning && !isPending && block.exitCode !== null && (
          <span className={`text-[10px] font-mono ml-1 ${isFailed ? "text-rose-400" : "opacity-60"}`}>
            EXIT {block.exitCode}
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="my-1.5 ml-2 pl-2 border-l border-[var(--border)]/50 space-y-2 text-[11px]">
        {/* Full Command Bar */}
        <div className="flex items-center justify-between p-1.5 rounded bg-[var(--secondary)]/30 border border-[var(--border)]/40">
          <span className="font-mono text-[11px] text-[var(--foreground)] select-text">
            $ {block.command}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="hover:text-[var(--foreground)] px-1 py-0.5 text-[10px] rounded transition-colors text-[var(--muted-foreground)] cursor-pointer bg-transparent border-none"
            title="Copy command"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Working Directory */}
        {block.cwd && (
          <div className="text-[10px] text-[var(--muted-foreground)] font-mono select-none px-1">
            cwd: <span className="text-[var(--foreground)]/70">{block.cwd}</span>
          </div>
        )}

        {/* Terminal Output */}
        {block.output ? (
          <div>
            <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] mb-0.5 font-semibold select-none">
              <span>Output</span>
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
              {block.output}
            </pre>
          </div>
        ) : isRunning ? (
          <div className="p-1 text-[10px] text-[var(--muted-foreground)] italic font-mono">
            Executing command...
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const FileDiffItem: React.FC<{
  block: Extract<MessageBlock, { type: "file_diff" }>;
}> = ({ block }) => {
  const [open, setOpen] = useState(false);
  const lines = (block.patch || "").split("\n");
  const addedCount = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const removedCount = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full my-0.5 text-xs">
      <CollapsibleTrigger className="group flex items-center gap-1.5 py-0.5 w-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer select-none bg-transparent border-none p-0 text-left">
        <ChevronRight
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="text-[12px] font-normal transition-colors shrink-0">
          Edited
        </span>
        <FileIcon fileName={block.path} className="w-3.5 h-3.5 shrink-0" />
        <span className="font-mono text-[11.5px] opacity-90 truncate">
          {block.path}
        </span>
        {(addedCount > 0 || removedCount > 0) && (
          <span className="flex items-center gap-1 font-mono text-[10.5px] font-semibold ml-1">
            {addedCount > 0 && <span className="text-emerald-400">+{addedCount}</span>}
            {removedCount > 0 && <span className="text-rose-400">-{removedCount}</span>}
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="my-1.5 ml-2 pl-2 border-l border-[var(--border)]/50">
        <div className="rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-xs overflow-hidden shadow-xs">
          <DiffViewer patch={block.patch} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const SingleToolAction: React.FC<{ block: ToolActionBlock }> = ({ block }) => {
  if (block.type === "command_exec") {
    return <CommandExecItem block={block} />;
  }
  return (
    <ToolCallBlock
      callId={block.callId}
      name={block.name}
      args={block.args}
      output={block.output}
      status={block.status}
    />
  );
};

export const ToolCallGroup: React.FC<{ blocks: ToolActionBlock[] }> = ({ blocks }) => {
  const [isGroupExpanded, setIsGroupExpanded] = useState(false);

  if (blocks.length === 0) return null;

  // Single tool call: render directly
  if (blocks.length === 1) {
    return <SingleToolAction block={blocks[0]} />;
  }

  const groupSummary = summarizeToolGroup(blocks);

  return (
    <div className="w-full my-0.5 text-xs">
      <Collapsible open={isGroupExpanded} onOpenChange={setIsGroupExpanded} className="w-full">
        {/* Group Header: Arrow at the beginning, groupSummary, full width, click to toggle */}
        <CollapsibleTrigger className="group flex items-center gap-1 py-0.5 w-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer select-none bg-transparent border-none p-0 text-left">
          <ChevronRight
            className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
              isGroupExpanded ? "rotate-90" : ""
            }`}
          />
          <span className="text-[12px] font-normal transition-colors truncate">
            {groupSummary}
          </span>
        </CollapsibleTrigger>

        {/* Expanded list with subtle indent and left border */}
        <CollapsibleContent className="mt-1 ml-1.5 pl-2 border-l border-[var(--border)]/40 space-y-0.5">
          {blocks.map((block, idx) => {
            const key =
              block.type === "tool_call"
                ? block.callId || `tool-${idx}`
                : `cmd-${idx}-${block.command}`;
            return <SingleToolAction key={key} block={block} />;
          })}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
