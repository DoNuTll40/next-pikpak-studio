import "server-only";
import { readOAuthSession } from "./auth";
import { verifyDesktopBearerToken } from "./desktop-tokens";

export const desktopHeaders = { "Cache-Control": "private, no-store" };
export const maxDesktopBodyBytes = 512 * 1024;
const uuidPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

export function desktopReply(status, body) {
  return Response.json(body, { status, headers: desktopHeaders });
}

export function extractBearerToken(request) {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export function isTrustedDesktopOrigin(request, { allowMissing = false } = {}) {
  const expected = new URL(process.env.BETTER_AUTH_URL ?? request.url).origin;
  const origin = request.headers.get("origin");
  if (!origin) {
    if (allowMissing || extractBearerToken(request)) {
      const fetchSite = request.headers.get("sec-fetch-site");
      return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
    }
    return false;
  }
  return origin === expected;
}

export async function requireDesktopSession(request) {
  const bearer = request ? extractBearerToken(request) : null;
  if (bearer) {
    const verified = await verifyDesktopBearerToken(bearer);
    if (!verified || !uuidPattern.test(verified.userId)) return null;
    return {
      userId: verified.userId,
      user: verified.user,
      authMethod: "bearer",
      tokenId: verified.tokenId,
    };
  }

  const session = await readOAuthSession();
  const userId = session?.user?.studioOwnerId;
  if (typeof userId !== "string" || !uuidPattern.test(userId)) return null;
  const rawEmail = session.user.email;
  const email = typeof rawEmail === "string" && !rawEmail.endsWith(".invalid") ? rawEmail : null;
  return {
    userId,
    user: {
      id: session.user.id,
      name: session.user.name ?? "",
      email,
      image: session.user.image ?? null,
    },
    authMethod: "cookie",
    tokenId: null,
  };
}

export async function readDesktopJsonBody(request, maxBytes = maxDesktopBodyBytes) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { error: desktopReply(415, { error: "json_required" }) };
  }
  if (!request.body) {
    return { error: desktopReply(400, { error: "invalid_payload" }) };
  }

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
      return { error: desktopReply(413, { error: "batch_too_large" }) };
    }
    text += decoder.decode(value, { stream: true });
  }

  try {
    return { data: JSON.parse(text + decoder.decode()) };
  } catch {
    return { error: desktopReply(400, { error: "invalid_payload" }) };
  }
}

export function desktopErrorCode(error) {
  return typeof error?.code === "string" && /^[0-9A-Z]{5}$/.test(error.code)
    ? error.code
    : "unavailable";
}
