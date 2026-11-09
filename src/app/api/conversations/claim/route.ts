import { db } from "@/lib/db";
import { getConversationOwner, getExistingGuestSessionHash, jsonError, verifySameOrigin, withOwnerCookie } from "@/lib/session";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) return jsonError("Request origin could not be verified.", 403);

  const owner = await getConversationOwner(request);
  if (!owner || !("userId" in owner.where)) {
    return jsonError("Sign in to move this browser's conversations into your account.", 401);
  }

  const guestSessionHash = getExistingGuestSessionHash(request);
  if (!guestSessionHash) {
    return withOwnerCookie(Response.json({ transferred: 0 }), owner);
  }

  const result = await db.conversation.updateMany({
    where: { ownerSessionHash: guestSessionHash, userId: null },
    data: { ownerSessionHash: null, userId: owner.where.userId },
  });

  return withOwnerCookie(Response.json({ transferred: result.count }), owner);
}
