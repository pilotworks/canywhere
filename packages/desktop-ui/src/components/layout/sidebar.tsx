import React, { useState } from "react";
import {
  Folder,
  FolderGit2,
  MessageSquare,
  Plus,
  ChevronDown,
  ChevronRight,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Terminal,
  Settings,
  HelpCircle,
  FolderSearch,
  Loader2,
  Pause,
  Trash2,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import type { Chat, Workspace } from "../../types/index.js";
import { useConnectionStore, useWorkspaceStore, useChatStore, useUiStore, useDeviceStore } from "../../store/index.js";
import { client } from "../../network/client.js";
import { PairingModal } from "../pairing/pairing-modal.js";
import { ThemeToggle } from "../ui/theme-toggle.js";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";
import { startWindowDrag, handleTitleBarDoubleClick } from "../../lib/window.js";

interface SidebarChatItemProps {
  chat: Chat;
  isActive: boolean;
}

const SidebarChatItem: React.FC<SidebarChatItemProps> = ({ chat, isActive }) => {
  const isRunning = chat.status === "running";
  const isAwaitingApproval = chat.status === "awaitingApproval";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    client.deleteChat(chat.id);
  };

  const handleInterrupt = (e: React.MouseEvent) => {
    e.stopPropagation();
    client.interruptTurn(chat.id);
  };

  return (
    <div
      onClick={() => client.selectChat(chat.id)}
      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
        isActive
          ? "bg-[var(--secondary)] text-[var(--foreground)] font-medium border border-[var(--border)] shadow-xs"
          : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]"
      }`}
    >
      <div className="flex items-center gap-1.5 truncate min-w-0 flex-1 pr-1.5">
        <MessageSquare className="w-3 h-3 text-[var(--muted-foreground)] shrink-0 opacity-70" />
        <span className="truncate" title={chat.title || "New Chat"}>
          {chat.title || "New Chat"}
        </span>
      </div>

      <div className="flex items-center shrink-0">
        {isRunning ? (
          <div className="relative flex items-center justify-center w-4 h-4">
            <span className="group-hover:hidden flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
            </span>
            <button
              onClick={handleInterrupt}
              className="hidden group-hover:flex items-center justify-center w-4 h-4 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              title="Stop generating"
            >
              <Pause className="w-3 h-3 fill-current" />
            </button>
          </div>
        ) : isAwaitingApproval ? (
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--foreground)] animate-pulse"
            title="Awaiting approval"
          />
        ) : (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-all cursor-pointer"
            title="Delete chat"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const connectionStatus = useConnectionStore((s) => s.status);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const chats = useChatStore((s) => s.chats);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const devices = useDeviceStore((s) => s.devices);
  const activeDevicesCount = devices.filter((d) => !d.revoked).length;

  const [isResizing, setIsResizing] = useState(false);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [newWsOpen, setNewWsOpen] = useState(false);
  const [wsName, setWsName] = useState("");
  const [wsPath, setWsPath] = useState("");
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [editWsName, setEditWsName] = useState("");
  const [editWsPath, setEditWsPath] = useState("");
  const [deletingWs, setDeletingWs] = useState<Workspace | null>(null);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({
    all: true,
  });

  const handleOpenEdit = (ws: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWs(ws);
    setEditWsName(ws.name);
    setEditWsPath(ws.rootPath);
  };

  const handleBrowseFolderEdit = async () => {
    try {
      setIsPickingFolder(true);
      const chosen = await client.pickWorkspaceFolder();
      if (chosen) {
        setEditWsPath(chosen);
      }
    } catch (err) {
      console.error("[Sidebar] Failed to browse folder", err);
    } finally {
      setIsPickingFolder(false);
    }
  };

  const handleSaveEditWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWs || !editWsName.trim() || !editWsPath.trim()) return;
    await client.updateWorkspace(editingWs.id, editWsName.trim(), editWsPath.trim());
    setEditingWs(null);
  };

  const handleConfirmDeleteWorkspace = async () => {
    if (!deletingWs) return;
    await client.deleteWorkspace(deletingWs.id);
    setDeletingWs(null);
  };

  const toggleWorkspaceExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedWorkspaces((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setSidebarWidth(startWidth + delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleBrowseFolder = async () => {
    try {
      setIsPickingFolder(true);
      const chosen = await client.pickWorkspaceFolder();
      if (chosen) {
        setWsPath(chosen);
        if (!wsName) {
          // Auto-fill name with folder basename
          const parts = chosen.split("/").filter(Boolean);
          if (parts.length > 0) {
            setWsName(parts[parts.length - 1]);
          }
        }
      }
    } catch (err) {
      console.error("[Sidebar] Failed to browse folder", err);
    } finally {
      setIsPickingFolder(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName || !wsPath) return;
    const ws = await client.createWorkspace(wsName, wsPath);
    useWorkspaceStore.getState().setActiveWorkspaceId(ws.id);
    setNewWsOpen(false);
    setWsName("");
    setWsPath("");
  };

  const workspaceChats = (wsId: string) => chats.filter((c) => c.workspaceId === wsId);
  const standaloneChats = chats.filter((c) => !c.workspaceId);

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col h-screen select-none text-[13px] shrink-0"
    >
      {/* Resizer Handle */}
      <div
        onMouseDown={handleMouseDownResize}
        className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-sky-500/40 transition-colors z-20 ${
          isResizing ? "bg-sky-500/60" : ""
        }`}
        title="Drag to resize sidebar"
      />

      {/* Window Drag Title Bar Header for macOS */}
      <div
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
        onDoubleClick={handleTitleBarDoubleClick}
        className="h-10 flex items-center justify-between px-3 text-xs text-[var(--muted-foreground)] shrink-0"
      >
        <div data-tauri-drag-region onMouseDown={startWindowDrag} className="flex-1 h-full" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => client.createChat(activeWorkspaceId || undefined)}
          title="New Chat (⌘N)"
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* WORKSPACES SECTION */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span>Workspaces</span>
            </span>
            <button
              onClick={() => setNewWsOpen(true)}
              className="hover:text-[var(--foreground)] p-0.5 rounded cursor-pointer"
              title="Add Workspace directory"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {workspaces.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-[var(--muted-foreground)] italic">
                No workspaces added.
              </div>
            ) : (
              workspaces.map((ws) => {
                const isWsActive = activeWorkspaceId === ws.id;
                const isExpanded = expandedWorkspaces[ws.id] !== false; // Default expanded
                const childChats = workspaceChats(ws.id);

                return (
                  <div key={ws.id} className="space-y-0.5">
                    <div
                      onClick={() => useWorkspaceStore.getState().setActiveWorkspaceId(ws.id)}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                        isWsActive
                          ? "bg-[var(--secondary)] text-[var(--foreground)] font-medium"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <button
                          onClick={(e) => toggleWorkspaceExpand(ws.id, e)}
                          className="p-0.5 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </button>
                        <Folder className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
                        <span className="truncate">{ws.name}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            client.createChat(ws.id);
                          }}
                          className="p-1 rounded hover:bg-[var(--accent)] hover:text-[var(--foreground)] text-[var(--muted-foreground)] cursor-pointer"
                          title="New Chat in Workspace"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-[var(--accent)] hover:text-[var(--foreground)] text-[var(--muted-foreground)] cursor-pointer"
                              title="Workspace options"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={(e) => handleOpenEdit(ws, e as any)}
                              className="cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 mr-2 text-[var(--muted-foreground)]" />
                              <span>Edit Workspace</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingWs(ws);
                              }}
                              className="text-red-500 focus:text-red-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              <span>Delete Workspace</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Nested Chats */}
                    {isExpanded && childChats.length > 0 && (
                      <div className="pl-6 space-y-0.5">
                        {childChats.map((chat) => (
                          <SidebarChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={activeChatId === chat.id}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* STANDALONE CHATS */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            <span>Standalone</span>
            <button
              onClick={() => client.createChat()}
              className="hover:text-[var(--foreground)] p-0.5 rounded cursor-pointer"
              title="New Standalone Chat"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {standaloneChats.length === 0 ? (
              <div className="px-2 py-1 text-xs text-[var(--muted-foreground)] italic">
                No standalone chats.
              </div>
            ) : (
              standaloneChats.map((chat) => (
                <SidebarChatItem
                  key={chat.id}
                  chat={chat}
                  isActive={activeChatId === chat.id}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* FOOTER CONTROLS & STATUS */}
      <div className="p-2 bg-[var(--sidebar-bg)] space-y-1">
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                  : connectionStatus === "connecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-xs text-[var(--muted-foreground)]">
              {connectionStatus === "connected"
                ? "Host: 7890"
                : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPairingOpen(true)}
              title={activeDevicesCount > 0 ? `Pair Remote Device (${activeDevicesCount} connected)` : "Pair Remote Mobile Device"}
              className="relative"
            >
              <Smartphone className="w-3.5 h-3.5" />
              {activeDevicesCount > 0 && (
                <span className="absolute 0.5 top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-[var(--sidebar)]" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <PairingModal open={pairingOpen} onOpenChange={setPairingOpen} />

      {/* Add Workspace Modal */}
      {newWsOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateWorkspace}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl text-[var(--card-foreground)]"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Add Workspace</h3>
              <p className="text-xs text-[var(--muted-foreground)]">Register a local project directory for Codex to index.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted-foreground)] block">Display Name</label>
              <Input
                type="text"
                size="sm"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                placeholder="e.g. codex-anywhere"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted-foreground)] block">Directory Path</label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  size="sm"
                  value={wsPath}
                  onChange={(e) => setWsPath(e.target.value)}
                  placeholder="/path/to/project"
                  className="font-mono text-xs flex-1"
                  required
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleBrowseFolder}
                  disabled={isPickingFolder}
                  className="shrink-0 flex items-center gap-1.5 text-xs cursor-pointer"
                  title="Browse local project folder"
                >
                  <FolderSearch className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                  <span>{isPickingFolder ? "Opening..." : "Browse"}</span>
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setNewWsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Add Workspace
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Workspace Modal */}
      {editingWs && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditWorkspace}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl text-[var(--card-foreground)]"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Edit Workspace</h3>
              <p className="text-xs text-[var(--muted-foreground)]">Modify workspace name or local directory path.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted-foreground)] block">Display Name</label>
              <Input
                type="text"
                size="sm"
                value={editWsName}
                onChange={(e) => setEditWsName(e.target.value)}
                placeholder="e.g. codex-anywhere"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted-foreground)] block">Directory Path</label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  size="sm"
                  value={editWsPath}
                  onChange={(e) => setEditWsPath(e.target.value)}
                  placeholder="/path/to/project"
                  className="font-mono text-xs flex-1"
                  required
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleBrowseFolderEdit}
                  disabled={isPickingFolder}
                  className="shrink-0 flex items-center gap-1.5 text-xs cursor-pointer"
                  title="Browse local project folder"
                >
                  <FolderSearch className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                  <span>{isPickingFolder ? "Opening..." : "Browse"}</span>
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingWs(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Workspace Confirmation Dialog */}
      {deletingWs && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl text-[var(--card-foreground)]">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Delete Workspace?</h3>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Are you sure you want to delete workspace <strong className="text-[var(--foreground)]">{deletingWs.name}</strong>?
              </p>
              <p className="text-xs text-red-400/90 leading-relaxed bg-red-500/10 border border-red-500/20 rounded-md p-2.5">
                Warning: All conversation threads and message history in this workspace will be deleted from Canywhere. Your local files on disk will not be affected.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeletingWs(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDeleteWorkspace}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
