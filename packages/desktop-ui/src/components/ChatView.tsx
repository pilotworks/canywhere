import React, { useState, useRef, useEffect } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  Send,
  Square,
  Sparkles,
  Terminal,
  FileCode,
  Brain,
  ChevronRight,
  User,
  Bot
} from "lucide-react";
import { useChatStore } from "../store/index.js";
import { client } from "../network/client.js";
import { MessageBlock } from "@canywhere/protocol-schema";

export const ChatView: React.FC = () => {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const chats = useChatStore((s) => s.chats);
  const messages = useChatStore((s) => (activeChatId ? s.messages[activeChatId] || [] : []));
  const activeTurnId = useChatStore((s) => (activeChatId ? s.activeTurnId[activeChatId] : null));

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const isRunning = activeChat?.status === "running";

  useEffect(() => {
    // Auto-scroll on new messages or streaming chunks
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 bg-neutral-950">
        <Sparkles className="w-12 h-12 mb-3 opacity-30 text-indigo-400" />
        <p className="text-sm font-medium">Select a chat or start a new conversation</p>
      </div>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="flex-1 flex flex-col h-screen bg-neutral-950 text-neutral-100 select-text">
      {/* Top Header */}
      <header className="h-14 border-b border-neutral-800 px-6 flex items-center justify-between shrink-0 bg-neutral-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-sm truncate">{activeChat.title}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
            {activeChat.providerId.toUpperCase()}
          </span>
        </div>

        {isRunning && (
          <button
            onClick={handleInterrupt}
            className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-300 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Interrupt</span>
          </button>
        )}
      </header>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 max-w-4xl mx-auto ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role !== "user" && (
              <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`space-y-3 rounded-2xl p-4 text-sm leading-relaxed max-w-3xl ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-900/20"
                  : "bg-neutral-900/90 border border-neutral-800 text-neutral-200 rounded-tl-none"
              }`}
            >
              {msg.blocks.map((block, idx) => (
                <RenderBlock key={idx} block={block} />
              ))}
              {msg.streaming && msg.blocks.length === 0 && (
                <div className="flex items-center gap-2 text-neutral-500 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 text-neutral-400">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Composer Bottom Area */}
      <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder={isRunning ? "Assistant is responding..." : "Ask Codex to code, run tests, or refactor... (Enter to send, Shift+Enter for newline)"}
            disabled={isRunning}
            rows={2}
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm outline-none resize-none focus:border-indigo-500 transition disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!input.trim() || isRunning}
            className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition shrink-0 cursor-pointer shadow-lg shadow-indigo-900/30"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

const RenderBlock: React.FC<{ block: MessageBlock }> = ({ block }) => {
  const [open, setOpen] = useState(false);

  switch (block.type) {
    case "text":
      return <div className="whitespace-pre-wrap">{block.content}</div>;

    case "reasoning":
      return (
        <Collapsible.Root open={open} onOpenChange={setOpen} className="w-full">
          <Collapsible.Trigger className="flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-neutral-200 cursor-pointer py-1">
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>Reasoning process</span>
          </Collapsible.Trigger>
          <Collapsible.Content className="mt-2 p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80 font-mono text-xs text-neutral-400 whitespace-pre-wrap">
            {block.content}
          </Collapsible.Content>
        </Collapsible.Root>
      );

    case "command_exec":
      return (
        <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 font-mono text-xs space-y-1.5">
          <div className="flex items-center gap-2 text-neutral-400">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-neutral-300">$ {block.command}</span>
            <span className="text-neutral-500 text-[10px]">({block.status})</span>
          </div>
          {block.output && (
            <pre className="text-neutral-400 overflow-x-auto whitespace-pre-wrap max-h-48 pt-1 border-t border-neutral-900">
              {block.output}
            </pre>
          )}
        </div>
      );

    case "file_diff":
      return (
        <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 font-mono text-xs space-y-1.5">
          <div className="flex items-center gap-2 text-neutral-400">
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-neutral-300 font-semibold">{block.path}</span>
            <span className="text-neutral-500 text-[10px]">({block.status})</span>
          </div>
          <pre className="text-neutral-400 overflow-x-auto whitespace-pre pt-1 border-t border-neutral-900">
            {block.patch}
          </pre>
        </div>
      );

    default:
      return null;
  }
};
