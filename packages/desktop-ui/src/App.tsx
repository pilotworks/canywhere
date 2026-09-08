import React, { useEffect } from "react";
import { client } from "./network/client.js";
import { Sidebar } from "./components/Sidebar.js";
import { ChatView } from "./components/ChatView.js";
import { ApprovalModal } from "./components/ApprovalModal.js";

export const App: React.FC = () => {
  useEffect(() => {
    client.connect();
    return () => client.disconnect();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatView />
      </main>
      <ApprovalModal />
    </div>
  );
};
