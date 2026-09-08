import React, { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  FolderGit2,
  MessageSquare,
  Plus,
  ChevronDown,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  FolderPlus
} from "lucide-react";
import { useConnectionStore, useWorkspaceStore, useChatStore } from "../store/index.js";
import { client } from "../network/client.js";
import { PairingModal } from "./PairingModal.js";

export const Sidebar: React.FC = () => {
  const connectionStatus = useConnectionStore((s) => s.status);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const chats = useChatStore((s) => s.chats);
  const activeChatId = useChatStore((s) => s.activeChatId);

  const [pairingOpen, setPairingOpen] = useState(false);
  const [newWsOpen, setNewWsOpen] = useState(false);
  const [wsName, setWsName] = useState("");
  const [wsPath, setWsPath] = useState("");

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const filteredChats = activeWorkspaceId
    ? chats.filter((c) => c.workspaceId === activeWorkspaceId)
    : chats;

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName || !wsPath) return;
    const ws = await client.createWorkspace(wsName, wsPath);
    useWorkspaceStore.getState().setActiveWorkspaceId(ws.id);
    setNewWsOpen(false);
    setWsName("");
    setWsPath("");
  };

  return (
    <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col h-screen select-none">
      {/* Workspace Selector */}
      <div className="p-3 border-b border-neutral-800">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="w-full flex items-center justify-between p-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-left transition border border-neutral-700/60 cursor-pointer">
              <div className="flex items-center gap-2.5 truncate">
                <FolderGit2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-sm font-medium truncate">
                  {activeWorkspace ? activeWorkspace.name : "All Workspaces"}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content className="w-64 bg-neutral-800 border border-neutral-700 rounded-lg p-1.5 shadow-xl z-50 text-neutral-100">
              <DropdownMenu.Item
                onClick={() => useWorkspaceStore.getState().setActiveWorkspaceId(null)}
                className="flex items-center gap-2 p-2 rounded text-sm hover:bg-neutral-700/80 cursor-pointer"
              >
                <FolderGit2 className="w-4 h-4 text-neutral-400" />
                <span>All Workspaces</span>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-neutral-700 my-1" />

              {workspaces.map((ws) => (
                <DropdownMenu.Item
                  key={ws.id}
                  onClick={() => useWorkspaceStore.getState().setActiveWorkspaceId(ws.id)}
                  className="flex items-center justify-between p-2 rounded text-sm hover:bg-neutral-700/80 cursor-pointer"
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === activeWorkspaceId && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  )}
                </DropdownMenu.Item>
              ))}

              <DropdownMenu.Separator className="h-px bg-neutral-700 my-1" />

              <DropdownMenu.Item
                onClick={() => setNewWsOpen(true)}
                className="flex items-center gap-2 p-2 rounded text-sm text-indigo-400 hover:bg-neutral-700/80 cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Add Local Workspace...</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* New Chat Action */}
      <div className="p-3">
        <button
          onClick={() => client.createChat(activeWorkspaceId ?? undefined)}
          className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Chat Session List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        <div className="px-2 py-1 text-xs font-semibold text-neutral-500 tracking-wider uppercase">
          Sessions
        </div>
        {filteredChats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => client.selectChat(chat.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition text-left cursor-pointer ${
              chat.id === activeChatId
                ? "bg-neutral-800 text-white font-medium border border-neutral-700/80"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0 text-neutral-500" />
            <span className="truncate flex-1">{chat.title}</span>
            {chat.status === "running" && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
            {chat.status === "awaitingApproval" && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        ))}
      </div>

      {/* Bottom Bar (Status & Mobile Pairing) */}
      <div className="p-3 border-t border-neutral-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {connectionStatus === "connected" ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Daemon Active
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              Connecting...
            </span>
          )}
        </div>

        <button
          onClick={() => setPairingOpen(true)}
          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
          title="Pair iOS Device"
        >
          <Smartphone className="w-4 h-4" />
          <span className="text-xs">Pair</span>
        </button>
      </div>

      <PairingModal open={pairingOpen} onOpenChange={setPairingOpen} />

      {/* Inline Modal to Add Workspace */}
      {newWsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateWorkspace}
            className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 w-full max-w-md space-y-4"
          >
            <h3 className="text-lg font-semibold">Add Workspace Directory</h3>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Display Name</label>
              <input
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                placeholder="e.g. My Project"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Absolute Directory Path</label>
              <input
                type="text"
                value={wsPath}
                onChange={(e) => setWsPath(e.target.value)}
                placeholder="e.g. /Users/name/work/project"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewWsOpen(false)}
                className="px-4 py-2 text-sm rounded-lg bg-neutral-800 hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                Save Workspace
              </button>
            </div>
          </form>
        </div>
      )}
    </aside>
  );
};
