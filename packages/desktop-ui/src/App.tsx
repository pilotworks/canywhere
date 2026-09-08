import React, { useEffect } from "react";
import { client } from "./network/client.js";
import { Sidebar } from "./components/layout/sidebar.js";
import { RightSidebar } from "./components/layout/right-sidebar.js";
import { ChatView } from "./components/chat/chat-view.js";
import { ApprovalModal } from "./components/approval/approval-modal.js";
import { FileViewerModal } from "./components/layout/file-viewer-modal.js";

export const App: React.FC = () => {
  useEffect(() => {
    client.connect();
    return () => client.disconnect();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatView />
      </main>
      <RightSidebar />
      <ApprovalModal />
      <FileViewerModal />
    </div>
  );
};
