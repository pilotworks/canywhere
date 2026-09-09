import React, { useEffect, useRef } from "react";
import {
  File,
  Folder,
  FileSearch,
  GitCompare,
  RotateCcw,
  Minimize2,
  Sparkles,
  Loader2,
  CornerDownLeft,
} from "lucide-react";
import { FuzzyFileMatchItem } from "../../types/index.js";

export interface SlashCommandDefinition {
  cmd: string;
  desc: string;
  category: "codex" | "chat";
  icon: React.ReactNode;
}

export const CANYWHERE_SLASH_COMMANDS: SlashCommandDefinition[] = [
  {
    cmd: "/review",
    desc: "Run automated git review on uncommitted changes via Codex app-server",
    category: "codex",
    icon: <GitCompare className="w-3.5 h-3.5 text-amber-400" />,
  },
  {
    cmd: "/compact",
    desc: "Compact conversational context & summarize thread history via Codex",
    category: "codex",
    icon: <Minimize2 className="w-3.5 h-3.5 text-purple-400" />,
  },
  {
    cmd: "/reset",
    desc: "Start a clean conversation thread in the current workspace",
    category: "chat",
    icon: <RotateCcw className="w-3.5 h-3.5 text-sky-400" />,
  },
  {
    cmd: "/scratch",
    desc: "Create an ephemeral standalone scratchpad chat",
    category: "chat",
    icon: <Sparkles className="w-3.5 h-3.5 text-emerald-400" />,
  },
];

/**
 * Highlights characters in text based on 0-based indices array from Nucleo fuzzy search.
 */
function HighlightedText({ text, indices }: { text: string; indices?: number[] | null }) {
  if (!indices || indices.length === 0) {
    return <span>{text}</span>;
  }

  const indexSet = new Set(indices);
  const chars = Array.from(text);

  return (
    <span>
      {chars.map((char, i) => {
        const isMatched = indexSet.has(i);
        return (
          <span
            key={i}
            className={isMatched ? "text-emerald-400 font-bold underline decoration-emerald-500/50" : ""}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

interface FileSearchPopupProps {
  files: FuzzyFileMatchItem[];
  selectedIndex: number;
  query: string;
  isLoading: boolean;
  onSelect: (file: FuzzyFileMatchItem) => void;
}

export const FileSearchPopup: React.FC<FileSearchPopupProps> = ({
  files,
  selectedIndex,
  query,
  isLoading,
  onSelect,
}) => {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  return (
    <div className="max-w-3xl mx-auto mb-2 rounded-xl border border-[var(--border)] bg-[var(--popover)]/95 backdrop-blur-md shadow-2xl overflow-hidden font-mono text-xs select-none animate-in fade-in slide-in-from-bottom-2 duration-150 z-30">
      {/* Header */}
      <div className="px-3 py-1.5 bg-[var(--secondary)]/80 text-[10px] uppercase font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span>Files in Workspace</span>
          {query ? (
            <span className="text-[var(--foreground)] font-bold">(@{query})</span>
          ) : (
            <span className="text-[var(--muted-foreground)]">(type to filter)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />}
          <span className="text-[9px] text-[var(--muted-foreground)] flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--muted)] text-[8px]">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-[var(--muted)] text-[8px]">↓</kbd> navigate
            <kbd className="px-1 py-0.5 rounded bg-[var(--muted)] text-[8px]">Tab</kbd> / <kbd className="px-1 py-0.5 rounded bg-[var(--muted)] text-[8px]">↵</kbd> insert
          </span>
        </div>
      </div>

      {/* Results List */}
      <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-subtle)]">
        {files.length === 0 ? (
          <div className="px-4 py-5 text-center text-xs text-[var(--muted-foreground)]">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                <span>Searching files with Codex Nucleo engine...</span>
              </div>
            ) : !query.trim() ? (
              <div className="flex flex-col items-center justify-center gap-1.5 py-1 text-center">
                <FileSearch className="w-5 h-5 text-[var(--muted-foreground)]/60 mb-0.5" />
                <span className="font-medium text-xs text-[var(--foreground)]">Type to search files</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  Enter a file or folder name to fuzzy match with Codex Nucleo
                </span>
              </div>
            ) : (
              <span>No matching files or directories found for &quot;@{query}&quot;</span>
            )}
          </div>
        ) : (
          files.map((file, idx) => {
            const isSelected = idx === selectedIndex;
            const isDir = file.matchType === "directory";

            return (
              <button
                key={file.path}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                onClick={() => onSelect(file)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "hover:bg-[var(--secondary)]/50 text-[var(--foreground)]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  {isDir ? (
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <File className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  )}
                  <div className="truncate flex items-baseline gap-1.5">
                    <span className="font-semibold text-xs">
                      <HighlightedText text={file.fileName} indices={file.indices} />
                    </span>
                    {file.path !== file.fileName && (
                      <span className="text-[10px] text-[var(--muted-foreground)] truncate">
                        {file.path.slice(0, file.path.length - file.fileName.length)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border-subtle)]">
                    {isDir ? "dir" : "file"}
                  </span>
                  {isSelected && (
                    <CornerDownLeft className="w-3 h-3 text-[var(--muted-foreground)]" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

interface SlashCommandPopupProps {
  commands: SlashCommandDefinition[];
  selectedIndex: number;
  filter: string;
  onSelect: (cmd: SlashCommandDefinition) => void;
}

export const SlashCommandPopup: React.FC<SlashCommandPopupProps> = ({
  commands,
  selectedIndex,
  filter,
  onSelect,
}) => {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  return (
    <div className="max-w-3xl mx-auto mb-2 rounded-xl border border-[var(--border)] bg-[var(--popover)]/95 backdrop-blur-md shadow-2xl overflow-hidden font-mono text-xs select-none animate-in fade-in slide-in-from-bottom-2 duration-150 z-30">
      {/* Header */}
      <div className="px-3 py-1.5 bg-[var(--secondary)]/80 text-[10px] uppercase font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span>Commands</span>
          {filter && <span className="text-[var(--foreground)] font-bold">(/{filter})</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[var(--muted-foreground)] flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--muted)] text-[8px]">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-[var(--muted)] text-[8px]">↓</kbd> navigate
            <kbd className="px-1 py-0.5 rounded bg-[var(--muted)] text-[8px]">↵</kbd> run
          </span>
        </div>
      </div>

      {/* Command List */}
      <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-subtle)]">
        {commands.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">
            No slash command matching &quot;/{filter}&quot;
          </div>
        ) : (
          commands.map((s, idx) => {
            const isSelected = idx === selectedIndex;

            return (
              <button
                key={s.cmd}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                onClick={() => onSelect(s)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "hover:bg-[var(--secondary)]/50 text-[var(--foreground)]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div className="shrink-0">{s.icon}</div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-emerald-400">{s.cmd}</span>
                    <span className="text-[11px] text-[var(--muted-foreground)] truncate">
                      {s.desc}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border-subtle)]">
                    {s.category}
                  </span>
                  {isSelected && (
                    <CornerDownLeft className="w-3 h-3 text-[var(--muted-foreground)]" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
