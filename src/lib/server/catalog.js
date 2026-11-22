import "server-only";
import { Pool } from "pg";
import { requireStudioUser } from "./session";
import { openDesktopThumbnails } from "./thumbnails";

let pool;

export function catalogPool() {
  if (!process.env.DATABASE_URL) throw new Error("Missing Studio database connection");
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      enableChannelBinding: true,
      max: 5,
      connectionTimeoutMillis: 8000,
    });
    pool.on("error", () => console.error("Idle Studio database connection closed"));
  }
  return pool;
}

async function readStudio(read) {
  const userId = await requireStudioUser();
  const client = await catalogPool().connect();
  let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SELECT set_config('studio.user_id', $1, true)", [userId]);
    const result = await read((sql, values = []) => client.query(sql, [userId, ...values]),
      userId === process.env.STUDIO_OWNER_ID);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discard = true;
    }
    const code = typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : "unavailable";
    console.error("Studio database read failed", code);
    throw new Error("Could not load Studio data");
  } finally {
    client.release(discard);
  }
}

const mediaKind = `CASE
  WHEN item.mime_type LIKE 'video/%' OR item.name ~* '[.](mp4|m4v|webm|mov|mkv|ts|m2ts|mts|avi|mpe?g|ogv|3gp)$' THEN 'video'
  WHEN item.mime_type LIKE 'image/%' OR item.name ~* '[.](jpe?g|png|gif|webp|avif|bmp|ico|svg|jxl|heic|heif|tiff?)$' THEN 'image'
  ELSE 'file'
END`;

export async function readCatalogMediaItem(id) {
  return readStudio(async (query, useDesktopCache) => (await query(`
    SELECT item.file_id AS id, item.name, ${mediaKind} AS kind,
      item.file_info -> 'preview' AS preview,
      item.file_info AS "fileInfo",
      $3::boolean AS "useDesktopCache"
    FROM studio.catalog_items item
    WHERE item.user_id = $1 AND item.file_id = $2 AND item.kind = 'file'
  `, [id, useDesktopCache])).rows[0] ?? null);
}

export async function readCatalog(folderId) {
  const { folders, files, previews, thumbnails, useDesktopCache } = await readStudio(async (query, useDesktopCache) => {
    const thumbnails = useDesktopCache ? await openDesktopThumbnails() : null;
    const { rows: folders } = await query(`
      SELECT item.file_id AS id, item.parent_file_id AS parent, item.name, item.kind,
        scan.status, scan.path AS "scanPath", children.count, item.share_root AS "shareRoot",
        coalesce(item.thumbnail_url, preview.thumbnail_url, deep_preview.thumbnail_url) AS thumbnail
      FROM studio.catalog_items item
      LEFT JOIN LATERAL (
        SELECT status, path FROM studio.scan_folders
        WHERE user_id = $1 AND folder_id = item.file_id
        ORDER BY updated_at DESC, path LIMIT 1
      ) scan ON true
      CROSS JOIN LATERAL (
        SELECT count(*)::int FROM studio.catalog_items
        WHERE user_id = $1 AND parent_file_id = item.file_id
      ) children
      LEFT JOIN LATERAL (
        SELECT thumbnail_url FROM studio.catalog_items
        WHERE user_id = $1 AND parent_file_id = item.file_id AND thumbnail_url IS NOT NULL
        ORDER BY (kind = 'file') DESC, name, file_id LIMIT 1
      ) preview ON true
      LEFT JOIN LATERAL (
        SELECT g.thumbnail_url
        FROM studio.catalog_items sub
        JOIN studio.catalog_items g
          ON g.user_id = $1 AND g.parent_file_id = sub.file_id AND g.thumbnail_url IS NOT NULL
        WHERE sub.user_id = $1 AND sub.parent_file_id = item.file_id AND sub.kind = 'folder'
        ORDER BY (g.kind = 'file') DESC, sub.name, g.name, g.file_id LIMIT 1
      ) deep_preview ON item.thumbnail_url IS NULL AND preview.thumbnail_url IS NULL
      WHERE item.user_id = $1 AND item.kind = 'folder'
      ORDER BY item.name, item.file_id
    `);

    const { rows: files } = await query(`
      SELECT item.file_id AS id, item.parent_file_id AS parent, item.name,
        ${mediaKind} AS kind, item.thumbnail_url AS thumbnail, (item.file_info IS NOT NULL OR EXISTS (
          SELECT 1 FROM studio.watch_history history
          WHERE history.user_id = $1 AND history.file_id = item.file_id
        )) AS "hasInfo"
      FROM studio.catalog_items item
      WHERE item.user_id = $1 AND item.kind = 'file'
        AND (
          item.parent_file_id = $2::text
          OR ($2::text IS NULL AND NOT EXISTS (
            SELECT 1 FROM studio.catalog_items parent
            WHERE parent.user_id = $1 AND parent.kind = 'folder'
              AND parent.file_id = item.parent_file_id
          ))
        )
      ORDER BY item.name, item.file_id
    `, [folderId]);

    const folderIds = new Set(folders.map(folder => folder.id));
    const visibleFolders = folders.filter(folder => folder.parent === folderId ||
      (folderId === null && !folderIds.has(folder.parent)));
    const { rows: previews } = thumbnails?.ids.length && visibleFolders.length ? await query(`
      SELECT DISTINCT ON (item.parent_file_id) item.parent_file_id AS folder, item.file_id AS id
      FROM studio.catalog_items item
      WHERE item.user_id = $1
        AND item.parent_file_id = ANY($2::text[]) AND item.file_id = ANY($3::text[])
      ORDER BY item.parent_file_id, (item.kind = 'file') DESC, item.name, item.file_id
    `, [visibleFolders.map(folder => folder.id), thumbnails.ids]) : { rows: [] };

    return { folders, files, previews, thumbnails, useDesktopCache };
  });

  if (thumbnails) {
    const foldersById = new Map(folders.map(folder => [folder.id, folder]));
    await Promise.all(previews.map(async ({ folder, id }) => {
      foldersById.get(folder).thumbnail ??= await thumbnails.read(id);
    }));
    await Promise.all(files.map(async item => {
      item.thumbnail ??= await thumbnails.read(item.id);
    }));
  }
  return { folders, files, useDesktopCache };
}

export async function readScans() {
  return readStudio(async query => (await query(`
    SELECT scan.path AS id, scan.parent_path AS parent, scan.name, scan.status,
      item.file_id AS "folderId",
      (extract(epoch FROM scan.updated_at) * 1000)::double precision AS "updatedAt"
    FROM studio.scan_folders scan
    LEFT JOIN studio.catalog_items item
      ON item.user_id = $1 AND item.file_id = scan.folder_id AND item.kind = 'folder'
    WHERE scan.user_id = $1
    ORDER BY scan.name, scan.path
  `)).rows);
}

export async function readHistory() {
  const { items, useDesktopCache } = await readStudio(async (query, useDesktopCache) => ({
    items: (await query(`
    SELECT item.file_id AS id, item.name, ${mediaKind} AS kind, parent.file_id AS "parentId",
      item.thumbnail_url AS thumbnail,
      (extract(epoch FROM history.viewed_at) * 1000)::double precision AS "viewedAt"
    FROM studio.watch_history history
    JOIN studio.catalog_items item ON item.user_id = $1 AND item.file_id = history.file_id
    LEFT JOIN studio.catalog_items parent
      ON parent.user_id = $1 AND parent.file_id = item.parent_file_id AND parent.kind = 'folder'
    WHERE history.user_id = $1
    ORDER BY history.viewed_at DESC, history.file_id
    LIMIT 100
  `)).rows,
    useDesktopCache,
  }));
  const thumbnails = useDesktopCache ? await openDesktopThumbnails() : null;
  if (thumbnails) {
    await Promise.all(items.map(async item => {
      item.thumbnail ??= await thumbnails.read(item.id);
    }));
  }
  return items;
}

