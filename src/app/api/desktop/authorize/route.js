import { readOAuthSession } from "@/lib/server/auth";
import {
  desktopErrorCode,
  desktopReply,
  isTrustedDesktopOrigin,
  readDesktopJsonBody,
} from "@/lib/server/desktop-auth";
import { createDesktopAuthCode, isValidChallenge } from "@/lib/server/desktop-tokens";

const statePattern = /^[A-Za-z0-9_-]{16,128}$/;
const uuidPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

export async function POST(request) {
  if (!isTrustedDesktopOrigin(request)) {
    return desktopReply(403, { error: "invalid_origin" });
  }

  try {
    const session = await readOAuthSession();
    const studioOwnerId = session?.user?.studioOwnerId;
    if (!session?.user?.id || typeof studioOwnerId !== "string" || !uuidPattern.test(studioOwnerId)) {
      return desktopReply(401, { error: "sign_in_required" });
    }

    const parsed = await readDesktopJsonBody(request, 8 * 1024);
    if (parsed.error) return parsed.error;

    const { port, state, challenge } = parsed.data ?? {};
    const portNum = Number(port);
    if (
      !Number.isInteger(portNum) || portNum < 1024 || portNum > 65535 ||
      typeof state !== "string" || !statePattern.test(state) ||
      !isValidChallenge(challenge)
    ) {
      return desktopReply(400, { error: "invalid_auth_request" });
    }

    const code = await createDesktopAuthCode({
      authUserId: session.user.id,
      studioOwnerId,
      challenge,
    });
    if (!code) return desktopReply(400, { error: "invalid_auth_request" });

    const redirectUrl = `http://127.0.0.1:${portNum}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    return desktopReply(200, { redirectUrl });
  } catch (error) {
    console.error("Desktop authorize failed", desktopErrorCode(error));
    return desktopReply(503, { error: "authorize_unavailable" });
  }
}
