import { createHash } from "node:crypto";

const GUEST_COOKIE_NAME = "aqizaai_guest";

export function readGuestSessionToken(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GUEST_COOKIE_NAME}=`))
    ?.slice(GUEST_COOKIE_NAME.length + 1);

  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

export function hashGuestSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
