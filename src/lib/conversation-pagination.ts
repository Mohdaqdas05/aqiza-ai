import { z } from "zod";

const cursorSchema = z.object({
  id: z.string().min(1).max(32),
  updatedAt: z.string().datetime(),
}).strict();

export type ConversationCursor = { id: string; updatedAt: Date };

export function encodeConversationCursor(cursor: ConversationCursor): string {
  return Buffer.from(JSON.stringify({ id: cursor.id, updatedAt: cursor.updatedAt.toISOString() })).toString("base64url");
}

export function parseConversationCursor(value: string | null): ConversationCursor | null {
  if (!value || value.length > 180) return null;

  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const parsed = cursorSchema.safeParse(decoded);
    return parsed.success ? { id: parsed.data.id, updatedAt: new Date(parsed.data.updatedAt) } : null;
  } catch {
    return null;
  }
}
