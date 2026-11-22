import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";

let pool;

function authPool() {
  const connectionString = process.env.AUTH_DATABASE_URL?.trim() || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing Studio auth database connection");
  if (!pool) {
    pool = new Pool({
      connectionString,
      enableChannelBinding: true,
      max: 4,
      connectionTimeoutMillis: 8000,
    });
    pool.on("error", () => console.error("Idle Desktop auth database connection closed"));
  }
  return pool;
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function pkceChallenge(verifier) {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

const CODE_TTL_MS = 2 * 60 * 1000;
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const challengePattern = /^[A-Za-z0-9_-]{43,128}$/;
const verifierPattern = /^[A-Za-z0-9._~-]{43,128}$/;
const rawCodePattern = /^[a-f0-9]{64}$/;
const bearerTokenPattern = /^pps_[A-Za-z0-9_-]{43,128}$/;

export function isValidChallenge(value) {
  return typeof value === "string" && challengePattern.test(value);
}

export async function createDesktopAuthCode({ authUserId, studioOwnerId, challenge }) {
  if (!isValidChallenge(challenge)) return null;
  const code = randomBytes(32).toString("hex");
  const id = `dc_${randomBytes(16).toString("hex")}`;
  const identifier = `desktop-code:${sha256Hex(code)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  const value = JSON.stringify({ authUserId, studioOwnerId, challenge });

  await authPool().query(
    `INSERT INTO public.studio_auth_verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [id, identifier, value, expiresAt.toISOString(), now.toISOString()]
  );
  return code;
}

export async function exchangeDesktopAuthCode({ code, codeVerifier, deviceName }) {
  if (
    typeof code !== "string" || !rawCodePattern.test(code) ||
    typeof codeVerifier !== "string" || !verifierPattern.test(codeVerifier)
  ) {
    return null;
  }

  const identifier = `desktop-code:${sha256Hex(code)}`;
  const client = await authPool().connect();
  try {
    await client.query("BEGIN");
    const { rows: [row] } = await client.query(
      `DELETE FROM public.studio_auth_verification
       WHERE identifier = $1 AND "expiresAt" > now()
       RETURNING value`,
      [identifier]
    );
    if (!row) {
      await client.query("ROLLBACK");
      return null;
    }

    let payload;
    try {
      payload = JSON.parse(row.value);
    } catch {
      await client.query("ROLLBACK");
      return null;
    }

    if (!payload?.challenge || !safeEqual(pkceChallenge(codeVerifier), payload.challenge)) {
      await client.query("ROLLBACK");
      return null;
    }

    const { rows: [user] } = await client.query(
      `SELECT id, name, email, image, "studioOwnerId" AS "studioOwnerId"
       FROM public.studio_auth_user
       WHERE id = $1`,
      [payload.authUserId]
    );
    if (!user || user.studioOwnerId !== payload.studioOwnerId) {
      await client.query("ROLLBACK");
      return null;
    }

    const rawToken = `pps_${randomBytes(32).toString("base64url")}`;
    const tokenId = `dt_${randomBytes(16).toString("hex")}`;
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const cleanDevice = typeof deviceName === "string" && deviceName.trim()
      ? deviceName.trim().slice(0, 120)
      : "PikPak Studio Desktop";

    await client.query(
      `INSERT INTO public.studio_desktop_token
         (id, token_hash, auth_user_id, studio_owner_id, device_name, last_used_at, expires_at)
       VALUES ($1, $2, $3, $4::uuid, $5, now(), $6)`,
      [tokenId, tokenHash, user.id, user.studioOwnerId, cleanDevice, expiresAt.toISOString()]
    );
    await client.query("COMMIT");

    const email = typeof user.email === "string" && !user.email.endsWith(".invalid")
      ? user.email
      : null;
    return {
      token: rawToken,
      accountId: user.studioOwnerId,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        name: user.name ?? "",
        email,
        image: user.image ?? null,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyDesktopBearerToken(rawToken) {
  if (typeof rawToken !== "string" || !bearerTokenPattern.test(rawToken)) {
    return null;
  }
  const tokenHash = sha256Hex(rawToken);
  const { rows: [row] } = await authPool().query(
    `SELECT t.id AS "tokenId", t.studio_owner_id::text AS "accountId",
            u.id AS "authUserId", u.name, u.email, u.image
     FROM public.studio_desktop_token t
     JOIN public.studio_auth_user u ON u.id = t.auth_user_id
     WHERE t.token_hash = $1
       AND t.revoked_at IS NULL
       AND t.expires_at > now()`,
    [tokenHash]
  );
  if (!row) return null;

  // Update last_used_at opportunistically (non-blocking)
  authPool()
    .query("UPDATE public.studio_desktop_token SET last_used_at = now() WHERE id = $1", [row.tokenId])
    .catch(() => {});

  const email = typeof row.email === "string" && !row.email.endsWith(".invalid")
    ? row.email
    : null;
  return {
    tokenId: row.tokenId,
    userId: row.accountId,
    user: {
      id: row.authUserId,
      name: row.name ?? "",
      email,
      image: row.image ?? null,
    },
  };
}

export async function revokeDesktopBearerToken(rawToken) {
  if (typeof rawToken !== "string" || !bearerTokenPattern.test(rawToken)) {
    return false;
  }
  const tokenHash = sha256Hex(rawToken);
  const result = await authPool().query(
    `UPDATE public.studio_desktop_token
     SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
  return result.rowCount > 0;
}
