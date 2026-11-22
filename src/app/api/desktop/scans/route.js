import {
  desktopErrorCode,
  desktopReply,
  isTrustedDesktopOrigin,
  readDesktopJsonBody,
  requireDesktopSession,
} from "@/lib/server/desktop-auth";
import { parseScanRequest, saveScanCheckpoints } from "@/lib/server/desktop-scans";

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

    const scanRequest = parseScanRequest(parsed.data);
    if (!scanRequest) return desktopReply(400, { error: "invalid_scan_payload" });

    return desktopReply(200, await saveScanCheckpoints(auth.userId, scanRequest));
  } catch (error) {
    console.error("Desktop scan sync failed", desktopErrorCode(error));
    return desktopReply(503, { error: "scans_unavailable" });
  }
}
