"use client";

import Link, { useLinkStatus } from "next/link";
import { useRef } from "react";
import { Check, File, Image, LoaderCircle, Play } from "lucide-react";
import { catalogFontClass, folderHref } from "@/lib/catalog";
import { surface, thumbnailPreview } from "@/lib/ui-styles";
import { FolderArtwork } from "./FolderArtwork";
import { FolderActions } from "./FolderActions";
import { ScanStatus } from "./ScanTree";
import { ShortcutArtwork } from "./ShortcutArtwork";
import { Thumbnail } from "./Thumbnail";

export function CatalogItem({ item, selected, onSelect, onClear, onSelectAll, onPreview }) {
  const lastTouch = useRef(null);
  const folderLink = useRef(null);
  const Icon = item.kind === "image" ? Image : File;
  const isFolder = item.kind === "folder";
  const isVideo = item.kind === "video";
  const isShortcut = item.kind === "file" && /\.url$/i.test(item.name);
  const card = `${surface} flex min-w-0 touch-manipulation select-none flex-col p-[7px] text-start hover:border-accent-text data-[selected=true]:border-accent data-[selected=true]:bg-accent/10 data-[selected=true]:ring-1 data-[selected=true]:ring-accent/35 md:p-[9px] list-view:flex-row list-view:items-center list-view:gap-3 list-view:px-3 list-view:py-[7px]`;

  function handleClick(event) {
    const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    let open = event.detail === 0 || event.detail === 2;
    if (event.nativeEvent.pointerType === "touch") {
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
      <span className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-[9px] text-muted [background:radial-gradient(ellipse_at_50%_30%,color-mix(in_srgb,#7998c8_32%,var(--art)),var(--art)_76%)] list-view:aspect-square list-view:w-11 list-view:shrink-0">
        {selected && (
          <span className="absolute top-2 left-2 z-10 grid size-6 place-items-center rounded-md bg-panel list-view:top-0.5 list-view:left-0.5 list-view:size-4">
            <Check className="size-4 rounded-full bg-accent p-0.5 text-white list-view:size-3" aria-hidden="true" />
            <span className="sr-only">เลือกแล้ว</span>
          </span>
        )}
        {isFolder ? (
          <>
            <FolderArtwork thumbnail={item.thumbnail} hasItems={item.count > 0} />
            <FolderLoadingIndicator />
          </>
        ) : (
          <>
            {isShortcut ? (
              <ShortcutArtwork className="w-[clamp(44px,42%,104px)] max-h-[80%] list-view:w-8" />
            ) : !isVideo && (
              <Icon className="max-h-[72%] w-[clamp(44px,37%,88px)] drop-shadow-[0_8px_12px_#0c122444] list-view:w-[26px]" size={42} aria-hidden="true" />
            )}
            <Thumbnail src={item.thumbnail} className="absolute inset-0 size-full scale-110 object-cover blur-[16px] brightness-[.68]" />
            <Thumbnail src={item.thumbnail} className={thumbnailPreview} />
            {isVideo && (
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="grid size-11 place-items-center rounded-full bg-black/55 text-white list-view:size-6">
                  <Play className="ml-0.5 size-5 fill-current list-view:size-3" />
                </span>
              </span>
            )}
          </>
        )}
      </span>
      <span className="min-w-0 pt-[11px] pb-[5px] list-view:flex-1 list-view:px-0 list-view:py-[3px]">
        <span className={`line-clamp-1 text-[.96rem] font-medium ${catalogFontClass(item.name) ?? ""}`} title={item.name}>
          {item.name}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-[5px] text-xs text-muted md:justify-between">
          {isFolder ? <><span>{item.count} รายการ</span><ScanStatus status={item.status} /></> :
            <><span>{item.hasInfo ? "เคยเปิดใน Desktop" : "ยังไม่มีประวัติเปิด"}</span>
              {isShortcut ? <span>ทางลัดเว็บ</span> : item.kind !== "file" && <span>เปิดพรีวิว</span>}</>}
        </span>
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
