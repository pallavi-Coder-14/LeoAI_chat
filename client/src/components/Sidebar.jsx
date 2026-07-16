export default function Sidebar({ chats, setSelectedChat }) {
  return (
    <div style={{ width: 200, borderRight: "1px solid gray" }}>
      <h3>Chats</h3>
      {chats.map((chat, i) => (
        <div key={i} onClick={() => setSelectedChat(chat)} style={{ cursor: "pointer", padding: 5 }}>
          {chat.title || `Chat ${i + 1}`}
        </div>
      ))}
    </div>
  );
}
