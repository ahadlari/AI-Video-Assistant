"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatPanel({ sessionId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, question }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to get response");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="chat-section">
      <div className="chat-section-title">
        {"\uD83D\uDCAC"} Chat with your Meeting
      </div>

      {/* Chat Messages */}
      {messages.length > 0 ? (
        <div className="chat-container">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`chat-msg ${
                msg.role === "user" ? "chat-msg-user" : "chat-msg-bot"
              }`}
            >
              <span
                className={`chat-label ${
                  msg.role === "user" ? "chat-label-user" : "chat-label-bot"
                }`}
              >
                {msg.role === "user" ? "You" : "\uD83E\uDD16 Assistant"}
              </span>
              <div
                className={`chat-bubble ${
                  msg.role === "user"
                    ? "chat-bubble-user"
                    : "chat-bubble-bot"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-msg chat-msg-bot">
              <span className="chat-label chat-label-bot">
                {"\uD83E\uDD16"} Assistant
              </span>
              <div className="chat-bubble chat-bubble-bot">
                <span className="spinner" style={{ display: "inline-block" }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="chat-empty">
            <div className="chat-empty-icon">{"\uD83D\uDCAC"}</div>
            <div>Ask anything about your meeting transcript</div>
          </div>
        </div>
      )}

      {/* Input Row */}
      <div className="chat-input-row">
        <input
          className="chat-input"
          type="text"
          placeholder="What were the main decisions made?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="btn-send"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          Send {"\u2192"}
        </button>
      </div>

      {/* Clear Chat */}
      {messages.length > 0 && (
        <div style={{ marginTop: "0.75rem" }}>
          <button className="btn-secondary" onClick={clearChat}>
            {"\uD83D\uDDD1\uFE0F"} Clear Chat
          </button>
        </div>
      )}
    </div>
  );
}
