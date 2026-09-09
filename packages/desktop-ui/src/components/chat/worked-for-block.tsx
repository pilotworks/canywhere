import React, { useState, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { MessageBlock } from "../../types/index.js";
import { RenderBlock, groupMessageBlocks } from "./render-block.js";
import { ToolCallGroup } from "./tool-call-group.js";
import { formatWorkedDuration } from "./tool-formatting.js";

export interface WorkedForBlockProps {
  durationSeconds: number;
  blocks: MessageBlock[];
}

export const WorkedForBlock: React.FC<WorkedForBlockProps> = ({
  durationSeconds,
  blocks,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const grouped = useMemo(() => groupMessageBlocks(blocks), [blocks]);
  const durationText = formatWorkedDuration(durationSeconds);

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen} className="w-full my-1">
      <Collapsible.Trigger asChild>
        <button
          type="button"
          aria-expanded={isOpen}
          className="w-full flex items-center gap-1.5 py-1 text-left text-xs font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer group select-none"
        >
          <ChevronRight
            className={`w-3.5 h-3.5 text-[var(--muted-foreground)]/70 group-hover:text-[var(--foreground)] transition-transform duration-200 shrink-0 ${
              isOpen ? "rotate-90" : ""
            }`}
          />
          <span className="font-normal">{durationText}</span>
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className="space-y-2 pt-1 pl-3 border-l border-[var(--border)] ml-1.5 my-1">
        {grouped.map((group, idx) => {
          if (group.type === "tool_group") {
            return (
              <ToolCallGroup
                key={`worked-tool-group-${idx}`}
                blocks={group.blocks}
              />
            );
          }
          return <RenderBlock key={`worked-block-${idx}`} block={group.block} />;
        })}
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
