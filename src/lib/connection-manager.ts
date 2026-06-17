import type {
  WebcastPushConnection,
  TikTokLiveConnection,
} from "tiktok-live-connector";
import { messageStore } from "./message-store";

export interface ConnectionData {
  connection: WebcastPushConnection;
  roomId: string;
  isLive: boolean;
  username: string;
}

class ConnectionManager {
  private connections = new Map<string, ConnectionData>();

  getConnection(username: string): ConnectionData | undefined {
    return this.connections.get(username);
  }

  hasConnection(username: string): boolean {
    return this.connections.has(username);
  }

  setConnection(username: string, data: ConnectionData): void {
    this.connections.set(username, data);
  }

  deleteConnection(username: string): void {
    const data = this.connections.get(username);
    if (data?.roomId) {
      messageStore.clearRoom(data.roomId);
    }
    this.connections.delete(username);
  }

  getAllConnections(): Map<string, ConnectionData> {
    return this.connections;
  }

  updateLiveStatus(username: string, isLive: boolean): void {
    const data = this.connections.get(username);
    if (data) {
      data.isLive = isLive;
      this.connections.set(username, data);
    }
  }
}

export const connectionManager = new ConnectionManager();
