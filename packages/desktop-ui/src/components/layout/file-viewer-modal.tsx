import React from "react";
import { X } from "lucide-react";
import { useWorkspaceStore } from "../../store/index.js";
import { FilePreviewPane } from "./file-preview-pane.js";

export const FileViewerModal: React.FC = () => {
  const activeFile = useWorkspaceStore((s) => s.activeFile);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);

  if (!activeFile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
      <div className="w-full max-w-4xl h-[85vh] flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden text-[var(--foreground)] relative">
        <button
          onClick={() => setActiveFile(null)}
          className="absolute top-2 right-2.5 z-10 p-1 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          title="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
        <FilePreviewPane path={activeFile.path} content={activeFile.content} />
      </div>
    </div>
  );
};
