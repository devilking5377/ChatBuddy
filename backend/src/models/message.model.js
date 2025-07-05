import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Encrypted message content
    encryptedContent: {
      type: String,
      required: true,
    },
    // For AES encryption
    iv: {
      type: String,
      required: true,
    },
    authTag: {
      type: String,
      required: true,
    },
    // Encrypted AES key for sender
    senderEncryptedKey: {
      type: String,
      required: true,
    },
    // Encrypted AES key for receiver
    receiverEncryptedKey: {
      type: String,
      required: true,
    },
    // Original fields for backward compatibility
    text: String,
    image: String
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
