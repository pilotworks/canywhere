import React, { useEffect } from "react";
import { client } from "./network/client.js";
import { Sidebar } from "./components/layout/sidebar.js";
import { RightSidebar } from "./components/layout/right-sidebar.js";
import { ChatView } from "./components/chat/chat-view.js";
import { UpdateBanner } from "./components/update/update-banner.js";
import { UpdateModal } from "./components/update/update-modal.js";
import { useUpdateStore } from "./store/update-store.js";

export const App: React.FC = () => {
  useEffect(() => {
    client.connect();

    // Auto-detect updates: initial check after 10s idle, then every 4 hours
    const initialTimer = setTimeout(() => {
      useUpdateStore.getState().checkForUpdates(false);
    }, 10_000);

    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const intervalTimer = setInterval(() => {
      useUpdateStore.getState().checkForUpdates(false);
    }, FOUR_HOURS_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      client.disconnect();
    };
  }, []);

  return (
    <div className="flex h-full w-full min-h-full min-w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)] font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatView />
      </main>
      <RightSidebar />

      {/* IN-APP UPDATE SYSTEM */}
      <UpdateBanner />
      <UpdateModal />
    </div>
  );
};
