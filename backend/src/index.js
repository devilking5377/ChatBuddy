import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import aiRoutes from "./routes/ai.route.js";
import { app, server } from "./lib/socket.js";
import { initSentimentAnalysis } from "./utils/sentimentAnalyzer.js";
import { checkOllamaHealth } from "./utils/ollamaService.js";

dotenv.config();

// Initialize AI services
await initSentimentAnalysis();

// Check Ollama connection
try {
  const ollamaReady = await checkOllamaHealth();
  if (ollamaReady) {
    console.log('✅ Ollama service connected - AI features enabled');
  } else {
    console.warn('⚠️ Ollama service unavailable - AI features disabled');
    console.log('💡 To enable AI features:');
    console.log('1. Install Ollama from https://ollama.ai');
    console.log('2. Run "npm run start:ollama" or "npm run dev:ollama"');
    console.log('3. Or run "ollama serve" in a separate terminal');
  }
} catch (err) {
  console.error('❌ Error connecting to Ollama:', err.message);
}

const PORT = process.env.PORT;
const __dirname = path.resolve();

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/ai", aiRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB();
});
