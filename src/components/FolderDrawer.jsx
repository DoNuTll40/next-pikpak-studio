"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { surface } from "@/lib/ui-styles";
import { ScanTree } from "./ScanTree";
import { EmptyState } from "./EmptyState";

export function FolderDrawer({ folders, path, onClose }) {
  const dialog = useRef(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (el.open && !el.matches(":modal")) el.removeAttribute("open");
    if (!el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      id="catalog-tree"
      aria-labelledby="catalog-tree-title"
      className="fixed inset-0 m-0 size-full max-h-none max-w-none items-end justify-end overflow-hidden bg-transparent text-foreground backdrop:bg-black/45 open:flex md:items-stretch md:p-3"
      onClose={onClose}
      onClick={event => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className={`${surface} flex max-h-[70dvh] w-full flex-col overflow-hidden rounded-b-none p-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_12px_45px_#0005] motion-safe:animate-sheet-in md:max-h-none md:w-[320px] md:rounded-2xl md:p-3 motion-safe:md:animate-drawer-in`}>
        <header className="mb-1.5 flex shrink-0 items-center justify-between gap-2 px-1.5">
          <h2 className="text-[0.95rem] font-semibold" id="catalog-tree-title">โครงสร้างโฟลเดอร์</h2>
          <form method="dialog">
            <button className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-field hover:text-foreground"
              aria-label="ปิดโครงสร้างโฟลเดอร์"><X size={18} aria-hidden="true" /></button>
          </form>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {folders.some(folder => folder.parent === null) ? <ScanTree folders={folders} path={path} compact /> :
            <div className="flex min-h-full flex-col">
              <EmptyState heading="ยังไม่มีโฟลเดอร์" />
            </div>}
        </div>
      </div>
    </dialog>
  );
}
