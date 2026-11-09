import { streamText } from "ai";
import { resolveModel, ProviderConfigurationError } from "@/lib/ai-providers";
import { chatRequestSchema } from "@/lib/chat-request";
import { db } from "@/lib/db";
import { getConversationOwner, jsonError, readJsonBody, RequestBodyError, verifySameOrigin, withOwnerCookie } from "@/lib/session";
import { checkChatRateLimit } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function event(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function shortTitle(message: string): string {
  const plain = message.replace(/\s+/g, " ").trim();
  return plain.length > 64 ? `${plain.slice(0, 61).trimEnd()}…` : plain;
}

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) return jsonError("Request origin could not be verified.", 403);
  const owner = await getConversationOwner(request);
  if (!owner) return jsonError("Sign in to send messages.", 401);
  const rateLimit = await checkChatRateLimit(owner.rateKey);
  if ("unavailable" in rateLimit) {
    return withOwnerCookie(jsonError("Chat is temporarily unavailable because rate limiting is not configured.", 503), owner);
  }
  if (!rateLimit.allowed) {
    const response = jsonError("Too many requests. Wait a minute and try again.", 429);
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return withOwnerCookie(response, owner);
  }

  let input: unknown;
  try {
    input = await readJsonBody(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return withOwnerCookie(jsonError(message, error instanceof RequestBodyError ? error.status : 400), owner);
  }
  const parsed = chatRequestSchema.safeParse(input);
  if (!parsed.success) return withOwnerCookie(jsonError("Message details are invalid.", 400), owner);
  const conversationId = parsed.data.conversationId;

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, ...owner.where },
    select: { id: true, title: true, model: true, systemPrompt: true },
  });
  if (!conversation) return withOwnerCookie(jsonError("Conversation not found.", 404), owner);

  let model;
  try {
    model = resolveModel(parsed.data.model);
  } catch (error) {
    if (error instanceof ProviderConfigurationError) {
      return withOwnerCookie(jsonError(error.message, 503), owner);
    }
    return withOwnerCookie(jsonError("Choose a supported model.", 400), owner);
  }

  let userMessageId: string;
  let messageContent: string;
  if (parsed.data.action === "retry") {
    const userMessage = await db.message.findFirst({
      where: { id: parsed.data.messageId, conversationId: conversation.id, role: "user" },
      select: { id: true, content: true },
    });
    const latestMessage = await db.message.findFirst({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, role: true },
    });
    if (!userMessage || latestMessage?.id !== userMessage.id) {
      return withOwnerCookie(jsonError("Only the latest unanswered message can be retried.", 409), owner);
    }
    userMessageId = userMessage.id;
    messageContent = userMessage.content;
    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        model: parsed.data.model,
        ...(parsed.data.systemPrompt !== undefined ? { systemPrompt: parsed.data.systemPrompt.trim() } : {}),
      },
    });
  } else {
    messageContent = parsed.data.message;
    const [, userMessage] = await db.$transaction([
      db.conversation.update({
        where: { id: conversation.id },
        data: {
          model: parsed.data.model,
          ...(parsed.data.systemPrompt !== undefined ? { systemPrompt: parsed.data.systemPrompt.trim() } : {}),
          ...(conversation.title === "New chat" ? { title: shortTitle(messageContent) } : {}),
        },
      }),
      db.message.create({
        data: { conversationId: conversation.id, role: "user", content: messageContent, model: parsed.data.model },
        select: { id: true },
      }),
    ]);
    userMessageId = userMessage.id;
  }

  const history = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 32,
    select: { role: true, content: true },
  });
  const messages = history.reverse()
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));
  const systemPrompt = parsed.data.systemPrompt ?? conversation.systemPrompt;
  const result = streamText({
    model,
    system: systemPrompt.trim()
      ? `You are AqizaAI, a thoughtful developer assistant. Follow the user's custom instructions where they do not conflict with safety or accuracy.\n\nCustom instructions:\n${systemPrompt.trim()}`
      : "You are AqizaAI, a thoughtful assistant for software developers. Be accurate, clear, and concise. When sharing code, use fenced blocks with the correct language label.",
    messages,
    maxOutputTokens: 4_096,
    abortSignal: request.signal,
  });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let output = "";
      try {
        for await (const delta of result.textStream) {
          output += delta;
          controller.enqueue(event({ type: "delta", text: delta }));
        }
        if (!output.trim()) {
          if (!request.signal.aborted) {
            controller.enqueue(event({ type: "error", message: "The model returned an empty response. Check its chat support, then try again." }));
          }
          return;
        }
        const assistant = await db.message.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: output,
            model: parsed.data.model,
          },
          select: { id: true },
        });
        await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
        controller.enqueue(event({ type: "done", messageId: assistant.id }));
      } catch {
        if (!request.signal.aborted) {
          controller.enqueue(event({
            type: "error",
            message: "The response stopped before it could be saved. Check the provider key and model availability, then try again.",
          }));
        }
      } finally {
        controller.close();
      }
    },
  });

  const response = new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Aqiza-User-Message-Id": userMessageId,
    },
  });
  return withOwnerCookie(response, owner);
}
