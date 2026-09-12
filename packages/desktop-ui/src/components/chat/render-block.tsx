import React, { useMemo } from "react";
import { ListTodo } from "lucide-react";
import { MessageBlock } from "../../types/index.js";
import { MarkdownContent } from "./markdown-content.js";
import { DiffViewer } from "./diff-viewer.js";
import { FileIcon } from "../ui/file-icon.js";
import { ReasoningBlock } from "./reasoning-block.js";
import { ToolCallBlock } from "./tool-call-block.js";
import {
  ToolCallGroup,
  CommandExecItem,
  FileDiffItem,
  ToolActionBlock,
} from "./tool-call-group.js";
import { WorkedForBlock } from "./worked-for-block.js";
import { isEditFileBlock } from "./tool-formatting.js";

export type RenderableBlockGroup =
  | { type: "single"; block: MessageBlock }
  | {
      type: "tool_group";
      blocks: ToolActionBlock[];
    };

export function groupMessageBlocks(blocks: MessageBlock[]): RenderableBlockGroup[] {
  const result: RenderableBlockGroup[] = [];
  let currentToolGroup: ToolActionBlock[] = [];

  for (const block of blocks) {
    if (isEditFileBlock(block)) {
      if (currentToolGroup.length > 0) {
        result.push({ type: "tool_group", blocks: currentToolGroup });
        currentToolGroup = [];
      }
      result.push({ type: "single", block });
    } else if (block.type === "tool_call" || block.type === "command_exec") {
      currentToolGroup.push(block);
    } else {
      if (currentToolGroup.length > 0) {
        result.push({ type: "tool_group", blocks: currentToolGroup });
        currentToolGroup = [];
      }
      result.push({ type: "single", block });
    }
  }

  if (currentToolGroup.length > 0) {
    result.push({ type: "tool_group", blocks: currentToolGroup });
  }

  return result;
}

export const RenderBlock: React.FC<{ block: MessageBlock }> = ({ block }) => {
  switch (block.type) {
    case "text":
      return <MarkdownContent content={block.content} />;

    case "reasoning": {
      const isCompleted = "completed" in block ? block.completed : true;
      return <ReasoningBlock content={block.content} completed={isCompleted} />;
    }

    case "plan":
      return (
        <div className="my-2.5 rounded-xl border border-indigo-500/30 bg-indigo-950/10 dark:bg-indigo-950/20 overflow-hidden shadow-xs">
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
      return (
        <ToolCallBlock
          callId={block.callId}
          name={block.name}
          args={block.args}
          output={block.output}
          status={block.status}
        />
      );
    }

    case "command_exec":
      return <CommandExecItem block={block} />;

    case "file_diff":
      return <FileDiffItem block={block} />;

    default:
      return null;
  }
};

export function partitionMessageBlocks(blocks: MessageBlock[]): {
  introBlocks: MessageBlock[];
  workBlocks: MessageBlock[];
  finalBlocks: MessageBlock[];
} {
  let firstWorkIdx = -1;
  let lastWorkIdx = -1;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const isWork =
      b.type === "reasoning" ||
      b.type === "tool_call" ||
      b.type === "command_exec" ||
      b.type === "file_diff" ||
      b.type === "plan";

    if (isWork) {
      if (firstWorkIdx === -1) {
        firstWorkIdx = i;
      }
      lastWorkIdx = i;
    }
  }

  if (firstWorkIdx === -1) {
    return { introBlocks: [], workBlocks: [], finalBlocks: blocks };
  }

  return {
    introBlocks: blocks.slice(0, firstWorkIdx),
    workBlocks: blocks.slice(firstWorkIdx, lastWorkIdx + 1),
    finalBlocks: blocks.slice(lastWorkIdx + 1),
  };
}

export const MessageBlocksRenderer: React.FC<{
  blocks: MessageBlock[];
  isStreaming?: boolean;
  durationSeconds?: number;
}> = ({ blocks, isStreaming = false, durationSeconds = 1 }) => {
  const grouped = useMemo(() => groupMessageBlocks(blocks), [blocks]);

  // While live streaming, render blocks directly so user sees progress in real-time
  if (isStreaming) {
    return (
      <>
        {grouped.map((group, idx) => {
          if (group.type === "tool_group") {
            const isLastGroup = idx === grouped.length - 1;
            const isActive = isStreaming && isLastGroup;
            return (
              <ToolCallGroup
                key={`tool-group-${idx}`}
                blocks={group.blocks}
                isActive={isActive}
              />
            );
          }
          return <RenderBlock key={`block-${idx}`} block={group.block} />;
        })}
      </>
    );
  }

  const { introBlocks, workBlocks, finalBlocks } = partitionMessageBlocks(blocks);

  // If there are no preparatory work blocks, render standard blocks
  if (workBlocks.length === 0) {
    return (
      <>
        {grouped.map((group, idx) => {
          if (group.type === "tool_group") {
            return (
              <ToolCallGroup
                key={`tool-group-${idx}`}
                blocks={group.blocks}
                isActive={false}
              />
            );
          }
          return <RenderBlock key={`block-${idx}`} block={group.block} />;
        })}
      </>
    );
  }

  // Completed turn with work blocks:
  // 1. Intro text (if model greeted or stated plan upfront) rendered outside
  // 2. Collapse internal work (reasoning, tool calls, commands) into WorkedForBlock
  // 3. Final response text rendered outside
  return (
    <>
      {introBlocks.map((block, idx) => (
        <RenderBlock key={`intro-block-${idx}`} block={block} />
      ))}
      <WorkedForBlock
        durationSeconds={durationSeconds}
        blocks={workBlocks}
      />
      {finalBlocks.map((block, idx) => (
        <RenderBlock key={`final-block-${idx}`} block={block} />
      ))}
    </>
  );
};
