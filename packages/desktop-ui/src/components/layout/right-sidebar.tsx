import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  FolderTree,
  Terminal,
  FileCode,
  GitCompare,
  GitBranch,
  X,
  Copy,
  Check,
  FolderGit2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useUiStore, useWorkspaceStore, useChatStore, EMPTY_MESSAGES, RightTabType } from "../../store/index.js";
import { FileTreeView } from "./file-tree-view.js";
import { GitView } from "./git-view.js";
import { DiffViewer } from "../chat/diff-viewer.js";
import { Button } from "../ui/button.js";
import { FileIcon } from "../ui/file-icon.js";
import { startWindowDrag, handleTitleBarDoubleClick } from "../../lib/window.js";

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
  const messages = useChatStore((s) => (activeChatId && s.messages[activeChatId] ? s.messages[activeChatId] : EMPTY_MESSAGES));

  const [isResizing, setIsResizing] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const currentIndex = tabs.findIndex((t) => t.id === activeTab?.id);
  const fileTabs = tabs.filter((t) => !t.isPermanent);

  // Tab switching via swipe
  const goToNextTab = () => {
    if (currentIndex < tabs.length - 1) {
      setActiveTabId(tabs[currentIndex + 1].id);
    }
  };

  const goToPrevTab = () => {
    if (currentIndex > 0) {
      setActiveTabId(tabs[currentIndex - 1].id);
    }
  };

  // Tab Strip Drag / Swipe & Wheel
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [isDraggingTabs, setIsDraggingTabs] = useState(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const handleTabStripMouseDown = (e: React.MouseEvent) => {
    if (!tabStripRef.current) return;
    setIsDraggingTabs(true);
    dragStartX.current = e.clientX;
    dragStartScrollLeft.current = tabStripRef.current.scrollLeft;
    hasDragged.current = false;
  };

  const handleTabStripMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingTabs || !tabStripRef.current) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 3) {
      hasDragged.current = true;
      tabStripRef.current.scrollLeft = dragStartScrollLeft.current - dx;
    }
  };

  const handleTabStripMouseUp = () => {
    setIsDraggingTabs(false);
  };

  const handleTabStripWheel = (e: React.WheelEvent) => {
    if (!tabStripRef.current) return;
    if (Math.abs(e.deltaX) > 0) {
      tabStripRef.current.scrollLeft += e.deltaX;
    } else if (Math.abs(e.deltaY) > 0) {
      tabStripRef.current.scrollLeft += e.deltaY;
    }
  };

  // Auto scroll active tab into view in the tab strip
  useEffect(() => {
    if (!tabStripRef.current) return;
    const el = tabStripRef.current.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    }
  }, [activeTabId]);

  // Touch Swipe on Content Area
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) {
        goToNextTab();
      } else {
        goToPrevTab();
      }
    }
  };

  // Trackpad Horizontal Swipe gesture on header / content
  const lastSwipeTime = useRef(0);
  const handleSwipeWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > 30 && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.8) {
      const now = Date.now();
      if (now - lastSwipeTime.current > 350) {
        if (e.deltaX > 30) {
          lastSwipeTime.current = now;
          goToNextTab();
        } else if (e.deltaX < -30) {
          lastSwipeTime.current = now;
          goToPrevTab();
        }
      }
    }
  };

  // Extract all command exec and file diff blocks from active chat for Terminal and Diff tabs
  const commandBlocks = useMemo(
    () =>
      messages.flatMap((m) =>
        m.blocks
          .filter((b) => b.type === "command_exec")
          .map((b) => ({ ...b, messageCreatedAt: m.createdAt }))
      ),
    [messages]
  );

  const diffBlocks = useMemo(
    () =>
      messages.flatMap((m) =>
        m.blocks
          .filter((b) => b.type === "file_diff")
          .map((b) => ({ ...b, messageCreatedAt: m.createdAt }))
      ),
    [messages]
  );

  if (!rightSidebarOpen || !activeTab) return null;

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

  const renderTabIcon = (type: RightTabType) => {
    switch (type) {
      case "fileTree":
        return <FolderTree className="w-3.5 h-3.5 text-amber-400" />;
      case "git":
        return <GitBranch className="w-3.5 h-3.5 text-rose-400" />;
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

      {/* Header Bar with Fixed Icons (Files, Terminal) + Dynamic File Tabs */}
      <div
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
        onDoubleClick={handleTitleBarDoubleClick}
        className="h-10 flex items-center border-b border-[var(--sidebar-border)] px-2 gap-1.5 shrink-0 bg-[var(--card)]/40 backdrop-blur-md text-xs select-none"
      >
        {/* Fixed Icons Outside Scroll: Files, Git & Terminal */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setActiveTabId("fileTree")}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
              activeTabId === "fileTree"
                ? "bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] shadow-xs"
                : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50 hover:text-[var(--foreground)]"
            }`}
            title="Files (Workspace File Tree)"
          >
            <FolderTree className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTabId("git")}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
              activeTabId === "git"
                ? "bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] shadow-xs"
                : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50 hover:text-[var(--foreground)]"
            }`}
            title="Source Control (Git)"
          >
            <GitBranch className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTabId("terminal")}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors cursor-pointer relative ${
              activeTabId === "terminal"
                ? "bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] shadow-xs"
                : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50 hover:text-[var(--foreground)]"
            }`}
            title={`Terminal Execution Feed (${commandBlocks.length} commands)`}
          >
            <Terminal className="w-4 h-4" />
            {commandBlocks.length > 0 && activeTabId !== "terminal" && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--foreground)]" />
            )}
          </button>
        </div>

        {/* Dynamic File Tabs (if any) */}
        {fileTabs.length > 0 ? (
          <>
            <div className="h-4 w-px bg-[var(--border)] shrink-0 mx-0.5" />
            <div
              ref={tabStripRef}
              onMouseDown={handleTabStripMouseDown}
              onMouseMove={handleTabStripMouseMove}
              onMouseUp={handleTabStripMouseUp}
              onMouseLeave={handleTabStripMouseUp}
              onWheel={handleTabStripWheel}
              className={`flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar py-1 cursor-grab ${
                isDraggingTabs ? "cursor-grabbing select-none" : ""
              }`}
            >
              {fileTabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    data-tab-id={tab.id}
                    onClick={() => {
                      if (hasDragged.current) return;
                      setActiveTabId(tab.id);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors shrink-0 text-xs ${
                      isActive
                        ? "bg-[var(--secondary)] text-[var(--foreground)] font-medium border border-[var(--border)] shadow-xs"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50 hover:text-[var(--foreground)]"
                    }`}
                    title={tab.data?.path || tab.title}
                  >
                    <FileIcon fileName={tab.data?.path || tab.title} className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[100px] font-mono text-[11px]">{tab.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="hover:text-[var(--foreground)] opacity-60 hover:opacity-100 p-0.5 rounded cursor-pointer"
                      title="Close file preview"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div data-tauri-drag-region className="flex-1 h-full" />
        )}
      </div>

      {/* Main Tab Content Panel with Touch & Trackpad Swipe Support */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleSwipeWheel}
        className="flex-1 flex flex-col overflow-hidden bg-[var(--background)] transition-opacity duration-150"
      >
        {/* 1. FILE TREE TAB */}
        {activeTab.type === "fileTree" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-9 px-3 flex items-center justify-between text-xs text-[var(--muted-foreground)] border-b border-[var(--border)] bg-[var(--secondary)]/30 font-mono shrink-0">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--foreground)] truncate">
                <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{activeWorkspace ? activeWorkspace.name : "No Workspace Selected"}</span>
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">Tree</span>
            </div>

            {activeWorkspaceId ? (
              <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
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

        {/* 2. GIT TAB */}
        {activeTab.type === "git" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <GitView workspaceId={activeWorkspaceId} />
          </div>
        )}

        {/* 3. TERMINAL TAB */}
        {activeTab.type === "terminal" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-9 px-3 text-xs font-mono text-[var(--muted-foreground)] border-b border-[var(--border)] flex items-center justify-between bg-[var(--secondary)]/30 shrink-0">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Command Execution Feed</span>
              </span>
              <span className="text-[10px]">{commandBlocks.length} executed</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs select-text no-scrollbar">
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
                      <pre className="p-2.5 text-[var(--foreground)]/85 overflow-x-auto text-[11px] leading-relaxed max-h-48 select-text font-mono no-scrollbar">
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
                <div className="h-9 px-3 flex items-center justify-between border-b border-[var(--border)] bg-[var(--secondary)]/30 font-mono text-xs shrink-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileIcon fileName={activeTab.data.path} className="w-3.5 h-3.5 shrink-0" />
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

                <div className="flex-1 overflow-auto p-3 bg-[var(--code-bg)] font-mono text-xs leading-relaxed select-text no-scrollbar">
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
                <FileIcon className="w-8 h-8 opacity-30 mb-2" />
                <p>Select any file from the Files tab to inspect its contents here.</p>
              </div>
            )}
          </div>
        )}

        {/* 4. DIFF TAB */}
        {activeTab.type === "diff" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-9 px-3 text-xs font-mono text-[var(--muted-foreground)] border-b border-[var(--border)] flex items-center justify-between bg-[var(--secondary)]/30 shrink-0">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--foreground)] truncate">
                <GitCompare className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">{activeTab.title || "File Diff"}</span>
              </span>
              <span className="text-[10px] shrink-0">
                {activeTab.data?.patch ? "1 file" : `${diffBlocks.length} modified`}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs select-text no-scrollbar">
              {activeTab.data?.patch ? (
                <div className="rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] overflow-hidden shadow-xs">
                  {activeTab.data.filePath && (
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 border-b border-[var(--code-border)] text-[var(--muted-foreground)]">
                      <span className="font-semibold text-[var(--foreground)] truncate text-[11px]">
                        {activeTab.data.filePath}
                      </span>
                    </div>
                  )}
                  <DiffViewer patch={activeTab.data.patch} />
                </div>
              ) : diffBlocks.length === 0 ? (
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

      {/* Navigation Dots Footer */}
      <div className="h-5 px-3 flex items-center justify-between border-t border-[var(--border)] bg-[var(--card)]/40 text-[10px] text-[var(--muted-foreground)] shrink-0 select-none">
        <span className="font-mono text-[9px] opacity-70">
          {currentIndex + 1} / {tabs.length}
        </span>
        <div className="flex items-center gap-1.5">
          {tabs.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => setActiveTabId(t.id)}
              className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                idx === currentIndex
                  ? "w-4 bg-sky-500"
                  : "w-1.5 bg-[var(--border)] hover:bg-[var(--muted-foreground)]"
              }`}
              title={`Switch to ${t.title}`}
            />
          ))}
        </div>
        <span className="w-5" />
      </div>
    </aside>
  );
};
