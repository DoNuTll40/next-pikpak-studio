import "server-only";
import { catalogPool } from "./catalog";
import { desktopFileId } from "./desktop-cache";

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

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

function hasFreshPreview(preview, now) {
  if (!preview || typeof preview !== "object") return false;
  if (preview.kind === "image") return typeof preview.url === "string" && preview.url.length > 0;
  if (preview.kind === "video" && Array.isArray(preview.variants) && preview.variants.length > 0) {
    return preview.variants.some(variant => !variant?.expiresAt || variant.expiresAt > now);
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

    const now = Date.now();
    const catalog = [];
    const saved = [];
    const fresh = [];
    for (const row of rows) {
      catalog.push(row.id);
      if (row.hasInfo) saved.push(row.id);
      if (hasFreshPreview(row.preview, now)) fresh.push(row.id);
    }
    return { catalog, saved, fresh };
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
