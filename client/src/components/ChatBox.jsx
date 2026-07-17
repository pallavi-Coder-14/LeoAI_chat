import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("https://leoai-chat.onrender.com"); // Backend URL

export default function ChatBox({ chat, onUpdateChat }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(chat?.messages || []);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages(chat?.messages || []);
  }, [chat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Receive messages from socket
  useEffect(() => {
    socket.on("receiveMessage", ({ userMsg, botMsg, chatId, error }) => {
      if (error) return alert(error);
      const updated = [...messages, { sender: "user", text: userMsg }, { sender: "bot", text: botMsg }];
      setMessages(updated);
      if (onUpdateChat) onUpdateChat({ ...chat, messages: updated, _id: chatId });
    });
    return () => socket.off("receiveMessage");
  }, [messages, chat, onUpdateChat]);

  const handleSend = () => {
    if (!message.trim()) return;
    socket.emit("sendMessage", { message, chatId: chat?._id, userId: localStorage.getItem("userId") });
    setMessage("");
  };

  if (!chat) return <div style={{ flex: 1, padding: 20 }}>Select a chat</div>;

  return (
    <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", height: "100%" }}>
      <h3>{chat.title || "Chat"}</h3>
      <div style={{ flex: 1, overflowY: "auto", marginBottom: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ textAlign: m.sender === "user" ? "right" : "left", margin: "5px 0" }}>
            <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: 10, background: m.sender === "user" ? "#4caf50" : "#e0e0e0", color: m.sender === "user" ? "#fff" : "#000", maxWidth: "70%" }}>
              {m.text}
            </span>
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>
      <div style={{ display: "flex" }}>
        <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Type a message..." onKeyDown={e => e.key === "Enter" && handleSend()} />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
