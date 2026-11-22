import {
  desktopErrorCode,
  desktopReply,
  extractBearerToken,
} from "@/lib/server/desktop-auth";
import { revokeDesktopBearerToken } from "@/lib/server/desktop-tokens";

export async function POST(request) {
  const token = extractBearerToken(request);
  if (!token) {
    return desktopReply(401, { error: "sign_in_required" });
  }

  try {
    await revokeDesktopBearerToken(token);
    return desktopReply(200, { revoked: true });
  } catch (error) {
    console.error("Desktop logout failed", desktopErrorCode(error));
    return desktopReply(503, { error: "logout_unavailable" });
  }
}
