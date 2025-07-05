import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { 
  analyzeSentiment,
  generateSmartReplies, 
  summarizeConversation,
  chatComplete,
  getAvailableModels,
  getModelStatus
} from "../controllers/ai.controller.js";

const router = express.Router();

const authMiddleware = process.env.NODE_ENV === "development" 
  ? (req, res, next) => next()
  : protectRoute;

router.post("/sentiment", authMiddleware, analyzeSentiment);
router.post("/smart-reply", authMiddleware, generateSmartReplies);
router.post("/summarize", authMiddleware, summarizeConversation);
router.post("/chat", authMiddleware, chatComplete);
router.get("/models", authMiddleware, getAvailableModels);
router.get("/status", authMiddleware, getModelStatus);

export default router;
