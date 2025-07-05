import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { 
  encryptWithRSA, 
  decryptWithRSA, 
  generateAESKey, 
  encryptWithAES, 
  decryptWithAES,
  getStoredKeys
} from "../lib/cryptoUtils";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  aiResults: null,
  decryptedMessages: {}, // Cache for decrypted messages
  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/api/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  addContactAndStartChat: async (userId) => {
    try {
      await axiosInstance.post(`/api/messages/add-contact/${userId}`);
      await get().getUsers(); // Refresh the users list
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add contact");
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/api/messages/${userId}`);
      const messages = res.data;
      
      // Decrypt messages
      await get().decryptMessages(messages);
      
      set({ messages });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  decryptMessages: async (messages) => {
    const authUser = useAuthStore.getState().authUser;
    const privateKey = localStorage.getItem('privateKey');
    console.log("DecryptMessages: Using privateKey:", privateKey);
    const decryptedMsgs = { ...get().decryptedMessages };
    
    if (!privateKey || !authUser) return;
    
    for (const message of messages) {
      if (decryptedMsgs[message._id]) continue;
      
      try {
        // Determine if user is sender or receiver
        const isSender = message.senderId === authUser._id;
        
        // Get the encrypted AES key for this user
        const encryptedAESKey = isSender 
          ? message.senderEncryptedKey 
          : message.receiverEncryptedKey;
        
        console.log(`DecryptMessages: Decrypting AES key for message ${message._id} with encryptedAESKey:`, encryptedAESKey);
        
        // Decrypt the AES key using user's private RSA key
        const aesKey = await decryptWithRSA(privateKey, encryptedAESKey);
        console.log(`DecryptMessages: Decrypted AES key for message ${message._id}:`, aesKey);
        
        // Decrypt the actual message content using the AES key
        const decryptedContent = await decryptWithAES(
          aesKey,
          message.iv,
          message.encryptedContent,
          message.authTag
        );
        
        // Store in cache
        decryptedMsgs[message._id] = decryptedContent;
      } catch (error) {
        console.error(`Failed to decrypt message ${message._id}:`, error);
        decryptedMsgs[message._id] = "Unable to decrypt message";
      }
    }
    
    set({ decryptedMessages: decryptedMsgs });
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const { publicKey } = getStoredKeys();

    if (!publicKey || typeof publicKey !== 'string') {
      toast.error("Your public key is missing or invalid. Please log in again.");
      throw new Error("Invalid sender public key");
    }

    if (!selectedUser?.publicKey || typeof selectedUser.publicKey !== 'string') {
      toast.error("Selected user's public key is missing or invalid.");
      throw new Error("Invalid receiver public key");
    }
    
    try {
      // Generate a random AES key for this message
      const aesKey = await generateAESKey();
      
      // Encrypt the message content with AES
      const { 
        encryptedData: encryptedContent, 
        iv, 
        authTag 
      } = await encryptWithAES(aesKey, JSON.stringify({
        text: messageData.text,
        image: messageData.image
      }));
      
      // Encrypt the AES key with both users' public keys
      const senderEncryptedKey = await encryptWithRSA(publicKey, aesKey);
      const receiverEncryptedKey = await encryptWithRSA(selectedUser.publicKey, aesKey);
      
      const res = await axiosInstance.post(`/api/messages/send/${selectedUser._id}`, {
        encryptedContent,
        iv,
        authTag,
        senderEncryptedKey,
        receiverEncryptedKey,
        // Include original fields for backward compatibility
        text: messageData.text,
        image: messageData.image
      });
      
      const newMessage = res.data;
      
      // Add decrypted content to cache
      const updatedDecryptedMsgs = { ...get().decryptedMessages };
      updatedDecryptedMsgs[newMessage._id] = JSON.stringify({
        text: messageData.text,
        image: messageData.image
      });
      
      set({ 
        messages: [...messages, newMessage],
        decryptedMessages: updatedDecryptedMsgs
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", async (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      // Decrypt the new message
      await get().decryptMessages([newMessage]);
      
      // Add message and sort by createdAt timestamp
      const updatedMessages = [...get().messages, newMessage].sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      );
      
      set({ messages: updatedMessages });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
  setAIResults: (results) => set({ aiResults: results }),
  
  getDecryptedContent: (messageId) => {
    const content = get().decryptedMessages[messageId];
    if (!content) return "Loading...";
    
    try {
      return JSON.parse(content);
    } catch {
      return { text: content };
    }
  },

  analyzeMessageSentiment: async (messageId, text) => {
    try {
      const { selectedModel } = get();
      const { data } = await axiosInstance.post("/api/ai/sentiment", { 
        message: text,
        model: selectedModel
      });
      set({
        aiResults: {
          type: "sentiment",
          messageId,
          label: data.sentiment,
          confidence: data.confidence
        }
      });
    } catch (error) {
      toast.error("Sentiment analysis failed");
      console.error(error);
    }
  },
  summarizeConversation: async (messages) => {
    try {
      const { data } = await axiosInstance.post("/api/ai/summarize", {
        chatHistory: messages.map(m => `${m.sender}: ${m.content}`).join('\n')
      });
      set({
        aiResults: {
          type: "summary",
          summary: data.summary
        }
      });
    } catch (error) {
      toast.error("Failed to summarize conversation");
      console.error(error);
    }
  },
  clearAIResults: () => set({ aiResults: null }),
  selectedModel: null,
  setSelectedModel: (model) => set({ selectedModel: model }),
  availableModels: [],
  setAvailableModels: (models) => set({ availableModels: models }),
  fetchAvailableModels: async () => {
    try {
      const { data } = await axiosInstance.get('/api/ai/models');
      set({ availableModels: data.models });
      if (data.models.length > 0) {
        set({ selectedModel: data.models[0].name });
      }
    } catch (error) {
      toast.error("Failed to fetch available models");
      console.error(error);
    }
  },
  text: '',
  setText: (text) => set({ text }),
}));
