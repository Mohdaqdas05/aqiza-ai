import { getModelReadiness } from "@/lib/model-readiness";
import { configuredAuthProviders } from "@/auth";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ...await getModelReadiness(),
    authProviders: configuredAuthProviders,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
