import { db } from "@/lib/db";
import { conversationExportFilename, conversationMarkdown } from "@/lib/conversation-export";
import { getConversationOwner, jsonError, withOwnerCookie } from "@/lib/session";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (id.length > 32) return jsonError("Conversation not found.", 404);

  const owner = await getConversationOwner(request);
  if (!owner) return jsonError("Sign in to export conversations.", 401);

  const conversation = await db.conversation.findFirst({
    where: { id, ...owner.where },
    select: {
      title: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true, model: true, createdAt: true },
      },
    },
  });
  if (!conversation) return withOwnerCookie(jsonError("Conversation not found.", 404), owner);

  const filename = conversationExportFilename(conversation.title);
  const response = new Response(conversationMarkdown(conversation.title, conversation.createdAt, conversation.messages), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
  return withOwnerCookie(response, owner);
}
