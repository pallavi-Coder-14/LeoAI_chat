// server/routes/chatRoutes.js
import express from "express";
import Groq from "groq-sdk";
import Chat from "../models/Chat.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Get all chat history for logged-in user
router.get("/history", auth, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: "Failed to load history" });
  }
});

// Send message (new or existing chat)
router.post("/", auth, async (req, res) => {
  try {
    const { message, chatId } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: message }],
    });

    const reply = completion.choices[0].message.content;

    let chat;
    if (chatId) {
      // Existing chat → append messages
      chat = await Chat.findById(chatId);
      chat.messages.push({ sender: "user", text: message });
      chat.messages.push({ sender: "bot", text: reply });
    } else {
      // New chat → create new document
      chat = new Chat({
        user: req.userId,
        messages: [
          { sender: "user", text: message },
          { sender: "bot", text: reply }
        ]
      });
    }

    await chat.save();
    res.json({ reply, chatId: chat._id });
  } catch (err) {
    console.error("AI Error:", err.message);
    res.status(500).json({ error: "AI failed" });
  }
});

export default router;
