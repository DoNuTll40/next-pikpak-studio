import {
  desktopErrorCode,
  desktopReply,
  isTrustedDesktopOrigin,
  readDesktopJsonBody,
  requireDesktopSession,
} from "@/lib/server/desktop-auth";
import { parseHistoryBatch, saveHistoryBatch } from "@/lib/server/desktop-history";

export async function POST(request) {
  if (!isTrustedDesktopOrigin(request)) {
    return desktopReply(403, { error: "invalid_origin" });
  }

  try {
    const auth = await requireDesktopSession(request);
    if (!auth) {
      return desktopReply(401, { error: "sign_in_required" });
    }

    const parsed = await readDesktopJsonBody(request);
    if (parsed.error) return parsed.error;

    const entries = parseHistoryBatch(parsed.data);
    if (!entries) return desktopReply(400, { error: "invalid_history_payload" });

    return desktopReply(200, await saveHistoryBatch(auth.userId, entries));
  } catch (error) {
    console.error("Desktop history sync failed", desktopErrorCode(error));
    return desktopReply(503, { error: "history_unavailable" });
  }
}
