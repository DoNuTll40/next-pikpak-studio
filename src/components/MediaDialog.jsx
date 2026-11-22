"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Braces,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  Info,
  Link2,
  LoaderCircle,
  Maximize,
  Minimize,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanLine,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useMediaPreview } from "@/hooks/useMediaPreview";
import { catalogFontClass, formatStudioDate } from "@/lib/catalog";
import { useStudioPreferences } from "@/providers/StudioProvider";
import { VideoPlayer } from "./VideoPlayer";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const ZOOM_STEPS = [800, 600, 400, 300, 200, 150, 100, 75, 50, 25];
const INITIAL_VIEW = { zoom: 1, angle: 0, x: 0, y: 0 };

const topActionButton =
  "grid size-10 sm:size-8 shrink-0 place-items-center rounded-lg bg-panel/90 text-muted shadow-sm backdrop-blur-sm hover:bg-panel hover:text-foreground";

function formatFileSize(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return "";
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = num;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function MediaDialog({ item, items = [], onSelectItem, onClose }) {
  const dialog = useRef(null);
  const closingRef = useRef(false);
  const [visible, setVisible] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reducedMotion = useReducedMotion();
  const result = useMediaPreview(item, reloadKey);

  // Sibling list of the same media kind (all images in folder or all videos in folder)
  const sameKindList = items.filter(entry => entry.kind === item.kind);
  const siblingList = sameKindList.length > 0 ? sameKindList : [item];
  const currentIndex = Math.max(0, siblingList.findIndex(entry => entry.id === item.id));
  const totalSiblings = siblingList.length;
  const hasPrev = currentIndex > 0 && typeof onSelectItem === "function";
  const hasNext = currentIndex < totalSiblings - 1 && typeof onSelectItem === "function";

  function goPrev() {
    if (hasPrev) onSelectItem(siblingList[currentIndex - 1]);
  }

  function goNext() {
    if (hasNext) onSelectItem(siblingList[currentIndex + 1]);
  }

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (el.open && !el.matches(":modal")) el.removeAttribute("open");
    if (!el.open) el.showModal();
  }, []);

  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    dialog.current?.querySelector("video")?.pause();
    if (reducedMotion) {
      dialog.current?.close();
    } else {
      setVisible(false);
    }
  }

  const fileInfo = result && typeof result === "object" ? result.fileInfo : null;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onCancel={event => {
        event.preventDefault();
        requestClose();
      }}
      aria-labelledby="preview-title"
      className="fixed inset-0 m-0 size-full max-h-none max-w-none items-center justify-center overflow-hidden border-0 bg-transparent p-0 md:p-4 text-foreground backdrop:bg-transparent open:flex"
    >
      <AnimatePresence onExitComplete={() => dialog.current?.close()}>
        {visible && (
          <motion.div
            key="backdrop"
            aria-hidden="true"
            onClick={requestClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 bg-[#080d18]/85 md:bg-[#080d18]/55"
          />
        )}
        {visible && (
          <motion.div
            key="player-shell"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion
              ? { opacity: 0, transition: { duration: 0.1 } }
              : { opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
            transition={reducedMotion
              ? { duration: 0.12 }
              : { type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
            className="relative z-1 size-full max-h-dvh md:size-auto md:max-h-[calc(100dvh-32px)] md:w-[min(1120px,calc(100vw-32px))] overflow-hidden rounded-none md:rounded-2xl bg-[#080d18] md:bg-panel shadow-[0_16px_48px_rgba(8,13,24,0.45)]"
          >
            <MediaContent
              item={item}
              siblings={siblingList}
              onSelectItem={onSelectItem}
              result={result}
              fileInfo={fileInfo}
              currentIndex={currentIndex}
              totalSiblings={totalSiblings}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onPrev={goPrev}
              onNext={goNext}
              onReload={() => setReloadKey(prev => prev + 1)}
              onClose={requestClose}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}

function CopyJsonButton({ data }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(event) {
    const text = JSON.stringify(data, null, 2);
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
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="คัดลอก JSON ของ file_info ทั้งหมด"
      className={`inline-flex h-10 sm:h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium shadow-sm backdrop-blur-sm ${
        copied
          ? "bg-panel text-success"
          : "bg-panel/90 text-foreground hover:bg-panel hover:text-accent-text"
      }`}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span className="hidden sm:inline">{copied ? "คัดลอกแล้ว" : "คัดลอก JSON"}</span>
    </button>
  );
}

function OverlayHeader({ title, titleClass, fileInfo, onClose, overlay = true }) {
  return (
    <div
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-[#080d18]/65 via-[#080d18]/25 to-transparent px-4 pt-3.5 pb-9"
          : "flex items-center justify-between gap-3 border-b border-border px-4 py-3"
      }
    >
      <h2
        id="preview-title"
        title={title}
        className={`min-w-0 truncate text-sm font-medium ${overlay ? "text-white drop-shadow-xs" : "text-foreground"} ${titleClass}`}
      >
        {title}
      </h2>
      <div className="flex shrink-0 items-center gap-1.5">
        {fileInfo && <CopyJsonButton data={fileInfo} />}
        <button type="button" onClick={onClose} aria-label="ปิดพรีวิว" title="ปิด (Esc)" className={topActionButton}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function ImagePreviewViewer({
  item,
  siblings,
  onSelectItem,
  url,
  isLoadingUrl,
  fileInfo,
  titleClass,
  currentIndex,
  totalSiblings,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
}) {
  const [view, setView] = useState(INITIAL_VIEW);
  const [isInteracting, setIsInteracting] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState(null);
  const [failedUrl, setFailedUrl] = useState(null);
  const [naturalDim, setNaturalDim] = useState({ id: null, width: 0, height: 0 });
  const [stripOpen, setStripOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState("");
  const shellRef = useRef(null);
  const stageRef = useRef(null);
  const stripRef = useRef(null);
  const toastTimer = useRef(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({
    mode: null, // "pan" | "pinch" | "swipe"
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    startScale: 1,
    startDist: 0,
    midX: 0,
    midY: 0,
    moved: false,
    downTime: 0,
  });

  // Reset pan/zoom/rotation smoothly inside the persistent modal whenever the selected image changes
  const prevItemIdRef = useRef(item.id);
  if (prevItemIdRef.current !== item.id) {
    prevItemIdRef.current = item.id;
    setView(INITIAL_VIEW);
  }

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Scroll the active thumbnail into view inside the desktop filmstrip
  useEffect(() => {
    if (!stripOpen) return;
    stripRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "smooth",
    });
  }, [item.id, stripOpen]);

  useEffect(() => {
    function onFsChange() {
      setFullscreen(document.fullscreenElement === shellRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function notify(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }

  function clampPan(nextX, nextY, nextScale) {
    if (nextScale <= 1.01) return { x: 0, y: 0 };
    const stage = stageRef.current;
    const w = stage?.clientWidth || 360;
    const h = stage?.clientHeight || 480;
    const maxX = Math.max(0, ((nextScale - 1) * w) / 2);
    const maxY = Math.max(0, ((nextScale - 1) * h) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY)),
    };
  }

  function resetZoom() {
    setView(INITIAL_VIEW);
  }

  function zoomTo(targetScale, clientX, clientY) {
    const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetScale));
    if (clampedScale <= 1.01 && clampedScale >= 0.99) {
      setView(prev => ({ ...prev, zoom: 1, x: 0, y: 0 }));
      return;
    }
    const stage = stageRef.current;
    if (!stage || clientX === undefined || clientY === undefined) {
      setView(prev => ({
        ...prev,
        zoom: clampedScale,
        ...(clampedScale <= 1 ? { x: 0, y: 0 } : clampPan(prev.x, prev.y, clampedScale)),
      }));
      return;
    }
    const rect = stage.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const offsetX = clientX - cx;
    const offsetY = clientY - cy;
    const ratio = clampedScale / view.zoom;
    const nextX = offsetX - (offsetX - view.x) * ratio;
    const nextY = offsetY - (offsetY - view.y) * ratio;
    const clampedPan = clampedScale <= 1 ? { x: 0, y: 0 } : clampPan(nextX, nextY, clampedScale);
    setView(prev => ({ ...prev, zoom: clampedScale, x: clampedPan.x, y: clampedPan.y }));
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === shellRef.current) {
        await document.exitFullscreen();
      } else {
        await shellRef.current?.requestFullscreen();
      }
    } catch {}
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    notify(label);
  }

  function handlePointerDown(event) {
    if (event.target.closest("button, a, input, select")) return;
    if (event.button !== undefined && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setIsInteracting(true);

    const pts = [...pointersRef.current.values()];
    if (pts.length === 2) {
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      gestureRef.current = {
        ...gestureRef.current,
        mode: "pinch",
        startDist: Math.max(10, Math.hypot(dx, dy)),
        startScale: view.zoom,
        startPanX: view.x,
        startPanY: view.y,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
        moved: true,
      };
    } else if (pts.length === 1) {
      gestureRef.current = {
        mode: view.zoom > 1.02 ? "pan" : "swipe",
        startX: event.clientX,
        startY: event.clientY,
        startPanX: view.x,
        startPanY: view.y,
        startScale: view.zoom,
        startDist: 0,
        midX: event.clientX,
        midY: event.clientY,
        moved: false,
        downTime: performance.now(),
      };
    }
  }

  function handlePointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointersRef.current.values()];
    const g = gestureRef.current;

    if (pts.length === 2 && g.mode === "pinch") {
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.max(10, Math.hypot(dx, dy));
      const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, g.startScale * (dist / g.startDist)));
      const curMidX = (pts[0].x + pts[1].x) / 2;
      const curMidY = (pts[0].y + pts[1].y) / 2;
      const ratio = nextScale / g.startScale;
      const stage = stageRef.current;
      const rect = stage?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : curMidX;
      const cy = rect ? rect.top + rect.height / 2 : curMidY;
      const focalX = g.midX - cx;
      const focalY = g.midY - cy;
      const nextX = focalX - (focalX - g.startPanX) * ratio + (curMidX - g.midX);
      const nextY = focalY - (focalY - g.startPanY) * ratio + (curMidY - g.midY);
      const clampedPan = nextScale <= 1 ? { x: 0, y: 0 } : clampPan(nextX, nextY, nextScale);
      setView(prev => ({ ...prev, zoom: nextScale, x: clampedPan.x, y: clampedPan.y }));
      return;
    }

    if (pts.length === 1) {
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        g.moved = true;
      }
      if (g.mode === "pan" && view.zoom > 1.02) {
        const clamped = clampPan(g.startPanX + dx, g.startPanY + dy, view.zoom);
        setView(prev => ({ ...prev, x: clamped.x, y: clamped.y }));
      }
    }
  }

  function handlePointerUp(event) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);
    const remaining = [...pointersRef.current.values()];

    if (remaining.length === 1) {
      gestureRef.current = {
        ...gestureRef.current,
        mode: view.zoom > 1.02 ? "pan" : "swipe",
        startX: remaining[0].x,
        startY: remaining[0].y,
        startPanX: view.x,
        startPanY: view.y,
        startScale: view.zoom,
      };
      return;
    }

    setIsInteracting(false);
    if (view.zoom < 1) {
      setView(prev => ({ ...prev, zoom: 1, x: 0, y: 0 }));
    }

    const g = gestureRef.current;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    const dt = performance.now() - g.downTime;

    // Double-tap / double-click at focal point -> toggle 2.5x zoom or reset to 1x
    if (!g.moved && Math.abs(dx) < 16 && Math.abs(dy) < 16 && dt < 280) {
      const now = performance.now();
      const last = lastTapRef.current;
      if (now - last.time <= 320 && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 36) {
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        if (view.zoom > 1.05) {
          resetZoom();
        } else {
          zoomTo(2.5, event.clientX, event.clientY);
        }
        return;
      }
      lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };
      return;
    }

    // Horizontal swipe -> next / prev image seamlessly inside the same modal
    if (g.mode === "swipe" && view.zoom <= 1.05) {
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0 && hasNext) onNext();
        else if (dx > 0 && hasPrev) onPrev();
        return;
      }
      if (dy > 75 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        onClose();
      }
    }
  }

  function handleWheel(event) {
    if (event.target.closest("button, a, input, select")) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
    zoomTo(view.zoom * factor, event.clientX, event.clientY);
  }

  const displayUrl = (url && url !== failedUrl ? url : null) || item.thumbnail || null;
  const fullLoaded = Boolean(url && loadedUrl === url);
  const showThumbUnderlay = Boolean(item.thumbnail && url && url !== item.thumbnail && !fullLoaded);
  const fileExt = /\.([a-z0-9]+)$/i.exec(item.name)?.[1]?.toUpperCase() || "IMAGE";
  const dimText =
    naturalDim.id === item.id && naturalDim.width && naturalDim.height
      ? `${naturalDim.width} × ${naturalDim.height}`
      : fileInfo?.params?.width && fileInfo?.params?.height
        ? `${fileInfo.params.width} × ${fileInfo.params.height}`
        : "";
  const sizeText = formatFileSize(fileInfo?.size);
  const transformCss = `translate3d(${view.x}px, ${view.y}px, 0) rotate(${view.angle}deg) scale(${view.zoom})`;
  const transitionCss = isInteracting ? "none" : "transform 160ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      ref={shellRef}
      tabIndex={-1}
      onKeyDown={event => {
        if (event.key === "ArrowLeft" && hasPrev) {
          event.preventDefault();
          onPrev();
        } else if (event.key === "ArrowRight" && hasNext) {
          event.preventDefault();
          onNext();
        } else if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          zoomTo(view.zoom + 0.25);
        } else if (event.key === "-") {
          event.preventDefault();
          zoomTo(view.zoom - 0.25);
        } else if (event.key === "0") {
          event.preventDefault();
          resetZoom();
        } else if (event.key.toLowerCase() === "e" && totalSiblings > 1) {
          event.preventDefault();
          setStripOpen(prev => !prev);
        } else if (event.key.toLowerCase() === "i") {
          event.preventDefault();
          setInfoOpen(prev => !prev);
        } else if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          toggleFullscreen();
        }
      }}
      className={`relative flex size-full flex-col justify-between bg-[#080d18] text-white select-none focus:outline-none! ${
        fullscreen ? "h-dvh w-dvw" : "md:h-[min(86dvh,820px)]"
      }`}
    >
      {/* Desktop Top Header (matches PC app: [ตัวดูรูปภาพ] | [DSC_7991.jpg] | [Copy JSON] [X]) */}
      <div className="hidden md:flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-panel px-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          <ImageIcon size={15} className="text-accent-text" aria-hidden="true" />
          <span>ตัวดูรูปภาพ</span>
          {totalSiblings > 1 && (
            <span className="rounded-md bg-field px-1.5 py-0.5 text-[11px] tabular-nums">
              {currentIndex + 1} / {totalSiblings}
            </span>
          )}
        </div>
        <h2
          id="preview-title"
          title={item.name}
          className={`min-w-0 truncate text-sm font-medium text-foreground ${titleClass}`}
        >
          {item.name}
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          {fileInfo && <CopyJsonButton data={fileInfo} />}
          <button type="button" onClick={onClose} aria-label="ปิดพรีวิว" title="ปิด (Esc)" className={topActionButton}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile Top Bar: [X] | [3 / 223] | [(i)] */}
      <div className="flex shrink-0 items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 md:hidden">
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดพรีวิว"
          className="grid size-10 place-items-center rounded-full text-white/90 active:bg-white/15"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold tracking-wide text-white/95 tabular-nums">
          {currentIndex + 1} / {totalSiblings}
        </span>
        <button
          type="button"
          onClick={() => setInfoOpen(prev => !prev)}
          aria-label="ข้อมูลไฟล์"
          aria-expanded={infoOpen}
          className={`grid size-10 place-items-center rounded-full transition-colors ${
            infoOpen ? "bg-accent/25 text-accent-text" : "text-white/90 active:bg-white/15"
          }`}
        >
          <Info size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="pointer-events-none absolute top-14 left-1/2 z-30 -translate-x-1/2 rounded-full bg-panel/95 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm"
        >
          {toast}
        </div>
      )}

      {/* Main Image Stage (with instant thumbnail underlay so sliding between images never flashes blank) */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={stageRef}
          className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden touch-none bg-[#0b101d] ${
            view.zoom > 1.02 ? (isInteracting ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          {/* Instant Thumbnail Underlay while full-res URL is loading */}
          {showThumbUnderlay && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              draggable={false}
              style={{ transform: transformCss, transition: transitionCss }}
              className="pointer-events-none absolute max-h-full w-full object-contain select-none"
              src={item.thumbnail}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
            />
          )}

          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={displayUrl}
              draggable={false}
              style={{ transform: transformCss, transition: transitionCss }}
              className="block max-h-full w-full object-contain select-none will-change-transform"
              src={displayUrl}
              alt={item.name}
              referrerPolicy="no-referrer"
              onLoad={event => {
                setLoadedUrl(displayUrl);
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (naturalWidth && naturalHeight) {
                  setNaturalDim({ id: item.id, width: naturalWidth, height: naturalHeight });
                }
              }}
              onError={() => setFailedUrl(displayUrl)}
            />
          ) : isLoadingUrl ? (
            <span className="grid size-11 place-items-center rounded-full bg-panel/90 text-accent shadow-md">
              <LoaderCircle size={22} className="animate-spin" aria-hidden="true" />
            </span>
          ) : (
            <p className="p-6 text-center text-sm text-warning" role="alert">
              ไม่มีลิงก์สำหรับเปิดภาพนี้ ลองเปิดพรีวิวใน PikPak Desktop เพื่ออัปเดตลิงก์
            </p>
          )}

          {/* Subtle corner spinner when upgrading from thumbnail to original image */}
          {(isLoadingUrl || (url && !fullLoaded && displayUrl)) && (
            <div className="pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-[#080d18]/75 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur-sm">
              <LoaderCircle size={13} className="animate-spin text-accent-text" aria-hidden="true" />
              <span>กำลังโหลดภาพชัด…</span>
            </div>
          )}

          {view.zoom > 1.05 && (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                resetZoom();
              }}
              className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/20 bg-[#080d18]/80 px-3 py-1 text-xs font-medium text-white shadow-md backdrop-blur-md active:scale-95"
            >
              ซูม {Math.round(view.zoom * 100)}% · แตะเพื่อรีเซ็ต
            </button>
          )}

          {/* Left / Right Navigation Arrows on Desktop */}
          {totalSiblings > 1 && (
            <>
              <button
                type="button"
                disabled={!hasPrev}
                onClick={onPrev}
                aria-label="ภาพก่อนหน้า (←)"
                title="ภาพก่อนหน้า (←)"
                className="absolute left-3.5 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-panel/85 text-foreground shadow-md backdrop-blur-sm hover:bg-panel disabled:pointer-events-none disabled:opacity-30 md:grid"
              >
                <ChevronLeft size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={onNext}
                aria-label="ภาพถัดไป (→)"
                title="ภาพถัดไป (→)"
                className="absolute right-3.5 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-panel/85 text-foreground shadow-md backdrop-blur-sm hover:bg-panel disabled:pointer-events-none disabled:opacity-30 md:grid"
              >
                <ChevronRight size={22} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {/* Info Sidebar / Drawer */}
        {infoOpen && (
          <aside className="absolute inset-x-3 top-14 z-20 rounded-xl border border-border bg-panel/95 p-3.5 text-xs text-foreground shadow-xl backdrop-blur-md md:static md:inset-auto md:w-64 md:shrink-0 md:rounded-none md:border-y-0 md:border-r-0 md:border-l md:bg-panel">
            <div className="mb-2.5 flex items-center justify-between border-b border-border pb-2">
              <strong className="text-xs font-semibold">ข้อมูลภาพ</strong>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                aria-label="ปิดข้อมูลภาพ"
                className="grid size-6 place-items-center rounded-md text-muted hover:bg-field hover:text-foreground"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <dl className="space-y-2">
              <div>
                <dt className="text-[11px] text-muted">ชื่อไฟล์</dt>
                <dd className={`mt-0.5 font-medium break-all ${titleClass}`}>{item.name}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-[11px] text-muted">ชนิดไฟล์</dt>
                  <dd className="mt-0.5 font-medium">{fileExt}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted">ลำดับ</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">
                    {currentIndex + 1} / {totalSiblings}
                  </dd>
                </div>
              </div>
              {dimText && (
                <div>
                  <dt className="text-[11px] text-muted">ความละเอียด</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{dimText} พิกเซล</dd>
                </div>
              )}
              {sizeText && (
                <div>
                  <dt className="text-[11px] text-muted">ขนาดไฟล์</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{sizeText}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] text-muted">รหัสไฟล์</dt>
                <dd className="mt-0.5 truncate font-mono text-[11px] text-muted">{item.id}</dd>
              </div>
            </dl>
          </aside>
        )}
      </div>

      {/* Desktop Filmstrip Thumbnail Bar (matches PC screenshot) */}
      {totalSiblings > 1 && stripOpen && (
        <div className="hidden md:block shrink-0 border-t border-border/60 bg-[#0d1322] px-3 py-2">
          <div
            ref={stripRef}
            aria-label="ภาพย่อในโฟลเดอร์"
            onWheel={event => {
              if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                event.currentTarget.scrollLeft += event.deltaY;
              }
            }}
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]"
          >
            {siblings.map(photo => {
              const active = photo.id === item.id;
              return (
                <button
                  key={photo.id}
                  type="button"
                  aria-label={photo.name}
                  aria-current={active}
                  title={photo.name}
                  onClick={() => onSelectItem?.(photo)}
                  className={`relative grid h-14 min-w-14 max-w-24 shrink-0 place-items-center overflow-hidden rounded-md border transition-all ${
                    active
                      ? "border-accent ring-2 ring-accent/50 brightness-105"
                      : "border-white/10 opacity-65 hover:opacity-100"
                  }`}
                >
                  {photo.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.thumbnail}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-auto object-cover"
                    />
                  ) : (
                    <ImageIcon size={18} className="text-muted" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop Bottom Status & Zoom Toolbar (matches PC screenshot: [Filmstrip] JPG 3008x2008 589.3KiB | (i) [-] [slider] [+] [100%] [Fit] [RotateL] [RotateR] [Fullscreen]) */}
      <footer className="hidden md:flex h-11 shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-panel px-3.5 text-xs">
        <div className="flex min-w-0 items-center gap-2.5">
          {totalSiblings > 1 && (
            <button
              type="button"
              onClick={() => setStripOpen(prev => !prev)}
              aria-expanded={stripOpen}
              title={stripOpen ? "ซ่อนแถบภาพย่อ (E)" : "แสดงแถบภาพย่อ (E)"}
              className={`grid size-7 place-items-center rounded-md border transition-colors ${
                stripOpen
                  ? "border-accent/60 bg-accent/15 text-accent-text"
                  : "border-border bg-field text-muted hover:text-foreground"
              }`}
            >
              <Film size={15} aria-hidden="true" />
            </button>
          )}
          <div className="flex items-center gap-2 truncate text-xs text-muted tabular-nums">
            <span className="font-semibold text-foreground">{fileExt}</span>
            {dimText && <span>{dimText}</span>}
            {sizeText && <span>{sizeText}</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setInfoOpen(prev => !prev)}
            aria-expanded={infoOpen}
            title="ข้อมูลภาพ (I)"
            className={`grid size-7 place-items-center rounded-md transition-colors ${
              infoOpen ? "bg-accent/20 text-accent-text" : "text-muted hover:bg-field hover:text-foreground"
            }`}
          >
            <Info size={16} aria-hidden="true" />
          </button>

          <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

          <button
            type="button"
            disabled={view.zoom <= MIN_ZOOM}
            onClick={() => zoomTo(view.zoom - 0.25)}
            aria-label="ซูมออก"
            title="ซูมออก (-)"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-field hover:text-foreground disabled:opacity-35"
          >
            <ZoomOut size={16} aria-hidden="true" />
          </button>

          <input
            type="range"
            min={25}
            max={500}
            step={5}
            aria-label="ระดับการซูม"
            value={Math.round(Math.min(500, view.zoom * 100))}
            onChange={event => zoomTo(Number(event.target.value) / 100)}
            className="h-1.5 w-24 cursor-pointer accent-accent"
          />

          <button
            type="button"
            disabled={view.zoom >= MAX_ZOOM}
            onClick={() => zoomTo(view.zoom + 0.25)}
            aria-label="ซูมเข้า"
            title="ซูมเข้า (+)"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-field hover:text-foreground disabled:opacity-35"
          >
            <ZoomIn size={16} aria-hidden="true" />
          </button>

          <select
            aria-label="เลือกเปอร์เซ็นต์การซูม"
            value={ZOOM_STEPS.includes(Math.round(view.zoom * 100)) ? Math.round(view.zoom * 100) : ""}
            onChange={event => zoomTo(Number(event.target.value) / 100)}
            className="h-7 rounded-md border border-border bg-field px-2 text-xs text-foreground tabular-nums outline-none hover:border-accent-text"
          >
            {!ZOOM_STEPS.includes(Math.round(view.zoom * 100)) && (
              <option value="" disabled>
                {Math.round(view.zoom * 100)}%
              </option>
            )}
            {ZOOM_STEPS.map(pct => (
              <option key={pct} value={pct}>
                {pct}%
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={resetZoom}
            aria-label="พอดีหน้าต่าง"
            title="พอดีหน้าต่าง (0)"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-field hover:text-foreground"
          >
            <ScanLine size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setView(prev => ({ ...prev, angle: prev.angle - 90, x: 0, y: 0 }))}
            aria-label="หมุนซ้าย"
            title="หมุนซ้าย 90°"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-field hover:text-foreground"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setView(prev => ({ ...prev, angle: prev.angle + 90, x: 0, y: 0 }))}
            aria-label="หมุนขวา"
            title="หมุนขวา 90°"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-field hover:text-foreground"
          >
            <RotateCw size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}
            title={fullscreen ? "ออกจากเต็มจอ (F)" : "เต็มจอ (F)"}
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-field hover:text-foreground"
          >
            {fullscreen ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
          </button>
        </div>
      </footer>

      {/* Mobile Bottom Sheet: Filename + Gesture Hint + Action Bar */}
      <div className="shrink-0 bg-[#080d18] px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={`truncate text-sm font-semibold text-white ${titleClass}`} title={item.name}>
            {item.name}
          </p>
          <span className="text-[11px] text-muted">
            ปัดซ้าย/ขวาเพื่อเปลี่ยนไฟล์ · ดับเบิลแตะเพื่อซูม
          </span>
        </div>

        <div className="mt-3.5 grid grid-cols-4 gap-2 border-t border-border/50 pt-3">
          <button
            type="button"
            disabled={!displayUrl}
            onClick={() => displayUrl && copyText(displayUrl, "คัดลอกลิงก์รูปภาพแล้ว")}
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] text-white/90 disabled:opacity-40 active:bg-white/10"
          >
            <Link2 size={18} className="text-muted" aria-hidden="true" />
            <span>คัดลอกลิงก์</span>
          </button>

          <a
            href={displayUrl || "#"}
            download={item.name}
            target="_blank"
            rel="noopener noreferrer"
            onClick={event => {
              if (!displayUrl) {
                event.preventDefault();
                return;
              }
              notify("กำลังเปิดดาวน์โหลดรูปภาพ");
            }}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] text-white/90 active:bg-white/10 ${
              !displayUrl ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <Download size={18} className="text-muted" aria-hidden="true" />
            <span>ดาวน์โหลด</span>
          </a>

          <button
            type="button"
            disabled={!fileInfo}
            onClick={() => fileInfo && copyText(JSON.stringify(fileInfo, null, 2), "คัดลอกข้อมูล JSON แล้ว")}
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] text-white/90 disabled:opacity-40 active:bg-white/10"
          >
            <Braces size={18} className="text-muted" aria-hidden="true" />
            <span>คัดลอก JSON</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] text-[#f87171] active:bg-white/10"
          >
            <X size={18} aria-hidden="true" />
            <span>ปิดหน้าต่าง</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaContent({
  item,
  siblings,
  onSelectItem,
  result,
  fileInfo,
  currentIndex,
  totalSiblings,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onReload,
  onClose,
}) {
  const { videoQuality } = useStudioPreferences();
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [failed, setFailed] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const titleClass = catalogFontClass(item.name) ?? "";
  const isMedia = item.kind === "video" || item.kind === "image";

  // Reset video failure state when switching to a sibling video inside the same open modal
  const prevIdRef = useRef(item.id);
  if (prevIdRef.current !== item.id) {
    prevIdRef.current = item.id;
    setFailed(false);
    setSelectedQuality(null);
  }

  if (!isMedia) {
    return (
      <div className="bg-panel text-foreground">
        <OverlayHeader title={item.name} titleClass={titleClass} fileInfo={fileInfo} onClose={onClose} overlay={false} />
        <p className="px-4 py-10 text-center text-sm text-muted">ไฟล์ประเภทนี้เปิดบนเว็บไม่ได้</p>
      </div>
    );
  }

  // For images, NEVER unmount ImagePreviewViewer during loading — keep the modal & filmstrip mounted
  // and render `item.thumbnail` immediately while `result` is fetching!
  if (item.kind === "image") {
    const imageUrl = result && typeof result === "object" && result.kind === "image" ? result.url : null;
    return (
      <ImagePreviewViewer
        item={item}
        siblings={siblings}
        onSelectItem={onSelectItem}
        url={imageUrl}
        isLoadingUrl={result === null}
        fileInfo={fileInfo}
        titleClass={titleClass}
        currentIndex={currentIndex}
        totalSiblings={totalSiblings}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={onPrev}
        onNext={onNext}
        onClose={onClose}
      />
    );
  }

  if (result === null) {
    return (
      <div className="relative flex size-full md:aspect-video md:max-h-[calc(100dvh-32px)] items-center justify-center overflow-hidden bg-[#080d18]">
        {item.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail} alt="" aria-hidden="true" referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 size-full object-contain opacity-45" />
        )}
        <OverlayHeader title={item.name} titleClass={titleClass} fileInfo={fileInfo} onClose={onClose} />
        <span role="status" aria-label="กำลังโหลดพรีวิว"
          className="relative z-1 grid size-12 place-items-center rounded-full bg-panel/90 text-accent shadow-md backdrop-blur-sm">
          <LoaderCircle size={24} className="animate-spin" aria-hidden="true" />
        </span>
      </div>
    );
  }

  if (!result || result.kind === "none") {
    return (
      <div className="flex size-full flex-col justify-center bg-panel text-foreground md:size-auto">
        <OverlayHeader title={item.name} titleClass={titleClass} fileInfo={fileInfo} onClose={onClose} overlay={false} />
        <p className="mx-auto max-w-md px-4 py-10 text-center text-sm text-muted" role="status">
          ไม่มีลิงก์สำหรับเปิดไฟล์นี้บนเว็บ ลองเปิดพรีวิวใน PikPak Desktop เพื่ออัปเดตลิงก์
        </p>
      </div>
    );
  }

  const selected = selectedQuality ?? preferredVariant(result.variants, videoQuality);
  const activeVariant = result.variants[selected] ?? result.variants[0];
  const expired = Boolean(activeVariant?.expiresAt && openedAt >= activeVariant.expiresAt);
  const transportStream = /\.(?:ts|m2ts|mts)$/i.test(item.name);
  const errorMessage = expired
    ? `ลิงก์วิดีโอนี้หมดอายุแล้ว (${formatStudioDate(activeVariant.expiresAt)}) กรุณาเปิดคลิปใน PikPak Desktop เพื่ออัปเดตลิงก์ใหม่`
    : activeVariant?.codec === "hevc"
      ? "เบราว์เซอร์นี้ไม่รองรับการถอดรหัส HEVC (H.265) หรือลิงก์อาจหมดอายุ ลองสลับไปที่ \"ต้นฉบับ\""
      : transportStream
        ? "เปิดวิดีโอคุณภาพนี้ไม่ได้ เบราว์เซอร์อาจไม่รองรับไฟล์ TS หรือลิงก์อาจหมดอายุ"
        : "เปิดวิดีโอคุณภาพนี้ไม่ได้ ลิงก์อาจหมดอายุหรือเบราว์เซอร์ไม่รองรับไฟล์";

  return (
    <VideoPlayer
      fileId={item.id}
      fileInfo={fileInfo}
      title={item.name}
      titleClass={titleClass}
      poster={item.thumbnail}
      headerActions={fileInfo && <CopyJsonButton data={fileInfo} />}
      onClose={onClose}
      variants={result.variants}
      selected={selected}
      onSelectQuality={setSelectedQuality}
      currentIndex={currentIndex}
      totalSiblings={totalSiblings}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onPrev={onPrev}
      onNext={onNext}
      failed={failed || expired}
      errorMessage={errorMessage}
      errorAction={
        <button type="button" onClick={onReload}
          className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent/90">
          <RefreshCw size={13} aria-hidden="true" />
          <span>โหลดลิงก์ใหม่</span>
        </button>
      }
      onError={setFailed}
    />
  );
}

function preferredVariant(variants, preference) {
  if (preference === "auto") return 0;
  if (preference === "original") {
    const original = variants.findLastIndex(variant => variant.original);
    return original === -1 ? 0 : original;
  }

  const target = Number(preference);
  const measured = variants
    .map((variant, index) => ({
      index,
      size: (variant.width && variant.height ? Math.min(variant.width, variant.height) : 0) ||
        Number(variant.label.match(/\b(\d{3,4})p\b/i)?.[1]) ||
        Infinity,
    }))
    .filter(variant => Number.isFinite(variant.size))
    .sort((a, b) => b.size - a.size);

  return measured.find(variant => variant.size <= target)?.index ?? measured.at(-1)?.index ?? 0;
}
