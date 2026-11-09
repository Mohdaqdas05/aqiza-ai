import assert from "node:assert/strict";
import { test } from "node:test";
import { userPreferencesPatchSchema } from "../src/lib/user-preferences";

test("accepts valid account preference updates", () => {
  assert.equal(userPreferencesPatchSchema.safeParse({ theme: "light" }).success, true);
  assert.equal(userPreferencesPatchSchema.safeParse({ defaultModel: "gemini-2.5-pro" }).success, true);
  assert.equal(userPreferencesPatchSchema.safeParse({ defaultModel: "ollama:qwen3.6:latest" }).success, true);
  assert.equal(userPreferencesPatchSchema.safeParse({ defaultSystemPrompt: "Use TypeScript" }).success, true);
});

test("rejects unsupported models, empty updates, and oversized instructions", () => {
  assert.equal(userPreferencesPatchSchema.safeParse({ defaultModel: "arbitrary/model" }).success, false);
  assert.equal(userPreferencesPatchSchema.safeParse({}).success, false);
  assert.equal(userPreferencesPatchSchema.safeParse({ theme: "system" }).success, false);
  assert.equal(userPreferencesPatchSchema.safeParse({ defaultSystemPrompt: "x".repeat(4_001) }).success, false);
  assert.equal(userPreferencesPatchSchema.safeParse({ theme: "dark", isAdmin: true }).success, false);
});
