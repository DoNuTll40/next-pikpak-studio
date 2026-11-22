import "server-only";
import { catalogPool } from "./catalog";
import { desktopFileId } from "./desktop-cache";

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

function parseTimestamp(value) {
  if (value === undefined || value === null || value === "") {
    return new Date().toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 1_000_000_000) {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function normalizeEntry(raw) {
  if (!isRecord(raw)) return null;
  const fileId = raw.file_id ?? raw.fileId ?? raw.id;
  if (typeof fileId !== "string" || !desktopFileId.test(fileId)) return null;
  const viewedAt = parseTimestamp(raw.viewed_at ?? raw.viewedAt);
  if (!viewedAt) return null;
  return { file_id: fileId, viewed_at: viewedAt };
}

export function parseHistoryBatch(payload) {
  if (!isRecord(payload)) return null;
  const rawList = Array.isArray(payload.items) ? payload.items : [payload];
  if (!rawList.length || rawList.length > 100) return null;

  const entries = new Map();
  for (const raw of rawList) {
    const entry = normalizeEntry(raw);
    if (!entry) return null;
    const prev = entries.get(entry.file_id);
    if (!prev || entry.viewed_at > prev.viewed_at) {
      entries.set(entry.file_id, entry);
    }
  }
  return [...entries.values()].sort((a, b) => a.file_id.localeCompare(b.file_id));
}

export async function saveHistoryBatch(userId, entries) {
  const client = await catalogPool().connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SELECT set_config('studio.user_id', $1, true)", [userId]);

    const result = await client.query(`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset($2::jsonb) AS entry(
          file_id text, viewed_at timestamptz
        )
      )
      INSERT INTO studio.watch_history AS target (user_id, file_id, viewed_at)
      SELECT $1, incoming.file_id, incoming.viewed_at
      FROM incoming
      JOIN studio.catalog_items item
        ON item.user_id = $1 AND item.file_id = incoming.file_id AND item.kind = 'file'
      ORDER BY incoming.file_id
      ON CONFLICT (user_id, file_id) DO UPDATE SET
        viewed_at = GREATEST(target.viewed_at, excluded.viewed_at)
    `, [userId, JSON.stringify(entries)]);

    await client.query("COMMIT");
    return {
      synced: result.rowCount,
      skipped: entries.length - result.rowCount,
    };
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
