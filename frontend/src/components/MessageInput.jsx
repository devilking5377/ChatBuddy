import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Video, FileText, Send, X, MessageSquarePlus, Smile } from "lucide-react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import EmojiPicker from "emoji-picker-react";
import { encryptWithRSA, encryptWithAES, generateAESKey, getStoredKeys } from "../lib/cryptoUtils";
import fileUploadIcon from "../../fileupload.png";

const MessageInput = () => {
  const { text, setText, sendMessage, setAIResults, selectedUser } = useChatStore();
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const uploadTypeRef = useRef("all");

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    try {
      // Show preview for images
      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setFilePreview(null);
      }

      // Create form data and upload directly
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await axiosInstance.post("/api/messages/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      
      // Set the file URL from Cloudinary response
      setFile(response.data.url);
      
    } catch (error) {
      console.error("File upload failed:", error);
      toast.error("Failed to upload file");
      removeFile();
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadButtonClick = () => {
    setShowUploadMenu(!showUploadMenu);
  };

  const handleUploadOptionClick = (type) => {
    uploadTypeRef.current = type;
    setShowUploadMenu(false);
    if (fileInputRef.current) {
      if (type === "image") {
        fileInputRef.current.accept = "image/*";
      } else if (type === "video") {
        fileInputRef.current.accept = "video/*";
      } else if (type === "document") {
        fileInputRef.current.accept = ".pdf,.doc,.docx,.txt";
      } else {
        fileInputRef.current.accept = "*/*";
      }
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !file) return;

    try {
      let imageUrl = null;
      
      if (file) {
        imageUrl = file;
      }

      // Generate an AES key for this message
      const aesKey = await generateAESKey();
      
      // Encrypt the message content with AES
      const messageContent = JSON.stringify({
        text: text.trim(),
        image: imageUrl
      });
      
      const { encryptedData, iv, authTag } = await encryptWithAES(aesKey, messageContent);
      
      // Get stored RSA keys
      const { publicKey } = getStoredKeys();
      
      // Encrypt the AES key with both users' public keys
      const senderEncryptedKey = await encryptWithRSA(publicKey, aesKey);
      const receiverEncryptedKey = await encryptWithRSA(selectedUser.publicKey, aesKey);

      await sendMessage({
        encryptedContent: encryptedData,
        iv,
        authTag,
        senderEncryptedKey,
        receiverEncryptedKey,
        text: text.trim(), // For backward compatibility
        image: imageUrl // For backward compatibility
      });

      // Clear form
      setText("");
      removeFile();
    } catch (error) {
      console.error("Failed to send message or upload file:", error);
      toast.error("Failed to send message or upload file");
    }
  };

  const analyzeSentiment = async () => {
    if (!text) return;
    try {
      const { data } = await axiosInstance.post("/api/ai/sentiment", { message: text });
      setAIResults({
        type: "sentiment",
        label: data.sentiment,
        confidence: data.confidence,
      });
    } catch (error) {
      toast.error("Sentiment analysis failed");
      console.error(error);
    }
  };

  const getSmartReplies = async () => {
    try {
      const { data } = await axiosInstance.post("/api/ai/smart-reply", {
        conversation: text,
      });
      setAIResults({
        type: "smart-replies",
        replies: data.replies,
      });
    } catch (error) {
      toast.error("Failed to get smart replies");
      console.error(error);
    }
  };

  const summarizeConversation = async () => {
    try {
      const { messages, getDecryptedContent } = useChatStore.getState();
      if (!messages || messages.length === 0) {
        toast.error("No messages to summarize");
        return;
      }

      const formattedMessages = messages
        .map((m) => {
          const decrypted = getDecryptedContent(m._id);
          return `${m.senderProfilePic ? "You" : "Other"}: ${decrypted.text || ""}`;
        })
        .filter((m) => m.includes(": "));

      const { data } = await axiosInstance.post("/api/ai/summarize", {
        chatHistory: formattedMessages.join("\n"),
      });
      setAIResults({
        type: "summary",
        summary: data.summary,
      });
    } catch (error) {
      toast.error("Failed to summarize conversation");
      console.error(error);
    }
  };

  const onEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;
    const cursorPos = inputRef.current.selectionStart;
    const newText = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);
    setText(newText);
    // Move cursor position after the inserted emoji
    setTimeout(() => {
      inputRef.current.selectionStart = cursorPos + emoji.length;
      inputRef.current.selectionEnd = cursorPos + emoji.length;
      inputRef.current.focus();
    }, 0);
  };

  return (
    <div className="p-4 w-full relative">
      {filePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={filePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeFile}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={getSmartReplies}
              className="btn btn-circle btn-sm"
              disabled={!text.trim()}
              title="Get smart replies"
            >
              <MessageSquarePlus size={18} />
            </button>
            <button
              type="button"
              onClick={summarizeConversation}
              className="btn btn-circle btn-sm"
              title="Summarize conversation"
            >
              <FileText size={18} />
            </button>
          </div>

          <input
            ref={inputRef}
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md message-input"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            type="file"
            accept="*/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          <div className="relative hidden sm:flex">
            <button
              type="button"
              className={`btn btn-circle ${filePreview ? "text-emerald-500" : "text-zinc-400"}`}
              onClick={handleUploadButtonClick}
              title="Upload file"
            >
              <img src={fileUploadIcon} alt="Upload" className="w-5 h-5" />
            </button>
            {showUploadMenu && (
              <div className="absolute bottom-12 left-0 bg-white rounded-lg shadow-lg p-3 flex flex-col gap-3 z-50 border border-gray-300">
                <button
                  type="button"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors"
                  onClick={() => handleUploadOptionClick("image")}
                >
                  <div className="bg-blue-500 p-2 rounded-full flex items-center justify-center">
                    <ImageIcon size={20} className="text-white" />
                  </div>
                  <span className="text-gray-800 font-semibold">Image</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 transition-colors"
                  onClick={() => handleUploadOptionClick("video")}
                >
                  <div className="bg-red-500 p-2 rounded-full flex items-center justify-center">
                    <VideoIcon size={20} className="text-white" />
                  </div>
                  <span className="text-gray-800 font-semibold">Video</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-yellow-50 transition-colors"
                  onClick={() => handleUploadOptionClick("document")}
                >
                  <div className="bg-yellow-500 p-2 rounded-full flex items-center justify-center">
                    <FileTextIcon size={20} className="text-white" />
                  </div>
                  <span className="text-gray-800 font-semibold">Document</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors"
                  onClick={() => handleUploadOptionClick("all")}
                >
                  <div className="bg-purple-500 p-2 rounded-full flex items-center justify-center">
                    <AllFilesIcon size={20} className="text-white" />
                  </div>
                  <span className="text-gray-800 font-semibold">All Files</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-circle btn-sm text-zinc-400"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Emoji picker"
        >
          <Smile size={20} />
        </button>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !file}
        >
          <Send size={22} />
        </button>
      </form>
      {showEmojiPicker && (
        <div className="absolute bottom-16 right-0 z-50 bg-base-200 rounded-lg shadow-lg p-2">
          <button
            type="button"
            className="absolute top-2 right-2 btn btn-xs btn-circle bg-zinc-300 hover:bg-zinc-400 text-zinc-800 shadow-md"
            onClick={() => setShowEmojiPicker(false)}
            aria-label="Close emoji picker"
            style={{ zIndex: 1001 }}
          >
            <X size={16} />
          </button>
          <EmojiPicker onEmojiClick={onEmojiClick} />
        </div>
      )}
    </div>
  );
};

const ImageIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.5 19.5l6-6 4.5 4.5 6-9"
    />
  </svg>
);

const VideoIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 10.5l4.5-3v9l-4.5-3m-6 3v-12a1.5 1.5 0 013 0v12a1.5 1.5 0 01-3 0z"
    />
  </svg>
);

const FileTextIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V18a2 2 0 01-2 2z"
    />
  </svg>
);

const AllFilesIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
);

export default MessageInput;
