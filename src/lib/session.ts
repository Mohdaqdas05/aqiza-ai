import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { hashGuestSessionToken, readGuestSessionToken } from "@/lib/guest-session";

const COOKIE_NAME = "aqizaai_guest";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 30;

export type GuestSession = {
  hash: string;
  setCookie?: string;
};

export type ConversationOwner = {
  where: { userId: string } | { ownerSessionHash: string };
  create: { userId: string | null; ownerSessionHash: string | null };
  rateKey: string;
  guestSession?: GuestSession;
};

export class RequestBodyError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export function getGuestSession(request: NextRequest): GuestSession {
  const existing = readGuestSessionToken(request.headers.get("cookie"));
  const token = existing ?? randomBytes(32).toString("hex");
  const hash = hashGuestSessionToken(token);

  if (existing) return { hash };

  const attributes = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    `Max-Age=${SESSION_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");

  return { hash, setCookie: attributes.join("; ") };
}

export function getExistingGuestSessionHash(request: NextRequest): string | null {
  const token = readGuestSessionToken(request.headers.get("cookie"));
  return token ? hashGuestSessionToken(token) : null;
}

export async function getConversationOwner(request: NextRequest): Promise<ConversationOwner | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (userId) {
    return {
      where: { userId },
      create: { userId, ownerSessionHash: null },
      rateKey: `user:${userId}`,
    };
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_GUEST_CHAT !== "true") return null;
  const guestSession = getGuestSession(request);
  return {
    where: { ownerSessionHash: guestSession.hash },
    create: { userId: null, ownerSessionHash: guestSession.hash },
    rateKey: `guest:${guestSession.hash}`,
    guestSession,
  };
}

export function withSessionCookie(response: Response, session: GuestSession): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  if (session.setCookie) headers.append("Set-Cookie", session.setCookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function withOwnerCookie(response: Response, owner: ConversationOwner): Response {
  if (owner.guestSession) return withSessionCookie(response, owner.guestSession);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function verifySameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
      ?? new URL(request.url).protocol.replace(":", "");
    return Boolean(host) && originUrl.host.toLowerCase() === host?.toLowerCase()
      && originUrl.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 64_000) {
    throw new RequestBodyError("Request body is too large.", 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError("Request body is required.", 400);
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > 64_000) {
      await reader.cancel();
      throw new RequestBodyError("Request body is too large.", 413);
    }
    chunks.push(value);
  }

  try {
    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    throw new RequestBodyError("Request body must be valid JSON.", 400);
  }
}
