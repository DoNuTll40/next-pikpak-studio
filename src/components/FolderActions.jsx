"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Ellipsis, ExternalLink, FolderOpen } from "lucide-react";
import { Dropdown } from "./Dropdown";

const action = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-accent/10 focus-visible:bg-accent/10";
const placements = {
  right: "absolute top-full left-full ml-1",
  left: "absolute top-full right-full mr-1",
  rightUp: "absolute bottom-0 left-full ml-1",
  leftUp: "absolute bottom-0 right-full mr-1",
  belowStart: "absolute top-full left-0 mt-1",
  belowEnd: "absolute top-full right-0 mt-1",
  aboveStart: "absolute bottom-full left-0 mb-1",
  aboveEnd: "absolute bottom-full right-0 mb-1",
  bottom: "fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] w-auto!",
};

function menuPlacement(button) {
  const rect = button.getBoundingClientRect();
  const root = document.documentElement;
  const rem = Number.parseFloat(getComputedStyle(root).fontSize);
  const width = 13 * rem;
  const height = 6 * rem;
  const inset = 8;
  const canGoRight = root.clientWidth - rect.right >= width + inset;
  const canGoLeft = rect.left >= width + inset;
  const canGoBelow = root.clientHeight - rect.bottom >= height + inset;
  const canGoAbove = rect.top >= height + inset;

  if (canGoRight && (canGoBelow || canGoAbove)) return canGoBelow ? "right" : "rightUp";
  if (canGoLeft && (canGoBelow || canGoAbove)) return canGoBelow ? "left" : "leftUp";
  const fitsStart = root.clientWidth - rect.left >= width + inset;
  const fitsEnd = rect.right >= width + inset;
  if (canGoBelow && fitsStart) return "belowStart";
  if (canGoBelow && fitsEnd) return "belowEnd";
  if (canGoAbove && fitsStart) return "aboveStart";
  if (canGoAbove && fitsEnd) return "aboveEnd";
  return "bottom";
}

export function FolderActions({ selected, pikpakHref, onOpen }) {
  const [placement, setPlacement] = useState(null);
  const open = placement !== null;
  const container = useRef(null);
  const trigger = useRef(null);
  const actionsId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOutside(event) {
      if (!container.current?.contains(event.target)) setPlacement(null);
    }
    function reposition() {
      if (trigger.current) setPlacement(menuPlacement(trigger.current));
    }
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  function dismiss() {
    setPlacement(null);
    trigger.current?.focus();
  }

  return (
    <div ref={container} className="absolute top-4 right-4 z-20 list-view:top-[calc(50%-16px)] list-view:right-2"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPlacement(null);
      }}
      onKeyDown={event => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          dismiss();
        }
      }}>
      <button ref={trigger} type="button" aria-label="คำสั่งโฟลเดอร์" aria-expanded={open}
        aria-controls={open ? actionsId : undefined}
        className={`grid size-8 place-items-center rounded-md border border-border bg-panel text-foreground shadow-sm hover:bg-field ${selected || open ? "" : "pointer-events-none opacity-0 group-hover/card:pointer-events-auto group-hover/card:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"}`}
        onClick={event => setPlacement(open ? null : menuPlacement(event.currentTarget))}>
        <Ellipsis size={18} aria-hidden="true" />
      </button>
      {open && (
        <Dropdown id={actionsId} className={`w-52 ${placements[placement]}`}>
          <button type="button" className={action} onClick={() => { dismiss(); onOpen(); }}>
            <FolderOpen size={16} aria-hidden="true" /> เปิดโฟลเดอร์
          </button>
          {pikpakHref ? (
            <a className={action} href={pikpakHref} target="_blank" rel="noopener noreferrer" onClick={dismiss}>
              <ExternalLink size={16} aria-hidden="true" /> เปิดด้วย PikPak
            </a>
          ) : (
            <button type="button" disabled title="ยังไม่มีเส้นทางของโฟลเดอร์นี้ใน PikPak"
              className={`${action} cursor-not-allowed! text-muted opacity-60`}>
              <ExternalLink size={16} aria-hidden="true" /> เปิดด้วย PikPak
            </button>
          )}
        </Dropdown>
      )}
    </div>
  );
}
