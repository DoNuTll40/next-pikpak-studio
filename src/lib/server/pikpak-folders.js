import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { desktopCacheDirectory } from "./desktop-cache";

const sharePath = /^\/s\/[\w-]+(?:\/[\w-]+)*$/;

export function pikPakUrl(path) {
  return typeof path === "string" && sharePath.test(path) ? `https://mypikpak.com${path}` : null;
}

export async function readDesktopFolderPaths() {
  const directory = desktopCacheDirectory();
  if (!directory) return new Map();
  const pages = join(directory, "share-detail");
  const names = await readdir(pages).catch(() => []);
  const paths = new Map();
  const ambiguous = new Set();

  for (const name of names.filter(name => /^document-[a-f0-9]+\.json$/.test(name))) {
    try {
      const data = JSON.parse(await readFile(join(pages, name), "utf8"));
      const page = data.data ?? data;
      const path = page.document_scope?.replace(/\/initial$/, "");
      if (!pikPakUrl(path) || !Array.isArray(page.files)) continue;
      const parentIds = new Set(page.files.map(file => file.parent_id).filter(Boolean));
      const matchingParents = page.files.filter(file => file.kind === "drive#folder" && parentIds.has(file.id));
      const id = matchingParents.length === 1 ? matchingParents[0].id :
        matchingParents.length === 0 && parentIds.size === 1 ? parentIds.values().next().value : null;
      if (!id) continue;
      if (paths.has(id) && paths.get(id) !== path) ambiguous.add(id);
      paths.set(id, path);
    } catch {
      // A missing or incomplete Desktop snapshot can be skipped.
    }
  }

  for (const id of ambiguous) paths.delete(id);
  return paths;
}
