import {
  desktopErrorCode,
  desktopReply,
  readDesktopJsonBody,
} from "@/lib/server/desktop-auth";
import { exchangeDesktopAuthCode } from "@/lib/server/desktop-tokens";

export async function POST(request) {
  if (request.headers.get("origin")) {
    return desktopReply(403, { error: "invalid_origin" });
  }

  try {
    const parsed = await readDesktopJsonBody(request, 8 * 1024);
    if (parsed.error) return parsed.error;

    const { code, code_verifier: codeVerifier, device_name: deviceName } = parsed.data ?? {};
    const issued = await exchangeDesktopAuthCode({ code, codeVerifier, deviceName });
    if (!issued) {
      return desktopReply(401, { error: "invalid_or_expired_code" });
    }

    return desktopReply(200, issued);
  } catch (error) {
    console.error("Desktop token exchange failed", desktopErrorCode(error));
    return desktopReply(503, { error: "token_unavailable" });
  }
}
