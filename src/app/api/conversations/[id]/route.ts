import { z } from "zod";
import { db } from "@/lib/db";
import { getConversationOwner, jsonError, readJsonBody, RequestBodyError, verifySameOrigin, withOwnerCookie } from "@/lib/session";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const updateConversationSchema = z.object({
  title: z.string().max(120).optional(),
  model: z.string().max(140).optional(),
  systemPrompt: z.string().max(4_000).optional(),
}).strict().refine((data) => Object.keys(data).length > 0);

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (id.length > 32) return jsonError("Conversation not found.", 404);
  const owner = await getConversationOwner(request);
  if (!owner) return jsonError("Sign in to access conversations.", 401);
  const conversation = await db.conversation.findFirst({
    where: { id, ...owner.where },
    select: {
      id: true,
      title: true,
      model: true,
      systemPrompt: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
        select: { id: true, role: true, content: true, model: true, createdAt: true },
      },
    },
  });

  if (!conversation) return withOwnerCookie(jsonError("Conversation not found.", 404), owner);
  return withOwnerCookie(Response.json({ conversation: {
    ...conversation,
    messages: [...conversation.messages].reverse(),
  } }), owner);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!verifySameOrigin(request)) return jsonError("Request origin could not be verified.", 403);
  const { id } = await context.params;
  if (id.length > 32) return jsonError("Conversation not found.", 404);
  const owner = await getConversationOwner(request);
  if (!owner) return jsonError("Sign in to update conversations.", 401);

  let input: unknown;
  try {
    input = await readJsonBody(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return jsonError(message, error instanceof RequestBodyError ? error.status : 400);
  }
  const parsed = updateConversationSchema.safeParse(input);
  if (!parsed.success) return jsonError("Conversation details are invalid.", 400);

  const title = parsed.data.title === undefined ? undefined : parsed.data.title
    .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "New chat";
  if (parsed.data.model !== undefined) {
    const supported = parsed.data.model === "ollama" || /^ollama:[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(parsed.data.model)
      || ["gemini-2.5-flash", "gemini-2.5-pro", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "openrouter/free"].includes(parsed.data.model);
    if (!supported) return jsonError("Choose a supported model.", 400);
  }

  const result = await db.conversation.updateMany({
    where: { id, ...owner.where },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(parsed.data.model !== undefined ? { model: parsed.data.model } : {}),
      ...(parsed.data.systemPrompt !== undefined ? { systemPrompt: parsed.data.systemPrompt.trim() } : {}),
    },
  });
  if (result.count === 0) return withOwnerCookie(jsonError("Conversation not found.", 404), owner);

  const conversation = await db.conversation.findFirst({
    where: { id, ...owner.where },
    select: { id: true, title: true, model: true, systemPrompt: true, createdAt: true, updatedAt: true },
  });
  return withOwnerCookie(Response.json({ conversation }), owner);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!verifySameOrigin(request)) return jsonError("Request origin could not be verified.", 403);
  const { id } = await context.params;
  if (id.length > 32) return jsonError("Conversation not found.", 404);
  const owner = await getConversationOwner(request);
  if (!owner) return jsonError("Sign in to delete conversations.", 401);
  const result = await db.conversation.deleteMany({ where: { id, ...owner.where } });
  if (result.count === 0) return withOwnerCookie(jsonError("Conversation not found.", 404), owner);
  return withOwnerCookie(Response.json({ deleted: true }), owner);
}
