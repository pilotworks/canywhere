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
  Shield,
  Eye,
  Flame,
  Folder,
  Plus,
} from "lucide-react";
import { useChatStore, useWorkspaceStore, useApprovalStore, useModelStore, useUiStore, EMPTY_MESSAGES } from "../../store/index.js";
import { client } from "../../network/client.js";
import { Message, PermissionMode, FuzzyFileMatchItem } from "../../types/index.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu.js";
import { RenderBlock, MessageBlocksRenderer } from "./render-block.js";
import { ApprovalTray } from "./approval-tray.js";
import { startWindowDrag, handleTitleBarDoubleClick } from "../../lib/window.js";
import {
  FileSearchPopup,
  SlashCommandPopup,
  CANYWHERE_SLASH_COMMANDS,
  SlashCommandDefinition,
} from "./composer-popups.js";
import { ModelEffortCombo } from "./model-effort-combo.js";
import { QueueTray } from "./queue-tray.js";

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

const PERMISSION_CONFIG: Record<
  PermissionMode,
  { label: string; shortLabel: string; desc: string; icon: React.ReactNode; colorClass: string; badgeBorder: string }
> = {
  onRequest: {
    label: "Ask for Approval",
    shortLabel: "Safe",
    desc: "Requires explicit user confirmation for shell commands and write actions",
    icon: <Shield className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />,
    colorClass: "text-[var(--foreground)]",
    badgeBorder: "border-[var(--border)] text-[var(--foreground)] bg-[var(--secondary)]/80 hover:bg-[var(--secondary)]",
  },
  readOnly: {
    label: "Plan Only (Read-Only)",
    shortLabel: "Plan Only",
    desc: "Disallows modifying files or executing state-altering shell commands",
    icon: <Eye className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />,
    colorClass: "text-[var(--foreground)]",
    badgeBorder: "border-[var(--border)] text-[var(--foreground)] bg-[var(--secondary)]/80 hover:bg-[var(--secondary)]",
  },
  auto: {
    label: "Full Auto (YOLO)",
    shortLabel: "Full Auto",
    desc: "Autonomously executes all commands and applies edits without prompt",
    icon: <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />,
    colorClass: "text-amber-500 dark:text-amber-400 font-medium",
    badgeBorder: "border-amber-500/40 text-amber-500 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20",
  },
};

export const ChatView: React.FC = () => {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const chats = useChatStore((s) => s.chats);
  const draftChat = useChatStore((s) => s.draftChat);
  const draftPermissionMode = useChatStore((s) => s.draftPermissionMode);
  const setDraftPermissionMode = useChatStore((s) => s.setDraftPermissionMode);
  const setDraftChat = useChatStore((s) => s.setDraftChat);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const messages = useChatStore((s) =>
    activeChatId && s.messages[activeChatId] ? s.messages[activeChatId] : EMPTY_MESSAGES
  );
  const activeTurnId = useChatStore((s) =>
    activeChatId && s.activeTurnId[activeChatId] ? s.activeTurnId[activeChatId] : null
  );
  const queuedMessages = useChatStore((s) => s.queuedMessages);
  const activeChatQueue = activeChatId ? (queuedMessages[activeChatId] || []) : [];
  const pendingApprovals = useApprovalStore((s) => s.pendingApprovals);

  const models = useModelStore((s) => s.models);
  const selectedModel = useModelStore((s) => s.selectedModel);
  const setSelectedModel = useModelStore((s) => s.setSelectedModel);
  const selectedEffort = useModelStore((s) => s.selectedEffort);
  const setSelectedEffort = useModelStore((s) => s.setSelectedEffort);

  const activeModelInfo = models.find((m) => m.model === selectedModel);
  const supportedEfforts = activeModelInfo?.supportedReasoningEfforts || [];

  const [input, setInput] = useState("");
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasUnseenMessages, setHasUnseenMessages] = useState(false);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);

  // File mention state (@)
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [fileResults, setFileResults] = useState<FuzzyFileMatchItem[]>([]);
  const [fileSelectIndex, setFileSelectIndex] = useState(0);
  const [isFileSearching, setIsFileSearching] = useState(false);
  const [atTokenRange, setAtTokenRange] = useState<{ start: number; end: number } | null>(null);

  // Slash command state (/)
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashSelectIndex, setSlashSelectIndex] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimerRef = useRef<any>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const isDraft = !activeChat;
  const targetWorkspaceId = activeChat ? activeChat.workspaceId : (draftChat?.workspaceId ?? activeWorkspaceId);
  const activeWorkspace = workspaces.find((w) => w.id === targetWorkspaceId);
  const isRunning = activeChat?.status === "running";
  const currentPermissionMode = activeChat ? (activeChat.permissionMode || "onRequest") : draftPermissionMode;

  // Global ⌘N / Ctrl+N shortcut for New Chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const wsId = useWorkspaceStore.getState().activeWorkspaceId;
        client.openDraftChat(wsId || undefined);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-focus composer when entering draft mode
  useEffect(() => {
    if (isDraft) {
      textareaRef.current?.focus();
    }
  }, [isDraft, draftChat]);

  // Filter approvals for this active chat
  const chatApprovals = pendingApprovals.filter(
    (a) => a.chatId === activeChatId && a.status === "pending"
  );

  // Debounced file search via Codex App-Server
  const performFileSearch = useCallback(
    (query: string) => {
      if (!activeWorkspace?.id) return;
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      setIsFileSearching(true);
      searchTimerRef.current = setTimeout(async () => {
        try {
          const res = await client.searchWorkspaceFiles(activeWorkspace.id, query);
          setFileResults(res.files || []);
          setFileSelectIndex(0);
        } catch (err) {
          console.error("[ChatView] File search failed", err);
          setFileResults([]);
        } finally {
          setIsFileSearching(false);
        }
      }, 100);
    },
    [activeWorkspace?.id]
  );

  const filteredSlashCommands = CANYWHERE_SLASH_COMMANDS.filter(
    (c) =>
      c.cmd.toLowerCase().includes("/" + slashFilter) ||
      c.desc.toLowerCase().includes(slashFilter)
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

  // Auto-resize textarea height and detect @ / triggers
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);

    // 1. Check for @ file mention
    const atMatch = textBefore.match(/(?:^|\s)@([^\s]*)$/);
    if (atMatch && activeWorkspace?.id) {
      const query = atMatch[1];
      const matchIndex = atMatch.index! + (atMatch[0].startsWith("@") ? 0 : 1);
      setAtTokenRange({ start: matchIndex, end: cursor });
      setFileQuery(query);
      setShowFileMenu(true);
      setShowSlashMenu(false);
      if (query.trim().length > 0) {
        performFileSearch(query);
      } else {
        if (searchTimerRef.current) {
          clearTimeout(searchTimerRef.current);
        }
        setFileResults([]);
        setIsFileSearching(false);
      }
    } else {
      setShowFileMenu(false);
      setAtTokenRange(null);
    }

    // 2. Check for / slash command
    const firstLine = val.split("\n")[0];
    const isFirstLine = cursor <= firstLine.length;
    const slashMatch = isFirstLine ? firstLine.match(/^\/([^\s]*)$/) : null;
    if (slashMatch && !atMatch) {
      const filter = slashMatch[1].toLowerCase();
      setSlashFilter(filter);
      setShowSlashMenu(true);
      setSlashSelectIndex(0);
    } else if (!atMatch) {
      setShowSlashMenu(false);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleSelectFile = (file: FuzzyFileMatchItem) => {
    if (!atTokenRange) return;
    const path = file.path;
    const formatted = path.includes(" ") ? `"${path}"` : path;
    const before = input.slice(0, atTokenRange.start);
    const after = input.slice(atTokenRange.end);
    const nextInput = `${before}@${formatted} ${after}`;
    const nextCursor = atTokenRange.start + formatted.length + 2; // @ + path + space

    setInput(nextInput);
    setShowFileMenu(false);
    setAtTokenRange(null);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    }, 0);
  };

  const handleSelectSlash = async (cmd: SlashCommandDefinition) => {
    setShowSlashMenu(false);

    if (cmd.cmd === "/review") {
      if (activeChatId) {
        try {
          setInput("");
          await client.startReview(activeChatId);
        } catch (err) {
          console.error("Failed to trigger review", err);
        }
      }
      return;
    }

    if (cmd.cmd === "/compact") {
      if (activeChatId) {
        try {
          setInput("");
          await client.compactChat(activeChatId);
        } catch (err) {
          console.error("Failed to trigger compact", err);
        }
      }
      return;
    }

    if (cmd.cmd === "/reset") {
      setInput("");
      client.openDraftChat(activeWorkspace?.id);
      return;
    }

    if (cmd.cmd === "/scratch") {
      setInput("");
      client.openDraftChat(null);
      return;
    }

    // Default: insert command prefix into composer
    setInput(cmd.cmd + " ");
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSelectWorkspace = (wsId: string | null) => {
    useWorkspaceStore.getState().setActiveWorkspaceId(wsId);
    if (!activeChat) {
      setDraftChat({ workspaceId: wsId });
    } else {
      client.openDraftChat(wsId);
    }
  };

  if (!activeChat && !draftChat && chats.length > 0) {
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
          <Button size="sm" onClick={() => client.openDraftChat(activeWorkspace?.id || null)}>
            Start New Conversation
          </Button>
        </div>
      </div>
    );
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isSubmittingDraft) return;

    const text = input.trim();
    setInput("");
    setShowSlashMenu(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Handle slash commands client-side if applicable
    if (text === "/reset") {
      client.openDraftChat(activeWorkspace?.id);
      return;
    }

    if (text === "/scratch") {
      client.openDraftChat(null);
      return;
    }

    // Draft / Lazy Chat Creation Flow
    if (isDraft || !activeChat) {
      const workspaceId = targetWorkspaceId ?? undefined;
      const permMode = draftPermissionMode || "onRequest";
      const firstLine = text.split("\n")[0].trim();
      const title = firstLine.length > 40 ? firstLine.slice(0, 40).trim() + "..." : (firstLine || "New Chat");

      try {
        setIsSubmittingDraft(true);
        const newChat = await client.createChat(workspaceId, title);
        if (permMode !== "onRequest") {
          await client.setChatPermission(newChat.id, permMode);
        }
        useChatStore.getState().setDraftChat(null);
        await client.sendTurn(newChat.id, text, selectedModel, permMode);
      } catch (err) {
        console.error("Failed to create chat and send turn:", err);
        setInput(text);
      } finally {
        setIsSubmittingDraft(false);
      }
      return;
    }

    // When agent is currently running, auto-enqueue into Chat Message Queue!
    if (isRunning) {
      client.enqueuePrompt(
        activeChat.id,
        text,
        selectedModel,
        selectedEffort,
        currentPermissionMode
      );
      return;
    }

    await client.sendTurn(activeChat.id, text, selectedModel);
  };

  const handleInterrupt = async () => {
    if (activeChat) {
      await client.interruptTurn(activeChat.id, activeTurnId || undefined);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. File Search navigation
    if (showFileMenu && fileResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFileSelectIndex((i) => (i + 1) % fileResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFileSelectIndex((i) => (i - 1 + fileResults.length) % fileResults.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (fileResults[fileSelectIndex]) {
          handleSelectFile(fileResults[fileSelectIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowFileMenu(false);
        return;
      }
    }

    // 2. Slash Command navigation
    if (showSlashMenu && filteredSlashCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashSelectIndex((i) => (i + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashSelectIndex((i) => (i - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredSlashCommands[slashSelectIndex]) {
          handleSelectSlash(filteredSlashCommands[slashSelectIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }

    // Normal Send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      setShowSlashMenu(false);
      setShowFileMenu(false);
    }
  };

  const renderComposer = (isHero: boolean) => (
    <div className={`w-full relative ${isHero ? "select-text" : ""}`}>
      {/* File Search (@) Suggestions Popover via Codex App-Server */}
      {showFileMenu && (
        <FileSearchPopup
          files={fileResults}
          selectedIndex={fileSelectIndex}
          query={fileQuery}
          isLoading={isFileSearching}
          onSelect={handleSelectFile}
        />
      )}

      {/* Slash Command (/) Suggestions Popover */}
      {showSlashMenu && (
        <SlashCommandPopup
          commands={filteredSlashCommands}
          selectedIndex={slashSelectIndex}
          filter={slashFilter}
          onSelect={handleSelectSlash}
        />
      )}



      {/* Approval Tray: Docked directly above composer for inline approvals */}
      {activeChat && chatApprovals.length > 0 && (
        <ApprovalTray chatId={activeChat.id} approvals={chatApprovals} />
      )}

      {/* Queue Tray: Docked directly above the composer box */}
      {activeChat && activeChatQueue.length > 0 && (
        <QueueTray
          chatId={activeChat.id}
          items={activeChatQueue}
          isRunning={isRunning}
          activeTurnId={activeTurnId}
          onSteer={(queueId) => client.steerQueuedPrompt(activeChat.id, queueId)}
          onEdit={(queueId, newText) => client.updateQueuedPrompt(activeChat.id, queueId, newText)}
          onDelete={(queueId) => client.cancelQueuedPrompt(activeChat.id, queueId)}
        />
      )}

      <div
        className={`rounded-2xl border transition-all overflow-hidden ${
          isHero
            ? "border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-md shadow-xl shadow-black/5 dark:shadow-black/30 focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/20"
            : "border-[var(--border)] bg-[var(--sidebar-bg)] focus-within:border-[var(--ring)] focus-within:ring-1 focus-within:ring-[var(--ring)] shadow-md shadow-black/5 dark:shadow-black/20"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleComposerKeyDown}
          placeholder={
            isRunning
              ? "Agent is working... Type next task (Enter to queue)"
              : isHero
              ? "Ask Codex to code, run tests, or refactor... (Type @ for files, / for commands)"
              : "Ask Codex to code, run tests, or refactor... (Type / for commands, Enter to send)"
          }
          rows={isHero ? 3 : 2}
          className={`w-full bg-transparent p-3.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none resize-none font-mono ${
            isHero ? "min-h-[76px]" : "min-h-[52px]"
          }`}
        />

        {/* Composer Utility Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border-subtle)] bg-[var(--secondary)]/30 text-[11px] text-[var(--muted-foreground)] select-none">
          <div className="flex items-center gap-2 sm:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                title={activeWorkspace ? `Workspace: ${activeWorkspace.name} (Click to switch)` : "Select workspace"}
                className="h-6 px-1.5 rounded-full border border-[var(--border)] bg-[var(--secondary)]/80 hover:bg-[var(--secondary)] hover:border-[var(--ring)] flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer select-none"
              >
                <Folder className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
                <Plus className="w-2.5 h-2.5 text-[var(--muted-foreground)] shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <div className="px-2 py-1 text-[10px] font-mono font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Workspaces
                </div>
                {workspaces.map((ws) => {
                  const isSelected = targetWorkspaceId === ws.id;
                  return (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => handleSelectWorkspace(ws.id)}
                      className="flex items-center justify-between font-mono text-xs cursor-pointer py-1.5"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
                        <span className="truncate">{ws.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--foreground)] shrink-0 ml-2" />}
                    </DropdownMenuItem>
                  );
                })}
                {workspaces.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-[var(--muted-foreground)] italic font-mono">
                    No workspaces added
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleSelectWorkspace(null)}
                  className="flex items-center justify-between font-mono text-xs cursor-pointer py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
                    <span>Scratchpad mode</span>
                  </div>
                  {!targetWorkspaceId && <Check className="w-3.5 h-3.5 text-[var(--foreground)] shrink-0 ml-2" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ModelEffortCombo
              models={models}
              selectedModel={selectedModel}
              selectedEffort={selectedEffort}
              onSelectModel={setSelectedModel}
              onSelectEffort={setSelectedEffort}
              size="sm"
              align="start"
            />
            <DropdownMenu>
              <DropdownMenuTrigger className={`font-mono text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 cursor-pointer transition-colors hover:opacity-80 select-none ${PERMISSION_CONFIG[currentPermissionMode]?.badgeBorder}`}>
                {PERMISSION_CONFIG[currentPermissionMode]?.icon}
                <span>{PERMISSION_CONFIG[currentPermissionMode]?.shortLabel}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {(["onRequest", "readOnly", "auto"] as PermissionMode[]).map((mode) => {
                  const cfg = PERMISSION_CONFIG[mode];
                  const isSelected = currentPermissionMode === mode;
                  return (
                    <DropdownMenuItem
                      key={mode}
                      onClick={() => {
                        if (activeChat) {
                          client.setChatPermission(activeChat.id, mode);
                        } else {
                          setDraftPermissionMode(mode);
                        }
                      }}
                      className="flex items-center justify-between font-mono text-xs cursor-pointer py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        {cfg.icon}
                        <span className={cfg.colorClass}>{cfg.shortLabel}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--foreground)]" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="hidden sm:inline-block font-mono text-[10px] text-[var(--muted-foreground)] opacity-75">
              ⚡ Context: ~32k tokens
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-block text-[10px] font-mono opacity-60">
              {isRunning ? "↵ to queue" : "↵ to send · ⇧↵ newline"}
            </span>
            <Button
              size="xs"
              disabled={!input.trim() || isSubmittingDraft}
              onClick={() => handleSend()}
              className="gap-1 font-mono cursor-pointer"
            >
              {isSubmittingDraft ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <span>{isRunning ? "Queue" : "Send"}</span>
                  <CornerDownLeft className="w-3 h-3" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

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
          <span className="truncate text-[var(--foreground)] font-medium">
            {activeChat ? activeChat.title : "New Chat"}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* All-in-One Model & Effort Selector */}
          <ModelEffortCombo
            models={models}
            selectedModel={selectedModel}
            selectedEffort={selectedEffort}
            onSelectModel={setSelectedModel}
            onSelectEffort={setSelectedEffort}
            size="md"
            align="end"
          />

          {/* Permission Mode Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors cursor-pointer select-none ${
              currentPermissionMode === "auto"
                ? "border border-amber-500/40 text-amber-500 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                : "border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--accent)]"
            }`}>
              {PERMISSION_CONFIG[currentPermissionMode]?.icon}
              <span>{PERMISSION_CONFIG[currentPermissionMode]?.shortLabel || "Safe"}</span>
              <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {(["onRequest", "readOnly", "auto"] as PermissionMode[]).map((mode) => {
                const cfg = PERMISSION_CONFIG[mode];
                const isSelected = currentPermissionMode === mode;
                return (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => {
                      if (activeChat) {
                        client.setChatPermission(activeChat.id, mode);
                      } else {
                        setDraftPermissionMode(mode);
                      }
                    }}
                    className="flex items-start justify-between font-mono text-xs cursor-pointer py-1.5"
                  >
                    <div className="flex items-start gap-2 truncate pr-2">
                      <div className="mt-0.5">{cfg.icon}</div>
                      <div className="flex flex-col">
                        <span className={`font-medium ${cfg.colorClass}`}>{cfg.label}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] line-clamp-2">
                          {cfg.desc}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[var(--foreground)] shrink-0 mt-0.5" />}
                  </DropdownMenuItem>
                );
              })}
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

      {messages.length === 0 ? (
        /* Centered Composer Screen */
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[560px] h-[360px] bg-emerald-500/[0.03] dark:bg-emerald-500/[0.04] rounded-full blur-3xl" />
          </div>

          <div className="w-full max-w-3xl flex flex-col items-center relative z-10 space-y-3">
            {/* Centered Composer */}
            {renderComposer(true)}

            {/* Keyboard-First Helper Line */}
            <div className="flex items-center gap-2.5 text-[11px] font-mono text-[var(--muted-foreground)]/70 pt-1 select-none">
              <span>Type <kbd className="px-1.5 py-0.5 rounded bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] text-[10px]">@</kbd> to mention files</span>
              <span>•</span>
              <span>Type <kbd className="px-1.5 py-0.5 rounded bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] text-[10px]">/</kbd> for commands</span>
              <span>•</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] text-[10px]">⌘N</kbd> new chat</span>
            </div>
          </div>
        </div>
      ) : (
        /* 2. Standard Active Chat Timeline Feed + Bottom Composer (when >0 messages) */
        <>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-6 py-6 space-y-6 relative"
          >
            {messages.map((msg, idx) => {
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
                            <Check className="w-3 h-3" />
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
              const durationSec = Math.max(0, Math.round((Number(msg.createdAt) - userTurnTime) / 1000));

              return (
                <div key={msg.id} className="group max-w-3xl mx-auto flex flex-col space-y-1">
                  <div className="text-[13px] leading-relaxed select-text text-[var(--foreground)] relative py-1">
                    <MessageBlocksRenderer blocks={msg.blocks} isStreaming={isMsgStreaming} durationSeconds={durationSec} />
                  </div>

                  {isMsgStreaming && (
                    <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--muted-foreground)] py-1 select-none">
                      <Loader2 className="w-3 h-3 animate-spin text-[var(--foreground)]" />
                      <span>Generating...</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)] font-mono opacity-0 group-hover:opacity-100 transition-opacity select-none pt-0.5">
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
                            <Check className="w-3 h-3" />
                            <span>Copied</span>
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
                    {durationSec > 0 && <span>• {durationSec}s</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Anchored Bottom Composer with Ambient Shadow & Smooth Fade Overlay */}
          <div className="p-4 pt-2 shrink-0 relative bg-gradient-to-t from-[var(--background)] via-[var(--background)]/90 to-transparent">
            {/* Top Fade Edge for Seamless Scrolling */}
            <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none" />

            <div className="max-w-3xl mx-auto relative">
              {/* Floating Jump to Bottom / New msg below Button */}
              {!isAtBottom && (
                <div className="absolute bottom-full right-0 mb-3 z-30 pointer-events-none select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <button
                    onClick={scrollToBottom}
                    className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--card)]/95 backdrop-blur-md border border-[var(--border)] text-[var(--foreground)] text-xs font-medium shadow-xl hover:bg-[var(--secondary)] transition-all cursor-pointer group"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors" />
                    <span className="font-mono text-[11px]">
                      {hasUnseenMessages ? "New messages below" : "Scroll to bottom"}
                    </span>
                    {hasUnseenMessages && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>
                </div>
              )}

              {renderComposer(false)}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
