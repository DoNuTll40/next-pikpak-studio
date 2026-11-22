import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolutionLabel } from "@/lib/catalog";
import { desktopCacheDirectory, desktopFileId } from "./desktop-cache";

function mediaUrl(value) {
  if (typeof value !== "string" || value.length > 16384) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname.endsWith(".mypikpak.com") &&
        !url.port && !url.username && !url.password) return url.href;
  } catch {
    return null;
  }
  return null;
}

function linkUrl(link) {
  if (typeof link === "string") return mediaUrl(link);
  if (!link) return null;
  return mediaUrl(link.url) ||
    [link.mirrors, link.fallbacks].flatMap(list => Array.isArray(list) ? list : [])
      .map(item => mediaUrl(typeof item === "string" ? item : item?.url)).find(Boolean);
}

function originalSource(file) {
  return linkUrl(file.web_content_link) || linkUrl(file.links?.["application/octet-stream"]) ||
    linkUrl(file.links?.[file.mime_type]) || null;
}

function dimension(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function labelText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function urlFileSize(value) {
  try {
    return dimension(new URL(value).searchParams.get("f"));
  } catch {
    return 0;
  }
}

function urlExpiresAt(url, link) {
  try {
    const raw = Number(new URL(url).searchParams.get("expire"));
    if (Number.isSafeInteger(raw) && raw > 1_000_000_000) return raw * 1000;
  } catch {
    // Fall back to link.expire below.
  }
  const parsed = typeof link?.expire === "string" ? Date.parse(link.expire) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function source(url, label, width, height, original = false, meta = {}) {
  const hls = /\.m3u8(?:[?#]|$)/i.test(url);
  return {
    url,
    label,
    height,
    width,
    original,
    detail: width && height ? `${width} × ${height}` : "",
    hls,
    mpegts: !hls && Boolean(meta.mpegts),
    codec: meta.codec ?? "",
    audioCodec: meta.audioCodec ?? "",
    fps: meta.fps ?? 0,
    bitrate: meta.bitrate ?? 0,
    videoType: meta.videoType ?? "",
    hdr: meta.hdr ?? "",
    mediaId: meta.mediaId ?? "",
    duration: meta.duration ?? 0,
    size: meta.size ?? 0,
    expiresAt: meta.expiresAt ?? 0,
  };
}

export async function readDesktopMedia(item) {
  const directory = desktopCacheDirectory();
  if (!directory || !desktopFileId.test(item.id)) return null;
  let file;
  try {
    const data = JSON.parse(await readFile(join(directory, `watch-${item.id}.json`), "utf8"));
    file = data?.file_info ?? data;
  } catch {
    return null;
  }
  if (file?.id !== item.id) return null;

  return { preview: mediaPreview(item.kind, file), fileInfo: file };
}

export function mediaPreview(kind, file) {
  const original = originalSource(file);
  if (kind === "image") return original ? { kind: "image", url: original } : null;
  if (kind !== "video") return null;

  const medias = Array.isArray(file.medias) ? file.medias : [];
  const origin = medias.find(media => media?.is_origin === true);
  const fallbackDuration = dimension(origin?.video?.duration);
  const seen = new Set();
  const variants = medias.flatMap(media => {
    if (!media || media.is_visible === false || media.need_more_quota === true) return [];
    const url = linkUrl(media.link);
    if (!url || url === original || seen.has(url)) return [];
    seen.add(url);
    const width = dimension(media.video?.width);
    const height = dimension(media.video?.height);
    const videoType = labelText(media.video?.video_type).toLowerCase();
    const hls = /\.m3u8(?:[?#]|$)/i.test(url);
    const rawName = labelText(media.resolution_name) || labelText(media.media_name);
    const isOrigin = media.is_origin === true || /\boriginal\b/i.test(rawName);
    const label = isOrigin
      ? (original || hls ? "ต้นฉบับ (สตรีม)" : "ต้นฉบับ")
      : resolutionLabel(width, height) || rawName || "สตรีม";
    const mpegts = videoType === "mpegts" || /\.(?:ts|m2ts|mts)(?:[?#]|$)/i.test(url);
    const codec = labelText(media.video?.video_codec).toLowerCase();
    const audioCodec = labelText(media.video?.audio_codec).toLowerCase();
    const fps = positiveNumber(media.video?.frame_rate);
    const bitrate = dimension(media.video?.bit_rate);
    const hdr = labelText(media.video?.hdr_type);
    const mediaId = labelText(media.media_id);
    const duration = dimension(media.video?.duration) || fallbackDuration;
    const size = urlFileSize(url) || (isOrigin ? dimension(file.size) : 0);
    const expiresAt = urlExpiresAt(url, media.link);
    return [source(url, label, width, height, isOrigin, {
      mpegts, codec, audioCodec, fps, bitrate, videoType, hdr, mediaId, duration, size, expiresAt,
    })];
  }).sort((a, b) =>
    (b.width * b.height) - (a.width * a.height) || Number(b.original) - Number(a.original),
  );

  if (original) {
    const originType = labelText(origin?.video?.video_type).toLowerCase();
    const mpegts = originType === "mpegts" || /\.(?:ts|m2ts|mts)$/i.test(file.name ?? "");
    const codec = labelText(origin?.video?.video_codec).toLowerCase();
    const audioCodec = labelText(origin?.video?.audio_codec).toLowerCase();
    const fps = positiveNumber(origin?.video?.frame_rate);
    const bitrate = dimension(origin?.video?.bit_rate);
    const hdr = labelText(origin?.video?.hdr_type);
    const mediaId = labelText(origin?.media_id);
    const size = dimension(file.size) || urlFileSize(original);
    const expiresAt = urlExpiresAt(original, origin?.link);
    variants.push(source(original, "ต้นฉบับ",
      dimension(origin?.video?.width) || dimension(file.params?.width),
      dimension(origin?.video?.height) || dimension(file.params?.height), true,
      { mpegts, codec, audioCodec, fps, bitrate, videoType: originType, hdr, mediaId, duration: fallbackDuration, size, expiresAt }));
  }
  return variants.length ? { kind: "video", variants } : null;
}
