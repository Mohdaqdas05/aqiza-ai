import { z } from "zod";
import { db } from "@/lib/db";
import { DEFAULT_MODEL, getModelOption, isOllamaModel } from "@/lib/models";
import { encodeConversationCursor, parseConversationCursor } from "@/lib/conversation-pagination";
import { getConversationOwner, jsonError, readJsonBody, RequestBodyError, verifySameOrigin, withOwnerCookie } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
const CONVERSATION_PAGE_SIZE = 100;

const createConversationSchema = z.object({
  title: z.string().max(120).optional(),
  model: z.string().max(140).optional(),
  systemPrompt: z.string().max(4_000).optional(),
}).strict();

function safeTitle(value: string | undefined): string {
  const cleaned = (value ?? "New chat")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "New chat";
}

function validModel(modelId: string): boolean {
  return Boolean(getModelOption(modelId)) || isOllamaModel(modelId);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim();
  const cursorValue = url.searchParams.get("cursor");
  const cursor = parseConversationCursor(cursorValue);
  if (search.length > 120) return jsonError("Search text is too long.", 400);
  if (cursorValue && !cursor) return jsonError("Conversation page cursor is invalid.", 400);

  const owner = await getConversationOwner(request);
  if (!owner) return jsonError("Sign in to access conversations.", 401);
  const where: Prisma.ConversationWhereInput = {
    ...owner.where,
    ...(search ? { title: { contains: search } } : {}),
    ...(cursor ? {
      OR: [
        { updatedAt: { lt: cursor.updatedAt } },
        { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
      ],
    } : {}),
  };
  const [records, totalCount] = await Promise.all([
    db.conversation.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: CONVERSATION_PAGE_SIZE + 1,
      select: {
        id: true,
        title: true,
        model: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
    db.conversation.count({
      where: { ...owner.where, ...(search ? { title: { contains: search } } : {}) },
    }),
  ]);
  const hasMore = records.length > CONVERSATION_PAGE_SIZE;
  const conversations = records.slice(0, CONVERSATION_PAGE_SIZE);
  const lastConversation = conversations.at(-1);

  return withOwnerCookie(Response.json({
    conversations: conversations.map(({ _count, ...conversation }) => ({
      ...conversation,
      messageCount: _count.messages,
    })),
    totalCount,
    nextCursor: hasMore && lastConversation
      ? encodeConversationCursor({ id: lastConversation.id, updatedAt: lastConversation.updatedAt })
      : null,
  }), owner);
}

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) return jsonError("Request origin could not be verified.", 403);
  const owner = await getConversationOwner(request);
  if (!owner) return jsonError("Sign in to create conversations.", 401);

  let input: unknown;
  try {
    input = await readJsonBody(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return jsonError(message, error instanceof RequestBodyError ? error.status : 400);
  }

  const parsed = createConversationSchema.safeParse(input);
  if (!parsed.success) return jsonError("Conversation details are invalid.", 400);
  const model = parsed.data.model ?? DEFAULT_MODEL;
  if (!validModel(model)) return jsonError("Choose a supported model.", 400);

  const conversation = await db.conversation.create({
    data: {
      title: safeTitle(parsed.data.title),
      model,
      systemPrompt: parsed.data.systemPrompt?.trim() ?? "",
      ...owner.create,
    },
    select: { id: true, title: true, model: true, systemPrompt: true, createdAt: true, updatedAt: true },
  });

  return withOwnerCookie(Response.json({ conversation }, { status: 201 }), owner);
}

export async function DELETE(request: NextRequest) {
  if (!verifySameOrigin(request)) return jsonError("Request origin could not be verified.", 403);
  const owner = await getConversationOwner(request);
  if (!owner) return jsonError("Sign in to clear conversation history.", 401);

  const result = await db.conversation.deleteMany({ where: owner.where });
  return withOwnerCookie(Response.json({ deleted: result.count }), owner);
}
