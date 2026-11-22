"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Braces,
  Check,
  Download,
  Link2,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { resolutionLabel } from "@/lib/catalog";
import { VideoStatsOverlay } from "./VideoStatsOverlay";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const TS_PACKET = 188;
const subscribeNoop = () => () => {};
const controlBtn = "grid size-8 shrink-0 place-items-center rounded-lg text-white/90 hover:bg-white/15 hover:text-white";
const pillBtn = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-white/90 hover:bg-white/15 hover:text-white aria-expanded:bg-accent aria-expanded:text-white";
const topCloseBtn = "grid size-8 shrink-0 place-items-center rounded-lg bg-panel/90 text-muted shadow-sm backdrop-blur-sm hover:bg-panel hover:text-foreground";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = value => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

function shortQualityLabel(variant) {
  if (!variant) return "อัตโนมัติ";
  const fromDim = resolutionLabel(variant.width, variant.height);
  if (fromDim) return fromDim;
  const match = variant.label.match(/\b(\d{3,4}p|[248]K)\b/i)?.[1];
  return match ?? variant.label;
}

function estimateTsByteOffset(targetSec, totalDuration, totalSize) {
  if (!totalDuration || !totalSize || targetSec <= 0) return 0;
  const ratio = Math.max(0, Math.min(0.995, targetSec / totalDuration));
  return Math.floor((ratio * totalSize) / TS_PACKET) * TS_PACKET;
}

function createOffsetSeekHandler(byteOffset) {
  return class OffsetRangeSeekHandler {
    getConfig(url, range) {
      const headers = {};
      const from = byteOffset + (range?.from || 0);
      const hasTo = range && range.to !== -1 && range.to !== undefined;
      const to = hasTo ? byteOffset + range.to : "";
      if (from > 0 || hasTo) {
        headers.Range = `bytes=${from}-${to}`;
      }
      return { url, headers };
    }

    removeURLParameters(url) {
      return url;
    }
  };
}

export function VideoPlayer({
  fileId = "",
  fileInfo = null,
  title,
  titleClass = "",
  poster,
  headerActions,
  onClose,
  variants,
  selected,
  onSelectQuality,
  failed,
  errorMessage,
  errorAction = null,
  onError,
}) {
  const source = variants[selected] ?? variants[0];
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const volumeTrackRef = useRef(null);
  const menuRef = useRef(null);
  const contextMenuRef = useRef(null);
  const dockHoverRef = useRef(false);
  const hideTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const playbackRef = useRef(null);
  const initialAutoPlayRef = useRef(true);
  const telemetryRef = useRef({
    speedKbps: 0,
    activityKB: 0,
    decodedFrames: 0,
    droppedFrames: 0,
    videoCodec: "",
    audioCodec: "",
    chromaFormat: "",
    fps: 0,
  });

  const [tsSession, setTsSession] = useState({ offsetSec: 0, byteOffset: 0, seq: 0 });
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [loadedKey, setLoadedKey] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(null);
  const [hoverSeek, setHoverSeek] = useState(null);
  const [volumeDragging, setVolumeDragging] = useState(false);

  const isMpegts = Boolean(source?.mpegts);
  const tsOffset = isMpegts ? tsSession.offsetSec : 0;
  const tsByteOffset = isMpegts ? tsSession.byteOffset : 0;
  const tsSeq = isMpegts ? tsSession.seq : 0;
  const playbackKey = `${source?.url ?? ""}:${tsSeq}`;
  const effectiveDuration = isMpegts ? (source?.duration || duration) : (duration || source?.duration || 0);

  const pipSupported = useSyncExternalStore(
    subscribeNoop,
    () => Boolean(document.pictureInPictureEnabled),
    () => false,
  );
  const reducedMotion = useReducedMotion();
  const menuSpring = reducedMotion
    ? { duration: 0.08 }
    : { type: "spring", stiffness: 520, damping: 34, mass: 0.7 };

  useEffect(() => {
    stageRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !source) return;
    if (source.expiresAt && Date.now() >= source.expiresAt) return;
    let disposed = false;
    let hls;
    let tsPlayer;

    const fail = () => {
      if (!disposed) {
        setBuffering(false);
        onError(true);
      }
    };

    telemetryRef.current = {
      speedKbps: 0,
      activityKB: 0,
      decodedFrames: 0,
      droppedFrames: 0,
      videoCodec: "",
      audioCodec: "",
      chromaFormat: "",
      fps: 0,
    };

    player.addEventListener("error", fail);

    if (source.hls && !player.canPlayType("application/vnd.apple.mpegurl")) {
      import("hls.js/light").then(({ default: Hls }) => {
        if (disposed) return;
        if (!Hls.isSupported()) return fail();
        hls = new Hls({ enableWorker: false, lowLatencyMode: false });
        hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) fail(); });
        hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
          const stats = data?.frag?.stats;
          if (!stats) return;
          const bytes = stats.total || 0;
          const ms = Math.max(1, (stats.loading?.end || 0) - (stats.loading?.start || 0));
          telemetryRef.current.activityKB += bytes / 1024;
          telemetryRef.current.speedKbps = (bytes * 8) / ms;
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (disposed) return;
          if (initialAutoPlayRef.current && !playbackRef.current) {
            initialAutoPlayRef.current = false;
            player.play().catch(() => {});
          }
        });
        hls.loadSource(source.url);
        hls.attachMedia(player);
      }).catch(fail);
    } else if (source.mpegts) {
      import("mpegts.js").then(({ default: mpegts }) => {
        if (disposed) return;
        if (!mpegts.isSupported()) return fail();
        mpegts.LoggingControl.enableVerbose = false;
        mpegts.LoggingControl.enableDebug = false;
        mpegts.LoggingControl.enableInfo = false;
        mpegts.LoggingControl.enableWarn = false;
        tsPlayer = mpegts.createPlayer(
          { type: "mpegts", isLive: false, url: source.url, cors: true },
          {
            enableWorker: false,
            lazyLoad: true,
            lazyLoadMaxDuration: 60,
            lazyLoadRecoverDuration: 20,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 60,
            autoCleanupMinBackwardDuration: 30,
            seekType: "custom",
            customSeekHandler: createOffsetSeekHandler(tsByteOffset),
          },
        );
        tsPlayer.on(mpegts.Events.ERROR, fail);
        tsPlayer.on(mpegts.Events.MEDIA_INFO, info => {
          if (!info || disposed) return;
          telemetryRef.current.videoCodec = info.videoCodec || "";
          telemetryRef.current.audioCodec = info.audioCodec || "";
          telemetryRef.current.chromaFormat = info.chromaFormat || "";
          telemetryRef.current.fps = info.fps || 0;
        });
        tsPlayer.on(mpegts.Events.STATISTICS_INFO, stats => {
          if (!stats || disposed) return;
          if (Number.isFinite(stats.speed)) {
            telemetryRef.current.speedKbps = stats.speed * 8;
            telemetryRef.current.activityKB += stats.speed * 0.6;
          }
          if (Number.isFinite(stats.decodedFrames)) telemetryRef.current.decodedFrames = stats.decodedFrames;
          if (Number.isFinite(stats.droppedFrames)) telemetryRef.current.droppedFrames = stats.droppedFrames;
        });
        tsPlayer.attachMediaElement(player);
        tsPlayer.load();
      }).catch(fail);
    } else {
      player.src = source.url;
    }

    return () => {
      disposed = true;
      player.removeEventListener("error", fail);
      hls?.destroy();
      if (tsPlayer) {
        try {
          tsPlayer.pause();
          tsPlayer.unload();
          tsPlayer.detachMediaElement();
          tsPlayer.destroy();
        } catch {
          // Ignore teardown errors during rapid switches.
        }
      }
      player.removeAttribute("src");
      player.load();
    };
  }, [source, tsByteOffset, tsSeq, onError]);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(document.fullscreenElement === stageRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    function closeOutside(event) {
      if (!menuRef.current?.contains(event.target)) setOpenMenu(null);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [openMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    function closeOutside(event) {
      if (!contextMenuRef.current?.contains(event.target)) setContextMenu(null);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [contextMenu]);

  useEffect(() => () => {
    clearTimeout(hideTimerRef.current);
    clearTimeout(toastTimerRef.current);
  }, []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 1800);
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const host = stageRef.current?.closest("dialog") ?? document.body;
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      host.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast(label);
  }

  function downloadCurrentVariant() {
    if (!fileId || !source || source.hls) return;
    setContextMenu(null);
    const link = document.createElement("a");
    link.href = `/api/media/${encodeURIComponent(fileId)}/download?v=${selected}`;
    link.download = "";
    (stageRef.current ?? document.body).append(link);
    link.click();
    link.remove();
    showToast(`เริ่มดาวน์โหลด (${shortQualityLabel(source)})`);
  }

  function toggleLoop() {
    const next = !loop;
    if (videoRef.current) videoRef.current.loop = next;
    setLoop(next);
    setContextMenu(null);
    showToast(next ? "เปิดเล่นซ้ำแล้ว" : "ปิดเล่นซ้ำแล้ว");
  }

  function handleContextMenu(event) {
    if (event.shiftKey) return;
    event.preventDefault();
    setOpenMenu(null);
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const menuW = 228;
    const menuH = 270;
    const pad = 8;
    const x = Math.max(pad, Math.min(event.clientX - rect.left, rect.width - menuW - pad));
    const y = Math.max(pad, Math.min(event.clientY - rect.top, rect.height - menuH - pad));
    setContextMenu({ x, y });
    scheduleHide();
  }

  function scheduleHide(isCurrentlyPlaying = playing) {
    clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    if (!isCurrentlyPlaying || dockHoverRef.current || scrubbing || openMenu || contextMenu) return;
    hideTimerRef.current = setTimeout(() => {
      if (!dockHoverRef.current) setControlsVisible(false);
    }, 2400);
  }

  function togglePlay() {
    const player = videoRef.current;
    if (!player) return;
    setOpenMenu(null);
    setContextMenu(null);
    if (player.paused) {
      player.play().catch(() => {});
      scheduleHide(true);
    } else {
      player.pause();
      clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    }
  }

  function isInBufferedRange(player, localTime) {
    const ranges = player.buffered;
    for (let i = 0; i < ranges.length; i++) {
      if (localTime >= ranges.start(i) && localTime <= ranges.end(i)) return true;
    }
    return false;
  }

  function seekTo(targetSec) {
    const player = videoRef.current;
    if (!player || effectiveDuration <= 0) return;
    const clamped = Math.max(0, Math.min(effectiveDuration, targetSec));

    if (isMpegts) {
      const localTarget = clamped - tsOffset;
      if (isInBufferedRange(player, localTarget)) {
        player.currentTime = localTarget;
        setCurrentTime(clamped);
      } else if (source?.duration > 0 && source?.size > 0) {
        const byteOffset = estimateTsByteOffset(clamped, source.duration, source.size);
        playbackRef.current = {
          time: clamped,
          playing: !player.paused,
          rate: player.playbackRate,
          volume: player.volume,
          muted: player.muted,
          bytePositioned: true,
        };
        onError(false);
        setBuffering(true);
        setCurrentTime(clamped);
        setBuffered(clamped);
        setTsSession(prev => ({ offsetSec: clamped, byteOffset, seq: prev.seq + 1 }));
      }
    } else {
      player.currentTime = clamped;
      setCurrentTime(clamped);
    }
    scheduleHide();
  }

  function seekBy(delta) {
    const player = videoRef.current;
    if (!player) return;
    const current = isMpegts ? tsOffset + player.currentTime : player.currentTime;
    seekTo(current + delta);
  }

  function applyVolume(nextVolume) {
    const player = videoRef.current;
    const clamped = Math.max(0, Math.min(1, nextVolume));
    if (player) {
      player.volume = clamped;
      player.muted = clamped === 0;
    }
    setVolume(clamped);
    setMuted(clamped === 0);
  }

  function toggleMute() {
    const player = videoRef.current;
    if (!player) return;
    if (muted || volume === 0) {
      const restored = volume > 0 ? volume : 0.7;
      player.volume = restored;
      player.muted = false;
      setVolume(restored);
      setMuted(false);
    } else {
      player.muted = true;
      setMuted(true);
    }
  }

  function changeRate(nextRate) {
    const player = videoRef.current;
    if (player) player.playbackRate = nextRate;
    setRate(nextRate);
    setOpenMenu(null);
  }

  function changeQuality(index) {
    setOpenMenu(null);
    if (index === selected) return;
    const player = videoRef.current;
    const nextVariant = variants[index];
    const absTime = player ? (isMpegts ? tsOffset + player.currentTime : player.currentTime) : 0;
    const byteOffset = nextVariant?.mpegts && absTime > 3 && nextVariant.duration > 0 && nextVariant.size > 0
      ? estimateTsByteOffset(absTime, nextVariant.duration, nextVariant.size)
      : 0;
    const nextOffsetSec = byteOffset > 0 ? absTime : 0;

    if (player) {
      playbackRef.current = {
        time: absTime,
        playing: !player.paused || playing,
        rate: player.playbackRate,
        volume: player.volume,
        muted: player.muted,
        bytePositioned: Boolean(nextVariant?.mpegts),
      };
    }
    onError(false);
    setBuffering(true);
    setCurrentTime(nextOffsetSec || absTime);
    setBuffered(nextOffsetSec);
    setTsSession(prev => ({ offsetSec: nextOffsetSec, byteOffset, seq: prev.seq + 1 }));
    onSelectQuality(index);
  }

  async function togglePip() {
    const player = videoRef.current;
    if (!player || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement === player) {
        await document.exitPictureInPicture();
      } else {
        await player.requestPictureInPicture();
      }
    } catch {
      // Ignore user-cancelled or unsupported PiP errors.
    }
  }

  async function toggleFullscreen() {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
      } else {
        await stage.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen rejection.
    }
  }

  function handleLoadedMetadata(event) {
    const player = event.currentTarget;
    if (Number.isFinite(player.duration) && player.duration > 0) {
      setDuration(player.duration);
    }
    setLoadedKey(playbackKey);
    setBuffering(false);
    const previous = playbackRef.current;
    if (previous) {
      playbackRef.current = null;
      player.playbackRate = previous.rate;
      player.volume = previous.volume;
      player.muted = previous.muted;
      if (!previous.bytePositioned && previous.time > 0) {
        player.currentTime = Math.min(previous.time, player.duration || previous.time);
      }
      if (previous.playing) player.play().catch(() => {});
    } else {
      player.playbackRate = rate;
      if (initialAutoPlayRef.current) {
        initialAutoPlayRef.current = false;
        player.play().catch(() => {});
      }
    }
  }

  function handleProgress(event) {
    const player = event.currentTarget;
    const ranges = player.buffered;
    if (!ranges.length) return;
    const time = player.currentTime;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= time + 0.5 && ranges.end(i) >= time) {
        setBuffered(tsOffset + ranges.end(i));
        return;
      }
    }
    setBuffered(tsOffset + ranges.end(ranges.length - 1));
  }

  function ratioFromPointer(event, element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0;
  }

  function handleSeekPointerDown(event) {
    if (!trackRef.current || effectiveDuration <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ratio = ratioFromPointer(event, trackRef.current);
    const nextTime = ratio * effectiveDuration;
    setScrubbing(true);
    setScrubTime(nextTime);
    setHoverSeek({ percent: ratio * 100, time: nextTime });
    if (!isMpegts && videoRef.current) {
      videoRef.current.currentTime = nextTime;
    } else if (isMpegts && videoRef.current && isInBufferedRange(videoRef.current, nextTime - tsOffset)) {
      videoRef.current.currentTime = nextTime - tsOffset;
    }
  }

  function handleSeekPointerMove(event) {
    if (!trackRef.current || effectiveDuration <= 0) return;
    const ratio = ratioFromPointer(event, trackRef.current);
    const time = ratio * effectiveDuration;
    setHoverSeek({ percent: ratio * 100, time });
    if (scrubbing) {
      setScrubTime(time);
      if (!isMpegts && videoRef.current) {
        videoRef.current.currentTime = time;
      } else if (isMpegts && videoRef.current && isInBufferedRange(videoRef.current, time - tsOffset)) {
        videoRef.current.currentTime = time - tsOffset;
      }
    }
  }

  function handleSeekPointerUp() {
    if (!scrubbing) return;
    const target = scrubTime;
    setScrubbing(false);
    setScrubTime(null);
    if (target !== null && isMpegts) {
      seekTo(target);
    } else {
      scheduleHide();
    }
  }

  function handleVolumePointerDown(event) {
    if (!volumeTrackRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setVolumeDragging(true);
    applyVolume(ratioFromPointer(event, volumeTrackRef.current));
  }

  function handleVolumePointerMove(event) {
    if (!volumeDragging || !volumeTrackRef.current) return;
    applyVolume(ratioFromPointer(event, volumeTrackRef.current));
  }

  function handleKeyDown(event) {
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key === "Escape" && (openMenu || contextMenu)) {
      event.preventDefault();
      event.stopPropagation();
      setOpenMenu(null);
      setContextMenu(null);
      return;
    }
    const key = event.key.toLowerCase();
    if (event.key === " " || key === "k") {
      if (tag === "BUTTON" && event.key === " ") return;
      event.preventDefault();
      togglePlay();
    } else if (event.key === "ArrowLeft" || key === "j") {
      event.preventDefault();
      seekBy(key === "j" ? -10 : -5);
    } else if (event.key === "ArrowRight" || key === "l") {
      event.preventDefault();
      seekBy(key === "l" ? 10 : 5);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      applyVolume((muted ? 0 : volume) + 0.1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      applyVolume((muted ? 0 : volume) - 0.1);
    } else if (key === "m") {
      event.preventDefault();
      toggleMute();
    } else if (key === "f") {
      event.preventDefault();
      toggleFullscreen();
    }
  }

  const loadingSource = loadedKey !== playbackKey && !failed;
  const isLoading = loadingSource || buffering;
  const showOverlay = !playing || controlsVisible || scrubbing || openMenu !== null || contextMenu !== null || failed;
  const activeTime = scrubbing && scrubTime !== null ? scrubTime : currentTime;
  const playedPercent = effectiveDuration > 0 ? Math.min(100, (activeTime / effectiveDuration) * 100) : 0;
  const bufferedPercent = effectiveDuration > 0 ? Math.min(100, (buffered / effectiveDuration) * 100) : 0;
  const displayVolume = muted ? 0 : volume;
  const VolumeIcon = displayVolume === 0 ? VolumeX : displayVolume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={stageRef}
      tabIndex={-1}
      role="region"
      aria-label="ตัวเล่นวิดีโอ"
      className={`group/player relative flex items-center justify-center overflow-hidden bg-[#080d18] select-none focus:outline-none! ${fullscreen ? "size-full" : "aspect-video max-h-[calc(100dvh-32px)] w-full"}`}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onPointerMove={() => scheduleHide()}
      onPointerLeave={() => {
        if (playing && !scrubbing && !openMenu && !contextMenu) setControlsVisible(false);
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        loop={loop}
        playsInline
        preload="auto"
        poster={poster || undefined}
        className="size-full object-contain"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={event => {
          const next = event.currentTarget.duration;
          if (Number.isFinite(next) && next > 0) setDuration(next);
        }}
        onTimeUpdate={event => {
          if (!scrubbing) setCurrentTime(tsOffset + event.currentTarget.currentTime);
        }}
        onProgress={handleProgress}
        onPlay={() => {
          setPlaying(true);
          scheduleHide(true);
        }}
        onPause={() => {
          setPlaying(false);
          clearTimeout(hideTimerRef.current);
          setControlsVisible(true);
        }}
        onEnded={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => {
          setLoadedKey(playbackKey);
          setBuffering(false);
        }}
        onCanPlay={() => {
          setLoadedKey(playbackKey);
          setBuffering(false);
        }}
        onVolumeChange={event => {
          setVolume(event.currentTarget.volume);
          setMuted(event.currentTarget.muted);
        }}
      />

      <div
        className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-[#080d18]/65 via-[#080d18]/25 to-transparent px-4 pt-3.5 pb-9 motion-safe:transition-opacity motion-safe:duration-200 ${showOverlay ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onPointerEnter={() => {
          dockHoverRef.current = true;
          clearTimeout(hideTimerRef.current);
          setControlsVisible(true);
        }}
        onPointerLeave={() => {
          dockHoverRef.current = false;
          scheduleHide();
        }}
      >
        <h2 id="preview-title" title={title}
          className={`min-w-0 truncate text-sm font-medium text-white drop-shadow-xs ${titleClass}`}>
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          {headerActions}
          {!fullscreen && onClose && (
            <button type="button" onClick={onClose} aria-label="ปิดพรีวิว" title="ปิด (Esc)" className={topCloseBtn}>
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {statsOpen && (
          <VideoStatsOverlay
            fileId={fileId}
            source={source}
            variants={variants}
            videoRef={videoRef}
            tsOffset={tsOffset}
            telemetryRef={telemetryRef}
            offsetTop={showOverlay}
            onClose={() => setStatsOpen(false)}
          />
        )}

        {toast && (
          <motion.div
            key="player-toast"
            role="status"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute top-14 left-1/2 z-30 -translate-x-1/2 rounded-full bg-panel/95 px-3 py-1 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm"
          >
            {toast}
          </motion.div>
        )}

        {contextMenu && (
          <motion.div
            key="context-menu"
            ref={contextMenuRef}
            role="menu"
            aria-label="เมนูตัวเล่นวิดีโอ"
            onClick={event => event.stopPropagation()}
            onContextMenu={event => {
              event.preventDefault();
              event.stopPropagation();
            }}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -2 }}
            transition={menuSpring}
            style={{ left: contextMenu.x, top: contextMenu.y, originX: 0, originY: 0 }}
            className="studio-dropdown absolute z-30 w-56 p-1.5"
          >
            <button type="button" role="menuitemcheckbox" aria-checked={loop} onClick={toggleLoop}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-xs text-foreground hover:bg-accent/10">
              <Repeat size={15} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="flex-1">เล่นซ้ำ</span>
              {loop && <Check size={14} className="shrink-0 text-accent-text" aria-hidden="true" />}
            </button>

            {pipSupported && (
              <button type="button" role="menuitem"
                onClick={() => { setContextMenu(null); togglePip(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-xs text-foreground hover:bg-accent/10">
                <PictureInPicture2 size={15} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="flex-1">ภาพซ้อนภาพ</span>
              </button>
            )}

            <button type="button" role="menuitem"
              onClick={() => { setContextMenu(null); toggleFullscreen(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-xs text-foreground hover:bg-accent/10">
              {fullscreen
                ? <Minimize size={15} className="shrink-0 text-muted" aria-hidden="true" />
                : <Maximize size={15} className="shrink-0 text-muted" aria-hidden="true" />}
              <span className="flex-1">{fullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}</span>
            </button>

            <div className="my-1 border-t border-border" role="separator" />

            {source?.url && !source.hls && fileId ? (
              <button type="button" role="menuitem"
                onClick={downloadCurrentVariant}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-xs text-foreground hover:bg-accent/10">
                <Download size={15} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">ดาวน์โหลดวิดีโอ ({shortQualityLabel(source)})</span>
              </button>
            ) : source?.url && (
              <button type="button" role="menuitem"
                onClick={() => { setContextMenu(null); copyText(source.url, "คัดลอก URL สตรีมแล้ว"); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-xs text-foreground hover:bg-accent/10">
                <Link2 size={15} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="flex-1">คัดลอก URL สตรีม</span>
              </button>
            )}

            {fileInfo && (
              <button type="button" role="menuitem"
                onClick={() => { setContextMenu(null); copyText(JSON.stringify(fileInfo, null, 2), "คัดลอกข้อมูล JSON แล้ว"); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-xs text-foreground hover:bg-accent/10">
                <Braces size={15} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="flex-1">คัดลอกข้อมูล JSON</span>
              </button>
            )}

            <div className="my-1 border-t border-border" role="separator" />

            <button type="button" role="menuitemcheckbox" aria-checked={statsOpen}
              onClick={() => { setContextMenu(null); setStatsOpen(prev => !prev); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-xs text-foreground hover:bg-accent/10">
              <Activity size={15} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="flex-1">สถิติสำหรับเด็กเนิร์ด</span>
              {statsOpen && <Check size={14} className="shrink-0 text-accent-text" aria-hidden="true" />}
            </button>
          </motion.div>
        )}

        {isLoading && !failed && (
          <motion.div
            key="loader"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: reducedMotion ? 0 : 0.16 }}
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            <span className="grid size-12 place-items-center rounded-full bg-panel/90 text-accent shadow-md backdrop-blur-sm">
              <LoaderCircle size={24} className="animate-spin" aria-hidden="true" />
            </span>
          </motion.div>
        )}

        {!playing && !isLoading && !failed && (
          <motion.button
            key="center-play"
            type="button"
            aria-label="เล่นวิดีโอ"
            onClick={togglePlay}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.84 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.16 }}
            whileHover={reducedMotion ? undefined : { scale: 1.07 }}
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            transition={reducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 460, damping: 30 }}
            className="absolute inset-0 m-auto grid size-14 place-items-center rounded-full bg-accent/90 text-white shadow-lg shadow-accent/30 backdrop-blur-sm hover:bg-accent"
          >
            <Play size={24} className="translate-x-0.5 fill-current" aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      {failed && errorMessage && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6">
          <div role="alert"
            onClick={event => event.stopPropagation()}
            className="pointer-events-auto max-w-md rounded-xl border border-warning/40 bg-panel/95 px-4 py-3 text-center text-sm text-warning shadow-lg backdrop-blur-sm">
            <p>{errorMessage}</p>
            {errorAction}
          </div>
        </div>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#080d18]/80 via-[#080d18]/40 to-transparent px-3 pt-9 pb-2.5 motion-safe:transition-opacity motion-safe:duration-200 ${showOverlay ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onPointerEnter={() => {
          dockHoverRef.current = true;
          clearTimeout(hideTimerRef.current);
          setControlsVisible(true);
        }}
        onPointerLeave={() => {
          dockHoverRef.current = false;
          scheduleHide();
        }}
      >
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="ตำแหน่งเวลาวิดีโอ"
          aria-valuemin={0}
          aria-valuemax={Math.floor(effectiveDuration)}
          aria-valuenow={Math.floor(activeTime)}
          aria-valuetext={`${formatTime(activeTime)} จาก ${formatTime(effectiveDuration)}`}
          className="group/seek relative mb-2 flex h-4 cursor-pointer touch-none items-center"
          onPointerDown={handleSeekPointerDown}
          onPointerMove={handleSeekPointerMove}
          onPointerUp={handleSeekPointerUp}
          onPointerCancel={handleSeekPointerUp}
          onPointerLeave={() => { if (!scrubbing) setHoverSeek(null); }}
          onKeyDown={event => {
            if (event.key === "ArrowLeft") { event.preventDefault(); event.stopPropagation(); seekBy(-5); }
            else if (event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); seekBy(5); }
          }}
        >
          {hoverSeek && effectiveDuration > 0 && (
            <span
              style={{ left: `clamp(24px, ${hoverSeek.percent}%, calc(100% - 24px))` }}
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md border border-border bg-panel/95 px-1.5 py-0.5 text-[11px] font-medium text-foreground tabular-nums shadow-md backdrop-blur-sm"
            >
              {formatTime(hoverSeek.time)}
            </span>
          )}
          <div className="relative h-1 w-full rounded-full bg-white/25 motion-safe:transition-[height] group-hover/seek:h-1.5">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/40"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-accent"
              style={{ width: `${playedPercent}%` }}
            />
            <span
              className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-accent motion-safe:transition-transform ${scrubbing ? "scale-110" : "scale-0 group-hover/seek:scale-100"}`}
              style={{ left: `${playedPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            <button type="button" className={controlBtn} onClick={togglePlay}
              aria-label={playing ? "หยุดชั่วคราว" : "เล่น"} title={playing ? "หยุดชั่วคราว (Space)" : "เล่น (Space)"}>
              {playing ? <Pause size={18} className="fill-current" aria-hidden="true" /> :
                <Play size={18} className="translate-x-0.5 fill-current" aria-hidden="true" />}
            </button>
            <button type="button" className={controlBtn} onClick={() => seekBy(-10)}
              aria-label="ย้อนกลับ 10 วินาที" title="ย้อนกลับ 10 วิ (J)">
              <RotateCcw size={16} aria-hidden="true" />
            </button>
            <button type="button" className={controlBtn} onClick={() => seekBy(10)}
              aria-label="ข้ามไปข้างหน้า 10 วินาที" title="ข้าม 10 วิ (L)">
              <RotateCw size={16} aria-hidden="true" />
            </button>

            <div className="flex items-center gap-1">
              <button type="button" className={controlBtn} onClick={toggleMute}
                aria-label={displayVolume === 0 ? "เปิดเสียง" : "ปิดเสียง"} title="ปิด/เปิดเสียง (M)">
                <VolumeIcon size={18} aria-hidden="true" />
              </button>
              <div
                ref={volumeTrackRef}
                role="slider"
                tabIndex={0}
                aria-label="ระดับเสียง"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(displayVolume * 100)}
                className="group/vol hidden h-6 w-16 cursor-pointer touch-none items-center sm:flex"
                onPointerDown={handleVolumePointerDown}
                onPointerMove={handleVolumePointerMove}
                onPointerUp={() => setVolumeDragging(false)}
                onPointerCancel={() => setVolumeDragging(false)}
                onKeyDown={event => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                    event.preventDefault(); event.stopPropagation(); applyVolume(displayVolume - 0.1);
                  } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                    event.preventDefault(); event.stopPropagation(); applyVolume(displayVolume + 0.1);
                  }
                }}
              >
                <div className="relative h-1 w-full rounded-full bg-white/30">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-accent"
                    style={{ width: `${displayVolume * 100}%` }} />
                  <span
                    className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                    style={{ left: `${displayVolume * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <span className="ml-1.5 truncate text-xs text-white/90 tabular-nums">
              {formatTime(activeTime)} <span className="text-white/50">/</span> {formatTime(effectiveDuration)}
            </span>
          </div>

          <div ref={menuRef} className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <div className="relative">
              <button
                type="button"
                className={`${pillBtn} ${rate !== 1 ? "bg-accent/25 text-white" : ""}`}
                aria-haspopup="menu"
                aria-expanded={openMenu === "speed"}
                title="ความเร็วในการเล่น"
                onClick={() => setOpenMenu(prev => prev === "speed" ? null : "speed")}
              >
                <span className="tabular-nums">{rate}x</span>
              </button>

              <AnimatePresence>
                {openMenu === "speed" && (
                  <motion.div
                    key="speed-menu"
                    role="menu"
                    aria-label="ความเร็วในการเล่น"
                    initial={reducedMotion ? { opacity: 0, x: "-50%" } : { opacity: 0, scale: 0.94, x: "-50%", y: 6 }}
                    animate={{ opacity: 1, scale: 1, x: "-50%", y: 0 }}
                    exit={reducedMotion ? { opacity: 0, x: "-50%" } : { opacity: 0, scale: 0.96, x: "-50%", y: 4 }}
                    transition={menuSpring}
                    style={{ originY: 1 }}
                    className="studio-dropdown absolute bottom-full left-1/2 z-20 mb-2 min-w-30"
                  >
                    {SPEEDS.map(option => (
                      <button key={option} type="button" role="menuitemradio" aria-checked={rate === option}
                        onClick={() => changeRate(option)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-accent/10 ${rate === option ? "bg-accent/15 font-medium text-accent-text" : "text-foreground"}`}>
                        <Check size={13} className={rate === option ? "shrink-0" : "invisible shrink-0"} aria-hidden="true" />
                        <span className="tabular-nums">{option === 1 ? "ปกติ (1x)" : `${option}x`}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {variants.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  className={pillBtn}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "quality"}
                  title="ความละเอียดวิดีโอ"
                  onClick={() => setOpenMenu(prev => prev === "quality" ? null : "quality")}
                >
                  <SlidersHorizontal size={14} aria-hidden="true" />
                  <span>{shortQualityLabel(source)}</span>
                </button>

                <AnimatePresence>
                  {openMenu === "quality" && (
                    <motion.div
                      key="quality-menu"
                      role="menu"
                      aria-label="ความละเอียดวิดีโอ"
                      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 4 }}
                      transition={menuSpring}
                      style={{ originX: 1, originY: 1 }}
                      className="studio-dropdown absolute right-0 bottom-full z-20 mb-2 max-h-56 min-w-52 max-w-[calc(100vw-2.5rem)] overflow-y-auto"
                    >
                      {variants.map((variant, index) => (
                        <button key={variant.url} type="button" role="menuitemradio" aria-checked={index === selected}
                          onClick={() => changeQuality(index)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs hover:bg-accent/10 ${index === selected ? "bg-accent/15 font-medium text-accent-text" : "text-foreground"}`}>
                          <Check size={13} className={index === selected ? "shrink-0" : "invisible shrink-0"} aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{variant.label}</span>
                          {variant.detail && <span className="shrink-0 text-[11px] text-muted tabular-nums">{variant.detail}</span>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {pipSupported && (
              <button type="button" className={controlBtn} onClick={togglePip}
                aria-label="หน้าต่างลอย (Picture-in-Picture)" title="Picture-in-Picture">
                <PictureInPicture2 size={16} aria-hidden="true" />
              </button>
            )}

            <button type="button" className={controlBtn} onClick={toggleFullscreen}
              aria-label={fullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"} title={fullscreen ? "ออกจากเต็มจอ (F)" : "เต็มจอ (F)"}>
              {fullscreen ? <Minimize size={17} aria-hidden="true" /> : <Maximize size={17} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
