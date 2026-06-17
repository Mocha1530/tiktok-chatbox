interface TikTokMessage {
  id: string;
  type: "chat" | "follow" | "gift" | "member" | "like";
  nickname?: string;
  comment?: string;
  uniqueId?: string;
  userId?: string;
  giftId?: string;
  likeCount?: string;
  timestamp: Date;
  roomId: string;
}

class MessageStore {
  private messagesByRoom: Map<string, TikTokMessage[]> = new Map();
  private listenersByRoom: Map<string, Set<(message: TikTokMessage) => void>> =
    new Map();

  addMessage(
    roomId: string,
    message: Omit<TikTokMessage, "id" | "timestamp" | "roomId">,
  ) {
    const fullMessage: TikTokMessage = {
      ...message,
      id: Date.now().toString() + Math.random(),
      timestamp: new Date(),
      roomId,
    };

    if (!this.messagesByRoom.has(roomId)) {
      this.messagesByRoom.set(roomId, []);
    }

    const roomMessages = this.messagesByRoom.get(roomId)!;
    roomMessages.push(fullMessage);

    if (roomMessages.length > 1000) {
      this.messagesByRoom.set(roomId, roomMessages.slice(-1000));
    }

    const roomListeners = this.listenersByRoom.get(roomId);
    if (roomListeners) {
      roomListeners.forEach((listener) => listener(fullMessage));
    }
  }

  addListener(roomId: string, listener: (message: TikTokMessage) => void) {
    if (!this.listenersByRoom.has(roomId)) {
      this.listenersByRoom.set(roomId, new Set());
    }

    const roomListeners = this.listenersByRoom.get(roomId)!;
    roomListeners.add(listener);

    return () => {
      roomListeners.delete(listener);
      if (roomListeners.size === 0) {
        this.listenersByRoom.delete(roomId);
      }
    };
  }

  getRecentMessages(roomId: string, count = 50): TikTokMessage[] {
    const roomMessages = this.messagesByRoom.get(roomId) || [];
    return roomMessages.slice(-count);
  }

  clearRoom(roomId: string) {
    this.messagesByRoom.delete(roomId);
    this.listenersByRoom.delete(roomId);
  }

  getActiveRooms(): string[] {
    return Array.from(this.messagesByRoom.keys());
  }
}

export const messageStore = new MessageStore();
export type { TikTokMessage };
