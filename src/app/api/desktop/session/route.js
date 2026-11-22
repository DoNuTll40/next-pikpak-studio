import {
  desktopErrorCode,
  desktopReply,
  isTrustedDesktopOrigin,
  requireDesktopSession,
} from "@/lib/server/desktop-auth";

export async function GET(request) {
  if (!isTrustedDesktopOrigin(request, { allowMissing: true })) {
    return desktopReply(403, { authenticated: false, error: "invalid_origin" });
  }

  try {
    const auth = await requireDesktopSession(request);
    if (!auth) {
      return desktopReply(401, { authenticated: false, error: "sign_in_required" });
    }

    return desktopReply(200, {
      authenticated: true,
      accountId: auth.userId,
      user: auth.user,
    });
  } catch (error) {
    console.error("Desktop session check failed", desktopErrorCode(error));
    return desktopReply(503, { authenticated: false, error: "session_unavailable" });
  }
}
