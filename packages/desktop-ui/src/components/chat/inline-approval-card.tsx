import React, { useState } from "react";
import { AlertTriangle, Terminal, FileCode, Check, X, ShieldAlert } from "lucide-react";
import { ApprovalRequest, ApprovalDecision } from "../../types/index.js";
import { client } from "../../network/client.js";
import { Button } from "../ui/button.js";
import { DiffViewer } from "./diff-viewer.js";
import { FileIcon } from "../ui/file-icon.js";

interface InlineApprovalCardProps {
  approval: ApprovalRequest;
}

export const InlineApprovalCard: React.FC<InlineApprovalCardProps> = ({ approval }) => {
  const [loading, setLoading] = useState(false);
  const isCommand = approval.kind === "command";
  const isHighRisk = approval.payload.isHighRisk;

  const handleDecision = async (decision: ApprovalDecision) => {
    setLoading(true);
    try {
      await client.respondApproval(approval.id, decision);
    } catch (err) {
      console.error("Failed to respond to approval", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`my-3 rounded-xl border p-4 shadow-sm transition-all ${
      isHighRisk
        ? "border-rose-800/40 bg-rose-950/20 text-rose-200"
        : "border-amber-700/40 bg-amber-950/15 text-amber-200"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border)] select-none">
        <div className="flex items-center gap-2">
          {isHighRisk ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="text-xs font-semibold font-mono tracking-wide uppercase text-[var(--foreground)]">
            Approval Required: {isCommand ? "Shell Execution" : "File Change"}
          </span>
        </div>
        {isHighRisk && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-900/40 border border-rose-700/50 text-rose-300 font-medium">
            HIGH RISK ACTION
          </span>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2.5 text-xs">
        {isCommand ? (
          <div>
            <p className="text-[11px] text-[var(--muted-foreground)] mb-1 font-mono">Proposed Command:</p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--code-bg)] border border-[var(--code-border)] font-mono text-emerald-400 select-text overflow-x-auto">
              <Terminal className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="font-semibold text-xs">$ {approval.payload.command}</span>
            </div>
            {approval.payload.cwd && (
              <p className="text-[10px] text-[var(--muted-foreground)] font-mono mt-1">
                Directory: {approval.payload.cwd}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-[11px] text-[var(--muted-foreground)] mb-1 font-mono">Target File:</p>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--code-bg)] border border-[var(--code-border)] font-mono text-[var(--foreground)] select-text">
              <FileIcon fileName={approval.payload.path} className="w-4 h-4 shrink-0" />
              <span className="font-semibold text-xs text-sky-400">{approval.payload.path}</span>
            </div>
            {approval.payload.diff && (
              <div className="mt-2 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] overflow-hidden max-h-56 overflow-y-auto">
                <DiffViewer patch={approval.payload.diff} />
              </div>
            )}
          </div>
        )}

        {approval.payload.reason && (
          <p className="text-[11px] text-[var(--muted-foreground)] italic font-mono pt-1">
            Note: {approval.payload.reason}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--border)] select-none">
        <Button
          variant="outline"
          size="xs"
          disabled={loading}
          onClick={() => handleDecision("decline")}
          className="gap-1 font-mono hover:text-rose-400"
        >
          <X className="w-3 h-3" />
          <span>Decline</span>
        </Button>
        <Button
          variant="secondary"
          size="xs"
          disabled={loading}
          onClick={() => handleDecision("accept_for_session")}
          className="font-mono text-[11px]"
        >
          <span>Always allow session</span>
        </Button>
        <Button
          variant="default"
          size="xs"
          disabled={loading}
          onClick={() => handleDecision("accept")}
          className="gap-1 font-mono bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Approve ↵</span>
        </Button>
      </div>
    </div>
  );
};
