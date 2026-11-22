import { readCatalogMediaItem } from "@/lib/server/catalog";
import { desktopFileId } from "@/lib/server/desktop-cache";
import { mediaPreview, readDesktopMedia } from "@/lib/server/media";

function safeFilename(rawName, variant) {
  const cleaned = (rawName || "video")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .trim() || "video";
  const dot = cleaned.lastIndexOf(".");
  const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  const origExt = dot > 0 ? cleaned.slice(dot) : ".mp4";

  let ext = origExt;
  if (variant.mpegts) ext = ".ts";
  else if (variant.videoType?.includes("webm")) ext = ".webm";
  else if (variant.videoType?.includes("matroska")) ext = ".mkv";

  const tag = !variant.original && variant.label
    ? ` [${variant.label.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "").trim()}]`
    : "";
  return `${base}${tag}${ext}`;
}

function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request, { params }) {
  const { id } = await params;
  if (!desktopFileId.test(id)) return new Response("Invalid ID", { status: 400 });

  const item = await readCatalogMediaItem(id);
  if (!item) return new Response("Not found", { status: 404 });

  const desktop = item.useDesktopCache ? await readDesktopMedia(item) : null;
  const preview = desktop?.preview ??
    (item.fileInfo?.medias ? mediaPreview(item.kind, item.fileInfo) : item.preview) ?? null;

  if (!preview || preview.kind !== "video" || !Array.isArray(preview.variants)) {
    return new Response("No downloadable video", { status: 404 });
  }

  const requested = Number(new URL(request.url).searchParams.get("v") ?? 0);
  const index = Number.isInteger(requested) && requested >= 0 && requested < preview.variants.length ? requested : 0;
  const variant = preview.variants[index];
  if (!variant?.url || variant.hls) {
    return new Response("Variant is not directly downloadable", { status: 400 });
  }

  let upstream;
  try {
    upstream = await fetch(variant.url, { signal: request.signal, redirect: "follow" });
  } catch {
    return new Response("Download failed", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream unavailable", { status: upstream.status || 502 });
  }

  const filename = safeFilename(item.name, variant);
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Disposition": contentDisposition(filename),
    "Content-Type": variant.mpegts ? "video/mp2t" : (upstream.headers.get("content-type") || "application/octet-stream"),
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new Response(upstream.body, { status: 200, headers });
}
