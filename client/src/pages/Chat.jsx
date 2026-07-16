import { useState, useEffect, useRef } from "react";
import API from "../utils/api";
import "./Chat.css";

export default function Chat() {
  const [chats, setChats] = useState([]); // current chat messages
  const [history, setHistory] = useState([]); // all chat sessions
  const [activeChat, setActiveChat] = useState(null);
  const [message, setMessage] = useState("");
  const bottomRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await API.get("/chat/history");
        setHistory(res.data);
        if (res.data.length) {
          setActiveChat(res.data[0]);
          setChats(res.data[0].messages);
        }
      } catch (err) {
        console.error("History fetch error:", err);
      }
    };
    fetchHistory();
  }, []);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    try {
      const res = await API.post("/chat", {
        message,
        chatId: activeChat?._id,
      });

      const userMsg = { sender: "user", text: message };
      const botMsg = { sender: "bot", text: res.data.reply };

      const updatedMessages = [...chats, userMsg, botMsg];
      setChats(updatedMessages);

      const updatedChat = { ...activeChat, messages: updatedMessages, _id: res.data.chatId };
      setActiveChat(updatedChat);
      setHistory((prev) => {
        const exists = prev.find((c) => c._id === updatedChat._id);
        if (exists) {
          return prev.map((c) => (c._id === updatedChat._id ? updatedChat : c));
        }
        return [updatedChat, ...prev];
      });

      setMessage("");
    } catch (err) {
      console.error("Send message error:", err);
      alert("AI Error");
    }
  };

  const newChat = () => {
    const chat = { messages: [], createdAt: new Date() };
    setActiveChat(chat);
    setChats([]);
  };

  const selectChat = (chat) => {
    setActiveChat(chat);
    setChats(chat.messages);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    window.location.href = "/login";
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <h2>AI Chat</h2>
        <p>Hello, {localStorage.getItem("name")}</p>
        <button onClick={newChat}>+ New Chat</button>
        <button onClick={logout} style={{ background: "red" }}>Logout</button>
        <div className="history-list">
          {history.length === 0 && <p>No chats yet</p>}
          {history.map((chat) => (
            <div
              key={chat._id}
              className={`history-item ${activeChat?._id === chat._id ? "active" : ""}`}
              onClick={() => selectChat(chat)}
            >
              {chat.messages[0]?.text.slice(0, 30) || "New Chat"}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        <div className="messages">
          {chats.map((m, i) => (
            <div key={i} className={`msg ${m.sender}`}>
              <div className="bubble">{m.text}</div>
            </div>
          ))}
          <div ref={bottomRef}></div>
        </div>

        <div className="input-area">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}
