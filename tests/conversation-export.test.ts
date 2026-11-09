import assert from "node:assert/strict";
import { test } from "node:test";
import { conversationExportFilename, conversationMarkdown } from "../src/lib/conversation-export";

test("exports a readable Markdown transcript with roles and model labels", () => {
  const markdown = conversationMarkdown("Fix a bug", new Date("2026-11-07T10:00:00.000Z"), [
    { role: "user", content: "Why does this fail?", model: null, createdAt: new Date("2026-11-07T10:01:00.000Z") },
    { role: "assistant", content: "Check the boundary condition.", model: "gemini-2.5-pro", createdAt: new Date("2026-11-07T10:02:00.000Z") },
  ]);

  assert.match(markdown, /^# Fix a bug/m);
  assert.match(markdown, /## You\n\nWhy does this fail\?/);
  assert.match(markdown, /## AqizaAI · gemini-2\.5-pro\n\nCheck the boundary condition\./);
  assert.match(markdown, /Exported from AqizaAI · 2026-11-07T10:00:00\.000Z/);
});

test("creates a safe filename even when a title contains only punctuation", () => {
  assert.equal(conversationExportFilename("Fix auth / OAuth"), "fix-auth-oauth.md");
  assert.equal(conversationExportFilename("???"), "aqizaai-conversation.md");
});
