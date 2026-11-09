import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeConversationCursor, parseConversationCursor } from "../src/lib/conversation-pagination";

test("round-trips stable timestamp and ID cursors", () => {
  const cursor = { id: "cm1234567890123456789012345", updatedAt: new Date("2026-11-07T12:34:56.789Z") };
  assert.deepEqual(parseConversationCursor(encodeConversationCursor(cursor)), cursor);
});

test("rejects malformed, oversized, or incomplete cursors", () => {
  assert.equal(parseConversationCursor(null), null);
  assert.equal(parseConversationCursor("not-base64-json"), null);
  assert.equal(parseConversationCursor(Buffer.from(JSON.stringify({ id: "ok" })).toString("base64url")), null);
  assert.equal(parseConversationCursor("x".repeat(181)), null);
});
