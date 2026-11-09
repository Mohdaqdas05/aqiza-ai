import { spawn } from "node:child_process";
import type { NextRequest } from "next/server";
import { getModelReadiness } from "@/lib/model-readiness";
import { findOllamaExecutable, usesLocalOllamaServer } from "@/lib/ollama";
import { jsonError, verifySameOrigin } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

let startAttempt: Promise<void> | null = null;

function startOllama(executable: string): Promise<void> {
  if (startAttempt) return startAttempt;
  startAttempt = new Promise<void>((resolve, reject) => {
    const child = spawn(executable, ["serve"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      setTimeout(resolve, 500);
    });
  }).finally(() => { startAttempt = null; });
  return startAttempt;
}

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) return jsonError("Request origin could not be verified.", 403);

  const current = await getModelReadiness();
  if (current.ollama.connected) return Response.json(current, { headers: { "Cache-Control": "no-store" } });
  if (!usesLocalOllamaServer()) {
    return jsonError("Ollama can be auto-started only when AqizaAI and Ollama run on the same computer.", 503);
  }

  const executable = await findOllamaExecutable();
  if (!executable) {
    return jsonError("Ollama is not installed or could not be found. Install Ollama, then try again.", 404);
  }

  try {
    await startOllama(executable);
  } catch {
    // Ollama may already be starting; the follow-up discovery decides whether it is ready.
  }

  const updated = await getModelReadiness();
  if (!updated.ollama.connected) {
    return jsonError("Ollama is installed, but its local service is not responding yet. Open Ollama and try again.", 503);
  }
  return Response.json(updated, { headers: { "Cache-Control": "no-store" } });
}
