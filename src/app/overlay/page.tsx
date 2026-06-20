"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type MessageType = "chat" | "follow" | "gift" | "member" | "like";

type Message = {
  id: string;
  type: MessageType;
  nickname?: string;
  comment?: string;
  uniqueId?: string;
  giftId?: string;
  giftName?: string;
  giftCount?: string;
  likeCount?: string;
  timestamp: Date;
  roomId: string;
  removing?: boolean;
};

const DEFAULT_COLORS: Record<MessageType, string> = {
  chat: "#b5ead7",
  follow: "#ffdac1",
  gift: "#ffb3c6",
  member: "#c7ceea",
  like: "#e2f0cb",
};

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace("#", "");
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function parseFilters(
  searchParams: URLSearchParams,
): Record<MessageType, boolean> {
  const defaults: Record<MessageType, boolean> = {
    chat: true,
    follow: true,
    gift: true,
    member: true,
    like: true,
  };

  const typesParam = searchParams.get("types");
  if (!typesParam) return defaults;

  const activeTypes = typesParam.split(",") as MessageType[];
  const result: Record<MessageType, boolean> = {
    chat: false,
    follow: false,
    gift: false,
    member: false,
    like: false,
  };

  activeTypes.forEach((t) => {
    if (t in result) result[t] = true;
  });

  return result;
}

function parseColors(
  searchParams: URLSearchParams,
): Record<MessageType, string> {
  const defaults: Record<MessageType, string> = {
    chat: "#b5ead7",
    follow: "#ffdac1",
    gift: "#ffb3c6",
    member: "#c7ceea",
    like: "#e2f0cb",
  };

  const result = { ...defaults };

  (Object.keys(defaults) as MessageType[]).forEach((type) => {
    const param = searchParams.get(`${type}Color`);
    if (param) {
      result[type] = "#" + param;
    }
  });

  return result;
}

export default function OverlayPage() {
  const searchParams = useSearchParams();
  const username = searchParams.get("username");

  const config = useRef({
    filters: parseFilters(searchParams),
    bubbleColors: parseColors(searchParams),
    textColor: searchParams.get("textColor")
      ? "#" + searchParams.get("textColor")
      : "#5a4a5c",
    maxMessages: Math.min(
      Math.max(Number(searchParams.get("maxMessages")) || 10, 3),
      10,
    ),
    duration: Math.min(
      Math.max(Number(searchParams.get("duration")) || 10, 5),
      30,
    ),
    showUsername: searchParams.get("showUsername") !== "0",
  });

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
    }, config.current.duration * 1000);
    messageTimersRef.current.set(messageId, timer);
  }, []);

  const addMessage = useCallback(
    (rawMessage: Omit<Message, "id" | "timestamp" | "removing">) => {
      if (!config.current.filters[rawMessage.type]) return;

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

        let newList = [...prev, newMessage];
        if (newList.length > config.current.maxMessages) {
          const toRemove = newList.slice(
            0,
            newList.length - config.current.maxMessages,
          );
          toRemove.forEach((msg) => {
            if (messageTimersRef.current.has(msg.id)) {
              clearTimeout(messageTimersRef.current.get(msg.id));
              messageTimersRef.current.delete(msg.id);
            }
          });
          newList = newList.slice(-config.current.maxMessages);
        }

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

  const connect = useCallback(async () => {
    if (!username) return null;
    try {
      console.log("[TiktokChatbox] connecting...");
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.success) {
        return data.roomId;
      } else {
        console.error("[TiktokChatbox] connection failed:", data.error);
        return null;
      }
    } catch (error) {
      console.error("[TiktokChatbox] Connect error:", error);
      return null;
    }
  }, [username]);

  const stream = useCallback(
    (newRoomId: string) => {
      if (!newRoomId) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      clearAllMessages();

      const eventSource = new EventSource(
        `/api/stream?roomId=${encodeURIComponent(newRoomId)}`,
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

      setRoomId(newRoomId);
      setIsConnected(true);
    },
    [addMessage, clearAllMessages],
  );

  // const reconnectToStream = useCallback(() => {
  //   if (!roomId) return;
  //   console.log("[TiktokChatbox] Reconnecting to stream");
  //
  //   if (eventSourceRef.current) {
  //     eventSourceRef.current.close();
  //     eventSourceRef.current = null;
  //   }
  //
  //   clearAllMessages();
  //
  //   const eventSource = new EventSource(
  //     `/api/stream?roomId=${encodeURIComponent(roomId)}`,
  //   );
  //   eventSourceRef.current = eventSource;
  //
  //   eventSource.onmessage = (event) => {
  //     try {
  //       const raw = JSON.parse(event.data);
  //       const message: Message = {
  //         id: Date.now().toString() + Math.random(),
  //         ...raw,
  //         timestamp: new Date(raw.timestamp),
  //       };
  //       addMessage(message);
  //     } catch (error) {
  //       console.log("[TiktokChatbox] Stream parse error:", error);
  //     }
  //   };
  //
  //   eventSource.onerror = () => {
  //     console.warn("[TiktokChatbox] SSE connection error, will retry...");
  //   };
  // }, [roomId, addMessage, clearAllMessages]);

  const connectToStream = useCallback(async () => {
    console.log("[TiktokChatbox] Reconnecting...");
    const newRoomId = await connect();
    if (newRoomId) {
      stream(newRoomId);
    } else {
      console.error("[TiktokChatbox] Reconnection failed");
    }
  }, [connect, stream]);

  useEffect(() => {
    if (!username) return;
    connectToStream();
  }, [username, connectToStream]);

  useEffect(() => {
    if (!roomId) return;

    if (reconnectTimerRef.current) {
      clearInterval(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setInterval(() => {
      connectToStream();
    }, 240000);

    return () => {
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [roomId, connectToStream]);

  useEffect(() => {
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
  }, [clearAllMessages]);

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

    const bubbleColor =
      config.current.bubbleColors[msg.type] || DEFAULT_COLORS[msg.type];
    const bgRgba = hexToRgba(bubbleColor, 0.8);
    //    const borderColor = bubbleColor;
    const textColor = config.current.textColor;
    const showName = config.current.showUsername;

    const bubbleStyle: React.CSSProperties = {
      background: bgRgba,
      //    borderLeftColor: borderColor,
      color: textColor,
    };
    // className += ` ${msg.type}`;

    switch (msg.type) {
      case "chat":
        return (
          <div key={msg.id} className={className} style={bubbleStyle}>
            {showName && (
              <span
                className="nickname"
                style={{ color: textColor, opacity: 0.85 }}
              >
                {msg.nickname}
              </span>
            )}
            <span className="comment" style={{ color: textColor }}>
              {showName ? ": " + msg.comment : msg.comment}
            </span>
          </div>
        );
      case "follow":
        return (
          <div key={msg.id} className={className} style={bubbleStyle}>
            {showName ? msg.uniqueId : "someone"} followed!
          </div>
        );
      case "gift":
        return (
          <div key={msg.id} className={className} style={bubbleStyle}>
            {showName ? msg.uniqueId : "someone"} sent a {msg.giftName}!
          </div>
        );
      case "member":
        return (
          <div key={msg.id} className={className} style={bubbleStyle}>
            {showName ? msg.uniqueId : "someone"} joined the stream!
          </div>
        );
      case "like":
        return (
          <div key={msg.id} className={className} style={bubbleStyle}>
            {showName ? msg.uniqueId : "someone"} liked! ({msg.likeCount})
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
