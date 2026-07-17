import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import http from "http"; // Needed for socket.io

import chatRoutes from "./routes/chatRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config({ path: path.resolve("./.env") });

const app = express();
const server = http.createServer(app); // Wrap Express app
import { Server } from "socket.io";
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

app.use("/api/chat", chatRoutes);
app.use("/api/auth", authRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err.message));

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("sendMessage", async ({ message, chatId, userId }) => {
    try {
      // Call your backend logic to get AI reply
      const Chat = await import("./models/Chat.js").then(m => m.default);
      const Groq = await import("groq-sdk").then(m => m.default);

      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: message }],
      });
      const reply = completion.choices[0].message.content;

      // Save chat
      let chat;
      if (chatId) {
        chat = await Chat.findById(chatId);
        chat.messages.push({ sender: "user", text: message });
        chat.messages.push({ sender: "bot", text: reply });
      } else {
        chat = new Chat({ user: userId, messages: [{ sender: "user", text: message }, { sender: "bot", text: reply }] });
      }
      await chat.save();

      // Emit to client
      io.to(socket.id).emit("receiveMessage", { userMsg: message, botMsg: reply, chatId: chat._id });
    } catch (err) {
      console.error("Socket AI error:", err.message);
      io.to(socket.id).emit("receiveMessage", { error: "AI failed" });
    }
  });

  socket.on("disconnect", () => {
    console.log("⚡ User disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
