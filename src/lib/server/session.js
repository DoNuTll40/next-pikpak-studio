import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { loginMethodCookie, readOAuthSession } from "./auth";

const cookieName = "studio_session";
const lifetime = 60 * 60 * 24 * 7;

function equal(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signature(expires, key, ownerId) {
  return createHmac("sha256", key).update(`studio-session.v1:${ownerId}:${expires}`).digest("base64url");
}

export async function requireStudioUser() {
  const session = await readOAuthSession();
  if (session) {
    const userId = session.user.studioOwnerId;
    if (typeof userId !== "string" || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(userId)) {
      throw new Error("Studio account is missing its catalog ID");
    }
    return userId;
  }
  const ownerId = await readAccessKeyUser();
  if (ownerId) return ownerId;
  redirect("/login");
}

export async function readAccessKeyUser() {
  await connection();
  const key = process.env.STUDIO_ACCESS_KEY;
  const ownerId = process.env.STUDIO_OWNER_ID;
  const token = (await cookies()).get(cookieName)?.value;
  const match = /^(\d{10})\.([\w-]{43})$/.exec(token ?? "");

  if (key && ownerId && match && Number(match[1]) > Math.floor(Date.now() / 1000) &&
      equal(match[2], signature(match[1], key, ownerId))) return ownerId;
  return null;
}

export async function openStudioSession(accessKey) {
  const key = process.env.STUDIO_ACCESS_KEY;
  const ownerId = process.env.STUDIO_OWNER_ID;
  if (!key || key.length < 32 || !ownerId || typeof accessKey !== "string" || !equal(accessKey, key)) return false;

  const expires = Math.floor(Date.now() / 1000) + lifetime;
  (await cookies()).set(cookieName, `${expires}.${signature(expires, key, ownerId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: lifetime,
  });
  return true;
}

export async function closeStudioSession() {
  const store = await cookies();
  store.delete(cookieName);
  store.delete(loginMethodCookie);
}
