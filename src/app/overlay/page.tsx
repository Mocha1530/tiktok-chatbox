"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  removing?: boolean;
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
  const messageTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const scheduleMessageRemoval = useCallback((messageId: string) => {
    if (messageTimersRef.current.has(messageId)) {
      clearTimeout(messageTimersRef.current.get(messageId));
    }

    const timer = setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, removing: true } : msg,
        ),
      );
      setTimeout(() => {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        messageTimersRef.current.delete(messageId);
      }, 300);
    }, 10000);
    messageTimersRef.current.set(messageId, timer);
  }, []);

  const addMessage = useCallback(
    (rawMessage: Omit<Message, "id" | "timestamp" | "removing">) => {
      const newMessage: Message = {
        ...rawMessage,
        id: Date.now().toString() + Math.random(),
        timestamp: new Date(),
        removing: false,
      };

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          newMessage.type === "like" &&
          last &&
          last.type === "like" &&
          last.uniqueId === newMessage.uniqueId
        ) {
          const updatedLast = {
            ...last,
            likeCount: String(
              Number(last.likeCount || 0) + Number(newMessage.likeCount || 0),
            ),
            timestamp: new Date(),
          };
          const newList = [...prev.slice(0, -1), updatedLast];
          scheduleMessageRemoval(updatedLast.id);
          return newList;
        }

        const newList = [...prev, newMessage];
        scheduleMessageRemoval(newMessage.id);
        return newList;
      });
    },
    [scheduleMessageRemoval],
  );

  const clearAllMessages = useCallback(() => {
    messageTimersRef.current.forEach((timer) => clearTimeout(timer));
    messageTimersRef.current.clear();
    setMessages([]);
  }, []);

  const reconnectToStream = useCallback(() => {
    if (!roomId) return;
    console.log("[TiktokChatbox] Reconnecting to stream");

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    clearAllMessages();

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
        addMessage(message);
      } catch (error) {
        console.log("[TiktokChatbox] Stream parse error:", error);
      }
    };

    eventSource.onerror = () => {
      console.warn("[TiktokChatbox] SSE connection error, will retry...");
    };
  }, [roomId, addMessage, clearAllMessages]);

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
      clearInterval(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setInterval(() => {
      reconnectToStream();
    }, 240000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearAllMessages();
    };
  }, [roomId, reconnectToStream, clearAllMessages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const renderMessage = (msg: Message) => {
    let className = "message";
    if (msg.removing) {
      className += " slide-out-right";
    } else {
      className += ` slide-in-right`;
    }
    className += ` ${msg.type}`;

    switch (msg.type) {
      case "chat":
        return (
          <div key={msg.id} className={className}>
            <span className="nickname">{msg.nickname}</span>
            <span className="comment">: {msg.comment}</span>
          </div>
        );
      case "follow":
        return (
          <div key={msg.id} className={className}>
            {msg.uniqueId} followed!
          </div>
        );
      case "gift":
        return (
          <div key={msg.id} className={className}>
            {msg.uniqueId} sent {msg.giftId}!
          </div>
        );
      case "member":
        return (
          <div key={msg.id} className={className}>
            {msg.uniqueId} joined the stream!
          </div>
        );
      case "like":
        return (
          <div key={msg.id} className={className}>
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
