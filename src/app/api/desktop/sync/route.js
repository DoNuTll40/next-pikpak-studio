import {
  desktopErrorCode,
  desktopReply,
  isTrustedDesktopOrigin,
  readDesktopJsonBody,
  requireDesktopSession,
} from "@/lib/server/desktop-auth";
import { parseSyncBatch, saveSyncBatch } from "@/lib/server/desktop-sync";

export async function POST(request) {
  if (!isTrustedDesktopOrigin(request)) {
    return desktopReply(403, { error: "invalid_origin" });
  }

  try {
    const auth = await requireDesktopSession();
    if (!auth) {
      return desktopReply(401, { error: "sign_in_required" });
    }

    const parsed = await readDesktopJsonBody(request);
    if (parsed.error) return parsed.error;

    const batch = parseSyncBatch(parsed.data);
    if (!batch) return desktopReply(400, { error: "invalid_batch" });

    return desktopReply(200, { synced: await saveSyncBatch(auth.userId, batch) });
  } catch (error) {
    console.error("Desktop sync failed", desktopErrorCode(error));
    return desktopReply(503, { error: "sync_unavailable" });
  }
}
