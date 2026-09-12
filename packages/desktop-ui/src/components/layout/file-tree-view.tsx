import React, { useState, useEffect, useMemo } from "react";
import { ChevronRight, ChevronDown, Loader2, RotateCw, Search, X } from "lucide-react";
import { FileIcon } from "../ui/file-icon.js";
import { FileTreeNode } from "../../types/index.js";
import { client } from "../../network/client.js";
import { useWorkspaceStore, useUiStore } from "../../store/index.js";

interface FileTreeNodeItemProps {
  node: FileTreeNode;
  workspaceId: string;
  depth?: number;
  forceOpen?: boolean;
}

export const FileTreeNodeItem: React.FC<FileTreeNodeItemProps> = ({
  node,
  workspaceId,
  depth = 0,
  forceOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(forceOpen);
  const [children, setChildren] = useState<FileTreeNode[] | null | undefined>(node.children);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const openOrFocusTab = useUiStore((s) => s.openOrFocusTab);

  // Sync children when node updates (e.g. tree reload or parent re-render)
  useEffect(() => {
    setChildren(node.children);
  }, [node.children]);

  // Keep open if forceOpen is set by search filter
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const handleClick = async () => {
    if (node.isDirectory) {
      const nextOpen = !isOpen;
      // If expanding and children were not preloaded by server due to depth limit, lazy-load them!
      if (nextOpen && (children === null || children === undefined)) {
        setLoadingChildren(true);
        try {
          const res = await client.getWorkspaceTree(workspaceId, node.path, 6);
          setChildren(res?.children || []);
        } catch (err) {
          console.error("Failed to lazy-load directory contents:", err);
          setChildren([]);
        } finally {
          setLoadingChildren(false);
        }
      }
      setIsOpen(nextOpen);
    } else {
      setLoadingFile(true);
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
        setLoadingFile(false);
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
            {loadingChildren ? (
              <Loader2 className="w-3 h-3 text-sky-400 animate-spin shrink-0" />
            ) : isOpen ? (
              <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
            )}
            <FileIcon
              fileName={node.name}
              isDirectory={true}
              isOpen={isOpen}
              className="w-4 h-4 shrink-0"
            />
          </>
        ) : (
          <>
            <span className="w-3" />
            {loadingFile ? (
              <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
            ) : (
              <FileIcon
                fileName={node.name}
                isDirectory={false}
                className="w-4 h-4 shrink-0"
              />
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

      {node.isDirectory && isOpen && (
        <div>
          {loadingChildren ? (
            <div
              style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
              className="py-1 text-[10px] text-[var(--muted-foreground)] flex items-center gap-1.5"
            >
              <Loader2 className="w-2.5 h-2.5 animate-spin text-sky-400" />
              <span>Loading...</span>
            </div>
          ) : children && children.length === 0 ? (
            <div
              style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
              className="py-0.5 text-[10px] text-[var(--muted-foreground)] italic"
            >
              (empty)
            </div>
          ) : (
            children?.map((child) => (
              <FileTreeNodeItem
                key={child.path}
                node={child}
                workspaceId={workspaceId}
                depth={depth + 1}
                forceOpen={forceOpen}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Filter node and its children recursively
function filterTreeNode(node: FileTreeNode, query: string): { node: FileTreeNode; matches: boolean } | null {
  const queryLower = query.toLowerCase();
  const selfMatches = node.name.toLowerCase().includes(queryLower);

  if (!node.isDirectory) {
    return selfMatches ? { node, matches: true } : null;
  }

  const filteredChildren: FileTreeNode[] = [];
  if (node.children) {
    for (const child of node.children) {
      const res = filterTreeNode(child, query);
      if (res) {
        filteredChildren.push(res.node);
      }
    }
  }

  if (selfMatches || filteredChildren.length > 0) {
    return {
      node: {
        ...node,
        children: filteredChildren,
      },
      matches: true,
    };
  }

  return null;
}

export const FileTreeView: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const fileTree = useWorkspaceStore((s) => s.fileTrees[workspaceId]);
  const fileTreeVersion = useWorkspaceStore((s) => s.fileTreeVersion[workspaceId] || 0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Initial load and live reload when fileTreeVersion increments
  useEffect(() => {
    if (workspaceId) {
      loadTree();
    }
  }, [workspaceId, fileTreeVersion]);

  const displayedChildren = useMemo(() => {
    if (!fileTree?.children) return [];
    if (!searchQuery.trim()) return fileTree.children;

    const results: FileTreeNode[] = [];
    for (const child of fileTree.children) {
      const res = filterTreeNode(child, searchQuery.trim());
      if (res) {
        results.push(res.node);
      }
    }
    return results;
  }, [fileTree, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* File Tree Toolbar */}
      <div className="px-2 py-1.5 border-b border-[var(--border)] bg-[var(--background)] flex items-center gap-1.5 shrink-0">
        <div className="relative flex-1 flex items-center">
          <Search className="w-3 h-3 absolute left-2 text-[var(--muted-foreground)] pointer-events-none" />
          <input
            type="text"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-6 pl-6 pr-5 text-[11px] font-mono rounded bg-[var(--secondary)]/50 border border-transparent focus:border-[var(--border)] focus:outline-none placeholder:text-[var(--muted-foreground)]/60 text-[var(--foreground)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={loadTree}
          disabled={loading}
          title="Refresh files"
          className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors shrink-0 disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-sky-400" : ""}`} />
        </button>
      </div>

      {/* File List Content */}
      <div className="py-1 space-y-0.5 flex-1 overflow-y-auto pr-1">
        {loading && !fileTree ? (
          <div className="flex items-center gap-2 py-3 px-3 text-[11px] font-mono text-[var(--muted-foreground)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
            <span>Loading project files...</span>
          </div>
        ) : displayedChildren.length === 0 ? (
          <div className="py-3 px-3 text-[10px] font-mono text-[var(--muted-foreground)] italic text-center">
            {searchQuery ? "No files matching filter." : "No files found."}
          </div>
        ) : (
          displayedChildren.map((child) => (
            <FileTreeNodeItem
              key={child.path}
              node={child}
              workspaceId={workspaceId}
              depth={0}
              forceOpen={Boolean(searchQuery.trim())}
            />
          ))
        )}
      </div>
    </div>
  );
};
