import React, { useState, useRef, useEffect, useCallback } from "react";
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
  ArrowDown,
  Bot,
  User,
  Copy,
  FileSearch,
  FlaskConical,
  GitCompare,
  Loader2,
  RotateCcw,
  Zap,
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
import { RenderBlock, MessageBlocksRenderer } from "./render-block.js";
import { InlineApprovalCard } from "./inline-approval-card.js";
import { startWindowDrag, handleTitleBarDoubleClick } from "../../lib/window.js";

const SLASH_COMMANDS = [
  { cmd: "/reset", desc: "Clear conversational state & start fresh" },
  { cmd: "/scratch", desc: "Toggle scratchpad ephemeral workspace" },
  { cmd: "/review", desc: "Trigger automated git changes code review" },
];

const QUICK_STARTERS = [
  {
    title: "Codebase Overview",
    desc: "Explain architecture, entrypoints, and core invariants",
    prompt: "Can you provide a high-level overview of this codebase architecture and its main components?",
    icon: <FileSearch className="w-4 h-4 text-sky-400 shrink-0" />,
  },
  {
    title: "Run Tests & Fix",
    desc: "Execute test suite and diagnose any broken assertions",
    prompt: "Please run the test suite and help diagnose and fix any failures found.",
    icon: <FlaskConical className="w-4 h-4 text-emerald-400 shrink-0" />,
  },
  {
    title: "Review Git Changes",
    desc: "Inspect working tree diff and summarize changes",
    prompt: "Inspect the git status and diff, and summarize all current uncommitted changes.",
    icon: <GitCompare className="w-4 h-4 text-amber-400 shrink-0" />,
  },
  {
    title: "Refactor & Cleanup",
    desc: "Identify dead code, unused imports, or code smells",
    prompt: "Identify opportunities for refactoring, unused code, or quality improvements in the current workspace.",
    icon: <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />,
  },
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
  const selectedEffort = useModelStore((s) => s.selectedEffort);
  const setSelectedEffort = useModelStore((s) => s.setSelectedEffort);

  const activeModelInfo = models.find((m) => m.model === selectedModel);
  const supportedEfforts = activeModelInfo?.supportedReasoningEfforts || [];

  const [input, setInput] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasUnseenMessages, setHasUnseenMessages] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeWorkspace = workspaces.find((w) => w.id === activeChat?.workspaceId);
  const isRunning = activeChat?.status === "running";

  // Filter approvals for this active chat
  const chatApprovals = pendingApprovals.filter(
    (a) => a.chatId === activeChatId && a.status === "pending"
  );

  // Smart Auto-Scroll: Track user scroll position
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasUnseenMessages(false);
    }
  }, []);

  // Auto-scroll on new message if user was already at bottom; otherwise notify
  useEffect(() => {
    if (!scrollRef.current) return;
    if (isAtBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else {
      setHasUnseenMessages(true);
    }
  }, [messages, chatApprovals, isAtBottom]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setIsAtBottom(true);
      setHasUnseenMessages(false);
    }
  };

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
    await client.interruptTurn(activeChat.id, activeTurnId || undefined);
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
              <span>{activeModelInfo?.displayName || selectedModel || "Select Model"}</span>
              <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {(models.length > 0 ? models : [
                { id: "gpt-5-codex", model: "gpt-5-codex", displayName: "gpt-5-codex", description: "Frontier autonomous coding", isDefault: true, supportedReasoningEfforts: ["low", "medium", "high"], defaultReasoningEffort: "medium" },
                { id: "o3-mini", model: "o3-mini", displayName: "o3-mini", description: "Fast reasoning", isDefault: false, supportedReasoningEfforts: ["low", "medium", "high"], defaultReasoningEffort: "medium" },
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

          {/* Reasoning Effort Selector Dropdown (when supported by model) */}
          {supportedEfforts.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--secondary)] border border-[var(--border)] font-mono text-[11px] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer select-none">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="capitalize">{selectedEffort || "effort"}</span>
                <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {supportedEfforts.map((eff) => (
                  <DropdownMenuItem
                    key={eff}
                    onClick={() => setSelectedEffort(eff)}
                    className="flex items-center justify-between font-mono text-xs cursor-pointer py-1.5 capitalize"
                  >
                    <span>{eff}</span>
                    {selectedEffort === eff && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-6 relative"
      >
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto py-12 px-4 flex flex-col items-center text-center select-none">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mb-4 text-emerald-500">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">
              {activeWorkspace ? activeWorkspace.name : "Autonomous Coding Session"}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] max-w-md mb-8">
              {activeWorkspace
                ? `Ready to inspect, modify, test, and run commands in ${activeWorkspace.rootPath}.`
                : "Isolated scratchpad session. Ask questions, draft scripts, or explore ideas."}
            </p>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {QUICK_STARTERS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(item.prompt);
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                    }
                  }}
                  className="group flex flex-col p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/60 hover:bg-[var(--secondary)] hover:border-[var(--ring)] transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {item.icon}
                    <span className="text-xs font-semibold text-[var(--foreground)] group-hover:text-emerald-400 transition-colors">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-2">
                    {item.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const textContent = msg.blocks
              .filter((b) => b.type === "text")
              .map((b) => (b as any).content)
              .join("\n");

            if (isUser) {
              return (
                <div key={msg.id} className="group max-w-3xl mx-auto flex flex-col items-end space-y-1">
                  <div className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed select-text bg-[var(--secondary)]/80 border border-[var(--border)] text-[var(--foreground)] max-w-[85%] shadow-xs">
                    <MessageBlocksRenderer blocks={msg.blocks} />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)] font-mono opacity-0 group-hover:opacity-100 transition-opacity pr-1 select-none">
                    {textContent && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(textContent);
                          setCopiedMsgId(msg.id);
                          setTimeout(() => setCopiedMsgId(null), 1500);
                        }}
                        className="p-1 rounded hover:bg-[var(--secondary)] transition-all cursor-pointer hover:text-[var(--foreground)]"
                        title="Copy prompt"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                    <span>
                      {new Date(Number(msg.createdAt)).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            }

            const isMsgStreaming = isRunning && msg.streaming;
            let userTurnTime = Number(msg.createdAt);
            for (let i = idx - 1; i >= 0; i--) {
              if (messages[i].role === "user") {
                userTurnTime = Number(messages[i].createdAt);
                break;
              }
            }
            const durationSeconds = Math.max(1, Math.round((Number(msg.createdAt) - userTurnTime) / 1000));

            return (
              <div key={msg.id} className="group max-w-3xl mx-auto space-y-1.5">
                {/* Assistant Message Body */}
                <div className="text-[13px] leading-relaxed select-text text-[var(--foreground)]">
                  <MessageBlocksRenderer
                    blocks={msg.blocks}
                    isStreaming={isMsgStreaming}
                    durationSeconds={durationSeconds}
                  />

                  {isRunning && msg.streaming && msg.blocks.length === 0 && (
                    <div className="inline-flex items-center gap-2 text-[var(--muted-foreground)] text-xs font-mono py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                      <span className="animate-pulse">Analyzing codebase & formulating response...</span>
                    </div>
                  )}

                  {isRunning && msg.streaming && msg.blocks.length > 0 && (
                    <div className="inline-flex items-center gap-1.5 text-[var(--muted-foreground)] text-[11px] font-mono pt-2 opacity-75 select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Streaming response...</span>
                    </div>
                  )}
                </div>

                {/* Subtle Actions Bar on Hover */}
                <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)] font-mono opacity-0 group-hover:opacity-100 transition-opacity pl-0.5 select-none">
                  {textContent && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(textContent);
                        setCopiedMsgId(msg.id);
                        setTimeout(() => setCopiedMsgId(null), 1500);
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--secondary)] transition-all cursor-pointer hover:text-[var(--foreground)]"
                      title="Copy response"
                    >
                      {copiedMsgId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                  <span>
                    {new Date(Number(msg.createdAt)).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Inline Pending Approvals Banner */}
        {chatApprovals.map((approval) => (
          <div key={approval.id} className="max-w-3xl mx-auto">
            <InlineApprovalCard approval={approval} />
          </div>
        ))}
      </div>

      {/* Floating Jump to Bottom Button */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-28 right-8 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-medium shadow-lg hover:opacity-95 transition-all cursor-pointer select-none"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>{hasUnseenMessages ? "New messages below" : "Scroll to bottom"}</span>
          {hasUnseenMessages && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      )}

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
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] font-medium">
                {activeWorkspace ? `Root: ${activeWorkspace.name}` : "Scratchpad mode"}
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--secondary)]/70 border border-[var(--border)] text-[var(--muted-foreground)]">
                {activeModelInfo?.displayName || selectedModel}
                {selectedEffort && ` · ${selectedEffort}`}
              </span>
              <span className="font-mono text-[10px] text-[var(--muted-foreground)] opacity-75">
                ⚡ Context: ~32k tokens
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono opacity-60">
                {isRunning ? "Steer turn ↵" : "↵ to send · ⇧↵ newline"}
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
