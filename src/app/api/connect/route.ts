import { type NextRequest, NextResponse } from "next/server";
import { WebcastPushConnection } from "tiktok-live-connector";
import { messageStore } from "@/lib/message-store";
import { connectionManager } from "@/lib/connection-manager";

export async function POST(request: NextRequest) {
  console.log("[TikTokChatbox] API: POST request received");

  try {
    const body = await request.json();
    console.log("[TikTokChatbox] API: Request body parsed:", body);

    const { username } = body;

    if (!username) {
      console.log("[TikTokChatbox] API: No username provided");
      return NextResponse.json(
        {
          success: false,
          error: "Username is required",
        },
        { status: 400 },
      );
    }

    console.log(
      `[TikTokChatbox] API: Attempting to connect to TikTok user: ${username}`,
    );

    if (connectionManager.hasConnection(username)) {
      console.log(
        `[TikTokChatbox] API: Disconnecting existing connection for ${username}`,
      );
      const existingData = connectionManager.getConnection(username);
      try {
        existingData?.connection.disconnect();
      } catch (disconnectError) {
        console.log(
          "[TikTokChatbox] API: Error disconnecting existing connection:",
          disconnectError,
        );
      }
      connectionManager.deleteConnection(username);
    }

    console.log(
      "[TikTokChatbox] API: Creating WebcastPushConnection instance...",
    );
    let tiktokLiveConnection;

    try {
      tiktokLiveConnection = new WebcastPushConnection(username, {
        enableExtendedGiftInfo: true,
        requestPollingIntervalMs: 10000,
        sessionId: undefined,
      });
      console.log(
        "[TikTokChatbox] API: WebcastPushConnection instance created successfully",
      );
    } catch (constructorError: any) {
      console.error(
        "[TikTokChatbox] API: Error creating WebcastPushConnection:",
        constructorError,
      );
      throw new Error(
        `Failed to create connection: ${constructorError.message}`,
      );
    }

    let currentRoomId = "";

    tiktokLiveConnection.on("connected", (state) => {
      currentRoomId = state.roomId;
      console.log(`[TikTokChatbox] API: Connected to room ${state.roomId}`);
      connectionManager.setConnection(username, {
        connection: tiktokLiveConnection,
        roomId: currentRoomId,
        isLive: true,
        username,
      });
    });

    tiktokLiveConnection.on("chat", (data) => {
      //     console.log(`[TikTokChatbox] API: ${data.nickname}: ${data.comment}`);
      messageStore.addMessage(currentRoomId, {
        type: "chat",
        nickname: data.nickname,
        comment: data.comment,
        uniqueId: data.uniqueId,
      });
    });

    tiktokLiveConnection.on("follow", (data) => {
      //   console.log(
      //   `[TikTokChatbox] API: Thanks for the follow! ${data.uniqueId}`,
      //);
      messageStore.addMessage(currentRoomId, {
        type: "follow",
        uniqueId: data.uniqueId,
      });
    });

    tiktokLiveConnection.on("gift", (data) => {
      //      console.log(
      //      `[TikTokChatbox] API: ${data.uniqueId} (userId:${data.userId}) sent ${data.giftName}`,
      //  );
      messageStore.addMessage(currentRoomId, {
        type: "gift",
        uniqueId: data.uniqueId,
        userId: data.userId?.toString(),
        giftId: data.giftId?.toString(),
        giftName: data.giftName,
      });
    });

    tiktokLiveConnection.on("member", (data) => {
      if (data.action !== 1) return;
      //      console.log(`[TikTokChatbox] API: ${data.uniqueId} joined the stream!`);
      messageStore.addMessage(currentRoomId, {
        type: "member",
        uniqueId: data.uniqueId,
      });
    });

    tiktokLiveConnection.on("like", (data) => {
      //     console.log(
      //     `[TikTokChatbox] API: ${data.uniqueId} liked the stream! (${data.likeCount} likes)`,
      //  );
      messageStore.addMessage(currentRoomId, {
        type: "like",
        uniqueId: data.uniqueId,
        likeCount: data.likeCount?.toString(),
      });
    });

    tiktokLiveConnection.on("disconnected", () => {
      console.log(`[TikTokChatbox] API: Disconnected from TikTok live stream`);
      connectionManager.updateLiveStatus(username, false);
    });

    tiktokLiveConnection.on("error", (err) => {
      console.error(`[TikTokChatbox] API: Tikok connection error:`, err);
      connectionManager.updateLiveStatus(username, false);
    });

    console.log(`[TikTokChatbox] API: Initiating connection...`);

    const state = await tiktokLiveConnection.connect();

    console.log(`[TikTokChatbox] API: Connected to roomId: ${state.roomId}`);

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${username}`,
      roomId: state.roomId,
      username,
      status: "connected",
    });
  } catch (error: any) {
    console.log("[TikTokChatbox] API: Failed to connect", error);
    console.log("[TikTokChatbox] API: Error stack:", error.stack);
    console.log("[TikTokChatbox] API: Error name:", error.name);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        success: false,
        error: `Failed to connect to TikTok live stream: ${errorMessage}`,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (connectionManager.hasConnection(username)) {
      const connectionData = connectionManager.getConnection(username);
      connectionData?.connection.disconnect();
      connectionManager.deleteConnection(username);

      return NextResponse.json({
        success: true,
        message: `Disconnected from ${username}`,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "No active connection found",
      },
      { status: 404 },
    );
  } catch (error) {
    console.error("[TikTokChatbox] Disconnect error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to disconnect",
      },
      { status: 500 },
    );
  }
}
