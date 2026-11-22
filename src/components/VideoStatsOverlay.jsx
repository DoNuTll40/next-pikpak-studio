"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, X } from "lucide-react";

const SAMPLES = 28;

function formatSize(bytes) {
  if (!bytes || !Number.isFinite(bytes)) return "";
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatBitrate(bps) {
  if (!bps || !Number.isFinite(bps) || bps <= 0) return "—";
  const kbps = Math.round(bps / 1000);
  if (bps >= 1_000_000) {
    return `${(bps / 1_000_000).toFixed(2)} Mbps (${kbps.toLocaleString("en-US")} Kbps)`;
  }
  return `${kbps.toLocaleString("en-US")} Kbps`;
}

function Sparkline({ values, color, maxFloor = 1 }) {
  const peak = Math.max(maxFloor, ...values);
  const step = 84 / SAMPLES;
  return (
    <svg width="84" height="14" viewBox="0 0 84 14" aria-hidden="true"
      className="shrink-0 rounded-[3px] bg-black/55">
      {values.map((value, index) => {
        const h = value > 0 ? Math.max(1.5, Math.min(13, (value / peak) * 13)) : 0;
        return h > 0 ? (
          <rect key={index} x={index * step} y={14 - h} width={Math.max(1.5, step - 0.5)} height={h} fill={color} />
        ) : null;
      })}
    </svg>
  );
}

function readSnapshot(video, source, optimal, tsOffset, telemetry) {
  const rect = video?.getBoundingClientRect();
  const dpr = typeof window !== "undefined" ? Number((window.devicePixelRatio || 1).toFixed(2)) : 1;
  const quality = video?.getVideoPlaybackQuality?.();
  const dropped = quality?.droppedVideoFrames ?? telemetry.droppedFrames ?? 0;
  const total = quality?.totalVideoFrames ?? telemetry.decodedFrames ?? 0;

  const localTime = video?.currentTime ?? 0;
  const absTime = tsOffset + localTime;
  let bufStart = 0;
  let bufEnd = 0;
  let bufferHealth = 0;
  if (video?.buffered?.length) {
    const ranges = video.buffered;
    let matched = false;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= localTime + 0.5 && ranges.end(i) >= localTime) {
        bufStart = tsOffset + ranges.start(i);
        bufEnd = tsOffset + ranges.end(i);
        bufferHealth = Math.max(0, ranges.end(i) - localTime);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const last = ranges.length - 1;
      bufStart = tsOffset + ranges.start(last);
      bufEnd = tsOffset + ranges.end(last);
      bufferHealth = Math.max(0, ranges.end(last) - localTime);
    }
  }

  const speedKbps = telemetry.speedKbps > 0
    ? Math.round(telemetry.speedKbps)
    : (typeof navigator !== "undefined" && navigator.connection?.downlink
      ? Math.round(navigator.connection.downlink * 1000)
      : 0);

  const curW = video?.videoWidth || source?.width || 0;
  const curH = video?.videoHeight || source?.height || 0;
  const curFps = Math.round(telemetry.fps || source?.fps || 0);
  const optW = optimal?.width || curW;
  const optH = optimal?.height || curH;
  const optFps = Math.round(optimal?.fps || curFps);

  const vCodec = telemetry.videoCodec || source?.codec || "unknown";
  const aCodec = telemetry.audioCodec || source?.audioCodec || "—";
  const engine = source?.mpegts ? "mpegts.js (MSE)" : source?.hls ? "hls.js (MSE)" : "Native <video>";
  const engineShort = source?.mpegts ? "MPEGTS" : source?.hls ? "HLS" : "DIRECT";
  const container = source?.videoType ? source.videoType.split(",")[0] : (source?.mpegts ? "mpegts" : source?.hls ? "hls" : "mp4");

  const durationSec = source?.duration || (Number.isFinite(video?.duration) ? video.duration : 0);
  const rawBitrate = source?.bitrate || (source?.size && durationSec > 0 ? (source.size * 8) / durationSec : 0);

  return {
    viewport: `${Math.round(rect?.width ?? 0)}×${Math.round(rect?.height ?? 0)}*${dpr}`,
    dropped,
    total,
    curRes: curW && curH ? `${curW}×${curH}${curFps ? `@${curFps}` : ""}` : "—",
    optRes: optW && optH ? `${optW}×${optH}${optFps ? `@${optFps}` : ""}` : "—",
    volume: video?.muted ? "Muted (0%)" : `${Math.round((video?.volume ?? 1) * 100)}%`,
    rate: video?.playbackRate ?? 1,
    loop: Boolean(video?.loop),
    codecs: `${vCodec} / ${aCodec}`,
    bitrate: formatBitrate(rawBitrate),
    size: formatSize(source?.size),
    color: source?.hdr || telemetry.chromaFormat || "bt709",
    engine,
    container,
    speedKbps,
    bufferHealth,
    readyState: video?.readyState ?? 0,
    networkState: video?.networkState ?? 0,
    absTime,
    bufStart,
    bufEnd,
    tsOffset,
    engineShort,
    date: new Date().toString().replace(/\s*\([^)]*\)\s*$/, ""),
  };
}

export function VideoStatsOverlay({
  fileId,
  source,
  variants,
  videoRef,
  tsOffset,
  telemetryRef,
  offsetTop = false,
  onClose,
}) {
  const reducedMotion = useReducedMotion();
  const optimal = variants.find(v => v.original) ?? variants[0];
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  const lastActivityRef = useRef({ time: 0, bufEnd: 0 });
  const [state, setState] = useState(() => ({
    snap: null,
    speedHistory: Array(SAMPLES).fill(0),
    activityHistory: Array(SAMPLES).fill(0),
    bufferHistory: Array(SAMPLES).fill(0),
    activityKB: 0,
  }));

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    function sample() {
      const video = videoRef.current;
      const telemetry = telemetryRef.current;
      const snap = readSnapshot(video, source, optimal, tsOffset, telemetry);

      let activityKB = 0;
      if (telemetry.activityKB > 0) {
        activityKB = Math.round(telemetry.activityKB);
        telemetry.activityKB = 0;
      } else if (snap.bufEnd > lastActivityRef.current.bufEnd + 0.05 && source?.bitrate) {
        const deltaSec = snap.bufEnd - lastActivityRef.current.bufEnd;
        activityKB = Math.round((deltaSec * source.bitrate) / 8 / 1024);
      }
      lastActivityRef.current = { time: snap.absTime, bufEnd: snap.bufEnd };

      setState(prev => ({
        snap,
        activityKB,
        speedHistory: [...prev.speedHistory.slice(1), snap.speedKbps],
        activityHistory: [...prev.activityHistory.slice(1), activityKB],
        bufferHistory: [...prev.bufferHistory.slice(1), snap.bufferHealth],
      }));
    }

    const initial = setTimeout(sample, 0);
    const interval = setInterval(sample, 500);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [videoRef, source, optimal, tsOffset, telemetryRef]);

  const snap = state.snap;
  if (!snap) return null;

  const mediaIdShort = source?.mediaId ? `${source.mediaId.slice(0, 12)}…` : "—";
  const mysteryText = `${snap.engineShort}, s:${snap.readyState} n:${snap.networkState} t:${snap.absTime.toFixed(2)} b:${snap.bufStart.toFixed(2)}-${snap.bufEnd.toFixed(2)}${snap.tsOffset > 0 ? ` off:${snap.tsOffset.toFixed(1)}` : ""}`;
  const bitrateLine = snap.size ? `${snap.bitrate} · ${snap.size}` : snap.bitrate;
  const engineLine = `${snap.color} · ${snap.engine} · ${snap.container}`;
  const shiftY = offsetTop ? 40 : 0;

  async function copyDebug(event) {
    event.stopPropagation();
    const text = [
      `Video ID / Media: ${fileId} / ${source?.mediaId || "—"}`,
      `Viewport / Frames: ${snap.viewport} / ${snap.dropped} dropped of ${snap.total}`,
      `Current / Optimal Res: ${snap.curRes} / ${snap.optRes}`,
      `Volume / Playback: ${snap.volume} / ${snap.rate}x${snap.loop ? " (Loop)" : ""}`,
      `Codecs: ${snap.codecs}`,
      `Video Bitrate: ${bitrateLine}`,
      `Color / Engine: ${engineLine}`,
      `Connection Speed: ${snap.speedKbps ? `${snap.speedKbps} Kbps` : "—"}`,
      `Network Activity: ${state.activityKB} KB`,
      `Buffer Health: ${snap.bufferHealth.toFixed(2)} s`,
      `Mystery Text: ${mysteryText}`,
      `Date: ${snap.date}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const host = event.currentTarget.closest("dialog") ?? document.body;
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      host.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <motion.aside
      key="stats-for-nerds"
      aria-label="สถิติสำหรับเด็กเนิร์ด"
      onClick={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()}
      onContextMenu={event => event.stopPropagation()}
      initial={reducedMotion ? { opacity: 0, y: shiftY } : { opacity: 0, scale: 0.96, y: shiftY - 6 }}
      animate={{ opacity: 1, scale: 1, y: shiftY }}
      exit={reducedMotion ? { opacity: 0, y: shiftY } : { opacity: 0, scale: 0.96, y: shiftY - 4 }}
      transition={reducedMotion ? { duration: 0.08 } : { type: "spring", stiffness: 440, damping: 34 }}
      className="absolute top-3 left-3 z-20 max-h-[calc(100%-6rem)] w-[min(480px,calc(100%-1.5rem))] overflow-y-auto rounded-xl border border-white/10 bg-[#080d18]/82 px-3 py-2.5 font-mono text-[11px] leading-[1.5] text-white/95 shadow-xl backdrop-blur-md select-text"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
        <span className="font-sans text-[11px] font-semibold text-white/90">สถิติสำหรับเด็กเนิร์ด</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={copyDebug} title="คัดลอกสถิติ"
            className={`inline-flex h-5 items-center gap-1 rounded px-1.5 font-sans text-[10px] hover:bg-white/15 ${copied ? "text-emerald-300" : "text-white/75 hover:text-white"}`}>
            {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
            <span>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
          </button>
          <button type="button" onClick={onClose} aria-label="ปิดสถิติสำหรับเด็กเนิร์ด" title="ปิด"
            className="grid size-5 place-items-center rounded text-white/75 hover:bg-white/15 hover:text-white">
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 tabular-nums">
        <dt className="text-right font-semibold text-white/65">Video ID / Media</dt>
        <dd className="truncate" title={`${fileId} / ${source?.mediaId || "—"}`}>{fileId} / {mediaIdShort}</dd>

        <dt className="text-right font-semibold text-white/65">Viewport / Frames</dt>
        <dd className="truncate">{snap.viewport} / {snap.dropped} dropped of {snap.total}</dd>

        <dt className="text-right font-semibold text-white/65">Current / Optimal Res</dt>
        <dd className="truncate">{snap.curRes} / {snap.optRes}</dd>

        <dt className="text-right font-semibold text-white/65">Volume / Playback</dt>
        <dd className="truncate">{snap.volume} / {snap.rate}x{snap.loop ? " (Loop)" : ""}</dd>

        <dt className="text-right font-semibold text-white/65">Codecs</dt>
        <dd className="truncate" title={snap.codecs}>{snap.codecs}</dd>

        <dt className="text-right font-semibold text-white/65">Video Bitrate</dt>
        <dd className="truncate" title={bitrateLine}>{bitrateLine}</dd>

        <dt className="text-right font-semibold text-white/65">Color / Engine</dt>
        <dd className="truncate" title={engineLine}>{engineLine}</dd>

        <dt className="text-right font-semibold text-white/65">Connection Speed</dt>
        <dd className="flex items-center justify-between gap-2">
          <Sparkline values={state.speedHistory} color="#3065f5" maxFloor={2000} />
          <span className="shrink-0">{snap.speedKbps ? `${snap.speedKbps.toLocaleString("en-US")} Kbps` : "—"}</span>
        </dd>

        <dt className="text-right font-semibold text-white/65">Network Activity</dt>
        <dd className="flex items-center justify-between gap-2">
          <Sparkline values={state.activityHistory} color="#38bdf8" maxFloor={256} />
          <span className="shrink-0">{state.activityKB.toLocaleString("en-US")} KB</span>
        </dd>

        <dt className="text-right font-semibold text-white/65">Buffer Health</dt>
        <dd className="flex items-center justify-between gap-2">
          <Sparkline values={state.bufferHistory} color="#f7c679" maxFloor={30} />
          <span className="shrink-0">{snap.bufferHealth.toFixed(2)} s</span>
        </dd>

        <dt className="text-right font-semibold text-white/65">Mystery Text</dt>
        <dd className="truncate" title={mysteryText}>{mysteryText}</dd>

        <dt className="text-right font-semibold text-white/65">Date</dt>
        <dd className="truncate">{snap.date}</dd>
      </dl>
    </motion.aside>
  );
}
