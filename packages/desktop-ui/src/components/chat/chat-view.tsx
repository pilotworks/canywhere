import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Square,
  Sparkles,
  Terminal,
  FolderGit2,
  ChevronDown,
  Cpu,
  CornerDownLeft,
  Paperclip,
  Compass,
  Check,
  PanelRight,
} from "lucide-react";
import { useChatStore, useWorkspaceStore, useApprovalStore, useModelStore, useUiStore, EMPTY_MESSAGES } from "../../store/index.js";
import { client } from "../../network/client.js";
import { Message } from "../../types/index.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";
import { RenderBlock } from "./render-block.js";
import { InlineApprovalCard } from "./inline-approval-card.js";
import { startWindowDrag, handleTitleBarDoubleClick } from "../../lib/window.js";

const SLASH_COMMANDS = [
  { cmd: "/reset", desc: "Clear conversational state & start fresh" },
  { cmd: "/scratch", desc: "Toggle scratchpad ephemeral workspace" },
  { cmd: "/review", desc: "Trigger automated git changes code review" },
];

export const ChatView: React.FC = () => {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const chats = useChatStore((s) => s.chats);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const messages = useChatStore((s) =>
    activeChatId && s.messages[activeChatId] ? s.messages[activeChatId] : EMPTY_MESSAGES
  );
  const activeTurnId = useChatStore((s) =>
    activeChatId && s.activeTurnId[activeChatId] ? s.activeTurnId[activeChatId] : null
  );
  const pendingApprovals = useApprovalStore((s) => s.pendingApprovals);

  const models = useModelStore((s) => s.models);
  const selectedModel = useModelStore((s) => s.selectedModel);
  const setSelectedModel = useModelStore((s) => s.setSelectedModel);

  const [input, setInput] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeWorkspace = workspaces.find((w) => w.id === activeChat?.workspaceId);
  const isRunning = activeChat?.status === "running";

  // Filter approvals for this active chat
  const chatApprovals = pendingApprovals.filter(
    (a) => a.chatId === activeChatId && a.status === "pending"
  );

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatApprovals]);

  // Auto-resize textarea height
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    if (val.startsWith("/")) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleSelectSlash = (cmd: string) => {
    setInput(cmd + " ");
    setShowSlashMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-[var(--background)] select-none">
        {/* Header bar in empty state matching sidebar height and draggable */}
        <header
          data-tauri-drag-region
          onMouseDown={startWindowDrag}
          onDoubleClick={handleTitleBarDoubleClick}
          className="h-10 border-b border-[var(--border)] px-4 flex items-center justify-between shrink-0 bg-[var(--card)]/50 backdrop-blur-md text-xs select-none"
        >
          <div data-tauri-drag-region className="flex items-center gap-2 text-[var(--muted-foreground)]">
            <Terminal className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
            <span className="text-[var(--muted-foreground)] font-medium">No Active Session</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={useUiStore.getState().toggleRightSidebar}
            title="Toggle Right Sidebar"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          >
            <PanelRight className="w-4 h-4" />
          </Button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)] p-8">
          <div className="w-12 h-12 rounded-2xl bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center mb-4 text-[var(--foreground)]">
            <Terminal className="w-5 h-5 text-[var(--foreground)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">Canywhere Autonomous Coding Assistant</h3>
          <p className="text-xs text-[var(--muted-foreground)] text-center max-w-sm mb-6">
            Decoupled remote workstation controller for OpenAI Codex and CLI models.
          </p>
          <Button size="sm" onClick={() => client.createChat()}>
            Start New Conversation
          </Button>
        </div>
      </div>
    );
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const text = input.trim();
    setInput("");
    setShowSlashMenu(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Handle slash commands client-side if applicable
    if (text === "/reset") {
      await client.createChat(activeChat.workspaceId ?? undefined, "New Conversation");
      return;
    }

    // Mid-turn Steering or Regular Turn
    if (isRunning && activeTurnId) {
      await client.steerTurn(activeChat.id, activeTurnId, text);
    } else {
      await client.sendTurn(activeChat.id, text, selectedModel);
    }
  };

  const handleInterrupt = async () => {
    if (activeTurnId) {
      await client.interruptTurn(activeChat.id, activeTurnId);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[var(--background)] text-[var(--foreground)] select-text">
      {/* Top Header / Breadcrumbs Bar */}
      <header
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
        onDoubleClick={handleTitleBarDoubleClick}
        className="h-10 border-b border-[var(--border)] px-4 flex items-center justify-between shrink-0 bg-[var(--card)]/50 backdrop-blur-md text-xs select-none"
      >
        <div data-tauri-drag-region className="flex items-center gap-2 text-[var(--muted-foreground)] truncate flex-1 min-w-0 mr-4">
          {activeWorkspace ? (
            <>
              <FolderGit2 className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
              <span className="font-medium text-[var(--foreground)] truncate">{activeWorkspace.name}</span>
              <span>›</span>
            </>
          ) : (
            <>
              <Terminal className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
              <span>Standalone</span>
              <span>›</span>
            </>
          )}
          <span className="truncate text-[var(--foreground)] font-medium">{activeChat.title}</span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Model Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--secondary)] border border-[var(--border)] font-mono text-[11px] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer select-none">
              <Cpu className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              <span>{selectedModel}</span>
              <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {(models.length > 0 ? models : [
                { id: "gpt-5-codex", model: "gpt-5-codex", displayName: "gpt-5-codex", description: "Frontier autonomous coding", isDefault: true, supportedReasoningEfforts: [], defaultReasoningEffort: null },
                { id: "o3-mini", model: "o3-mini", displayName: "o3-mini", description: "Fast reasoning", isDefault: false, supportedReasoningEfforts: [], defaultReasoningEffort: null },
                { id: "gpt-4o", model: "gpt-4o", displayName: "gpt-4o", description: "General purpose", isDefault: false, supportedReasoningEfforts: [], defaultReasoningEffort: null },
              ]).map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => setSelectedModel(m.model)}
                  className="flex items-center justify-between font-mono text-xs cursor-pointer py-1.5"
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="font-medium text-[var(--foreground)]">{m.displayName || m.model}</span>
                    {m.description && (
                      <span className="text-[10px] text-[var(--muted-foreground)] truncate">{m.description}</span>
                    )}
                  </div>
                  {selectedModel === m.model && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isRunning && (
            <Button
              variant="destructive"
              size="xs"
              onClick={handleInterrupt}
              className="flex items-center gap-1 font-mono cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>INTERRUPT</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={useUiStore.getState().toggleRightSidebar}
            title="Toggle Right Sidebar"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          >
            <PanelRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Message History Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className="max-w-3xl mx-auto space-y-1.5">
              {/* Message Header */}
              <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] font-mono select-none">
                <span className={`font-semibold ${isUser ? "text-[var(--foreground)]" : "text-emerald-500"}`}>
                  {isUser ? "You" : `Codex (${selectedModel})`}
                </span>
                <span>
                  {new Date(Number(msg.createdAt)).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>

              {/* Message Body */}
              <div
                className={`rounded-xl p-3.5 text-[13px] leading-relaxed select-text ${
                  isUser
                    ? "bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)]"
                    : "bg-transparent text-[var(--foreground)]"
                }`}
              >
                {msg.blocks.map((block, idx) => (
                  <RenderBlock key={idx} block={block} />
                ))}

                {msg.streaming && msg.blocks.length === 0 && (
                  <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs font-mono py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--foreground)] animate-pulse" />
                    <span>Analyzing codebase...</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Inline Pending Approvals Banner */}
        {chatApprovals.map((approval) => (
          <div key={approval.id} className="max-w-3xl mx-auto">
            <InlineApprovalCard approval={approval} />
          </div>
        ))}
      </div>

      {/* Information Dense Composer Input Area */}
      <div className="p-4 shrink-0 relative">
        {/* Slash Command Suggestions Popover */}
        {showSlashMenu && (
          <div className="max-w-3xl mx-auto mb-2 rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg overflow-hidden font-mono text-xs select-none">
            <div className="px-3 py-1.5 bg-[var(--secondary)]/70 text-[10px] uppercase font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)]">
              Slash Commands
            </div>
            {SLASH_COMMANDS.map((s) => (
              <button
                key={s.cmd}
                onClick={() => handleSelectSlash(s.cmd)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                <span className="font-semibold text-emerald-400">{s.cmd}</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">{s.desc}</span>
              </button>
            ))}
          </div>
        )}

        <div className="max-w-3xl mx-auto rounded-xl border border-[var(--border)] bg-[var(--sidebar-bg)] focus-within:border-[var(--ring)] focus-within:ring-1 focus-within:ring-[var(--ring)] transition-all shadow-xs overflow-hidden">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              } else if (e.key === "Escape") {
                setShowSlashMenu(false);
              }
            }}
            placeholder={
              isRunning
                ? "Type mid-turn guidance to steer Codex, or click Interrupt above..."
                : "Ask Codex to code, run tests, or refactor... (Type / for commands, Enter to send)"
            }
            rows={2}
            className="w-full bg-transparent p-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none resize-none font-mono min-h-[52px]"
          />

          {/* Composer Utility Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border-subtle)] bg-[var(--secondary)]/30 text-[11px] text-[var(--muted-foreground)] select-none">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--secondary)] border border-[var(--border)]">
                {activeWorkspace ? `Root: ${activeWorkspace.name}` : "Scratchpad mode"}
              </span>
              <span className="font-mono text-[10px] text-[var(--muted-foreground)] opacity-75">
                ⚡ Context: ~32k tokens
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono opacity-60">
                {isRunning ? "Steer turn ↵" : "Press ↵ to send"}
              </span>
              <Button
                size="xs"
                disabled={!input.trim()}
                onClick={() => handleSend()}
                className="gap-1 font-mono"
              >
                <span>{isRunning ? "Steer" : "Send"}</span>
                <CornerDownLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
