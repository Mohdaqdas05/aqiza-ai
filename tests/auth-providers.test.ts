import assert from "node:assert/strict";
import { test } from "node:test";
import { getConfiguredAuthProviders } from "../src/lib/auth-providers";

test("enables Google OAuth only when both credentials are present", () => {
  assert.deepEqual(getConfiguredAuthProviders({
    AUTH_GOOGLE_ID: "google-client-id",
    AUTH_GOOGLE_SECRET: "google-client-secret",
  }), ["google"]);

  assert.deepEqual(getConfiguredAuthProviders({ AUTH_GOOGLE_ID: "google-client-id" }), []);
  assert.deepEqual(getConfiguredAuthProviders({ AUTH_GOOGLE_ID: " ", AUTH_GOOGLE_SECRET: " " }), []);
});

test("keeps Google and GitHub providers available together", () => {
  assert.deepEqual(getConfiguredAuthProviders({
    AUTH_GOOGLE_ID: "google-client-id",
    AUTH_GOOGLE_SECRET: "google-client-secret",
    AUTH_GITHUB_ID: "github-client-id",
    AUTH_GITHUB_SECRET: "github-client-secret",
  }), ["google", "github"]);
});
