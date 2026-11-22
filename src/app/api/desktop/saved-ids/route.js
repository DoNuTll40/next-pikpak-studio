import {
  desktopErrorCode,
  desktopReply,
  isTrustedDesktopOrigin,
  readDesktopJsonBody,
  requireDesktopSession,
} from "@/lib/server/desktop-auth";
import { lookupSavedIds, parseSavedIdsRequest } from "@/lib/server/desktop-saved-ids";

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

    const ids = parseSavedIdsRequest(parsed.data);
    if (!ids) return desktopReply(400, { error: "invalid_ids_payload" });

    return desktopReply(200, await lookupSavedIds(auth.userId, ids));
  } catch (error) {
    console.error("Desktop saved-ids lookup failed", desktopErrorCode(error));
    return desktopReply(503, { error: "lookup_unavailable" });
  }
}
