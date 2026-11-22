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

export function formatShortStudioDate(timestamp) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(timestamp);
}

export function formatFileSize(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = num;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const digits = i === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[i]}`;
}

export function formatDuration(seconds) {
  const num = Number(seconds);
  if (!Number.isFinite(num) || num <= 0) return "";
  const total = Math.floor(num);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = value => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function formatExpiryInfo(expiresAt, now = null) {
  const ts = Number(expiresAt);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const shortDate = formatShortStudioDate(ts);
  const fullDate = formatStudioDate(ts);
  if (now === null) {
    return {
      state: "neutral",
      label: `หมดอายุ ${shortDate}`,
      compactLabel: `หมด ${shortDate}`,
      title: `ลิงก์หมดอายุ ${fullDate}`,
    };
  }
  const diff = ts - now;
  if (diff <= 0) {
    return {
      state: "expired",
      label: `หมดอายุแล้ว · ${shortDate}`,
      compactLabel: "หมดอายุแล้ว",
      title: `ลิงก์หมดอายุแล้วเมื่อ ${fullDate}`,
    };
  }
  const mins = Math.max(1, Math.floor(diff / 60_000));
  if (mins < 60) {
    return {
      state: "soon",
      label: `เหลือ ${mins} นาที · ${shortDate}`,
      compactLabel: `เหลือ ${mins} น.`,
      title: `ลิงก์หมดอายุ ${fullDate}`,
    };
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return {
      state: hours < 6 ? "soon" : "ok",
      label: `เหลือ ${hours} ชม. · ${shortDate}`,
      compactLabel: `เหลือ ${hours} ชม.`,
      title: `ลิงก์หมดอายุ ${fullDate}`,
    };
  }
  const days = Math.floor(hours / 24);
  return {
    state: "ok",
    label: `เหลือ ${days} วัน · ${shortDate}`,
    compactLabel: `เหลือ ${days} วัน`,
    title: `ลิงก์หมดอายุ ${fullDate}`,
  };
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

