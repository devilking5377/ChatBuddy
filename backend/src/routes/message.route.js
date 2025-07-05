import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, addContact, uploadFile } from "../controllers/message.controller.js";
import upload from "../lib/multerConfig.cjs";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);
router.post("/add-contact/:id", protectRoute, addContact);
router.post("/upload", protectRoute, upload.single('file'), uploadFile);

export default router;
