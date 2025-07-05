import { useState, useEffect } from "react";
import { formatMessageTime } from "../lib/utils";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

const Message = ({ message }) => {
  const { getDecryptedContent } = useChatStore();
  const { authUser } = useAuthStore();
  const [decryptedContent, setDecryptedContent] = useState({ text: "Decrypting..." });
  const isSender = message.senderId === authUser?._id;

  useEffect(() => {
    const content = getDecryptedContent(message._id);
    if (typeof content === 'string') {
      try {
        setDecryptedContent(JSON.parse(content));
      } catch {
        setDecryptedContent({ text: content });
      }
    } else {
      setDecryptedContent(content);
    }
  }, [message._id, getDecryptedContent]);

  return (
    <div className={`chat ${isSender ? "chat-end" : "chat-start"}`}>
      <div className="chat-image avatar">
        <div className="w-10 h-10 rounded-full border">
          <img
            src={
              isSender
                ? authUser?.profilePic || "/avatar.png"
                : message.senderProfilePic || "/avatar.png"
            }
            alt="profile pic"
          />
        </div>
      </div>
      <div className="chat-header mb-1">
        <time className="text-xs opacity-50 ml-1">
          {formatMessageTime(message.createdAt)}
        </time>
      </div>
      <div className="chat-bubble flex flex-col">
        {decryptedContent?.image && (
          <img
            src={decryptedContent.image}
            alt="Attachment"
            className="max-w-[300px] rounded-md mb-2"
            onLoad={() => console.log("Image loaded successfully")}
            onError={(e) => console.error("Image load error:", e)}
          />
        )}
        {decryptedContent?.text && <p>{decryptedContent.text}</p>}
      </div>
    </div>
  );
};

export default Message;