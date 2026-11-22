import { readOAuthSession } from "@/lib/server/auth";
import { parseSyncBatch, saveSyncBatch } from "@/lib/server/desktop-sync";

const headers = { "Cache-Control": "private, no-store" };
const maxBytes = 512 * 1024;

function reply(status, body) {
  return Response.json(body, { status, headers });
}

export async function POST(request) {
  if (request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL ?? request.url).origin) {
    return reply(403, { error: "invalid_origin" });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return reply(415, { error: "json_required" });
  }

  try {
    const session = await readOAuthSession();
    const userId = session?.user.studioOwnerId;
    if (typeof userId !== "string" || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(userId)) {
      return reply(401, { error: "sign_in_required" });
    }

    if (!request.body) return reply(400, { error: "invalid_batch" });
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return reply(413, { error: "batch_too_large" });
      }
      text += decoder.decode(value, { stream: true });
    }

    let batch;
    try {
      batch = parseSyncBatch(JSON.parse(text + decoder.decode()));
    } catch {
      return reply(400, { error: "invalid_batch" });
    }
    if (!batch) return reply(400, { error: "invalid_batch" });

    return reply(200, { synced: await saveSyncBatch(userId, batch) });
  } catch (error) {
    const code = /^[0-9A-Z]{5}$/.test(error.code ?? "") ? error.code : "unavailable";
    console.error("Desktop sync failed", code);
    return reply(503, { error: "sync_unavailable" });
  }
}
