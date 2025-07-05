import { useChatStore } from "../store/useChatStore";
import { Lock } from "lucide-react";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <div className="h-screen bg-base-200">
      <div className="flex items-center justify-center pt-20 px-4">
        <div className="flex flex-col w-full max-w-6xl">
          <div className="bg-base-100 rounded-lg shadow-cl w-full h-[calc(100vh-10rem)]">
            <div className="flex h-full rounded-lg overflow-hidden">
              <Sidebar />
              {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
            </div>
          </div>
          
          {/* Encryption indicator outside of chat container */}
          {selectedUser && (
            <div className="mt-2 px-4 py-2 bg-base-100 rounded-lg shadow-sm">
              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-600">
                <Lock size={12} className="flex-shrink-0" />
                <span>Messages are end-to-end encrypted. Nobody outside of this chat can read them.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default HomePage;
