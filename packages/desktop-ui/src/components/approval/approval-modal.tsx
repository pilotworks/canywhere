import React, { useState } from "react";
import { AlertTriangle, Terminal, Check, X, ShieldAlert } from "lucide-react";
import { useApprovalStore } from "../../store/index.js";
import { client } from "../../network/client.js";
import { FileIcon } from "../ui/file-icon.js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../ui/alert-dialog.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";

export const ApprovalModal: React.FC = () => {
  const pendingApprovals = useApprovalStore((s) => s.pendingApprovals);
  const [rememberSession, setRememberSession] = useState(false);
  const current = pendingApprovals[0]; // Process FIFO

  if (!current) return null;

  const isCommand = current.kind === "command";
  const isHighRisk = current.payload.isHighRisk;

  const handleApprove = () => {
    const decision = rememberSession ? "accept_for_session" : "accept";
    client.respondApproval(current.id, decision);
  };

  return (
    <AlertDialog open={true}>
      <AlertDialogContent className="max-w-lg p-6">
        {/* Header */}
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            {isHighRisk ? (
              <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-400 shrink-0">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <AlertDialogTitle className="text-sm font-semibold tracking-tight">
                  {isCommand ? "Command Execution Approval" : "File Modification Approval"}
                </AlertDialogTitle>
                {isHighRisk && <Badge variant="destructive">HIGH RISK</Badge>}
              </div>
              <AlertDialogDescription className="text-xs">
                The agent is requesting permission to run operations on your local machine.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {/* Command / Patch Terminal Preview */}
        <div className="my-1 rounded-lg border border-[var(--border)] bg-[var(--code-bg)] font-mono text-xs overflow-hidden">
          <div className="px-3 py-1.5 bg-[var(--secondary)]/70 border-b border-[var(--border)] text-[11px] text-[var(--muted-foreground)] flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              {isCommand ? (
                <>
                  <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Command to execute</span>
                </>
              ) : (
                <>
                  <FileIcon fileName={current.payload.path} className="w-3.5 h-3.5 shrink-0" />
                  <span>Target File: {current.payload.path}</span>
                </>
              )}
            </span>
            {current.payload.cwd && (
              <span className="truncate max-w-[200px] text-[10px]">dir: {current.payload.cwd}</span>
            )}
          </div>

          <div className="p-3 text-[12px] font-mono leading-relaxed select-text overflow-x-auto max-h-56 text-[var(--foreground)]">
            {isCommand ? (
              <div className="text-emerald-400 font-semibold break-all">
                $ {current.payload.command}
              </div>
            ) : (
              <pre className="text-[var(--foreground)]/90 whitespace-pre">
                {current.payload.diff}
              </pre>
            )}
          </div>
        </div>

        {/* Context metadata */}
        <div className="space-y-1 text-xs text-[var(--muted-foreground)] select-none">
          {current.payload.reason && (
            <p className="text-[11px] italic">Reason: {current.payload.reason}</p>
          )}
          {isHighRisk && (
            <p className="text-[11px] text-rose-400 font-medium">
              🚨 Potentially destructive action detected. Review command carefully.
            </p>
          )}
        </div>

        {/* Policy Checkbox */}
        <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] select-none cursor-pointer py-1">
          <input
            type="checkbox"
            checked={rememberSession}
            onChange={(e) => setRememberSession(e.target.checked)}
            className="rounded border-[var(--border)] accent-[var(--primary)]"
          />
          <span>Remember decision for the remainder of this session</span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button
            variant="outline"
            size="sm"
            onClick={() => client.respondApproval(current.id, "decline")}
          >
            <X className="w-3.5 h-3.5" />
            <span>Decline</span>
          </Button>

          <Button
            variant={isHighRisk ? "destructive" : "default"}
            size="sm"
            onClick={handleApprove}
            className="gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve {rememberSession ? "for Session" : ""}</span>
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
