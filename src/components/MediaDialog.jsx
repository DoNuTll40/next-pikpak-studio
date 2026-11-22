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
  Info,
  Link2,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useMediaPreview } from "@/hooks/useMediaPreview";
import { catalogFontClass, formatStudioDate } from "@/lib/catalog";
import { useStudioPreferences } from "@/providers/StudioProvider";
import { VideoPlayer } from "./VideoPlayer";

const topActionButton =
  "grid size-10 sm:size-8 shrink-0 place-items-center rounded-lg bg-panel/90 text-muted shadow-sm backdrop-blur-sm hover:bg-panel hover:text-foreground";

export function MediaDialog({ item, items = [], onSelectItem, onClose }) {
  const dialog = useRef(null);
  const closingRef = useRef(false);
  const [visible, setVisible] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reducedMotion = useReducedMotion();
  const result = useMediaPreview(item, reloadKey);

  // Compute sibling list of the same media kind (all images in folder or all videos in folder)
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
            className="fixed inset-0 bg-[#080d18]/85 md:bg-[#080d18]/45"
          />
        )}
        {visible && (
          <motion.div
            key="player-shell"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion
              ? { opacity: 0, transition: { duration: 0.1 } }
              : { opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
            transition={reducedMotion
              ? { duration: 0.12 }
              : { type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
            className="relative z-1 size-full max-h-dvh md:size-auto md:max-h-[calc(100dvh-32px)] md:w-[min(1040px,calc(100vw-32px))] overflow-hidden rounded-none md:rounded-2xl bg-[#080d18] md:bg-transparent shadow-[0_16px_48px_rgba(8,13,24,0.32)]"
          >
            <MediaContent
              key={`${item.id}:${reloadKey}`}
              item={item}
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
  url,
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
  const [failed, setFailed] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [toast, setToast] = useState("");
  const stageRef = useRef(null);
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

  useEffect(() => () => clearTimeout(toastTimer.current), []);

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
    setScale(1);
    setPan({ x: 0, y: 0 });
  }

  function zoomAroundPoint(targetScale, clientX, clientY) {
    const clampedScale = Math.max(1, Math.min(5, targetScale));
    if (clampedScale <= 1.01) {
      resetZoom();
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      setScale(clampedScale);
      return;
    }
    const rect = stage.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const offsetX = clientX - cx;
    const offsetY = clientY - cy;
    const ratio = clampedScale / scale;
    const nextX = offsetX - (offsetX - pan.x) * ratio;
    const nextY = offsetY - (offsetY - pan.y) * ratio;
    setScale(clampedScale);
    setPan(clampPan(nextX, nextY, clampedScale));
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
        startScale: scale,
        startPanX: pan.x,
        startPanY: pan.y,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
        moved: true,
      };
    } else if (pts.length === 1) {
      gestureRef.current = {
        mode: scale > 1.02 ? "pan" : "swipe",
        startX: event.clientX,
        startY: event.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        startScale: scale,
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
      const nextScale = Math.max(1, Math.min(5, g.startScale * (dist / g.startDist)));
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
      setScale(nextScale);
      setPan(clampPan(nextX, nextY, nextScale));
      return;
    }

    if (pts.length === 1) {
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        g.moved = true;
      }
      if (g.mode === "pan" && scale > 1.02) {
        setPan(clampPan(g.startPanX + dx, g.startPanY + dy, scale));
      }
    }
  }

  function handlePointerUp(event) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);
    const remaining = [...pointersRef.current.values()];

    if (remaining.length === 1) {
      // Transition from 2-finger pinch back to 1-finger pan smoothly
      gestureRef.current = {
        ...gestureRef.current,
        mode: scale > 1.02 ? "pan" : "swipe",
        startX: remaining[0].x,
        startY: remaining[0].y,
        startPanX: pan.x,
        startPanY: pan.y,
        startScale: scale,
      };
      return;
    }

    setIsInteracting(false);
    if (scale <= 1.03) {
      resetZoom();
    }

    const g = gestureRef.current;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    const dt = performance.now() - g.downTime;

    // Double-tap / double-click to zoom in (2.5x at tap point) or reset to 1x
    if (!g.moved && Math.abs(dx) < 16 && Math.abs(dy) < 16 && dt < 280) {
      const now = performance.now();
      const last = lastTapRef.current;
      if (now - last.time <= 320 && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 36) {
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        if (scale > 1.05) {
          resetZoom();
        } else {
          zoomAroundPoint(2.5, event.clientX, event.clientY);
        }
        return;
      }
      lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };
      return;
    }

    // Only allow swipe to next/prev file or swipe down to close when not zoomed in
    if (g.mode === "swipe" && scale <= 1.05) {
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
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
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
    zoomAroundPoint(scale * factor, event.clientX, event.clientY);
  }

  return (
    <div
      className="relative flex size-full flex-col justify-between bg-[#080d18] text-white select-none md:min-h-[50dvh] md:max-h-[calc(100dvh-32px)] md:items-center md:justify-center"
      onKeyDown={event => {
        if (event.key === "ArrowLeft" && hasPrev) {
          event.preventDefault();
          onPrev();
        } else if (event.key === "ArrowRight" && hasNext) {
          event.preventDefault();
          onNext();
        }
      }}
      tabIndex={-1}
    >
      {/* Desktop Top Header (md and above — unchanged) */}
      <div className="hidden md:block">
        <OverlayHeader title={item.name} titleClass={titleClass} fileInfo={fileInfo} onClose={onClose} />
      </div>

      {/* Mobile Top Bar: [X] | [3 / 223] | [(i)] */}
      <div className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 md:hidden">
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

      {/* File Info Drawer on Mobile when (i) is tapped */}
      {infoOpen && (
        <div className="mx-3 mb-2 rounded-xl border border-border bg-panel/95 p-3 text-xs text-foreground shadow-lg backdrop-blur-md md:hidden">
          <p className={`font-medium break-all ${titleClass}`}>{item.name}</p>
          <p className="mt-1 text-muted">
            ไฟล์ที่ {currentIndex + 1} จาก {totalSiblings} · รหัส {item.id}
          </p>
        </div>
      )}

      {/* Main Image Stage (supports pinch-to-zoom, double-tap zoom at point, and 1-finger drag pan) */}
      <div
        ref={stageRef}
        className={`relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden touch-none bg-[#111827]/50 md:bg-transparent ${
          scale > 1.02 ? (isInteracting ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {failed ? (
          <p className="p-6 text-center text-sm text-warning" role="alert">
            เปิดภาพนี้ไม่ได้ ลิงก์อาจหมดอายุหรือเบราว์เซอร์ไม่รองรับไฟล์
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            draggable={false}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
              transition: isInteracting ? "none" : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            className="block max-h-full w-full object-contain select-none will-change-transform md:max-h-[calc(100dvh-32px)]"
            src={url}
            alt={item.name}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        )}

        {scale > 1.05 && (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              resetZoom();
            }}
            className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/20 bg-[#080d18]/80 px-3 py-1 text-xs font-medium text-white shadow-md backdrop-blur-md active:scale-95"
          >
            ซูม {scale.toFixed(1)}x · แตะเพื่อรีเซ็ต
          </button>
        )}

        {/* Desktop Previous / Next Arrows */}
        {hasPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="ภาพก่อนหน้า"
            className="absolute left-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-panel/85 text-foreground shadow-md backdrop-blur-sm hover:bg-panel md:grid"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="ภาพถัดไป"
            className="absolute right-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-panel/85 text-foreground shadow-md backdrop-blur-sm hover:bg-panel md:grid"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Mobile Bottom Sheet: Filename + Gesture Hint + Action Bar */}
      <div className="bg-[#080d18] px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] md:hidden">
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
            onClick={() => copyText(url, "คัดลอกลิงก์รูปภาพแล้ว")}
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] text-white/90 active:bg-white/10"
          >
            <Link2 size={18} className="text-muted" aria-hidden="true" />
            <span>คัดลอกลิงก์</span>
          </button>

          <a
            href={url}
            download={item.name}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => notify("กำลังเปิดดาวน์โหลดรูปภาพ")}
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] text-white/90 active:bg-white/10"
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

  if (!isMedia) {
    return (
      <div className="bg-panel text-foreground">
        <OverlayHeader title={item.name} titleClass={titleClass} fileInfo={fileInfo} onClose={onClose} overlay={false} />
        <p className="px-4 py-10 text-center text-sm text-muted">ไฟล์ประเภทนี้เปิดบนเว็บไม่ได้</p>
      </div>
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

  if (result.kind === "image") {
    return (
      <ImagePreviewViewer
        item={item}
        url={result.url}
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
