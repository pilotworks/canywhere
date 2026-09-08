import React, { useState } from "react";
import { Folder, FolderOpen, FileCode, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { FileTreeNode } from "../../types/index.js";
import { client } from "../../network/client.js";
import { useWorkspaceStore, useUiStore } from "../../store/index.js";

interface FileTreeNodeItemProps {
  node: FileTreeNode;
  workspaceId: string;
  depth?: number;
}

export const FileTreeNodeItem: React.FC<FileTreeNodeItemProps> = ({ node, workspaceId, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const openOrFocusTab = useUiStore((s) => s.openOrFocusTab);

  const handleClick = async () => {
    if (node.isDirectory) {
      setIsOpen(!isOpen);
    } else {
      setLoading(true);
      try {
        const fileData = await client.readWorkspaceFile(workspaceId, node.path);
        openOrFocusTab({
          id: `file:${fileData.path}`,
          type: "filePreview",
          title: node.name,
          data: {
            workspaceId,
            path: fileData.path,
            content: fileData.content,
          },
        });
      } catch (err) {
        console.error("Failed to read file", err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="select-none font-mono text-[11px]">
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        className="flex items-center gap-1.5 py-1 pr-2 rounded-md hover:bg-[var(--secondary)] cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors group"
      >
        {node.isDirectory ? (
          <>
            {isOpen ? (
              <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
            )}
            {isOpen ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3" />
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            )}
          </>
        )}

        <span className="truncate flex-1">{node.name}</span>

        {node.size !== null && node.size !== undefined && !node.isDirectory && (
          <span className="text-[9px] opacity-0 group-hover:opacity-60 transition-opacity">
            {Math.round(Number(node.size) / 1024)}k
          </span>
        )}
      </div>

      {node.isDirectory && isOpen && node.children && (
        <div>
          {node.children.length === 0 ? (
            <div
              style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
              className="py-0.5 text-[10px] text-[var(--muted-foreground)] italic"
            >
              (empty)
            </div>
          ) : (
            node.children.map((child) => (
              <FileTreeNodeItem
                key={child.path}
                node={child}
                workspaceId={workspaceId}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const FileTreeView: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const fileTree = useWorkspaceStore((s) => s.fileTrees[workspaceId]);
  const [loading, setLoading] = useState(false);

  const loadTree = async () => {
    setLoading(true);
    try {
      const tree = await client.getWorkspaceTree(workspaceId);
      useWorkspaceStore.getState().setFileTree(workspaceId, tree);
    } catch (err) {
      console.error("Failed to load file tree", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!fileTree && workspaceId) {
      loadTree();
    }
  }, [workspaceId]);

  if (loading && !fileTree) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 text-[11px] font-mono text-[var(--muted-foreground)]">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading project files...</span>
      </div>
    );
  }

  if (!fileTree || !fileTree.children || fileTree.children.length === 0) {
    return (
      <div className="py-1.5 px-3 text-[10px] font-mono text-[var(--muted-foreground)] italic">
        No files found.
      </div>
    );
  }

  return (
    <div className="py-1 space-y-0.5 flex-1 overflow-y-auto pr-1">
      {fileTree.children.map((child) => (
        <FileTreeNodeItem key={child.path} node={child} workspaceId={workspaceId} depth={0} />
      ))}
    </div>
  );
};
