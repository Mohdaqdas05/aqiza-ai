import { auth } from "@/auth";
import { db } from "@/lib/db";
import { readJsonBody, RequestBodyError, verifySameOrigin } from "@/lib/session";
import { userPreferencesPatchSchema } from "@/lib/user-preferences";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store" };

function privateError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: privateHeaders });
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return privateError("Sign in to access account settings.", 401);

  const preferences = await db.user.findUnique({
    where: { id: userId },
    select: { defaultModel: true, themePreference: true, defaultSystemPrompt: true },
  });
  if (!preferences) return privateError("Account not found.", 404);

  return Response.json({
    defaultModel: preferences.defaultModel,
    theme: preferences.themePreference,
    defaultSystemPrompt: preferences.defaultSystemPrompt,
  }, { headers: privateHeaders });
}

export async function PATCH(request: NextRequest) {
  if (!verifySameOrigin(request)) return privateError("Request origin could not be verified.", 403);

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return privateError("Sign in to update account settings.", 401);

  let input: unknown;
  try {
    input = await readJsonBody(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return privateError(message, error instanceof RequestBodyError ? error.status : 400);
  }

  const parsed = userPreferencesPatchSchema.safeParse(input);
  if (!parsed.success) return privateError("Account settings are invalid.", 400);

  const { defaultModel, theme, defaultSystemPrompt } = parsed.data;
  const result = await db.user.updateMany({
    where: { id: userId },
    data: {
      ...(defaultModel !== undefined ? { defaultModel } : {}),
      ...(theme !== undefined ? { themePreference: theme } : {}),
      ...(defaultSystemPrompt !== undefined ? { defaultSystemPrompt: defaultSystemPrompt.trim() } : {}),
    },
  });
  if (result.count === 0) return privateError("Account not found.", 404);

  return Response.json({ saved: true }, { headers: privateHeaders });
}
