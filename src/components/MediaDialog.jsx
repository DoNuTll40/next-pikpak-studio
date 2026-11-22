"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useMediaPreview } from "@/hooks/useMediaPreview";
import { catalogFontClass, formatStudioDate } from "@/lib/catalog";
import { useStudioPreferences } from "@/providers/StudioProvider";
import { VideoPlayer } from "./VideoPlayer";

const topActionButton = "grid size-10 sm:size-8 shrink-0 place-items-center rounded-lg bg-panel/90 text-muted shadow-sm backdrop-blur-sm hover:bg-panel hover:text-foreground";

export function MediaDialog({ item, onClose }) {
  const dialog = useRef(null);
  const closingRef = useRef(false);
  const [visible, setVisible] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reducedMotion = useReducedMotion();
  const result = useMediaPreview(item, reloadKey);

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
      className="fixed inset-0 m-0 size-full max-h-none max-w-none items-center justify-center overflow-hidden border-0 bg-transparent p-0 sm:p-4 text-foreground backdrop:bg-transparent open:flex"
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
            className="fixed inset-0 bg-[#080d18]/45"
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
            className="relative z-1 max-h-dvh sm:max-h-[calc(100dvh-32px)] w-full sm:w-[min(1040px,calc(100vw-32px))] overflow-hidden rounded-none sm:rounded-2xl bg-transparent shadow-[0_16px_48px_rgba(8,13,24,0.32)]"
          >
            <MediaContent key={reloadKey} item={item} result={result} fileInfo={fileInfo}
              onReload={() => setReloadKey(prev => prev + 1)} onClose={requestClose} />
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
    <button type="button" onClick={copy}
      title="คัดลอก JSON ของ file_info ทั้งหมด"
      className={`inline-flex h-10 sm:h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium shadow-sm backdrop-blur-sm ${
        copied
          ? "bg-panel text-success"
          : "bg-panel/90 text-foreground hover:bg-panel hover:text-accent-text"
      }`}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span className="hidden sm:inline">{copied ? "คัดลอกแล้ว" : "คัดลอก JSON"}</span>
    </button>
  );
}

function OverlayHeader({ title, titleClass, fileInfo, onClose, overlay = true }) {
  return (
    <div className={overlay
      ? "absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-[#080d18]/65 via-[#080d18]/25 to-transparent px-4 pt-3.5 pb-9"
      : "flex items-center justify-between gap-3 border-b border-border px-4 py-3"}>
      <h2 id="preview-title" title={title}
        className={`min-w-0 truncate text-sm font-medium ${overlay ? "text-white drop-shadow-xs" : "text-foreground"} ${titleClass}`}>
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

function MediaContent({ item, result, fileInfo, onReload, onClose }) {
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
      <div className="relative flex aspect-video max-h-[calc(100dvh-32px)] w-full items-center justify-center overflow-hidden bg-[#080d18]">
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
      <div className="bg-panel text-foreground">
        <OverlayHeader title={item.name} titleClass={titleClass} fileInfo={fileInfo} onClose={onClose} overlay={false} />
        <p className="mx-auto max-w-md px-4 py-10 text-center text-sm text-muted" role="status">
          ไม่มีลิงก์สำหรับเปิดไฟล์นี้บนเว็บ ลองเปิดพรีวิวใน PikPak Desktop เพื่ออัปเดตลิงก์
        </p>
      </div>
    );
  }

  if (result.kind === "image") {
    return (
      <div className="relative flex min-h-[50dvh] max-h-[calc(100dvh-32px)] w-full items-center justify-center bg-[#080d18]">
        <OverlayHeader title={item.name} titleClass={titleClass} fileInfo={fileInfo} onClose={onClose} />
        {failed ? (
          <p className="p-6 text-sm text-warning" role="alert">
            เปิดภาพนี้ไม่ได้ ลิงก์อาจหมดอายุหรือเบราว์เซอร์ไม่รองรับไฟล์
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="block max-h-[calc(100dvh-32px)] w-full object-contain" src={result.url} alt={item.name}
            referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        )}
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
