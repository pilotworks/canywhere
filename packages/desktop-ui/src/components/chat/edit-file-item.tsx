import React from "react";
import { FileIcon } from "../ui/file-icon.js";
import { parseFileLink, openFileInRightSidebar, openDiffInRightSidebar } from "../../lib/file-link.js";
import { client } from "../../network/client.js";
import { useWorkspaceStore, useChatStore } from "../../store/index.js";

export interface EditFileItemProps {
  filePath: string;
  target?: string;
  verb?: string;
  patch?: string;
  diffStats?: { added: number; removed: number };
  status?: "running" | "completed" | "failed";
}

export const EditFileItem: React.FC<EditFileItemProps> = ({
  filePath,
  target,
  verb,
  patch: initialPatch,
  diffStats: initialDiffStats,
  status = "completed",
}) => {
  const isRunning = status === "running";
  const isFailed = status === "failed";

  const [fetchedPatch, setFetchedPatch] = React.useState<string | undefined>(undefined);
  const [fetchedStats, setFetchedStats] = React.useState<{ added: number; removed: number } | undefined>(undefined);

  const effectivePatch = initialPatch || fetchedPatch;

  // Background fallback if patch and diffStats were not present or 0
  React.useEffect(() => {
    if (initialDiffStats && (initialDiffStats.added > 0 || initialDiffStats.removed > 0)) {
      return;
    }
    if (initialPatch && initialPatch.trim()) {
      return;
    }
    if (!filePath || isRunning) {
      return;
    }

    let isMounted = true;
    const cleanPath = filePath.replace(/^file:\/\//, "").replace(/\\/g, "/");

    const fetchGitDiff = async () => {
      try {
        const workspaces = useWorkspaceStore.getState().workspaces;
        const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
        const activeChatId = useChatStore.getState().activeChatId;
        const chats = useChatStore.getState().chats;
        const activeChat = chats.find((c) => c.id === activeChatId);
        const currentWsId = activeChat ? activeChat.workspaceId : activeWorkspaceId;
        const targetWorkspace = workspaces.find((w) => w.id === currentWsId) || workspaces[0];

        if (!targetWorkspace) return;

        let relativePath = cleanPath;
        if (targetWorkspace.rootPath && relativePath.startsWith(targetWorkspace.rootPath)) {
          relativePath = relativePath.slice(targetWorkspace.rootPath.length).replace(/^[/\\]+/, "");
        }
        relativePath = relativePath.replace(/^[/\\]+/, "");

        const res = await client.gitDiff(targetWorkspace.id, relativePath, false);
        if (isMounted && res?.diff) {
          const lines = res.diff.split(/\r?\n/);
          const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
          const removed = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
          setFetchedPatch(res.diff);
          setFetchedStats({ added, removed });
        }
      } catch (err) {
        // Silently ignore if not in git or file uncommitted
      }
    };

    fetchGitDiff();
    return () => {
      isMounted = false;
    };
  }, [filePath, initialDiffStats, initialPatch, isRunning]);

  const { addedCount, removedCount } = React.useMemo(() => {
    if (initialDiffStats && (initialDiffStats.added > 0 || initialDiffStats.removed > 0)) {
      return { addedCount: initialDiffStats.added, removedCount: initialDiffStats.removed };
    }
    if (fetchedStats) {
      return { addedCount: fetchedStats.added, removedCount: fetchedStats.removed };
    }
    if (effectivePatch) {
      const lines = effectivePatch.split(/\r?\n/);
      const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
      const removed = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
      return { addedCount: added, removedCount: removed };
    }
    return { addedCount: 0, removedCount: 0 };
  }, [initialDiffStats, fetchedStats, effectivePatch]);

  const fileLinkInfo = React.useMemo(() => {
    return parseFileLink(filePath);
  }, [filePath]);

  const handleFileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileLinkInfo) {
      openFileInRightSidebar(fileLinkInfo);
    } else if (filePath) {
      const parsed = parseFileLink(filePath) || {
        isFile: true,
        originalHref: filePath,
        cleanPath: filePath.replace(/^file:\/\//, "").replace(/\\/g, "/"),
        fileName: filePath.split(/[/\\]/).pop() || filePath,
      };
      openFileInRightSidebar(parsed);
    }
  };

  const handleOpenDiff = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openDiffInRightSidebar({
      filePath,
      patch: effectivePatch,
    });
  };

  const displayTarget = target || (fileLinkInfo ? fileLinkInfo.cleanPath : filePath);

  return (
    <div className="w-full my-0.5 py-0.5 flex items-center justify-between text-xs text-[var(--muted-foreground)] select-none bg-transparent border-none p-0 group">
      {/* Left: Verb + File Icon & Path */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
        <span className="text-[12px] font-normal transition-colors shrink-0 text-[var(--muted-foreground)]">
          {verb || (isRunning ? "Editing" : "Edited")}
        </span>
        <span
          onClick={handleFileClick}
          className="inline-flex items-center gap-1 font-mono text-[11.5px] text-[var(--foreground)] hover:underline px-0.5 rounded transition-colors cursor-pointer group/link max-w-full truncate"
          title={`Preview ${displayTarget} in right sidebar`}
        >
          <FileIcon fileName={displayTarget} className="w-3.5 h-3.5 shrink-0 pointer-events-none" />
          <span className="truncate">{displayTarget}</span>
        </span>
      </div>

      {/* Right: Running/Failed status + Clickable (+, -) badge to open diff */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {isRunning && (
          <span className="text-amber-400/90 text-[11px] font-mono animate-pulse mr-1">
            ...
          </span>
        )}
        {isFailed && (
          <span className="text-rose-400 text-[10px] font-mono mr-1">
            (failed)
          </span>
        )}

        <button
          type="button"
          onClick={handleOpenDiff}
          className="inline-flex items-center gap-1 font-mono text-[10.5px] font-semibold hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none p-0 select-none"
          title={`Preview diff for ${displayTarget} in right sidebar`}
        >
          <span className="text-emerald-400">+{addedCount}</span>
          <span className="text-rose-400">-{removedCount}</span>
        </button>
      </div>
    </div>
  );
};
