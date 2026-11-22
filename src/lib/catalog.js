export const statusText = {
  complete: "สแกนครบ",
  partial: "สแกนได้บางส่วน",
  pending: "รอสแกน",
};

export function folderHref(id) {
  return id ? `/library/folder/${encodeURIComponent(id)}` : "/library";
}

export function formatStudioDate(timestamp) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(timestamp);
}

export function catalogFontClass(name) {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(name)) return "font-ja";
  if (/\p{Script=Hangul}/u.test(name)) return "font-ko";
}

export function resolutionLabel(width, height) {
  if (!width || !height) return "";
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  if (shortSide >= 4320 || longSide >= 7680) return "8K";
  if (shortSide >= 2160 || longSide >= 3840) return "4K";
  if (shortSide >= 1440 || longSide >= 2560) return "2K";
  if (shortSide >= 1080 || longSide >= 1920) return "1080p";
  if (shortSide >= 720 || longSide >= 1280) return "720p";
  if (shortSide >= 480 || longSide >= 850) return "480p";
  if (shortSide >= 360 || longSide >= 640) return "360p";
  return `${shortSide}p`;
}

