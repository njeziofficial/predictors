import { Navigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import NavBar from "@/components/NavBar";
import ChatWorkspace from "@/components/chat/ChatWorkspace";

// The game's messaging screen. Fills the viewport under the nav bar so only the chat scrolls.
const Messages = () => {
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/" replace />;

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <NavBar />
      <main className="min-h-0 flex-1 page-transition">
        <div className="mx-auto h-full max-w-6xl">
          <ChatWorkspace basePath="/messages" />
        </div>
      </main>
    </div>
  );
};

export default Messages;
