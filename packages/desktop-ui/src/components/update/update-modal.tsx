import React from "react";
import {
  Sparkles,
  DownloadCloud,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useUpdateStore } from "../../store/update-store.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export const UpdateModal: React.FC = () => {
  const {
    status,
    currentVersion,
    availableVersion,
    releaseNotes,
    releaseDate,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    error,
    isModalOpen,
    closeModal,
    downloadAndInstall,
    restartApp,
    checkForUpdates,
  } = useUpdateStore();

  const isDownloading = status === "downloading";
  const isReady = status === "ready";
  const isError = status === "error";

  const formattedDate = releaseDate
    ? new Date(releaseDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl">
        {/* HEADER */}
        <DialogHeader className="p-5 pb-4 border-b border-[var(--border)] bg-[var(--sidebar-bg)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              {isReady ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : isDownloading ? (
                <DownloadCloud className="w-5 h-5 animate-pulse text-purple-400" />
              ) : (
                <Sparkles className="w-5 h-5 text-purple-400" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
                <span>Software Update</span>
                {availableVersion && (
                  <Badge variant="secondary" className="text-[11px] font-mono px-2 py-0.5">
                    v{availableVersion}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--muted-foreground)]">
                {isReady
                  ? "Update is ready to be applied."
                  : isDownloading
                  ? "Downloading update package..."
                  : "A new version of Canywhere is available."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* BODY CONTENT */}
        <div className="p-5 space-y-4 text-xs">
          {/* VERSION TRANSITION */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--background)]">
            <div className="space-y-0.5">
              <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                Current Version
              </span>
              <div className="font-mono font-medium text-[var(--foreground)]">v{currentVersion}</div>
            </div>
            <div className="text-[var(--muted-foreground)] font-mono">→</div>
            <div className="space-y-0.5 text-right">
              <span className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold">
                New Version
              </span>
              <div className="font-mono font-semibold text-purple-400">
                v{availableVersion || currentVersion}
              </div>
            </div>
          </div>

          {/* RELEASE NOTES */}
          {releaseNotes && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--foreground)]">Release Notes</span>
                {formattedDate && (
                  <span className="text-[10px] text-[var(--muted-foreground)]">{formattedDate}</span>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto p-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/70 text-[11px] font-mono leading-relaxed whitespace-pre-wrap select-text text-[var(--muted-foreground)]">
                {releaseNotes}
              </div>
            </div>
          )}

          {/* PROGRESS BAR (WHEN DOWNLOADING) */}
          {isDownloading && (
            <div className="space-y-2 p-3 rounded-xl border border-purple-500/20 bg-purple-500/5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--foreground)] font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>Downloading package...</span>
                </span>
                <span className="font-mono font-semibold text-purple-400">
                  {downloadProgress}%
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              {totalBytes > 0 && (
                <div className="text-[10px] text-[var(--muted-foreground)] text-right font-mono">
                  {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
                </div>
              )}
            </div>
          )}

          {/* READY STATUS */}
          {isReady && (
            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-emerald-400">Update Ready to Install</div>
                <div className="text-[11px] text-[var(--muted-foreground)]">
                  The update has been downloaded and verified. Restarting will replace the binary and re-launch Canywhere.
                </div>
              </div>
            </div>
          )}

          {/* ERROR STATUS */}
          {isError && (
            <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/10 flex items-start gap-2.5 text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="text-xs font-medium">Update Error</div>
                <div className="text-[11px] opacity-90 break-words">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--sidebar-bg)] flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={closeModal}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            {isReady ? "Close" : "Remind Me Later"}
          </Button>

          <div className="flex items-center gap-2">
            {isError && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkForUpdates(true)}
                className="text-xs"
              >
                <RotateCw className="w-3.5 h-3.5 mr-1" />
                Retry Check
              </Button>
            )}

            {isReady ? (
              <Button
                size="sm"
                onClick={restartApp}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Restart to Apply</span>
              </Button>
            ) : isDownloading ? (
              <Button
                size="sm"
                disabled
                className="text-xs bg-purple-600/70 text-white font-medium px-4 flex items-center gap-1.5"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Downloading ({downloadProgress}%)</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={downloadAndInstall}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 flex items-center gap-1.5"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Download & Install</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
