import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { desktopCacheDirectory } from "./desktop-cache";

const thumbnailName = /^watch-([A-Za-z0-9_-]{1,128})\.thumbnail$/;
const thumbnailHost = /^(?:[a-z0-9]+-)?thumbnail-drive\.mypikpak\.com$/;

export function thumbnailUrl(value) {
  if (typeof value !== "string" || value.length > 8192) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && thumbnailHost.test(url.hostname) &&
        !url.port && !url.username && !url.password) return url.href;
  } catch {
    return null;
  }
  return null;
}

export async function openDesktopThumbnails() {
  const directory = desktopCacheDirectory();
  if (!directory) return null;

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("Studio thumbnail cache unavailable", error.code);
    return null;
  }

  const files = new Map();
  for (const entry of entries) {
    const match = thumbnailName.exec(entry.name);
    if (match && entry.isFile()) files.set(match[1], entry.name);
  }

  return {
    ids: [...files.keys()],
    async read(id) {
      const name = files.get(id);
      if (!name) return null;
      try {
        const value = (await readFile(join(directory, name), "utf8")).trim();
        return thumbnailUrl(value);
      } catch {
        return null;
      }
      return null;
    },
  };
}
