import type { NextRequest } from "next/server";
import { messageStore } from "@/lib/message-store";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId");

  if (!roomId) {
    return new Response("Room ID is required", { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      console.log(
        `[TikTokChatbox] Starting TikTok message stream for room: ${roomId}`,
      );

      const recentMessages = messageStore.getRecentMessages(roomId, 10);
      recentMessages.forEach((message) => {
        const data = `data:${JSON.stringify(message)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });

      const removeListener = messageStore.addListener(roomId, (message) => {
        const data = `data:${JSON.stringify(message)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });

      request.signal.addEventListener("abort", () => {
        removeListener();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
