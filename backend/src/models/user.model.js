import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    publicKey: {
      type: String,
      default: null,  // Will store the user's RSA public key
    },
    privateKey: {
      type: String,
      default: null,  // Will store the user's RSA private key securely
    },
    contacts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }]
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
