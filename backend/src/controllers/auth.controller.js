import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { generateRSAKeyPair } from "../utils/cryptoUtils.js";

export const signup = async (req, res) => {
  const { username, fullName, email, password } = req.body;
  try {
    if (!username || !fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: "Email already exists" });
      }
      return res.status(400).json({ message: "Username already exists" });
    }

    // Generate RSA key pair
    const { publicKey, privateKey } = generateRSAKeyPair();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      fullName,
      email,
      password: hashedPassword,
      publicKey,
      privateKey
    });

    await newUser.save();

    // generate jwt token here
    generateToken(newUser._id, res);

    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      fullName: newUser.fullName,
      email: newUser.email,
      profilePic: newUser.profilePic,
      publicKey: newUser.publicKey,
      privateKey  // Send private key to client for storage
    });
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid username/email or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    let privateKey = user.privateKey;
    let publicKey = user.publicKey;

    // Generate new RSA key pair if keys are missing
    if (!privateKey || !publicKey) {
      const keys = generateRSAKeyPair();
      privateKey = keys.privateKey;
      publicKey = keys.publicKey;
      user.privateKey = privateKey;
      user.publicKey = publicKey;
      await user.save();
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      publicKey,
      privateKey  // Send stored or newly generated private key
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, username, fullName } = req.body;
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }
    
    const userId = req.user._id;

    const updateData = {};
    
    if (profilePic) {
      // Skip upload if already a URL (from existing profile)
      if (profilePic.startsWith('http')) {
        updateData.profilePic = profilePic;
      } else {
        try {
          const uploadResponse = await cloudinary.uploader.upload(profilePic, {
            folder: 'profile_pics'
          });
          updateData.profilePic = uploadResponse.secure_url;
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(500).json({ message: 'Failed to upload profile picture' });
        }
      }
    }

    if (username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== userId.toString()) {
        return res.status(400).json({ message: "Username already exists" });
      }
      updateData.username = username;
    }

    if (fullName) {
      updateData.fullName = fullName;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in updateProfile controller:", {
      message: error.message,
      stack: error.stack,
      requestBody: req.body,
      userId: req.user?._id
    });
    res.status(500).json({ 
      message: "Profile update failed",
      error: error.message 
    });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
