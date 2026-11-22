import "server-only";
import { catalogPool } from "./catalog";
import { desktopFileId } from "./desktop-cache";

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const EXPIRY_BUFFER_MS = 10 * 60 * 1000;

export function parseSavedIdsRequest(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.ids)) return null;
  if (!payload.ids.length || payload.ids.length > 500) return null;

  const unique = new Set();
  for (const id of payload.ids) {
    if (typeof id !== "string" || !desktopFileId.test(id)) return null;
    unique.add(id);
  }
  return [...unique];
}

function urlExpireMs(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl) return 0;
  try {
    const raw = Number(new URL(rawUrl).searchParams.get("expire"));
    if (Number.isSafeInteger(raw) && raw > 1_000_000_000) return raw * 1000;
  } catch {
    return 0;
  }
  return 0;
}

function hasFreshPreview(preview, minValidMs) {
  if (!preview || typeof preview !== "object") return false;
  if (preview.kind === "image") {
    if (typeof preview.url !== "string" || !preview.url.length) return false;
    const exp = urlExpireMs(preview.url);
    return exp === 0 || exp > minValidMs;
  }
  if (preview.kind === "video" && Array.isArray(preview.variants) && preview.variants.length > 0) {
    return preview.variants.some(variant => {
      if (!variant?.url) return false;
      const exp = Number(variant.expiresAt) || urlExpireMs(variant.url);
      return exp === 0 || exp > minValidMs;
    });
  }
  return false;
}

export async function lookupSavedIds(userId, ids) {
  const client = await catalogPool().connect();
  let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SELECT set_config('studio.user_id', $1, true)", [userId]);

    const { rows } = await client.query(`
      SELECT file_id AS id,
        (file_info IS NOT NULL) AS "hasInfo",
        (file_info -> 'preview') AS preview
      FROM studio.catalog_items
      WHERE user_id = $1 AND file_id = ANY($2::text[])
    `, [userId, ids]);

    await client.query("COMMIT");

    const minValidMs = Date.now() + EXPIRY_BUFFER_MS;
    const catalog = [];
    const saved = [];
    const fresh = [];
    const expired = [];
    for (const row of rows) {
      catalog.push(row.id);
      if (row.hasInfo) {
        saved.push(row.id);
        if (hasFreshPreview(row.preview, minValidMs)) {
          fresh.push(row.id);
        } else {
          expired.push(row.id);
        }
      }
    }
    return { catalog, saved, fresh, expired };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
