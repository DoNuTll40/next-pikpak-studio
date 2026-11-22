import "server-only";
import { catalogPool } from "./catalog";
import { desktopFileId } from "./desktop-cache";
import { mediaPreview } from "./media";
import { thumbnailUrl } from "./thumbnails";

const validId = value => typeof value === "string" && desktopFileId.test(value);
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);

function normalize(raw, field) {
  if (!record(raw) || !validId(raw.id) ||
      typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 2048 || raw.name.includes("\0")) return null;
  const kind = { "drive#folder": "folder", "drive#file": "file", folder: "folder", file: "file" }[raw.kind];
  if (kind !== "folder" && kind !== "file") return null;
  const parent = raw.parent_id === "" || raw.parent_id === null ? null : raw.parent_id;
  if (parent !== undefined && parent !== null && (!validId(parent) || parent === raw.id)) return null;
  const mime = typeof raw.mime_type === "string" && raw.mime_type.length <= 255 && !raw.mime_type.includes("\0") ? raw.mime_type : null;
  const size = typeof raw.size === "string" || Number.isSafeInteger(raw.size) ? String(raw.size) : "";
  const modified = typeof raw.modified_time === "string" ? Date.parse(raw.modified_time) : NaN;
  const data = {
    file_id: raw.id,
    parent_file_id: parent ?? null,
    has_parent: parent !== undefined,
    name: raw.name,
    kind,
    mime_type: mime,
    size_bytes: /^\d{1,19}$/.test(size) && BigInt(size) <= 9223372036854775807n ? size : null,
    source_modified_at: Number.isFinite(modified) ? new Date(modified).toISOString() : null,
    thumbnail_url: thumbnailUrl(raw.thumbnail_link ?? raw.thumbnail_url ?? raw.params?.small_thumbnail),
    share_root: kind === "folder" && raw.share_root === true,
  };
  const metadata = {
    id: data.file_id, name: data.name, kind: raw.kind, parent_id: parent,
    mime_type: mime, size: data.size_bytes, modified_time: data.source_modified_at,
  };
  const previewKind = mime?.startsWith("image/") ||
    /\.(?:jpe?g|png|gif|webp|avif|bmp|ico|svg|jxl|heic|heif|tiff?)$/i.test(raw.name)
    ? "image" : mime?.startsWith("video/") || /\.(?:mp4|m4v|webm|mov|mkv|ts|m2ts|mts|avi|mpe?g|ogv|3gp)$/i.test(raw.name)
      ? "video" : null;
  data[field] = field === "file_info" ? {
    ...metadata,
    preview: kind === "file" && previewKind ? mediaPreview(previewKind, raw) : null,
  } : metadata;
  return data;
}

export function parseSyncBatch(payload) {
  if (!record(payload)) return null;
  const files = payload.catalog ?? payload.detail?.files ?? payload.detail?.data?.files ?? [];
  const info = payload.file_info ?? [];
  const details = Array.isArray(info) ? info : [info];
  if (!Array.isArray(files) || files.length + details.length > 100 || !files.length && !details.length) return null;

  const items = new Map();
  for (const [rows, field] of [[files, "detail"], [details, "file_info"]]) {
    for (const raw of rows) {
      const item = normalize(raw, field);
      if (!item) return null;
      const previous = items.get(item.file_id);
      if (previous?.has_parent && !item.has_parent) {
        item.has_parent = true;
        item.parent_file_id = previous.parent_file_id;
      }
      for (const key of ["mime_type", "size_bytes", "source_modified_at", "thumbnail_url"]) {
        item[key] ??= previous?.[key] ?? null;
      }
      item.share_root ||= previous?.share_root === true;
      items.set(item.file_id, { ...previous, ...item });
    }
  }
  return [...items.values()].sort((left, right) => left.file_id.localeCompare(right.file_id));
}

export async function saveSyncBatch(userId, items) {
  const client = await catalogPool().connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SELECT set_config('studio.user_id', $1, true)", [userId]);
    const result = await client.query(`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset($2::jsonb) AS entry(
          file_id text, parent_file_id text, has_parent boolean, name text, kind text,
          mime_type text, size_bytes bigint, source_modified_at timestamptz,
          detail jsonb, file_info jsonb, thumbnail_url text, share_root boolean
        )
      )
      INSERT INTO studio.catalog_items AS target
        (user_id, file_id, parent_file_id, name, kind, mime_type, size_bytes,
         source_modified_at, detail, file_info, thumbnail_url, share_root)
      SELECT $1, file_id, parent_file_id, name, kind, mime_type, size_bytes,
             source_modified_at, detail, file_info, thumbnail_url, share_root
      FROM incoming ORDER BY file_id
      ON CONFLICT (user_id, file_id) DO UPDATE SET
        parent_file_id = CASE WHEN (SELECT has_parent FROM incoming WHERE file_id = excluded.file_id)
                              THEN excluded.parent_file_id ELSE target.parent_file_id END,
        name = excluded.name,
        kind = excluded.kind,
        mime_type = coalesce(excluded.mime_type, target.mime_type),
        size_bytes = coalesce(excluded.size_bytes, target.size_bytes),
        source_modified_at = coalesce(excluded.source_modified_at, target.source_modified_at),
        detail = coalesce(excluded.detail, target.detail),
        file_info = coalesce(excluded.file_info, target.file_info),
        thumbnail_url = coalesce(excluded.thumbnail_url, target.thumbnail_url),
        share_root = target.share_root OR excluded.share_root
      WHERE excluded.file_info IS NOT NULL
         OR excluded.thumbnail_url IS NOT NULL
         OR excluded.source_modified_at IS NULL OR target.source_modified_at IS NULL
         OR excluded.source_modified_at >= target.source_modified_at
    `, [userId, JSON.stringify(items)]);
    await client.query("COMMIT");
    return result.rowCount;
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
