import "server-only";
import { join } from "node:path";

export const desktopFileId = /^[A-Za-z0-9_-]{1,128}$/;

export function desktopCacheDirectory() {
  return process.env.STUDIO_DESKTOP_CACHE_DIR || (process.env.APPDATA &&
    join(process.env.APPDATA, "com.pikpakstudio.desktop", "browser-video-info"));
}
