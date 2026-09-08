import React, { useState } from "react";
import {
  FolderTree,
  Terminal,
  FileCode,
  GitCompare,
  X,
  Copy,
  Check,
  FolderGit2,
} from "lucide-react";
import { useUiStore, useWorkspaceStore, useChatStore, RightTabType } from "../../store/index.js";
import { FileTreeView } from "./file-tree-view.js";
import { DiffViewer } from "../chat/diff-viewer.js";
import { Button } from "../ui/button.js";

export const RightSidebar: React.FC = () => {
  const rightSidebarOpen = useUiStore((s) => s.rightSidebarOpen);
  const rightSidebarWidth = useUiStore((s) => s.rightSidebarWidth);
  const setRightSidebarWidth = useUiStore((s) => s.setRightSidebarWidth);
  const tabs = useUiStore((s) => s.rightSidebarTabs);
  const activeTabId = useUiStore((s) => s.activeRightTabId);
  const setActiveTabId = useUiStore((s) => s.setActiveRightTabId);
  const closeTab = useUiStore((s) => s.closeTab);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const activeChatId = useChatStore((s) => s.activeChatId);
  const messages = useChatStore((s) => (activeChatId && s.messages[activeChatId] ? s.messages[activeChatId] : []));

  const [isResizing, setIsResizing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!rightSidebarOpen) return null;

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Dragging from left edge of right sidebar
      const delta = startX - moveEvent.clientX;
      setRightSidebarWidth(startWidth + delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Extract all command exec and file diff blocks from active chat for Terminal and Diff tabs
  const commandBlocks = messages.flatMap((m) =>
    m.blocks
      .filter((b) => b.type === "command_exec")
      .map((b) => ({ ...b, messageCreatedAt: m.createdAt }))
  );

  const diffBlocks = messages.flatMap((m) =>
    m.blocks
      .filter((b) => b.type === "file_diff")
      .map((b) => ({ ...b, messageCreatedAt: m.createdAt }))
  );

  const renderTabIcon = (type: RightTabType) => {
    switch (type) {
      case "fileTree":
        return <FolderTree className="w-3.5 h-3.5 text-amber-400" />;
      case "terminal":
        return <Terminal className="w-3.5 h-3.5 text-emerald-400" />;
      case "filePreview":
        return <FileCode className="w-3.5 h-3.5 text-sky-400" />;
      case "diff":
        return <GitCompare className="w-3.5 h-3.5 text-rose-400" />;
    }
  };

  return (
    <aside
      style={{ width: `${rightSidebarWidth}px` }}
      className="relative bg-[var(--sidebar-bg)] border-l border-[var(--sidebar-border)] flex flex-col h-screen select-none text-[13px] shrink-0"
    >
      {/* Resizer Handle on Left Edge */}
      <div
        onMouseDown={handleMouseDownResize}
        className={`absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-sky-500/40 transition-colors z-20 ${
          isResizing ? "bg-sky-500/60" : ""
        }`}
        title="Drag to resize right sidebar"
      />

      {/* Tab Strip Bar (Synchronized to 40px Header Height) */}
      <div
        data-tauri-drag-region
        className="h-10 flex items-center border-b border-[var(--sidebar-border)] px-2 gap-1 overflow-x-auto shrink-0 bg-[var(--card)]/40 backdrop-blur-md text-xs select-none no-scrollbar"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer transition-colors shrink-0 text-xs ${
                isActive
                  ? "bg-[var(--secondary)] text-[var(--foreground)] font-medium border border-[var(--border)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50 hover:text-[var(--foreground)]"
              }`}
            >
              {renderTabIcon(tab.type)}
              <span className="truncate max-w-[100px]">{tab.title}</span>
              {!tab.isPermanent && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="hover:text-[var(--foreground)] opacity-60 hover:opacity-100 p-0.5 rounded"
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Tab Content Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background)]/40">
        {/* 1. FILE TREE TAB */}
        {activeTab.type === "fileTree" && (
          <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] border-b border-[var(--border)] pb-2 font-mono">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>{activeWorkspace ? activeWorkspace.name : "No Workspace Selected"}</span>
              </span>
              <span className="text-[10px]">Tree</span>
            </div>

            {activeWorkspaceId ? (
              <div className="flex-1 overflow-y-auto">
                <FileTreeView workspaceId={activeWorkspaceId} />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-xs text-[var(--muted-foreground)] p-4 text-center">
                <FolderTree className="w-8 h-8 opacity-30 mb-2" />
                <p>Select a workspace from the left sidebar to view its project files.</p>
              </div>
            )}
          </div>
        )}

        {/* 2. TERMINAL TAB */}
        {activeTab.type === "terminal" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 text-xs font-mono text-[var(--muted-foreground)] border-b border-[var(--border)] flex items-center justify-between bg-[var(--secondary)]/30">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Command Execution Feed</span>
              </span>
              <span className="text-[10px]">{commandBlocks.length} executed</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs select-text">
              {commandBlocks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-[var(--muted-foreground)] p-4 text-center">
                  <Terminal className="w-8 h-8 opacity-30 mb-2 text-emerald-400" />
                  <p>No terminal commands executed yet in this session.</p>
                </div>
              ) : (
                commandBlocks.map((b, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] overflow-hidden shadow-xs"
                  >
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 border-b border-[var(--code-border)] text-[var(--muted-foreground)]">
                      <span className="font-semibold text-[var(--foreground)] truncate text-[11px]">
                        $ {b.command}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-emerald-500 tracking-wider">
                        {b.status}
                      </span>
                    </div>
                    {b.output && (
                      <pre className="p-2.5 text-[var(--foreground)]/85 overflow-x-auto text-[11px] leading-relaxed max-h-48 select-text font-mono">
                        {b.output}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. FILE PREVIEW TAB */}
        {activeTab.type === "filePreview" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab.data?.path ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--secondary)]/40 font-mono text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate font-semibold text-[var(--foreground)]">
                      {activeTab.data.path}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      navigator.clipboard.writeText(activeTab.data.content);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="gap-1 font-mono text-[10px]"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </Button>
                </div>

                <div className="flex-1 overflow-auto p-3 bg-[var(--code-bg)] font-mono text-xs leading-relaxed select-text">
                  <table className="w-full border-collapse">
                    <tbody>
                      {activeTab.data.content.split("\n").map((line: string, idx: number) => (
                        <tr key={idx} className="hover:bg-[var(--accent)]/40 transition-colors">
                          <td className="w-9 pr-3 text-right select-none text-[10px] text-[var(--muted-foreground)] opacity-50 align-top">
                            {idx + 1}
                          </td>
                          <td className="whitespace-pre align-top text-[var(--foreground)]/90">
                            {line || " "}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-xs text-[var(--muted-foreground)] p-4 text-center">
                <FileCode className="w-8 h-8 opacity-30 mb-2 text-sky-400" />
                <p>Select any file from the Files tab to inspect its contents here.</p>
              </div>
            )}
          </div>
        )}

        {/* 4. DIFF TAB */}
        {activeTab.type === "diff" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 text-xs font-mono text-[var(--muted-foreground)] border-b border-[var(--border)] flex items-center justify-between bg-[var(--secondary)]/30">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                <GitCompare className="w-3.5 h-3.5 text-rose-400" />
                <span>Workspace File Diffs</span>
              </span>
              <span className="text-[10px]">{diffBlocks.length} modified</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs select-text">
              {diffBlocks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-[var(--muted-foreground)] p-4 text-center">
                  <GitCompare className="w-8 h-8 opacity-30 mb-2 text-rose-400" />
                  <p>No file changes or diff patches proposed yet.</p>
                </div>
              ) : (
                diffBlocks.map((b, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] overflow-hidden shadow-xs"
                  >
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 border-b border-[var(--code-border)] text-[var(--muted-foreground)]">
                      <span className="font-semibold text-[var(--foreground)] truncate text-[11px]">
                        {b.path}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-sky-400 tracking-wider">
                        {b.status}
                      </span>
                    </div>
                    <DiffViewer patch={b.patch} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
