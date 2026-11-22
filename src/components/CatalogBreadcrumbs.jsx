"use client";

import Link from "next/link";
import { ChevronRight, Ellipsis, Folder } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { catalogFontClass, folderHref } from "@/lib/catalog";
import { Dropdown } from "./Dropdown";

const breadcrumbLink = "hover:underline aria-[current=page]:text-foreground";
const GAP = 6; // Tailwind gap-1.5 (0.375rem)

export function CatalogBreadcrumbs({ path }) {
  const current = path.at(-1);
  const ancestors = path.slice(0, -1);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [open, setOpen] = useState(false);
  const navRef = useRef(null);
  const measureRef = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const menuId = useId();

  useEffect(() => {
    const nav = navRef.current;
    const strip = measureRef.current;
    if (!nav || !strip || ancestors.length === 0) return;

    let cancelled = false;
    function recompute() {
      if (cancelled) return;
      const available = nav.clientWidth;
      if (available <= 0) return;

      const rootEl = strip.querySelector('[data-measure="root"]');
      const ellipsisEl = strip.querySelector('[data-measure="ellipsis"]');
      const currentEl = strip.querySelector('[data-measure="current"]');
      const ancestorEls = strip.querySelectorAll('[data-measure="ancestor"]');
      if (!rootEl || !ellipsisEl || !currentEl) return;

      const rootW = rootEl.getBoundingClientRect().width;
      const ellipsisW = ellipsisEl.getBoundingClientRect().width;
      const currentFullW = currentEl.getBoundingClientRect().width;
      const ancestorWidths = Array.from(ancestorEls, el => el.getBoundingClientRect().width);
      const currentTarget = Math.min(currentFullW, Math.max(180, available * 0.5));

      let nextHidden = ancestorWidths.length;
      for (let hide = 0; hide <= ancestorWidths.length; hide++) {
        let total = rootW + GAP + currentTarget;
        if (hide > 0) total += GAP + ellipsisW;
        for (let i = hide; i < ancestorWidths.length; i++) {
          total += GAP + ancestorWidths[i];
        }
        if (total <= available) {
          nextHidden = hide;
          break;
        }
      }
      setHiddenCount(nextHidden);
    }

    const observer = new ResizeObserver(recompute);
    observer.observe(nav);
    document.fonts?.ready.then(recompute);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [ancestors.length, path]);

  const clampedHidden = Math.min(hiddenCount, ancestors.length);
  const hidden = ancestors.slice(0, clampedHidden);
  const visibleAncestors = ancestors.slice(clampedHidden);
  const menuOpen = open && hidden.length > 0;

  useEffect(() => {
    if (!menuOpen) return;
    function closeOutside(event) {
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [menuOpen]);

  function dismiss() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <nav ref={navRef} className="relative mb-1 flex min-w-0 items-center gap-1.5 text-sm text-muted" aria-label="เส้นทางโฟลเดอร์"
      onBlur={event => {
        if (!trigger.current?.contains(event.relatedTarget) && !menu.current?.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={event => {
        if (menuOpen && event.key === "Escape") {
          event.stopPropagation();
          dismiss();
        }
      }}>
      {ancestors.length > 0 && current && (
        <div aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
          <div ref={measureRef} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span data-measure="root">คลัง</span>
            <span data-measure="ellipsis" className="inline-flex items-center gap-1.5">
              <ChevronRight size={14} />
              <span className="inline-block size-7" />
            </span>
            {ancestors.map(item => (
              <span key={item.id} data-measure="ancestor"
                className={`inline-flex items-center gap-1.5 ${catalogFontClass(item.name) ?? ""}`}>
                <ChevronRight size={14} />
                <span>{item.name}</span>
              </span>
            ))}
            <span data-measure="current"
              className={`inline-flex items-center gap-1.5 ${catalogFontClass(current.name) ?? ""}`}>
              <ChevronRight size={14} />
              <span>{current.name}</span>
            </span>
          </div>
        </div>
      )}

      <Link href="/library" className={`shrink-0 whitespace-nowrap ${breadcrumbLink}`}
        aria-current={current ? undefined : "page"}>
        คลัง
      </Link>

      {hidden.length > 0 && (
        <>
          <ChevronRight size={14} className="shrink-0" aria-hidden="true" />
          <button ref={trigger} type="button" aria-label="แสดงโฟลเดอร์ก่อนหน้า" title="แสดงโฟลเดอร์ก่อนหน้า"
            aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-foreground/10 hover:text-foreground aria-expanded:bg-foreground/10 aria-expanded:text-foreground"
            onClick={() => setOpen(prev => !prev)}>
            <Ellipsis size={16} aria-hidden="true" />
          </button>
          {menuOpen && (
            <Dropdown ref={menu} id={menuId}
              className="absolute top-full left-12 z-30 mt-1.5 max-h-[min(18rem,50dvh)] w-max min-w-[min(13rem,calc(100%-3rem))] max-w-[min(28rem,calc(100%-3rem))] overflow-y-auto p-1.5">
              {hidden.map(item => (
                <Link key={item.id} href={folderHref(item.id)} title={item.name}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-accent/10 focus-visible:bg-accent/10 ${catalogFontClass(item.name) ?? ""}`}>
                  <Folder size={16} className="shrink-0 text-muted" aria-hidden="true" />
                  <span className="min-w-0 truncate">{item.name}</span>
                </Link>
              ))}
            </Dropdown>
          )}
        </>
      )}

      {visibleAncestors.map(item => (
        <span key={item.id} className="inline-flex shrink-0 items-center gap-1.5">
          <ChevronRight size={14} className="shrink-0" aria-hidden="true" />
          <Link href={folderHref(item.id)} title={item.name}
            className={`whitespace-nowrap ${breadcrumbLink} ${catalogFontClass(item.name) ?? ""}`}>
            {item.name}
          </Link>
        </span>
      ))}

      {current && (
        <>
          <ChevronRight size={14} className="shrink-0" aria-hidden="true" />
          <Link href={folderHref(current.id)} title={current.name}
            className={`min-w-0 truncate ${breadcrumbLink} ${catalogFontClass(current.name) ?? ""}`}
            aria-current="page">
            {current.name}
          </Link>
        </>
      )}
    </nav>
  );
}
