import React from "react";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { useUpdateStore } from "../../store/update-store.js";
import { Button } from "../ui/button.js";

export const UpdateBanner: React.FC = () => {
  const {
    status,
    availableVersion,
    dismissedVersion,
    isModalOpen,
    openModal,
    dismissUpdate,
  } = useUpdateStore();

  const isVisible =
    (status === "available" || status === "ready") &&
    availableVersion !== null &&
    availableVersion !== dismissedVersion &&
    !isModalOpen;

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="flex items-center gap-3 p-3.5 bg-[var(--card)]/95 backdrop-blur-md border border-[var(--border)] shadow-xl rounded-2xl max-w-md text-xs">
        <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 text-purple-400">
          <Sparkles className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[var(--foreground)] truncate flex items-center gap-1.5">
            <span>Canywhere v{availableVersion}</span>
            {status === "ready" ? (
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-medium px-1.5 py-0.5 rounded-full">
                Ready to restart
              </span>
            ) : (
              <span className="text-[10px] bg-purple-500/15 text-purple-400 font-medium px-1.5 py-0.5 rounded-full">
                New version
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] truncate">
            {status === "ready"
              ? "Update downloaded. Restart to apply changes."
              : "A new update is available with improvements."}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={openModal}
            className="h-7 text-xs px-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1"
          >
            <span>{status === "ready" ? "Restart" : "Update"}</span>
            <ArrowRight className="w-3 h-3" />
          </Button>

          <button
            onClick={dismissUpdate}
            className="p-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
            title="Dismiss for now"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
