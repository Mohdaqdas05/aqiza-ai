import assert from "node:assert/strict";
import { test } from "node:test";
import { hashGuestSessionToken, readGuestSessionToken } from "../src/lib/guest-session";

test("reads only a well-formed guest token from the matching cookie", () => {
  const token = "a".repeat(64);
  assert.equal(readGuestSessionToken(`other=value; aqizaai_guest=${token}; theme=dark`), token);
  assert.equal(readGuestSessionToken("aqizaai_guest=short"), undefined);
  assert.equal(readGuestSessionToken(`aqizaai_guest=${"g".repeat(64)}`), undefined);
  assert.equal(readGuestSessionToken("aqizaai_guest_evil=not-a-token"), undefined);
  assert.equal(readGuestSessionToken(null), undefined);
});

test("stores a one-way digest rather than the browser session token", () => {
  const token = "b".repeat(64);
  const digest = hashGuestSessionToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, token);
  assert.equal(hashGuestSessionToken(token), digest);
});
