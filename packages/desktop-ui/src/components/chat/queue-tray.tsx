import React, { useState, useRef, useEffect } from "react";
import { Zap, Pencil, X, Check, Clock } from "lucide-react";
import { QueuedMessage } from "../../types/index.js";

export interface QueueTrayProps {
  chatId: string;
  items: QueuedMessage[];
  isRunning: boolean;
  activeTurnId?: string | null;
  onSteer: (queueId: string) => void;
  onEdit: (queueId: string, newText: string) => void;
  onDelete: (queueId: string) => void;
}

export const QueueTray: React.FC<QueueTrayProps> = ({
  items,
  isRunning,
  activeTurnId,
  onSteer,
  onEdit,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  if (!items || items.length === 0) {
    return null;
  }

  const handleStartEdit = (item: QueuedMessage) => {
    setEditingId(item.id);
    setEditText(item.content);
  };

  const handleSaveEdit = (queueId: string) => {
    const trimmed = editText.trim();
    if (trimmed) {
      onEdit(queueId, trimmed);
    } else {
      onDelete(queueId);
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="mb-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
      {/* Tray Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--secondary)]/40 text-[11px] font-mono text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
          <span className="font-semibold text-[var(--foreground)]">
            In Queue ({items.length})
          </span>
        </div>
        <span className="text-[10px] opacity-70 hidden sm:inline">
          Executes sequentially when turn completes
        </span>
      </div>

      {/* Queue Items List */}
      <div className="max-h-40 overflow-y-auto divide-y divide-[var(--border-subtle)]">
        {items.map((item, idx) => {
          const isEditing = editingId === item.id;

          if (isEditing) {
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--secondary)]/30"
              >
                <span className="font-mono text-[10px] text-[var(--muted-foreground)] w-4 shrink-0">
                  {idx + 1}.
                </span>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveEdit(item.id);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      handleCancelEdit();
                    }
                  }}
                  className="flex-1 bg-transparent border-b border-[var(--ring)] outline-none text-xs text-[var(--foreground)] font-mono py-0.5 px-1"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleSaveEdit(item.id)}
                    className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                    title="Save edit (Enter)"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                    title="Cancel (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-[var(--secondary)]/40 transition-colors group"
            >
              {/* Left: Index & Prompt content */}
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <span className="font-mono text-[10px] text-[var(--muted-foreground)] w-4 shrink-0">
                  {idx + 1}.
                </span>
                <span
                  className="text-[var(--foreground)] truncate select-text font-mono text-[11px]"
                  title={item.content}
                >
                  {item.content}
                </span>
              </div>

              {/* Right: Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isRunning && activeTurnId && (
                  <button
                    onClick={() => onSteer(item.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[var(--border)] text-[var(--foreground)] bg-[var(--secondary)]/70 hover:bg-[var(--secondary)] hover:border-[var(--ring)] transition-colors cursor-pointer"
                    title="Steer into active turn immediately"
                  >
                    <Zap className="w-2.5 h-2.5 text-[var(--muted-foreground)]" />
                    <span>Steer</span>
                  </button>
                )}

                <button
                  onClick={() => handleStartEdit(item)}
                  className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                  title="Edit prompt"
                >
                  <Pencil className="w-3 h-3" />
                </button>

                <button
                  onClick={() => onDelete(item.id)}
                  className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                  title="Remove from queue"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
