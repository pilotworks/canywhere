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
} from "lucide-react";
import { useChatStore, useWorkspaceStore } from "../../store/index.js";
import { client } from "../../network/client.js";
import { Message } from "../../types/index.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import { RenderBlock } from "./render-block.js";

const EMPTY_MESSAGES: Message[] = [];

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

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeWorkspace = workspaces.find((w) => w.id === activeChat?.workspaceId);
  const isRunning = activeChat?.status === "running";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)] bg-[var(--background)] p-8 select-none">
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
    );
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isRunning) return;
    const prompt = input.trim();
    setInput("");
    await client.sendTurn(activeChat.id, prompt);
  };

  const handleInterrupt = async () => {
    if (activeTurnId) {
      await client.interruptTurn(activeChat.id, activeTurnId);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[var(--background)] text-[var(--foreground)] select-text">
      {/* Top Header / Breadcrumbs Bar */}
      <header className="h-10 border-b border-[var(--border)] px-4 flex items-center justify-between shrink-0 bg-[var(--card)]/50 backdrop-blur-md text-xs select-none">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)] truncate">
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
          <span className="truncate text-[var(--foreground)]">{activeChat.title}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--secondary)] border border-[var(--border)] font-mono text-[11px] text-[var(--muted-foreground)]">
            <Cpu className="w-3 h-3 text-[var(--muted-foreground)]" />
            <span>codex (app-server)</span>
          </div>

          {isRunning && (
            <Button
              variant="destructive"
              size="xs"
              onClick={handleInterrupt}
              className="flex items-center gap-1 font-mono"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>INTERRUPT</span>
            </Button>
          )}
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
                  {isUser ? "You" : "Codex"}
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
      </div>

      {/* Information Dense Composer Input Area */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--card)]/40 backdrop-blur-md shrink-0">
        <div className="max-w-3xl mx-auto rounded-xl border border-[var(--border)] bg-[var(--background)] focus-within:border-[var(--ring)] focus-within:ring-1 focus-within:ring-[var(--ring)] transition-all shadow-xs overflow-hidden">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isRunning
                ? "Agent is responding... Click Interrupt above to cancel."
                : "Ask Codex to code, run tests, or refactor... (Enter to send, Shift+Enter for newline)"
            }
            disabled={isRunning}
            rows={3}
            className="w-full bg-transparent p-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none resize-none disabled:opacity-50 font-mono"
          />

          {/* Composer Utility Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border-subtle)] bg-[var(--secondary)]/30 text-[11px] text-[var(--muted-foreground)] select-none">
            <div className="flex items-center gap-2">
              <span className="font-mono">
                {activeWorkspace ? `Root: ${activeWorkspace.name}` : "Scratchpad mode"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono opacity-60">Press ↵ to send</span>
              <Button
                size="xs"
                disabled={!input.trim() || isRunning}
                onClick={() => handleSend()}
                className="gap-1 font-mono"
              >
                <span>Send</span>
                <CornerDownLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
