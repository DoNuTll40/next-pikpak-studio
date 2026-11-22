"use client";

import Link, { useLinkStatus } from "next/link";
import { useRef } from "react";
import { Check, Clock, File, Image, LoaderCircle, Play } from "lucide-react";
import { catalogFontClass, folderHref, formatDuration, formatExpiryInfo, formatFileSize } from "@/lib/catalog";
import { surface, thumbnailPreview } from "@/lib/ui-styles";
import { FolderArtwork } from "./FolderArtwork";
import { FolderActions } from "./FolderActions";
import { ScanStatus } from "./ScanTree";
import { ShortcutArtwork } from "./ShortcutArtwork";
import { Thumbnail } from "./Thumbnail";

export function CatalogItem({ item, now = null, selected, onSelect, onClear, onSelectAll, onPreview, mobilePhotoTile = false }) {
  const lastTouch = useRef(null);
  const folderLink = useRef(null);
  const Icon = item.kind === "image" ? Image : File;
  const isFolder = item.kind === "folder";
  const isVideo = item.kind === "video";
  const isShortcut = item.kind === "file" && /\.url$/i.test(item.name);
  const durationLabel = isVideo ? formatDuration(item.duration) : "";
  const sizeLabel = !isFolder ? formatFileSize(item.sizeBytes) : "";
  const expiry = formatExpiryInfo(item.expiresAt, now);
  const expiryTone =
    expiry?.state === "expired"
      ? "text-rose-400 light-theme:text-rose-600"
      : expiry?.state === "soon"
        ? "text-warning"
        : "text-muted";
  const card = `${surface} flex min-w-0 touch-manipulation select-none flex-col p-[7px] text-start hover:border-accent-text data-[selected=true]:border-accent data-[selected=true]:bg-accent/10 data-[selected=true]:ring-1 data-[selected=true]:ring-accent/35 desktop:p-[9px] list-view:flex-row list-view:items-center list-view:gap-3 list-view:px-3 list-view:py-[7px] ${
    mobilePhotoTile
      ? "mobile:grid-view:rounded-none mobile:grid-view:border-0 mobile:grid-view:bg-transparent mobile:grid-view:p-0"
      : ""
  }`;

  function handleClick(event) {
    const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    let open = event.detail === 0 || event.detail === 2;
    if (event.nativeEvent.pointerType === "touch") {
      // On mobile 3-column photo tiles, a single tap opens the image viewer immediately
      if (mobilePhotoTile && !isFolder && !modified) {
        onPreview(item);
        return;
      }
      const previous = lastTouch.current;
      open = previous !== null && event.timeStamp - previous <= 350;
      lastTouch.current = open ? null : event.timeStamp;
    }

    if (!open || modified) {
      event.preventDefault();
      onSelect(item.id, event);
    } else if (!isFolder) {
      onPreview(item);
    }
  }

  function handleKeyDown(event) {
    if (event.key === " ") {
      event.preventDefault();
      onSelect(item.id, event);
    } else if (event.key === "Escape") {
      onClear();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      onSelectAll();
    }
  }

  const interaction = {
    className: card,
    "data-catalog-item": "",
    "data-selected": selected,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
  };
  const body = (
    <>
      <span className={`relative grid aspect-video w-full place-items-center overflow-hidden rounded-[9px] text-muted [background:radial-gradient(ellipse_at_50%_30%,color-mix(in_srgb,#7998c8_32%,var(--art)),var(--art)_76%)] list-view:aspect-square list-view:w-11 list-view:shrink-0 ${
        mobilePhotoTile ? "mobile:grid-view:aspect-square mobile:grid-view:rounded-[2px]" : ""
      }`}>
        {selected && (
          <span className="absolute top-2 left-2 z-10 grid size-6 place-items-center rounded-md bg-panel list-view:top-0.5 list-view:left-0.5 list-view:size-4">
            <Check className="size-4 rounded-full bg-accent p-0.5 text-white list-view:size-3" aria-hidden="true" />
            <span className="sr-only">เลือกแล้ว</span>
          </span>
        )}
        {isFolder ? (
          <>
            <FolderArtwork thumbnail={item.thumbnail} />
            <FolderLoadingIndicator />
          </>
        ) : (
          <>
            {isShortcut ? (
              <ShortcutArtwork className="w-[clamp(44px,42%,104px)] max-h-[80%] list-view:w-8" />
            ) : !isVideo && (
              <Icon className="max-h-[72%] w-[clamp(32px,34%,88px)] drop-shadow-[0_8px_12px_#0c122444] list-view:w-[26px]" size={38} aria-hidden="true" />
            )}
            <Thumbnail src={item.thumbnail} className="absolute inset-0 size-full scale-110 object-cover blur-[16px] brightness-[.68]" />
            <Thumbnail src={item.thumbnail} className={`${thumbnailPreview} ${mobilePhotoTile ? "mobile:grid-view:object-cover" : ""}`} />
            {isVideo && (
              <>
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="grid size-11 place-items-center rounded-full bg-black/55 text-white list-view:size-6">
                    <Play className="ml-0.5 size-5 fill-current list-view:size-3" />
                  </span>
                </span>
                {durationLabel && (
                  <span className="pointer-events-none absolute right-1.5 bottom-1.5 z-10 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] leading-tight font-medium text-white tabular-nums backdrop-blur-[2px] list-view:hidden">
                    {durationLabel}
                  </span>
                )}
              </>
            )}
          </>
        )}
      </span>
      <span className={`min-w-0 pt-[11px] pb-[5px] list-view:flex-1 list-view:px-0 list-view:py-[3px] ${
        mobilePhotoTile ? "mobile:grid-view:hidden" : ""
      }`}>
        <span className={`line-clamp-1 text-[.96rem] font-medium ${catalogFontClass(item.name) ?? ""}`} title={item.name}>
          {item.name}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-[5px] text-xs text-muted desktop:justify-between">
          {isFolder ? (
            <>
              <span>{item.count > 0 ? `${item.count} รายการ` : "โฟลเดอร์"}</span>
              <ScanStatus status={item.status} />
            </>
          ) : (
            <>
              <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 tabular-nums">
                {durationLabel && <span className="hidden list-view:inline font-medium text-foreground/85">{durationLabel}</span>}
                {durationLabel && sizeLabel && <span className="hidden list-view:inline opacity-60">·</span>}
                {sizeLabel && <span className="font-medium text-foreground/80">{sizeLabel}</span>}
                {sizeLabel && <span className="opacity-60">·</span>}
                <span>{item.hasInfo ? "เคยเปิดใน Desktop" : "ยังไม่มีประวัติเปิด"}</span>
              </span>
              {isShortcut ? <span>ทางลัดเว็บ</span> : item.kind !== "file" && <span className="mobile:grid-view:hidden shrink-0">เปิดพรีวิว</span>}
            </>
          )}
        </span>
        {expiry && (
          <span
            title={isFolder ? `ลิงก์ที่ใกล้หมดอายุที่สุดในโฟลเดอร์นี้ (${expiry.title})` : expiry.title}
            className={`mt-1.5 flex items-center gap-1 text-[11px] leading-tight tabular-nums ${expiryTone}`}
          >
            <Clock size={11} className="shrink-0 opacity-85" aria-hidden="true" />
            <span className="truncate">{expiry.label}</span>
          </span>
        )}
      </span>
    </>
  );

  if (isFolder) {
    return (
      <div className="group/card relative min-w-0 focus-within:z-10" data-catalog-item="">
        <Link ref={folderLink} href={folderHref(item.id)} prefetch={false} {...interaction}
          className={`${card} h-full w-full list-view:pr-12`}>
          {body}
        </Link>
        <FolderActions selected={selected} pikpakHref={item.pikpakHref}
          onOpen={() => folderLink.current?.click()} />
      </div>
    );
  }

  return <button type="button" {...interaction}>{body}</button>;
}

function FolderLoadingIndicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span role="status" className="absolute inset-0 grid place-items-center bg-black/25">
      <span className="grid size-10 place-items-center rounded-full bg-panel text-accent list-view:size-7">
        <LoaderCircle className="size-5 motion-safe:animate-spin list-view:size-4" aria-hidden="true" />
      </span>
      <span className="sr-only">กำลังเปิดโฟลเดอร์…</span>
    </span>
  );
}
