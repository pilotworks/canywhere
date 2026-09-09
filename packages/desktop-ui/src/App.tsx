import React, { useEffect } from "react";
import { client } from "./network/client.js";
import { Sidebar } from "./components/layout/sidebar.js";
import { RightSidebar } from "./components/layout/right-sidebar.js";
import { ChatView } from "./components/chat/chat-view.js";

export const App: React.FC = () => {
  useEffect(() => {
    client.connect();
    return () => client.disconnect();
  }, []);

  return (
    <div className="flex h-full w-full min-h-full min-w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)] font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatView />
      </main>
      <RightSidebar />
    </div>
  );
};
