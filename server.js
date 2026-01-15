import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";

// =====================
// ES Module path fix
// =====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================
// App init
// =====================
dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// =====================
// Serve frontend (index.html etc.)
// =====================
app.use(express.static(__dirname));

// =====================
// Groq init
// =====================
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// =====================
// Chat API
// =====================
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body?.message;

    if (!userMessage) {
      return res.status(400).json({
        reply: "⚠️ Message missing hai."
      });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
You are Atharva's AI Assistant.

IMPORTANT:
- Always use Markdown
- Use headings, bullet points, bold text
- Never write one long paragraph

Tone:
- Friendly
- Professional
- Hinglish

Context:
- 2nd Year BTech CSE (AI & ML), VIT Vellore
- Skills: Python, SQL, Power BI, Machine Learning, Data Analytics
- Projects:
  - Student Performance Prediction
  - Sales Analytics Dashboard
  - Churn Prediction
          `
        },
        {
          role: "user",
          content: userMessage
        }
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "⚠️ AI response generate nahi ho paya.";

    res.json({ reply });

  } catch (error) {
    console.error("❌ Chat Error:", error.message);
    res.status(500).json({
      reply: "⚠️ Server issue ho gaya. Thodi der baad try karo."
    });
  }
});

// =====================
// Server start (RENDER SAFE)
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
