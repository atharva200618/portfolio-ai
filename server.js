/*************************************************
 *  SERVER.JS – AI BACKEND FOR PORTFOLIO ASSISTANT
 *  Author: Atharva
 *  Purpose:
 *  - AI chat backend
 *  - Works with GitHub Pages + Render
 *************************************************/

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

/* =================================================
   1. ENV SETUP
================================================= */
dotenv.config();

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY is missing");
  process.exit(1);
}

/* =================================================
   2. APP INIT
================================================= */
const app = express();
app.set("trust proxy", 1);

/* =================================================
   3. MIDDLEWARES
================================================= */
app.use(
  cors({
    origin: "*", // GitHub Pages safe
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "1mb" }));

/* =================================================
   4. GROQ CLIENT
================================================= */
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* =================================================
   5. SIMPLE MEMORY (SAFE)
================================================= */
const chatMemory = [];
const MAX_MEMORY = 6;

function pushMemory(role, content) {
  chatMemory.push({ role, content });
  if (chatMemory.length > MAX_MEMORY) chatMemory.shift();
}

/* =================================================
   6. SANITIZE
================================================= */
function sanitize(text = "") {
  return text
    .replace(/<script.*?>.*?<\/script>/gi, "")
    .replace(/[<>]/g, "")
    .trim();
}

/* =================================================
   7. HEALTH CHECK
================================================= */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Atharva AI Backend",
    uptime: Math.floor(process.uptime()),
  });
});

/* =================================================
   8. CHAT ENDPOINT
================================================= */
app.post("/chat", async (req, res) => {
  try {
    const { message, system } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        reply: "Invalid request",
      });
    }

    const userMessage = sanitize(message);
    const systemPrompt = system ? sanitize(system) : null;

    pushMemory("user", userMessage);

    const messages = [];

    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    messages.push(...chatMemory);

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.45,
      max_tokens: 800,
      messages,
    });

    const reply =
      completion?.choices?.[0]?.message?.content ||
      "AI failed to respond";

    pushMemory("assistant", reply);

    res.json({ reply });

  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    res.status(500).json({
      reply: "Server error. Please retry.",
    });
  }
});

/* =================================================
   9. GLOBAL ERROR HANDLER
================================================= */
app.use((err, req, res, next) => {
  console.error("🔥 UNHANDLED:", err);
  res.status(500).json({ reply: "Unexpected server error" });
});

/* =================================================
   10. START SERVER (RENDER SAFE)
================================================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("====================================");
  console.log("✅ Atharva AI Backend LIVE");
  console.log(`🌍 Port: ${PORT}`);
  console.log("====================================");
});
