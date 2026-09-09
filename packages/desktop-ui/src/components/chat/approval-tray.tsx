import React, { useState } from "react";
import {
  Terminal,
  FileCode,
  Check,
  X,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Folder,
} from "lucide-react";
import { ApprovalRequest, ApprovalDecision } from "../../types/index.js";
import { client } from "../../network/client.js";
import { DiffViewer } from "./diff-viewer.js";

export interface ApprovalTrayProps {
  chatId: string;
  approvals: ApprovalRequest[];
}

export const ApprovalTray: React.FC<ApprovalTrayProps> = ({ chatId, approvals }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [rememberSession, setRememberSession] = useState(false);

  if (!approvals || approvals.length === 0) {
    return null;
  }

  const handleDecision = async (approval: ApprovalRequest, decision: ApprovalDecision) => {
    setLoadingId(approval.id);
    try {
      const finalDecision =
        decision === "accept" && rememberSession ? "accept_for_session" : decision;
      await client.respondApproval(approval.id, finalDecision);
    } catch (err) {
      console.error("Failed to respond to approval:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="mb-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
      {/* Tray Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--secondary)]/40 text-[11px] font-mono text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
          <span className="font-semibold text-[var(--foreground)]">
            Approval Required ({approvals.length})
          </span>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberSession}
            onChange={(e) => setRememberSession(e.target.checked)}
            className="rounded border-[var(--border)] accent-[var(--foreground)] cursor-pointer"
          />
          <span>Remember for session</span>
        </label>
      </div>

      {/* Approvals List */}
      <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-subtle)]">
        {approvals.map((approval) => {
          const isCommand = approval.kind === "command";
          const isFile = approval.kind === "file_change";
          const isHighRisk = Boolean(approval.payload.isHighRisk);
          const isExpanded = expandedId === approval.id;
          const isLoading = loadingId === approval.id;

          const hasDetails =
            Boolean(approval.payload.diff) ||
            Boolean(approval.payload.cwd) ||
            Boolean(approval.payload.reason) ||
            (isCommand && (approval.payload.command?.length ?? 0) > 60);

          return (
            <div key={approval.id} className="text-xs transition-colors">
              {/* Row header / quick actions */}
              <div className="flex items-center justify-between px-3 py-2 gap-2 hover:bg-[var(--secondary)]/30">
                {/* Left: Kind Icon + High Risk + Summary */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isHighRisk ? (
                    <div
                      className="p-1 rounded bg-rose-500/10 text-rose-500 shrink-0"
                      title="High Risk Action"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </div>
                  ) : isCommand ? (
                    <div className="p-1 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] shrink-0">
                      <Terminal className="w-3.5 h-3.5" />
                    </div>
                  ) : isFile ? (
                    <div className="p-1 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] shrink-0">
                      <FileCode className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="p-1 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] shrink-0">
                      <HelpCircle className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 min-w-0 flex-1 font-mono text-[11px]">
                    {isHighRisk && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 text-[9px] font-bold shrink-0 tracking-wide">
                        HIGH RISK
                      </span>
                    )}

                    {isCommand ? (
                      <span
                        className="truncate text-[var(--foreground)] font-semibold select-text"
                        title={approval.payload.command ?? ""}
                      >
                        $ {approval.payload.command}
                      </span>
                    ) : isFile ? (
                      <span
                        className="truncate text-[var(--foreground)] font-medium select-text"
                        title={approval.payload.path ?? ""}
                      >
                        {approval.payload.path}
                      </span>
                    ) : (
                      <span
                        className="truncate text-[var(--foreground)] select-text"
                        title={approval.payload.prompt ?? ""}
                      >
                        {approval.payload.prompt || "User confirmation needed"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasDetails && (
                    <button
                      onClick={() => toggleExpand(approval.id)}
                      className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                      title={isExpanded ? "Hide details" : "View details"}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          <span>Details</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    disabled={isLoading}
                    onClick={() => handleDecision(approval, "decline")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer disabled:opacity-50"
                    title="Decline request"
                  >
                    <X className="w-3 h-3" />
                    <span>Decline</span>
                  </button>

                  <button
                    disabled={isLoading}
                    onClick={() => handleDecision(approval, "accept")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                      isHighRisk
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
                        : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                    }`}
                    title="Approve request"
                  >
                    <Check className="w-3 h-3" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Details Drawer */}
              {isExpanded && (
                <div className="px-3 py-2.5 bg-[var(--secondary)]/20 border-t border-[var(--border-subtle)] space-y-2 select-text font-mono text-[11px]">
                  {/* Working directory info */}
                  {approval.payload.cwd && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                      <Folder className="w-3 h-3 shrink-0" />
                      <span className="opacity-70">Working Directory:</span>
                      <span className="truncate text-[var(--foreground)]">
                        {approval.payload.cwd}
                      </span>
                    </div>
                  )}

                  {/* Full Command if long */}
                  {isCommand && approval.payload.command && (
                    <div className="p-2 rounded-md bg-[var(--code-bg)] border border-[var(--code-border)] text-emerald-400 break-all leading-relaxed max-h-36 overflow-y-auto">
                      $ {approval.payload.command}
                    </div>
                  )}

                  {/* Diff Viewer for file modifications */}
                  {approval.payload.diff && (
                    <div className="rounded-md border border-[var(--code-border)] bg-[var(--code-bg)] overflow-hidden max-h-60 overflow-y-auto">
                      <DiffViewer patch={approval.payload.diff} />
                    </div>
                  )}

                  {/* Reason if provided by assistant */}
                  {approval.payload.reason && (
                    <div className="text-[10px] text-[var(--muted-foreground)] italic">
                      Reason: {approval.payload.reason}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
