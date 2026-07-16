import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import API from "./utils/api";
import "./App.css";

// ----- LOGIN PAGE -----
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/auth/login", { email, password });
      if (res.data.error) return alert(res.data.error);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("name", res.data.name);
      navigate("/chat");
    } catch {
      alert("Login failed");
    }
  };

  return (
    <div className="auth-page">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Login</button>
      </form>
      <p>Don't have an account? <span style={{color:'blue', cursor:'pointer'}} onClick={() => navigate("/register")}>Register here</span></p>
    </div>
  );
}

// ----- REGISTER PAGE -----
function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/auth/register", { name, email, password });
      if (res.data.error) return alert(res.data.error);

      alert("Registered successfully! Login now.");
      navigate("/login");
    } catch {
      alert("Register failed");
    }
  };

  return (
    <div className="auth-page">
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Register</button>
      </form>
      <p>Already have an account? <span style={{color:'blue', cursor:'pointer'}} onClick={() => navigate("/login")}>Login here</span></p>
    </div>
  );
}

// ----- helpers -----

// Buckets chats into Today / Yesterday / Previous 7 Days / Older, like ChatGPT's sidebar.
function groupChatsByDate(chats) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const weekAgo = new Date(startOfToday);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups = { Today: [], Yesterday: [], "Previous 7 Days": [], Older: [] };

  chats.forEach((chat) => {
    const d = new Date(chat.updatedAt || chat.createdAt || Date.now());
    if (d >= startOfToday) groups.Today.push(chat);
    else if (d >= startOfYesterday) groups.Yesterday.push(chat);
    else if (d >= weekAgo) groups["Previous 7 Days"].push(chat);
    else groups.Older.push(chat);
  });

  return groups;
}

function chatTitle(chat) {
  return chat.title || chat.messages?.[0]?.text?.slice(0, 30) || "New Chat";
}

const SUGGESTED_PROMPTS = [
  "Explain a tricky concept simply",
  "Help me debug a piece of code",
  "Draft a professional email",
  "Give me ideas for a weekend trip",
];

// ----- PROTECTED CHAT PAGE -----
function ChatPage() {
  const [chats, setChats] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef(null);
  const editInputRef = useRef(null);
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    navigate("/login");
  };

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  useEffect(() => {
    if (editingChatId) editInputRef.current?.focus();
  }, [editingChatId]);

  const sendMessage = async (overrideText) => {
    const text = (overrideText ?? message).trim();
    if (!text) return;
    try {
      const res = await API.post("/chat", { message: text, chatId: activeChat?._id });
      const userMsg = { sender: "user", text };
      const botMsg = { sender: "bot", text: res.data.reply };

      const updatedMessages = [...chats, userMsg, botMsg];
      setChats(updatedMessages);

      const updatedChat = { ...activeChat, messages: updatedMessages, _id: res.data.chatId };
      setActiveChat(updatedChat);
      setHistory(prev => {
        const exists = prev.find(c => c._id === updatedChat._id);
        if (exists) return prev.map(c => c._id === updatedChat._id ? updatedChat : c);
        return [updatedChat, ...prev];
      });

      setMessage("");
    } catch (err) {
      console.error("Send message error:", err);
      alert("AI Error");
    }
  };

  const copyMessage = async (text, i) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(i);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const startEditMessage = (i, text) => {
    setEditingIndex(i);
    setEditingText(text);
  };

  const cancelEditMessage = () => {
    setEditingIndex(null);
    setEditingText("");
  };

  // Edits a previously sent prompt: drops that message and everything after it
  // (including the old reply), then resends the edited text as a fresh turn.
  const saveEditMessage = async (i) => {
    const newText = editingText.trim();
    if (!newText) return;
    setEditingIndex(null);

    const baseMessages = chats.slice(0, i);
    try {
      const res = await API.post("/chat", { message: newText, chatId: activeChat?._id });
      const userMsg = { sender: "user", text: newText };
      const botMsg = { sender: "bot", text: res.data.reply };
      const updatedMessages = [...baseMessages, userMsg, botMsg];

      setChats(updatedMessages);

      const updatedChat = { ...activeChat, messages: updatedMessages, _id: res.data.chatId };
      setActiveChat(updatedChat);
      setHistory(prev => {
        const exists = prev.find(c => c._id === updatedChat._id);
        if (exists) return prev.map(c => c._id === updatedChat._id ? updatedChat : c);
        return [updatedChat, ...prev];
      });
    } catch (err) {
      console.error("Edit resend error:", err);
      alert("AI Error");
    }
  };

  const newChat = () => {
    const chat = { messages: [], createdAt: new Date() };
    setActiveChat(chat);
    setChats([]);
    setEditingChatId(null);
  };

  const selectChat = (chat) => {
    setActiveChat(chat);
    setChats(chat.messages);
  };

  const startRename = (e, chat) => {
    e.stopPropagation();
    setEditingChatId(chat._id);
    setEditingTitle(chatTitle(chat));
  };

  const saveRename = async (chat) => {
    const newTitle = editingTitle.trim() || chatTitle(chat);
    setEditingChatId(null);

    const updatedChat = { ...chat, title: newTitle };
    setHistory(prev => prev.map(c => c._id === chat._id ? updatedChat : c));
    if (activeChat?._id === chat._id) setActiveChat(updatedChat);

    // Persist to backend if a rename route exists; sidebar stays correct locally either way.
    try {
      await API.patch(`/chat/${chat._id}`, { title: newTitle });
    } catch (err) {
      console.warn("Rename not persisted to backend:", err);
    }
  };

  const deleteChat = async (e, chat) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${chatTitle(chat)}"? This can't be undone.`)) return;

    setHistory(prev => prev.filter(c => c._id !== chat._id));
    if (activeChat?._id === chat._id) {
      setActiveChat(null);
      setChats([]);
    }

    try {
      await API.delete(`/chat/${chat._id}`);
    } catch (err) {
      console.warn("Delete not persisted to backend:", err);
    }
  };

  const filteredHistory = history.filter(chat => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return chatTitle(chat).toLowerCase().includes(q) ||
      chat.messages?.some(m => m.text?.toLowerCase().includes(q));
  });

  const groupedHistory = groupChatsByDate(filteredHistory);
  const userName = localStorage.getItem("name");

  return (
    <div className="app">
      {!sidebarOpen && (
        <button
          className="sidebar-open-btn"
          onClick={() => setSidebarOpen(true)}
          title="Open sidebar"
        >
          ☰
        </button>
      )}

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? "" : "closed"}`}>
        <div className="sidebar-header-row">
          <h2>Leo AI</h2>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            ☰
          </button>
        </div>
        <button onClick={newChat}>+ New Chat</button>

        <div className="sidebar-search">
          <input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="history-list">
          {history.length === 0 && <p>No chats yet</p>}
          {history.length > 0 && filteredHistory.length === 0 && <p>No matches</p>}

          {Object.entries(groupedHistory).map(([label, list]) => (
            list.length === 0 ? null : (
              <div className="history-group" key={label}>
                <p className="history-group-label">{label}</p>
                {list.map(chat => (
                  <div
                    key={chat._id}
                    className={`history-item ${activeChat?._id === chat._id ? "active" : ""}`}
                    onClick={() => selectChat(chat)}
                  >
                    {editingChatId === chat._id ? (
                      <input
                        ref={editInputRef}
                        className="history-item-edit"
                        value={editingTitle}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") saveRename(chat);
                          if (e.key === "Escape") setEditingChatId(null);
                        }}
                        onBlur={() => saveRename(chat)}
                      />
                    ) : (
                      <>
                        <span className="history-item-text">{chatTitle(chat)}</span>
                        <span className="history-item-actions">
                          <button
                            className="icon-btn"
                            title="Rename"
                            onClick={(e) => startRename(e, chat)}
                          >✎</button>
                          <button
                            className="icon-btn icon-btn-danger"
                            title="Delete"
                            onClick={(e) => deleteChat(e, chat)}
                          >🗑</button>
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )
          ))}
        </div>

        <p>Hello, {userName}</p>
        <button onClick={logout} style={{ background: "red" }}>Logout</button>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {chats.length === 0 ? (
          <div className="welcome-screen">
            <div className="welcome-avatar">Leo <br></br></div>
            <h1>Hi{userName ? `, ${userName}` : ""} ! <br></br>I'm Leo — what can I help with ?</h1>
            <p className="welcome-subtitle">Ask me anything, or try one of these to get started</p>
            <div className="suggested-prompts">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="prompt-chip"
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {chats.map((m, i) => (
              <div key={i} className={`msg ${m.sender}`}>
                {editingIndex === i ? (
                  <div className="edit-box">
                    <textarea
                      className="edit-textarea"
                      value={editingText}
                      onChange={e => setEditingText(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button className="edit-cancel" onClick={cancelEditMessage}>Cancel</button>
                      <button className="edit-save" onClick={() => saveEditMessage(i)}>Save & Submit</button>
                    </div>
                  </div>
                ) : (
                  <div className="msg-wrapper">
                    <div className="bubble">
                      {m.sender === "bot" ? (
                        <ReactMarkdown>{m.text}</ReactMarkdown>
                      ) : (
                        m.text
                      )}
                    </div>
                    <div className="msg-actions">
                      <button
                        className="msg-action-btn"
                        title="Copy"
                        onClick={() => copyMessage(m.text, i)}
                      >
                        {copiedIndex === i ? "Copied" : "Copy"}
                      </button>
                      {m.sender === "user" && (
                        <button
                          className="msg-action-btn"
                          title="Edit"
                          onClick={() => startEditMessage(i, m.text)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef}></div>
          </div>
        )}

        <div className="input-area">
          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
          />
          <button onClick={() => sendMessage()}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ----- MAIN APP -----
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/chat" element={
          localStorage.getItem("token") ? <ChatPage /> : <Navigate to="/login" />
        } />
      </Routes>
    </BrowserRouter>
  );
}