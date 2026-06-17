"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Message = {
  id: string;
  type: "chat" | "follow" | "gift" | "member" | "like";
  nickname?: string;
  comment?: string;
  uniqueId?: string;
  giftId?: string;
  likeCount?: string;
  timestamp: Date;
  roomId: string;
};

export default function OverlayPage() {
  const searchParams = useSearchParams();
  const username = searchParams.get("username");

  const [messages, setMessages] = useState<Message[]>([]);
  const [roomId, setRoomId] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const reconnectToStream = () => {
    if (!roomId) return;

    console.log("[TiktokChatbox] Reconnecting to stream");

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const eventSource = new EventSource(
      `/api/stream?roomId=${encodeURIComponent(roomId)}`,
    );
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        const message: Message = {
          id: Date.now().toString() + Math.random(),
          ...raw,
          timestamp: new Date(raw.timestamp),
        };
        setMessages((prev) => {
          const updated = [...prev, message];
          return updated.slice(-30);
        });
      } catch (error) {
        console.log("[TiktokChatbox] Stream parse error:", error);
      }
    };

    eventSource.onerror = () => {
      console.warn("[TiktokChatbox] SSE connection error, will retry...");
    };
  };

  useEffect(() => {
    if (!username) return;

    const connect = async () => {
      try {
        console.log("[TiktokChatbox] connecting...");
        const res = await fetch("/api/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (data.success) {
          setRoomId(data.roomId);
          setIsConnected(true);
        } else {
          console.error("[TiktokChatbox] connection failed:", data.error);
        }
      } catch (error) {
        console.error("[TiktokChatbox] Connect error:", error);
      }
    };

    connect();
  }, [username]);

  useEffect(() => {
    if (!roomId) return;

    reconnectToStream();

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setTimeout(() => {
      reconnectToStream();
      reconnectTimerRef.current = setTimeout(() => {
        reconnectToStream();
      }, 240000);
    }, 240000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages((prev) => prev.slice(1));
    }, 10000);
    return () => clearTimeout(timer);
  }, [messages]);

  const renderMessage = (msg: Message) => {
    switch (msg.type) {
      case "chat":
        return (
          <div key={msg.id} className="message chat">
            <span className="nickname">{msg.nickname}</span>
            <span className="comment">: {msg.comment}</span>
          </div>
        );
      case "follow":
        return (
          <div key={msg.id} className="message follow">
            {msg.uniqueId} followed!
          </div>
        );
      case "gift":
        return (
          <div key={msg.id} className="message gift">
            {msg.uniqueId} sent {msg.giftId}!
          </div>
        );
      case "member":
        return (
          <div key={msg.id} className="message member">
            {msg.uniqueId} joined the stream!
          </div>
        );
      case "like":
        return (
          <div key={msg.id} className="message like">
            {msg.uniqueId} liked! ({msg.likeCount})
          </div>
        );
      default:
        return null;
    }
  };

  if (!username) {
    return (
      <div
        style={{
          color: "white",
          padding: "20px",
          background: "rgba(0,0,0,0.7)",
        }}
      >
        Please provide a username via ?username=...
      </div>
    );
  }

  return (
    <div className="overlay-container">
      <div className="messages-wrapper">
        {messages.map((msg) => renderMessage(msg))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
