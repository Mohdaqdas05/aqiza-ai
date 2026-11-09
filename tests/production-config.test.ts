import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { checkChatRateLimit } from "../src/lib/rate-limit";
import { resolveDatabaseUrl } from "../src/lib/database-config";

const originalFetch = globalThis.fetch;
const envKeys = ["NODE_ENV", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

beforeEach(() => {
  Reflect.set(process.env, "NODE_ENV", "test");
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) Reflect.deleteProperty(process.env, key);
    else Reflect.set(process.env, key, value);
  }
});

test("uses the local SQLite file only outside Vercel", () => {
  assert.equal(resolveDatabaseUrl(undefined, false), "file:./prisma/dev.db");
  assert.equal(resolveDatabaseUrl(" libsql://db.example ", false), "libsql://db.example");
});

test("requires a durable remote database on Vercel", () => {
  assert.equal(resolveDatabaseUrl("libsql://db.example", true), "libsql://db.example");
  assert.throws(() => resolveDatabaseUrl(undefined, true), /Vercel requires a durable DATABASE_URL/);
  assert.throws(() => resolveDatabaseUrl("file:./prisma/dev.db", true), /Vercel requires a durable DATABASE_URL/);
});

test("enforces the local 12-request window in development", async () => {
  Reflect.set(process.env, "NODE_ENV", "development");
  const identity = `local-test:${randomUUID()}`;

  for (let index = 0; index < 12; index += 1) {
    assert.deepEqual(await checkChatRateLimit(identity), { allowed: true });
  }

  const blocked = await checkChatRateLimit(identity);
  assert.equal(blocked.allowed, false);
  assert.ok("retryAfterSeconds" in blocked);
  assert.equal(blocked.retryAfterSeconds, 60);
});

test("fails closed in production without shared rate-limit credentials", async () => {
  Reflect.set(process.env, "NODE_ENV", "production");
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ result: 1 });
  };

  const decision = await checkChatRateLimit(`prod-test:${randomUUID()}`);
  assert.deepEqual(decision, { allowed: false, unavailable: true });
  assert.equal(calls, 0);
});

test("uses an atomic Upstash counter and returns its retry window", async () => {
  Reflect.set(process.env, "NODE_ENV", "production");
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "server-only-test-token";
  const identity = `remote-test:${randomUUID()}`;
  const expectedKey = `aqizaai:chat:${createHash("sha256").update(identity).digest("hex")}`;
  let count = 0;

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://redis.example.test");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer server-only-test-token");
    const command = JSON.parse(String(init?.body)) as unknown[];
    assert.equal(command[0], "EVAL");
    assert.match(String(command[1]), /INCR/);
    assert.match(String(command[1]), /EXPIRE/);
    assert.equal(command[2], "1");
    assert.equal(command[3], expectedKey);
    assert.equal(command[4], "60");
    assert.equal(command[5], "12");
    count += 1;
    return Response.json({ result: [count <= 12 ? 1 : 0, 37] });
  };

  for (let index = 0; index < 12; index += 1) {
    assert.deepEqual(await checkChatRateLimit(identity), { allowed: true });
  }
  assert.deepEqual(await checkChatRateLimit(identity), { allowed: false, retryAfterSeconds: 37 });
  assert.equal(count, 13);
});

test("fails closed for incomplete or invalid Upstash configuration", async () => {
  Reflect.set(process.env, "NODE_ENV", "production");
  process.env.UPSTASH_REDIS_REST_URL = "http://redis.example.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "server-only-test-token";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ result: 1 });
  };

  assert.deepEqual(await checkChatRateLimit(`invalid-url:${randomUUID()}`), { allowed: false, unavailable: true });
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.deepEqual(await checkChatRateLimit(`missing-token:${randomUUID()}`), { allowed: false, unavailable: true });
  assert.equal(calls, 0);
});

test("fails closed when Upstash is unavailable", async () => {
  Reflect.set(process.env, "NODE_ENV", "production");
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "server-only-test-token";
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });

  assert.deepEqual(await checkChatRateLimit(`service-error:${randomUUID()}`), { allowed: false, unavailable: true });
});
