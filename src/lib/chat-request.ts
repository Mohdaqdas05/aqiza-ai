import { z } from "zod";

const requestContext = {
  conversationId: z.string().min(1).max(32),
  model: z.string().min(1).max(140),
  systemPrompt: z.string().max(4_000).optional(),
};

export const chatRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send"),
    ...requestContext,
    message: z.string().trim().min(1).max(16_000),
  }).strict(),
  z.object({
    action: z.literal("retry"),
    ...requestContext,
    messageId: z.string().min(1).max(32),
  }).strict(),
]);

export type ChatRequest = z.infer<typeof chatRequestSchema>;
