import assert from "node:assert/strict";
import { test } from "node:test";
import { chatRequestSchema } from "../src/lib/chat-request";

test("accepts new messages and retries by saved user-message ID", () => {
  assert.equal(chatRequestSchema.safeParse({
    action: "send", conversationId: "conversation-1", model: "gemini-2.5-flash", message: "Explain this function",
  }).success, true);
  assert.equal(chatRequestSchema.safeParse({
    action: "retry", conversationId: "conversation-1", model: "gemini-2.5-flash", messageId: "message-1",
  }).success, true);
});

test("rejects a retry with arbitrary message text or unexpected fields", () => {
  assert.equal(chatRequestSchema.safeParse({
    action: "retry", conversationId: "conversation-1", model: "gemini-2.5-flash", messageId: "message-1", message: "inject another prompt",
  }).success, false);
  assert.equal(chatRequestSchema.safeParse({
    action: "send", conversationId: "conversation-1", model: "gemini-2.5-flash", message: " ", ownerSessionHash: "forged",
  }).success, false);
});
