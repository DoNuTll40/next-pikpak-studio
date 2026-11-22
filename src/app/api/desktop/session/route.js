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
    const auth = await requireDesktopSession();
    if (!auth) {
      return desktopReply(401, { authenticated: false, error: "sign_in_required" });
    }

    const { userId, session } = auth;
    const rawEmail = session.user.email;
    const email = typeof rawEmail === "string" && !rawEmail.endsWith(".invalid") ? rawEmail : null;

    return desktopReply(200, {
      authenticated: true,
      accountId: userId,
      user: {
        id: session.user.id,
        name: session.user.name ?? "",
        email,
        image: session.user.image ?? null,
      },
    });
  } catch (error) {
    console.error("Desktop session check failed", desktopErrorCode(error));
    return desktopReply(503, { authenticated: false, error: "session_unavailable" });
  }
}
