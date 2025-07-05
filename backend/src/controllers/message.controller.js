import mongoose from "mongoose";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import multer from 'multer';
import upload from '../lib/multerConfig.cjs';

export const getUsersForSidebar = async (req, res) => {
  try {
    let loggedInUserId = req.user?._id;
    
    // Handle development mode where auth is bypassed
    if (!loggedInUserId && process.env.NODE_ENV === 'development') {
      const devUser = await User.findOne().select("-password");
      if (devUser) loggedInUserId = devUser._id;
    }

    if (!loggedInUserId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get all users who have either sent messages to or received messages from the current user
    const [senderIds, receiverIds] = await Promise.all([
      Message.distinct("senderId"),
      Message.distinct("receiverId")
    ]);
    const usersWithMessages = [...new Set([...senderIds, ...receiverIds])];
    
    // Get users that match the search criteria and either have messages or are in contacts
    const filteredUsers = await User.find({
      $and: [
        { _id: { $ne: loggedInUserId } },
        { 
          $or: [
            { _id: { $in: usersWithMessages } },
            { contacts: loggedInUserId }
          ]
        }
      ]
    })
    .select("-password")
    .select("+publicKey");
      
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    let myId = req.user?._id;
    
    // Handle development mode where auth is bypassed
    if (!myId && process.env.NODE_ENV === 'development') {
      const devUser = await User.findOne().select("-password");
      if (devUser) myId = devUser._id;
    }

    if (!myId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 }); // Add sorting by createdAt in ascending order

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    // Validate request
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }

    const { 
      encryptedContent, 
      iv, 
      authTag, 
      senderEncryptedKey, 
      receiverEncryptedKey, 
      text, // Original text for backward compatibility
      image // Original image for backward compatibility
    } = req.body;

    if (!encryptedContent || !iv || !authTag || !senderEncryptedKey || !receiverEncryptedKey) {
      return res.status(400).json({ error: "Missing required encryption parameters" });
    }

    const { id: receiverId } = req.params;
    if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ error: "Invalid receiver ID" });
    }

    // Handle authentication
    let senderId = req.user?._id;
    if (!senderId && process.env.NODE_ENV === 'development') {
      const devUser = await User.findOne().select("-password");
      if (devUser) senderId = devUser._id;
    }
    if (!senderId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Create and save message
    const newMessage = new Message({
      senderId,
      receiverId,
      encryptedContent,
      iv,
      authTag,
      senderEncryptedKey,
      receiverEncryptedKey,
      text, // Store original text if provided
      image // Store original image if provided
    });

    await newMessage.save();

    // Emit socket event
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    return res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage controller:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
      params: req.params
    });
    res.status(500).json({ 
      error: "Failed to send message",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const uploadFile = async (req, res) => {
  try {
    if (!req.files && !req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = req.files?.file || req.file;
    
    // Convert the file buffer to a base64 string that Cloudinary can accept
    const b64 = Buffer.from(file.buffer).toString('base64');
    const dataURI = `data:${file.mimetype};base64,${b64}`;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      resource_type: 'auto'
    });

    res.json({
      message: 'File uploaded successfully',
      url: result.secure_url
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
};

export const addContact = async (req, res) => {
  try {
    const { id: contactId } = req.params;
    const userId = req.user._id;

    // Verify the contact exists
    const contact = await User.findById(contactId);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    // Add contact to user's contacts list (if not already there)
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { contacts: contactId } },
      { new: true }
    );

    res.status(200).json({ message: "Contact added successfully" });
  } catch (error) {
    console.error("Error in addContact:", error);
    res.status(500).json({ message: "Failed to add contact" });
  }
};
