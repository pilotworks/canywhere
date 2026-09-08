import React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, Terminal, FileCode, Check, X, ShieldAlert } from "lucide-react";
import { useApprovalStore } from "../store/index.js";
import { client } from "../network/client.js";

export const ApprovalModal: React.FC = () => {
  const pendingApprovals = useApprovalStore((s) => s.pendingApprovals);
  const current = pendingApprovals[0]; // Process FIFO

  if (!current) return null;

  const isCommand = current.kind === "command";
  const isHighRisk = current.payload.isHighRisk;

  return (
    <AlertDialog.Root open={true}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-fade-in" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-neutral-900 border border-neutral-700 rounded-xl p-6 shadow-2xl z-50 text-neutral-100 animate-scale-in">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            {isHighRisk ? (
              <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
            )}
            <div>
              <AlertDialog.Title className="text-lg font-semibold flex items-center gap-2">
                {isCommand ? "Command Execution Approval" : "File Change Approval"}
                {isHighRisk && (
                  <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                    CRITICAL RISK
                  </span>
                )}
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-neutral-400">
                Codex requires permission to proceed with this operation.
              </AlertDialog.Description>
            </div>
          </div>

          {/* Details Body */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 mb-6 font-mono text-xs overflow-x-auto max-h-64">
            {isCommand ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Working Directory: {current.payload.cwd || "~"}</span>
                </div>
                <div className="p-2.5 bg-neutral-900 rounded border border-neutral-800 text-neutral-200 font-semibold break-all select-text">
                  {current.payload.command}
                </div>
                {current.payload.reason && (
                  <p className="text-neutral-400 font-sans mt-2">{current.payload.reason}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-neutral-400">
                  <FileCode className="w-4 h-4 text-sky-400" />
                  <span>Target: {current.payload.path}</span>
                </div>
                <pre className="p-2.5 bg-neutral-900 rounded border border-neutral-800 text-neutral-300 whitespace-pre overflow-x-auto select-text">
                  {current.payload.diff}
                </pre>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => client.respondApproval(current.id, "decline")}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition flex items-center gap-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
              Deny
            </button>
            <button
              onClick={() => client.respondApproval(current.id, "accept_for_session")}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition cursor-pointer"
            >
              Allow for Session
            </button>
            <button
              onClick={() => client.respondApproval(current.id, "accept")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition flex items-center gap-2 cursor-pointer shadow-lg ${
                isHighRisk
                  ? "bg-red-600 hover:bg-red-500 text-white shadow-red-900/40"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40"
              }`}
            >
              <Check className="w-4 h-4" />
              Allow Once
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
