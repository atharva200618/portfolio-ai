/*************************************************
 *  SERVER.JS – AI BACKEND FOR PORTFOLIO ASSISTANT
 *  Author: Atharva Portfolio Backend
 *  Purpose:
 *  - Handle AI chat requests
 *  - Respect frontend systemPrompt (dual-brain)
 *  - Provide safety, structure & memory
 *************************************************/

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

/* ================================================
   1. ENVIRONMENT SETUP
================================================ */
dotenv.config();

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY missing in .env");
  process.exit(1);
}

/* ================================================
   2. APP INITIALIZATION
================================================ */
const app = express();

/* ---------- Middlewares ---------- */
app.use(cors({
  origin: "*", // later restrict to domain
  methods: ["POST", "GET"],
}));
app.use(express.json({ limit: "1mb" }));

/* ================================================
   3. AI CLIENT INITIALIZATION
================================================ */
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* ================================================
   4. IN-MEMORY SESSION MEMORY
   (Frontend already limits memory visually)
================================================ */
const chatMemory = [];
const MAX_MEMORY_MESSAGES = 6;

/**
 * Save message safely into memory
 */
function pushToMemory(role, content) {
  chatMemory.push({ role, content });

  if (chatMemory.length > MAX_MEMORY_MESSAGES) {
    chatMemory.shift();
  }
}

/* ================================================
   5. RESPONSE QUALITY ENFORCER
   (FINAL SAFETY NET – frontend already formats)
================================================ */
function enforceMarkdownStructure(text) {
  if (!text) return "";

  // If AI already structured → return as-is
  const structured =
    text.includes("##") ||
    text.includes("- ") ||
    text.includes("**");

  if (structured) return text;

  // Convert plain text → bullets
  const lines = text.split(/[.?!]\s+/).filter(Boolean);

  let output = "## 📌 Response\n\n";
  for (const line of lines) {
    output += `- ${line.trim()}\n`;
  }

  return output;
}

/* ================================================
   6. BASIC INPUT SANITIZATION
================================================ */
function sanitize(text = "") {
  return text
    .replace(/<script.*?>.*?<\/script>/gi, "")
    .replace(/[<>]/g, "")
    .trim();
}

/* ================================================
   7. HEALTH CHECK (OPTIONAL BUT PRO)
================================================ */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Atharva AI Backend",
    uptime: process.uptime(),
  });
});

/* ================================================
   8. MAIN CHAT ENDPOINT
   (THIS IS WHAT FRONTEND CALLS)
================================================ */
app.post("/chat", async (req, res) => {
  try {
    /* ---------- Validate Request ---------- */
    const userMessageRaw = req.body?.message;
    const systemPromptRaw = req.body?.system;

    if (!userMessageRaw || typeof userMessageRaw !== "string") {
      return res.status(400).json({
        reply: "## ⚠️ Invalid Request\n- Message missing or invalid",
      });
    }

    const userMessage = sanitize(userMessageRaw);
    const systemPrompt = systemPromptRaw ? sanitize(systemPromptRaw) : null;

    /* ---------- Save User Message ---------- */
    pushToMemory("user", userMessage);

    /* ---------- Build Messages for AI ---------- */
    const messages = [];

    // 🔥 CRITICAL: frontend controls system prompt
    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    // Short memory (context)
    messages.push(...chatMemory);

    /* ---------- AI CALL ---------- */
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.45,
      max_tokens: 900,
      top_p: 0.9,
      messages,
    });

    let aiReply =
      completion?.choices?.[0]?.message?.content ||
      "## ⚠️ AI Error\n- Empty response received";

    /* ---------- Enforce Structure ---------- */
    aiReply = enforceMarkdownStructure(aiReply);

    /* ---------- Save AI Reply ---------- */
    pushToMemory("assistant", aiReply);

    /* ---------- Send Response ---------- */
    return res.json({
      reply: aiReply,
    });

  } catch (error) {
    console.error("❌ CHAT ERROR:", error);

    return res.status(500).json({
      reply: `
## ❌ Server Error
- AI backend temporarily unavailable
- Please click **Retry**
      `,
    });
  }
});

/* ================================================
   9. GLOBAL ERROR HANDLER (SAFETY)
================================================ */
app.use((err, req, res, next) => {
  console.error("🔥 Unhandled Error:", err);
  res.status(500).json({
    reply: "## ❌ Unexpected Server Error\n- Please try again later",
  });
});

/* ================================================
   10. SERVER START
================================================ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("=====================================");
  console.log(`✅ AI Backend Running`);
  console.log(`🌍 URL: http://localhost:${PORT}`);
  console.log(`🤖 Model: LLaMA 3.1`);
  console.log("=====================================");
});
