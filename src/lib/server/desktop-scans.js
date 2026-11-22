import "server-only";
import { catalogPool } from "./catalog";
import { desktopFileId } from "./desktop-cache";

const sharePathPattern = /^\/s\/[\w-]+(?:\/[\w-]+)*$/;
const validStatuses = new Set(["pending", "partial", "complete"]);

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

function validSharePath(value) {
  return typeof value === "string" && value.length <= 2048 && sharePathPattern.test(value);
}

function normalizeCheckpoint(raw) {
  if (!isRecord(raw) || !validSharePath(raw.path)) return null;
  const status = raw.status;
  if (status === undefined) return { queryOnly: true, path: raw.path };

  const parentPath = raw.parentPath ?? raw.parent_path ?? null;
  const folderId = raw.folderId ?? raw.folder_id ?? null;
  const name = raw.name;

  if (
    !validStatuses.has(status) ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 1024 ||
    name.includes("\0") ||
    (parentPath !== null && (!validSharePath(parentPath) || !raw.path.startsWith(parentPath + "/"))) ||
    (folderId !== null && (typeof folderId !== "string" || !desktopFileId.test(folderId)))
  ) {
    return null;
  }

  return {
    queryOnly: false,
    path: raw.path,
    parent_path: parentPath,
    folder_id: folderId,
    name: name.trim(),
    status,
  };
}

export function parseScanRequest(payload) {
  if (!isRecord(payload)) return null;

  if (Array.isArray(payload.checkpoints)) {
    if (!payload.checkpoints.length || payload.checkpoints.length > 100) return null;
    const checkpoints = new Map();
    for (const raw of payload.checkpoints) {
      const entry = normalizeCheckpoint(raw);
      if (!entry || entry.queryOnly) return null;
      checkpoints.set(entry.path, entry);
    }
    const queryPath = payload.queryPath ?? payload.query_path ?? null;
    if (queryPath !== null && !validSharePath(queryPath)) return null;
    return {
      writes: [...checkpoints.values()].sort((a, b) => a.path.localeCompare(b.path)),
      queryPath,
    };
  }

  const single = normalizeCheckpoint(payload);
  if (!single) return null;
  return {
    writes: single.queryOnly ? [] : [single],
    queryPath: single.path,
  };
}

export async function saveScanCheckpoints(userId, { writes, queryPath }) {
  const client = await catalogPool().connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SELECT set_config('studio.user_id', $1, true)", [userId]);

    let synced = 0;
    if (writes.length > 0) {
      const result = await client.query(`
        WITH incoming AS (
          SELECT * FROM jsonb_to_recordset($2::jsonb) AS entry(
            path text, parent_path text, folder_id text, name text, status text
          )
        )
        INSERT INTO studio.scan_folders AS target
          (user_id, path, parent_path, folder_id, name, status)
        SELECT $1, path, parent_path, folder_id, name, status
        FROM incoming ORDER BY path
        ON CONFLICT (user_id, path) DO UPDATE SET
          name = CASE
            WHEN excluded.parent_path IS NULL AND target.parent_path IS NOT NULL
            THEN target.name
            ELSE excluded.name
          END,
          folder_id = CASE
            WHEN excluded.parent_path IS NULL
            THEN coalesce(target.folder_id, excluded.folder_id)
            ELSE coalesce(excluded.folder_id, target.folder_id)
          END,
          parent_path = coalesce(excluded.parent_path, target.parent_path),
          status = excluded.status,
          updated_at = now()
        WHERE excluded.status <> 'pending' OR target.status <> 'complete'
      `, [userId, JSON.stringify(writes)]);
      synced = result.rowCount;
    }

    let children = [];
    if (queryPath) {
      const { rows } = await client.query(`
        SELECT path, parent_path AS "parentPath", folder_id AS "folderId", name, status,
          (extract(epoch FROM updated_at) * 1000)::double precision AS "updatedAt"
        FROM studio.scan_folders
        WHERE user_id = $1 AND parent_path = $2
        ORDER BY name, path
      `, [userId, queryPath]);
      children = rows;
    }

    await client.query("COMMIT");
    return { synced, children };
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
