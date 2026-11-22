"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Braces,
  Check,
  ChevronDown,
  Clock,
  Download,
  FastForward,
  Link2,
  LoaderCircle,
  Lock,
  Maximize,
  Minimize,
  MoreVertical,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Rewind,
  RotateCcw,
  RotateCw,
  Settings,
  SlidersHorizontal,
  Unlock,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { catalogFontClass, formatDuration, formatExpiryInfo, formatFileSize, resolutionLabel } from "@/lib/catalog";
import { Thumbnail } from "./Thumbnail";
import { VideoStatsOverlay } from "./VideoStatsOverlay";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const TS_PACKET = 188;
const DOUBLE_TAP_MS = 320;
const HOLD_2X_MS = 450;
const subscribeNoop = () => () => {};

const controlBtn =
  "grid size-10 sm:size-8 shrink-0 place-items-center rounded-lg text-white/90 active:bg-white/20 hover:bg-white/15 hover:text-white touch-manipulation";
const pillBtn =
  "inline-flex h-10 sm:h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-2 text-xs font-medium text-white/90 active:bg-white/20 hover:bg-white/15 hover:text-white aria-expanded:bg-accent aria-expanded:text-white touch-manipulation";
const topCloseBtn =
  "grid size-10 sm:size-8 shrink-0 place-items-center rounded-lg bg-panel/90 text-muted shadow-sm backdrop-blur-sm active:bg-panel hover:bg-panel hover:text-foreground touch-manipulation";

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
  if (variant.original || /\boriginal\b|ต้นฉบับ/i.test(variant.label ?? "")) {
    return /สตรีม/i.test(variant.label ?? "") ? "ต้นฉบับ (สตรีม)" : "ต้นฉบับ";
  }
  const fromDim = resolutionLabel(variant.width, variant.height);
  if (fromDim) return fromDim;
  const match = variant.label?.match(/\b(\d{3,4}p|[248]K)\b/i)?.[1];
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
  loading = false,
  variants,
  selected,
  onSelectQuality,
  siblings = [],
  onSelectSibling,
  minimized = false,
  onMinimize,
  onRestore,
  currentIndex = 0,
  totalSiblings = 1,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
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
  const mobileSheetRef = useRef(null);
  const contextMenuRef = useRef(null);
  const dockHoverRef = useRef(false);
  const hideTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const playbackRef = useRef(null);
  const initialAutoPlayRef = useRef(true);
  const wakeLockRef = useRef(null);
  const lastTouchTapRef = useRef({ time: 0, side: null });
  const lastTouchUpTimeRef = useRef(0);
  const mouseClickTimerRef = useRef(null);
  const rippleTimerRef = useRef(null);
  const holdTimerRef = useRef(null);
  const holdActiveRef = useRef(false);
  const prevRateBeforeHoldRef = useRef(1);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

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
  const [holding2x, setHolding2x] = useState(false);
  const [loop, setLoop] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(null);
  const [hoverSeek, setHoverSeek] = useState(null);
  const [volumeDragging, setVolumeDragging] = useState(false);
  const [seekRipple, setSeekRipple] = useState(null);
  const [now, setNow] = useState(null);

  useEffect(() => {
    const sync = () => setNow(Date.now());
    const init = setTimeout(sync, 0);
    const interval = setInterval(sync, 60_000);
    return () => {
      clearTimeout(init);
      clearInterval(interval);
    };
  }, []);

  // Reset playback state smoothly inside the persistent player whenever switching to another video
  const [trackedFileId, setTrackedFileId] = useState(fileId);
  if (trackedFileId !== fileId) {
    setTrackedFileId(fileId);
    setTsSession({ offsetSec: 0, byteOffset: 0, seq: 0 });
    setPlaying(false);
    setBuffering(false);
    setLoadedKey(null);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setOpenMenu(null);
    setContextMenu(null);
    setScrubbing(false);
    setScrubTime(null);
    setHoverSeek(null);
    setControlsVisible(true);
  }

  useEffect(() => {
    playbackRef.current = null;
    initialAutoPlayRef.current = true;
  }, [fileId]);

  const isMpegts = Boolean(source?.mpegts);
  const tsOffset = isMpegts ? tsSession.offsetSec : 0;
  const tsByteOffset = isMpegts ? tsSession.byteOffset : 0;
  const tsSeq = isMpegts ? tsSession.seq : 0;
  const playbackKey = `${source?.url ?? ""}:${tsSeq}`;
  const effectiveDuration = isMpegts ? (source?.duration || duration) : (duration || source?.duration || 0);

  const pipSupported = useSyncExternalStore(
    subscribeNoop,
    () => Boolean(
      typeof document !== "undefined" &&
      (document.pictureInPictureEnabled ||
        typeof HTMLVideoElement !== "undefined" &&
        typeof HTMLVideoElement.prototype.webkitSetPresentationMode === "function"),
    ),
    () => false,
  );
  const reducedMotion = useReducedMotion();
  const menuSpring = reducedMotion
    ? { duration: 0.08 }
    : { type: "spring", stiffness: 520, damping: 34, mass: 0.7 };

  useEffect(() => {
    stageRef.current?.focus({ preventScroll: true });
  }, []);

  // Screen Wake Lock API: keep mobile screen awake while video is playing
  useEffect(() => {
    let cancelled = false;
    async function acquireWakeLock() {
      if (!playing || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        wakeLockRef.current = sentinel;
      } catch {
        // Ignore wakeLock errors on low-battery or unsupported browsers
      }
    }

    if (playing) {
      acquireWakeLock();
    } else if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && playing) {
        acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [playing]);

  // Media Session API: mobile lock-screen / notification bar metadata & hardware buttons
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || "PikPak Studio",
        artist: "PikPak Studio",
        artwork: poster ? [{ src: poster }] : [],
      });
      navigator.mediaSession.setActionHandler("play", () => {
        videoRef.current?.play().catch(() => {});
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        videoRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler("seekbackward", details => {
        seekBy(-(details?.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", details => {
        seekBy(details?.seekOffset || 10);
      });
      navigator.mediaSession.setActionHandler("seekto", details => {
        if (typeof details?.seekTime === "number") seekTo(details.seekTime);
      });
    } catch {
      // Ignore unsupported mediaSession action handlers
    }
    return () => {
      if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
      for (const action of ["play", "pause", "seekbackward", "seekforward", "seekto"]) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {}
      }
    };
  });

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
    const player = videoRef.current;
    function onFullscreenChange() {
      const isStageFs =
        document.fullscreenElement === stageRef.current ||
        document.webkitFullscreenElement === stageRef.current ||
        Boolean(player?.webkitDisplayingFullscreen);
      setFullscreen(isStageFs);
      if (!isStageFs) {
        try {
          screen.orientation?.unlock?.();
        } catch {}
      }
    }
    function onWebkitBegin() {
      setFullscreen(true);
    }
    function onWebkitEnd() {
      setFullscreen(false);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    player?.addEventListener("webkitbeginfullscreen", onWebkitBegin);
    player?.addEventListener("webkitendfullscreen", onWebkitEnd);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      player?.removeEventListener("webkitbeginfullscreen", onWebkitBegin);
      player?.removeEventListener("webkitendfullscreen", onWebkitEnd);
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    function closeOutside(event) {
      if (
        !menuRef.current?.contains(event.target) &&
        !mobileSheetRef.current?.contains(event.target) &&
        !event.target.closest?.("[data-player-menu-trigger]")
      ) {
        setOpenMenu(null);
      }
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
    clearTimeout(rippleTimerRef.current);
    clearTimeout(holdTimerRef.current);
    clearTimeout(mouseClickTimerRef.current);
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
    setOpenMenu(null);
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
    setOpenMenu(null);
    showToast(next ? "เปิดเล่นซ้ำแล้ว" : "ปิดเล่นซ้ำแล้ว");
  }

  function handleContextMenu(event) {
    if (event.shiftKey) return;
    // Ignore synthetic long-press context menu when holding for 2x speed on touch
    if (holdActiveRef.current || locked) {
      event.preventDefault();
      return;
    }
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
    }, 2800);
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

  function triggerDoubleTapSeek(side) {
    const delta = side === "left" ? -10 : 10;
    seekBy(delta);
    setSeekRipple(prev => {
      const accumulated = prev && prev.side === side ? prev.seconds + 10 : 10;
      return { side, seconds: accumulated, key: Date.now() };
    });
    clearTimeout(rippleTimerRef.current);
    rippleTimerRef.current = setTimeout(() => setSeekRipple(null), 650);
  }

  function startHold2x() {
    const player = videoRef.current;
    if (!player || player.paused || locked) return;
    holdActiveRef.current = true;
    prevRateBeforeHoldRef.current = rate;
    player.playbackRate = 2;
    setHolding2x(true);
  }

  function stopHold2x() {
    clearTimeout(holdTimerRef.current);
    if (!holdActiveRef.current) return;
    holdActiveRef.current = false;
    const player = videoRef.current;
    if (player) player.playbackRate = prevRateBeforeHoldRef.current;
    setHolding2x(false);
  }

  function handleVideoPointerDown(event) {
    if (event.pointerType !== "touch") return;
    touchStartPosRef.current = { x: event.clientX, y: event.clientY };
    clearTimeout(holdTimerRef.current);
    if (playing && !locked && !openMenu && !contextMenu) {
      holdTimerRef.current = setTimeout(startHold2x, HOLD_2X_MS);
    }
  }

  function handleVideoPointerMove(event) {
    if (event.pointerType === "touch") {
      const dx = Math.abs(event.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(event.clientY - touchStartPosRef.current.y);
      if (dx > 14 || dy > 14) {
        clearTimeout(holdTimerRef.current);
      }
      return;
    }
    scheduleHide();
  }

  function handleVideoPointerUp(event) {
    if (event.pointerType !== "touch") return;
    lastTouchUpTimeRef.current = performance.now();
    const wasHolding2x = holdActiveRef.current;
    stopHold2x();
    if (wasHolding2x) {
      event.preventDefault();
      return;
    }

    if (openMenu || contextMenu) {
      setOpenMenu(null);
      setContextMenu(null);
      return;
    }

    if (locked) {
      setControlsVisible(prev => !prev);
      if (!controlsVisible) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
      }
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    const dx = event.clientX - touchStartPosRef.current.x;
    const dy = event.clientY - touchStartPosRef.current.y;
    if (!fullscreen) {
      // Swipe left / right to switch to next / previous video in the same folder
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0 && hasNext && typeof onNext === "function") {
          onNext();
          return;
        }
        if (dx > 0 && hasPrev && typeof onPrev === "function") {
          onPrev();
          return;
        }
      }
      // Swipe down to minimize into floating Mini Player (or close if minimize unavailable)
      if (dy > 76 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        if (typeof onMinimize === "function") {
          setOpenMenu(null);
          onMinimize();
          return;
        }
        if (typeof onClose === "function") {
          onClose();
          return;
        }
      }
    }

    const rect = stage.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / Math.max(1, rect.width);
    const side = relX < 0.36 ? "left" : relX > 0.64 ? "right" : "center";
    const now = performance.now();
    const last = lastTouchTapRef.current;

    if (side !== "center" && now - last.time <= DOUBLE_TAP_MS && last.side === side) {
      lastTouchTapRef.current = { time: now, side };
      triggerDoubleTapSeek(side);
      return;
    }

    lastTouchTapRef.current = { time: now, side };
    // Single tap on mobile toggles controls overlay cleanly (YouTube/Netflix mobile behavior)
    if (controlsVisible && playing) {
      clearTimeout(hideTimerRef.current);
      setControlsVisible(false);
    } else {
      scheduleHide(playing);
    }
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
    prevRateBeforeHoldRef.current = nextRate;
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
    if (!player) return;
    setOpenMenu(null);
    setContextMenu(null);
    try {
      if (document.pictureInPictureElement === player) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && typeof player.requestPictureInPicture === "function") {
        await player.requestPictureInPicture();
      } else if (typeof player.webkitSetPresentationMode === "function") {
        const mode = player.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture";
        player.webkitSetPresentationMode(mode);
      }
    } catch {
      // Ignore user-cancelled or unsupported PiP errors.
    }
  }

  async function toggleFullscreen() {
    const stage = stageRef.current;
    const player = videoRef.current;
    if (!stage) return;
    setOpenMenu(null);
    setContextMenu(null);
    try {
      const isFs =
        document.fullscreenElement === stage ||
        document.webkitFullscreenElement === stage ||
        Boolean(player?.webkitDisplayingFullscreen);

      if (isFs) {
        if (document.exitFullscreen && document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen && document.webkitFullscreenElement) {
          document.webkitExitFullscreen();
        } else if (typeof player?.webkitExitFullscreen === "function") {
          player.webkitExitFullscreen();
        }
        try {
          screen.orientation?.unlock?.();
        } catch {}
      } else {
        if (typeof stage.requestFullscreen === "function") {
          await stage.requestFullscreen();
        } else if (typeof stage.webkitRequestFullscreen === "function") {
          stage.webkitRequestFullscreen();
        } else if (typeof player?.webkitEnterFullscreen === "function") {
          // iOS Safari iPhone native video fullscreen fallback
          player.webkitEnterFullscreen();
        }
        // Auto-lock to landscape on mobile when video is widescreen
        const vw = player?.videoWidth || source?.width || 16;
        const vh = player?.videoHeight || source?.height || 9;
        if (vw >= vh) {
          try {
            await screen.orientation?.lock?.("landscape");
          } catch {}
        }
      }
    } catch {
      // Fall back to iOS native fullscreen if container requestFullscreen rejected
      try {
        if (typeof player?.webkitEnterFullscreen === "function") {
          player.webkitEnterFullscreen();
        }
      } catch {}
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
    if (!trackRef.current || effectiveDuration <= 0 || locked) return;
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
    if (!trackRef.current || effectiveDuration <= 0 || locked) return;
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
    setHoverSeek(null);
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
    if (locked) return;
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

  const loadingSource = loading || (Boolean(source) && loadedKey !== playbackKey && !failed);
  const isLoading = loadingSource || buffering;
  const showOverlay = (!playing || controlsVisible || scrubbing || openMenu !== null || contextMenu !== null || failed) && !holding2x;
  const activeTime = scrubbing && scrubTime !== null ? scrubTime : currentTime;
  const playedPercent = effectiveDuration > 0 ? Math.min(100, (activeTime / effectiveDuration) * 100) : 0;
  const bufferedPercent = effectiveDuration > 0 ? Math.min(100, (buffered / effectiveDuration) * 100) : 0;
  const displayVolume = muted ? 0 : volume;
  const VolumeIcon = displayVolume === 0 ? VolumeX : displayVolume < 0.5 ? Volume1 : Volume2;

  const otherVideos = siblings.filter(entry => entry.id !== fileId);
  const activeSizeLabel = formatFileSize(fileInfo?.size || source?.size);
  const activeExpiry = formatExpiryInfo(source?.expiresAt, now);

  return (
    <div
      className={
        minimized
          ? "relative flex w-full items-center gap-2.5 bg-panel px-2.5 py-2 text-foreground"
          : fullscreen
            ? "size-full bg-[#080d18]"
            : "flex size-full flex-col bg-background text-foreground mobile-landscape:bg-[#080d18] desktop:block desktop:size-auto desktop:bg-[#080d18]"
      }
    >
      <div
        ref={stageRef}
        tabIndex={-1}
        role="region"
        aria-label="ตัวเล่นวิดีโอ"
        className={
          minimized
            ? "relative h-12 w-21 shrink-0 overflow-hidden rounded-lg bg-[#080d18]"
            : `group/player relative flex shrink-0 items-center justify-center overflow-hidden bg-[#080d18] select-none touch-manipulation focus:outline-none! ${
                fullscreen
                  ? "size-full"
                  : "aspect-video max-h-dvh w-full mobile-landscape:aspect-auto mobile-landscape:size-full desktop:max-h-[calc(100dvh-32px)]"
              }`
        }
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        onPointerMove={handleVideoPointerMove}
        onPointerLeave={event => {
          if (event.pointerType === "touch") return;
          if (playing && !scrubbing && !openMenu && !contextMenu) setControlsVisible(false);
        }}
        onClick={minimized ? onRestore : undefined}
      >
      <video
        ref={videoRef}
        autoPlay
        loop={loop}
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        preload="auto"
        poster={poster || undefined}
        className="size-full object-contain"
        onPointerDown={handleVideoPointerDown}
        onPointerUp={handleVideoPointerUp}
        onPointerCancel={stopHold2x}
        onClick={event => {
          // Ignore synthetic click after a touch interaction
          if (
            event.nativeEvent.pointerType === "touch" ||
            performance.now() - lastTouchUpTimeRef.current < 550
          ) {
            return;
          }
          if (locked) {
            setControlsVisible(true);
            return;
          }
          const stage = stageRef.current;
          const rect = stage?.getBoundingClientRect();
          const relX = rect ? (event.clientX - rect.left) / Math.max(1, rect.width) : 0.5;
          if (relX < 0.36 || relX > 0.64) {
            clearTimeout(mouseClickTimerRef.current);
            mouseClickTimerRef.current = setTimeout(() => {
              togglePlay();
            }, 220);
            return;
          }
          togglePlay();
        }}
        onDoubleClick={event => {
          if (
            event.nativeEvent.pointerType === "touch" ||
            performance.now() - lastTouchUpTimeRef.current < 550 ||
            locked
          ) {
            return;
          }
          clearTimeout(mouseClickTimerRef.current);
          const stage = stageRef.current;
          if (!stage) return;
          const rect = stage.getBoundingClientRect();
          const relX = (event.clientX - rect.left) / Math.max(1, rect.width);
          // Double-click on left/right edges seeks -10s / +10s; center toggles fullscreen
          if (relX < 0.36) {
            triggerDoubleTapSeek("left");
          } else if (relX > 0.64) {
            triggerDoubleTapSeek("right");
          } else {
            toggleFullscreen();
          }
        }}
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
          stopHold2x();
          clearTimeout(hideTimerRef.current);
          setControlsVisible(true);
        }}
        onEnded={() => {
          setPlaying(false);
          stopHold2x();
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

      {/* Top Header Bar (respects safe-area insets in fullscreen mobile landscape) */}
      {!locked && !minimized && (
        <div
          className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2.5 bg-gradient-to-b from-[#080d18]/75 via-[#080d18]/30 to-transparent px-3 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] motion-safe:transition-opacity motion-safe:duration-200 ${
            showOverlay ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onPointerEnter={event => {
            if (event.pointerType === "touch") return;
            dockHoverRef.current = true;
            clearTimeout(hideTimerRef.current);
            setControlsVisible(true);
          }}
          onPointerLeave={event => {
            if (event.pointerType === "touch") return;
            dockHoverRef.current = false;
            scheduleHide();
          }}
        >
          {/* Mobile Header (matches mockup: [v] [合集1.mp4] ... [Settings Gear]) — works in BOTH portrait & landscape phones */}
          <div className="flex w-full items-center justify-between gap-2 desktop:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {!fullscreen && (onMinimize || onClose) && (
                <button
                  type="button"
                  onClick={onMinimize ?? onClose}
                  aria-label={onMinimize ? "ย่อเป็น Mini Player" : "ปิดพรีวิว"}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-white/95 active:bg-white/15"
                >
                  <ChevronDown size={22} aria-hidden="true" />
                </button>
              )}
              <span className={`truncate text-xs font-semibold text-white drop-shadow-xs ${titleClass}`}>
                {title}
              </span>
            </div>

            <button
              type="button"
              data-player-menu-trigger=""
              onClick={() => setOpenMenu(prev => prev === "more" ? null : "more")}
              aria-label="ตั้งค่าการเล่น"
              aria-expanded={openMenu === "more"}
              className="grid size-9 shrink-0 place-items-center rounded-full text-white/95 active:bg-white/15"
            >
              <Settings size={19} aria-hidden="true" />
            </button>
          </div>

          {/* Desktop Header (desktop breakpoint only — unchanged) */}
          <h2
            id="preview-title"
            title={title}
            className={`hidden desktop:block min-w-0 truncate text-sm font-medium text-white drop-shadow-xs ${titleClass}`}
          >
            {title}
          </h2>
          <div className="hidden desktop:flex shrink-0 items-center gap-1.5">
            {headerActions}
            {!fullscreen && onClose && (
              <button type="button" onClick={onClose} aria-label="ปิดพรีวิว" title="ปิด (Esc)" className={topCloseBtn}>
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Screen Lock Floating Pill (Mobile / Touch protection) */}
      {locked && showOverlay && (
        <div className="absolute top-[max(0.85rem,env(safe-area-inset-top))] left-1/2 z-30 -translate-x-1/2">
          <button
            type="button"
            onClick={() => {
              setLocked(false);
              showToast("ปลดล็อกหน้าจอแล้ว");
              scheduleHide(playing);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-[#080d18]/85 px-4 text-xs font-medium text-white shadow-lg backdrop-blur-md active:scale-95"
          >
            <Unlock size={15} className="text-accent-text" aria-hidden="true" />
            <span>แตะเพื่อปลดล็อกหน้าจอ</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {statsOpen && (
          <VideoStatsOverlay
            fileId={fileId}
            source={source}
            variants={variants}
            videoRef={videoRef}
            tsOffset={tsOffset}
            telemetryRef={telemetryRef}
            offsetTop={showOverlay && !locked}
            onClose={() => setStatsOpen(false)}
          />
        )}

        {/* Hold-for-2x Speed Pill */}
        {holding2x && (
          <motion.div
            key="hold-2x-pill"
            role="status"
            initial={{ opacity: 0, y: -8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.92 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute top-[max(1rem,env(safe-area-inset-top))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#080d18]/85 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md"
          >
            <span>เล่นความเร็ว 2x</span>
            <FastForward size={14} className="fill-current text-accent-text" aria-hidden="true" />
          </motion.div>
        )}

        {/* Double-Tap Seek Ripple Feedback (Left -10s / Right +10s) */}
        {seekRipple && (
          <motion.div
            key={seekRipple.key}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 0.22 }}
            className={`pointer-events-none absolute inset-y-0 z-20 flex w-[38%] flex-col items-center justify-center gap-1.5 bg-white/10 text-white backdrop-blur-[2px] ${
              seekRipple.side === "left"
                ? "left-0 rounded-r-[45%]"
                : "right-0 rounded-l-[45%]"
            }`}
          >
            <span className="grid size-12 place-items-center rounded-full bg-[#080d18]/65 shadow-md">
              {seekRipple.side === "left" ? (
                <Rewind size={22} className="fill-current" />
              ) : (
                <FastForward size={22} className="fill-current" />
              )}
            </span>
            <span className="text-xs font-semibold tracking-wide drop-shadow">
              {seekRipple.side === "left" ? `-${seekRipple.seconds} วินาที` : `+${seekRipple.seconds} วินาที`}
            </span>
          </motion.div>
        )}

        {toast && (
          <motion.div
            key="player-toast"
            role="status"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute top-14 left-1/2 z-30 -translate-x-1/2 rounded-full bg-panel/95 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm"
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
                onClick={togglePip}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-xs text-foreground hover:bg-accent/10">
                <PictureInPicture2 size={15} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="flex-1">ภาพซ้อนภาพ</span>
              </button>
            )}

            <button type="button" role="menuitem"
              onClick={toggleFullscreen}
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

        {/* Center Transport Controls (clean single Play/Pause circle like mockup; double-tap edges still seek ±10s) */}
        {!isLoading && !failed && !locked && !minimized && showOverlay && (
          <motion.div
            key="center-transport"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <button
              type="button"
              aria-label={playing ? "หยุดชั่วคราว" : "เล่นวิดีโอ"}
              onClick={togglePlay}
              className={`pointer-events-auto grid size-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/35 ring-8 ring-white/10 backdrop-blur-sm active:scale-95 hover:bg-accent/90 ${
                playing ? "desktop:hidden" : ""
              }`}
            >
              {playing ? (
                <Pause size={24} className="fill-current" aria-hidden="true" />
              ) : (
                <Play size={24} className="translate-x-0.5 fill-current" aria-hidden="true" />
              )}
            </button>
          </motion.div>
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

      {/* Bottom Control Dock (safe-area aware for iPhone home indicator & notched landscape) */}
      {!locked && !minimized && (
        <div
          ref={menuRef}
          className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#080d18]/85 via-[#080d18]/45 to-transparent px-3 pt-9 pb-[max(0.625rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] motion-safe:transition-opacity motion-safe:duration-200 ${
            showOverlay ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onPointerEnter={event => {
            if (event.pointerType === "touch") return;
            dockHoverRef.current = true;
            clearTimeout(hideTimerRef.current);
            setControlsVisible(true);
          }}
          onPointerLeave={event => {
            if (event.pointerType === "touch") return;
            dockHoverRef.current = false;
            scheduleHide();
          }}
        >
          {/* Mobile Compact Single-Line Bottom Bar (portrait & landscape phones): [0:05] [Seek Bar] [39:24] [Fullscreen] */}
          <div className="flex items-center gap-2.5 desktop:hidden">
            <span className="shrink-0 text-xs font-medium text-white/95 tabular-nums">
              {formatTime(activeTime)}
            </span>

            <div
              role="slider"
              tabIndex={0}
              aria-label="ตำแหน่งเวลาวิดีโอ"
              aria-valuemin={0}
              aria-valuemax={Math.floor(effectiveDuration)}
              aria-valuenow={Math.floor(activeTime)}
              aria-valuetext={`${formatTime(activeTime)} จาก ${formatTime(effectiveDuration)}`}
              className="group/seek relative flex h-8 flex-1 cursor-pointer touch-none items-center"
              onPointerDown={event => {
                if (effectiveDuration <= 0 || locked) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                const ratio = ratioFromPointer(event, event.currentTarget);
                const nextTime = ratio * effectiveDuration;
                setScrubbing(true);
                setScrubTime(nextTime);
                setHoverSeek({ percent: ratio * 100, time: nextTime });
                if (!isMpegts && videoRef.current) {
                  videoRef.current.currentTime = nextTime;
                } else if (isMpegts && videoRef.current && isInBufferedRange(videoRef.current, nextTime - tsOffset)) {
                  videoRef.current.currentTime = nextTime - tsOffset;
                }
              }}
              onPointerMove={event => {
                if (effectiveDuration <= 0 || locked) return;
                const ratio = ratioFromPointer(event, event.currentTarget);
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
              }}
              onPointerUp={handleSeekPointerUp}
              onPointerCancel={handleSeekPointerUp}
              onPointerLeave={() => { if (!scrubbing) setHoverSeek(null); }}
            >
              {hoverSeek && scrubbing && effectiveDuration > 0 && (
                <span
                  style={{ left: `clamp(24px, ${hoverSeek.percent}%, calc(100% - 24px))` }}
                  className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md border border-border bg-panel/95 px-2 py-0.5 text-[11px] font-medium text-foreground tabular-nums shadow-md backdrop-blur-sm"
                >
                  {formatTime(hoverSeek.time)}
                </span>
              )}
              <div className="relative h-1 w-full rounded-full bg-white/25">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/40"
                  style={{ width: `${bufferedPercent}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white"
                  style={{ width: `${playedPercent}%` }}
                />
                <span
                  className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow motion-safe:transition-transform ${
                    scrubbing ? "scale-125 ring-2 ring-accent" : "scale-100"
                  }`}
                  style={{ left: `${playedPercent}%` }}
                />
              </div>
            </div>

            <span className="shrink-0 text-xs font-medium text-white/95 tabular-nums">
              {formatTime(effectiveDuration)}
            </span>

            <button
              type="button"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-white/90 active:bg-white/20"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}
            >
              {fullscreen ? <Minimize size={17} aria-hidden="true" /> : <Maximize size={17} aria-hidden="true" />}
            </button>
          </div>

          {/* Desktop Seek Bar & Control Bar (desktop only — unchanged) */}
          <div className="hidden desktop:block">
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
                  style={{ left: `clamp(28px, ${hoverSeek.percent}%, calc(100% - 28px))` }}
                  className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md border border-border bg-panel/95 px-2 py-0.5 text-[11px] font-medium text-foreground tabular-nums shadow-md backdrop-blur-sm"
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
                  className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-accent motion-safe:transition-transform ${
                    scrubbing ? "scale-125" : "scale-0 group-hover/seek:scale-100"
                  }`}
                  style={{ left: `${playedPercent}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
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
                    className="group/vol flex h-6 w-16 cursor-pointer touch-none items-center"
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

              <div className="flex shrink-0 items-center gap-1">
                {/* Speed Selector */}
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
                        className="studio-dropdown absolute bottom-full left-1/2 z-20 mb-2 min-w-32"
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

                {/* Quality Selector */}
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
                          className="studio-dropdown absolute right-0 bottom-full z-20 mb-2 max-h-56 min-w-52 max-w-[calc(100vw-2rem)] overflow-y-auto"
                        >
                          {variants.map((variant, index) => (
                            <button key={variant.url} type="button" role="menuitemradio" aria-checked={index === selected}
                              onClick={() => changeQuality(index)}
                              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs hover:bg-accent/10 ${index === selected ? "bg-accent/15 font-medium text-accent-text" : "text-foreground"}`}>
                              <Check size={13} className={index === selected ? "shrink-0" : "invisible shrink-0"} aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate">
                                {variant.original || /\boriginal\b/i.test(variant.label ?? "")
                                  ? (/สตรีม/i.test(variant.label ?? "") ? "ต้นฉบับ (สตรีม)" : "ต้นฉบับ")
                                  : variant.label}
                              </span>
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
      )}
      </div>

      {/* Mini Player Controls Bar (visible only when minimized on mobile — matches right side of mockup) */}
      {minimized && (
        <>
          <button
            type="button"
            onClick={onRestore}
            className="min-w-0 flex-1 text-start"
          >
            <p className={`truncate text-xs font-semibold text-foreground ${titleClass}`}>{title}</p>
            <p className="mt-0.5 text-[11px] text-muted tabular-nums">
              {formatTime(activeTime)} / {formatTime(effectiveDuration)}
            </p>
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "หยุดชั่วคราว" : "เล่น"}
            className="grid size-9 shrink-0 place-items-center rounded-full text-foreground active:bg-foreground/10"
          >
            {playing ? <Pause size={18} className="fill-current" aria-hidden="true" /> : <Play size={18} className="translate-x-0.5 fill-current" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดตัวเล่น"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted active:bg-foreground/10"
          >
            <X size={18} aria-hidden="true" />
          </button>

          {/* Thin progress indicator along the bottom edge of the mini player */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-border/60">
            <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${playedPercent}%` }} />
          </div>
        </>
      )}

      {/* Mobile Watch-Page Below Video (portrait phones only — hidden in mobile landscape so video fills 100% of screen!) */}
      {!fullscreen && !minimized && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-background px-3.5 pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] mobile-landscape:hidden desktop:hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className={`line-clamp-2 text-[0.98rem] leading-snug font-semibold text-foreground ${titleClass}`} title={title}>
                {title}
              </h2>
              <p className="mt-1 text-xs text-muted tabular-nums">
                {loading ? "กำลังโหลด…" : playing ? "กำลังเล่น" : "หยุดชั่วคราว"} · {shortQualityLabel(source)} · {rate}x
                {activeSizeLabel ? ` · ${activeSizeLabel}` : ""}
                {totalSiblings > 1 ? ` · คลิปที่ ${currentIndex + 1}/${totalSiblings}` : ""}
              </p>
              {activeExpiry && (
                <p
                  title={activeExpiry.title}
                  className={`mt-1 flex items-center gap-1 text-[11px] tabular-nums ${
                    activeExpiry.state === "expired"
                      ? "text-rose-400 light-theme:text-rose-600"
                      : activeExpiry.state === "soon"
                        ? "text-warning"
                        : "text-muted"
                  }`}
                >
                  <Clock size={11} className="shrink-0" aria-hidden="true" />
                  <span>{activeExpiry.label}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดตัวเล่น"
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted active:bg-foreground/10"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {otherVideos.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-muted">วิดีโออื่นในโฟลเดอร์นี้ ({otherVideos.length})</p>
              <div className="grid grid-cols-2 gap-2.5">
                {otherVideos.map(entry => {
                  const entryDuration = formatDuration(entry.duration);
                  const entrySize = formatFileSize(entry.sizeBytes);
                  const entryExpiry = formatExpiryInfo(entry.expiresAt, now);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onSelectSibling?.(entry)}
                      className="flex min-w-0 flex-col rounded-2xl border border-border bg-panel p-1.5 text-start active:scale-[0.98]"
                    >
                      <span className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-art">
                        {entry.thumbnail && (
                          <>
                            <Thumbnail src={entry.thumbnail} className="absolute inset-0 size-full scale-110 object-cover blur-[12px] brightness-[.68]" />
                            <Thumbnail src={entry.thumbnail} className="absolute inset-0 size-full object-contain" />
                          </>
                        )}
                        <span aria-hidden="true" className="pointer-events-none relative z-1 grid size-9 place-items-center rounded-full bg-black/55 text-white">
                          <Play size={16} className="ml-0.5 fill-current" />
                        </span>
                        {entryDuration && (
                          <span className="pointer-events-none absolute right-1.5 bottom-1.5 z-10 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] leading-tight font-medium text-white tabular-nums">
                            {entryDuration}
                          </span>
                        )}
                      </span>
                      <span className={`mt-2 line-clamp-1 px-0.5 text-xs font-medium text-foreground ${catalogFontClass(entry.name) ?? ""}`}>
                        {entry.name}
                      </span>
                      <span className="mt-0.5 truncate px-0.5 text-[11px] text-muted tabular-nums">
                        {entrySize || (entry.hasInfo ? "เคยเปิดใน Desktop" : "ยังไม่มีประวัติเปิด")}
                      </span>
                      {entryExpiry && (
                        <span
                          className={`mt-0.5 flex items-center gap-1 px-0.5 pb-0.5 text-[10.5px] leading-tight tabular-nums ${
                            entryExpiry.state === "expired"
                              ? "text-rose-400 light-theme:text-rose-600"
                              : entryExpiry.state === "soon"
                                ? "text-warning"
                                : "text-muted"
                          }`}
                        >
                          <Clock size={10} className="shrink-0" aria-hidden="true" />
                          <span className="truncate">{entryExpiry.compactLabel}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Settings Bottom Sheet (matches left mockup: pill chips for ความเร็ว & คุณภาพ + clean action rows) */}
      <AnimatePresence>
        {openMenu === "more" && !minimized && (
          <>
            <motion.div
              key="mobile-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setOpenMenu(null)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] desktop:hidden"
            />
            <motion.div
              key="mobile-sheet"
              ref={mobileSheetRef}
              role="dialog"
              aria-label="ตั้งค่าการเล่น"
              initial={reducedMotion ? { opacity: 0 } : { y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { y: "100%" }}
              transition={reducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 420, damping: 36 }}
              onClick={event => event.stopPropagation()}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[82dvh] max-w-lg overflow-y-auto rounded-t-[24px] border-t border-border bg-panel px-5 pt-3 mobile-landscape:pt-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] mobile-landscape:pb-[max(0.75rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl desktop:hidden"
            >
              <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
              <h3 className="mb-4 text-base font-semibold text-foreground">ตั้งค่าการเล่น</h3>

              {/* Speed Pill Chips */}
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted">ความเร็ว</p>
                <div className="flex flex-wrap gap-2">
                  {SPEEDS.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => changeRate(option)}
                      className={`inline-flex h-10 min-w-14 items-center justify-center rounded-full border px-3.5 text-xs font-semibold tabular-nums transition-colors ${
                        rate === option
                          ? "border-accent bg-accent text-white shadow-xs"
                          : "border-border bg-field text-foreground active:bg-accent/10"
                      }`}
                    >
                      {option}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Pill Chips */}
              {variants.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-muted">คุณภาพ</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((variant, index) => (
                      <button
                        key={variant.url}
                        type="button"
                        onClick={() => changeQuality(index)}
                        className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs font-semibold transition-colors ${
                          index === selected
                            ? "border-accent bg-accent text-white shadow-xs"
                            : "border-border bg-field text-foreground active:bg-accent/10"
                        }`}
                      >
                        {shortQualityLabel(variant)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clean List Rows */}
              <div className="divide-y divide-border/50 border-t border-border pt-1">
                {source?.url && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      copyText(source.url, "คัดลอกลิงก์วิดีโอแล้ว");
                    }}
                    className="flex h-12 w-full items-center gap-3 text-start text-sm text-foreground active:bg-field/60"
                  >
                    <Link2 size={18} className="shrink-0 text-muted" aria-hidden="true" />
                    <span className="flex-1">คัดลอกลิงก์</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setLocked(true);
                    showToast("ล็อกหน้าจอสัมผัสแล้ว");
                  }}
                  className="flex h-12 w-full items-center gap-3 text-start text-sm text-foreground active:bg-field/60"
                >
                  <Lock size={18} className="shrink-0 text-muted" aria-hidden="true" />
                  <span className="flex-1">ล็อกหน้าจอ</span>
                </button>

                <button
                  type="button"
                  onClick={toggleLoop}
                  className="flex h-12 w-full items-center gap-3 text-start text-sm text-foreground active:bg-field/60"
                >
                  <Repeat size={18} className="shrink-0 text-muted" aria-hidden="true" />
                  <span className="flex-1">เล่นซ้ำ</span>
                  {loop && <Check size={16} className="shrink-0 text-accent-text" aria-hidden="true" />}
                </button>

                {source?.url && !source.hls && fileId && (
                  <button
                    type="button"
                    onClick={downloadCurrentVariant}
                    className="flex h-12 w-full items-center gap-3 text-start text-sm text-foreground active:bg-field/60"
                  >
                    <Download size={18} className="shrink-0 text-muted" aria-hidden="true" />
                    <span className="flex-1 truncate">ดาวน์โหลดวิดีโอ ({shortQualityLabel(source)})</span>
                  </button>
                )}

                {pipSupported && (
                  <button
                    type="button"
                    onClick={togglePip}
                    className="flex h-12 w-full items-center gap-3 text-start text-sm text-foreground active:bg-field/60"
                  >
                    <PictureInPicture2 size={18} className="shrink-0 text-muted" aria-hidden="true" />
                    <span className="flex-1">ภาพซ้อนภาพ (PiP)</span>
                  </button>
                )}

                {fileInfo && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      copyText(JSON.stringify(fileInfo, null, 2), "คัดลอกข้อมูล JSON แล้ว");
                    }}
                    className="flex h-12 w-full items-center gap-3 text-start text-sm text-foreground active:bg-field/60"
                  >
                    <Braces size={18} className="shrink-0 text-muted" aria-hidden="true" />
                    <span className="flex-1">คัดลอกข้อมูล JSON</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setStatsOpen(prev => !prev);
                  }}
                  className="flex h-12 w-full items-center gap-3 text-start text-sm text-foreground active:bg-field/60"
                >
                  <Activity size={18} className="shrink-0 text-muted" aria-hidden="true" />
                  <span className="flex-1">สถิติสำหรับเด็กเนิร์ด</span>
                  {statsOpen && <Check size={16} className="shrink-0 text-accent-text" aria-hidden="true" />}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
