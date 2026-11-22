"use client";

import Link from "next/link";
import { ArrowUp, ChevronLeft, Grid2X2, List, ListTree, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { catalogFontClass, folderHref } from "@/lib/catalog";
import { EmptyState } from "./EmptyState";
import { control, field, subtitle } from "@/lib/ui-styles";
import { SegmentedControl } from "./SegmentedControl";
import { Select } from "./Select";
import { CatalogBreadcrumbs } from "./CatalogBreadcrumbs";
import { CatalogItem } from "./CatalogItem";
import { MediaDialog } from "./MediaDialog";
import { useStudioPreferences } from "@/providers/StudioProvider";
import { useCatalogFilters } from "@/hooks/useCatalogFilters";
import { useCatalogSelection } from "@/hooks/useCatalogSelection";
import { FolderDrawer } from "./FolderDrawer";
import { StudioPage } from "./StudioContent";
import { StudioPageHeader } from "./StudioPageHeader";

const cardDensities = {
  compact: "grid-view:gap-2 md:grid-view:grid-cols-[repeat(auto-fill,minmax(min(100%,190px),1fr))] list-view:gap-1",
  standard: "grid-view:gap-2.5 md:grid-view:grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] md:grid-view:gap-4 list-view:gap-2",
  spacious: "grid-view:gap-4 md:grid-view:grid-cols-[repeat(auto-fill,minmax(min(100%,290px),1fr))] md:grid-view:gap-5 list-view:gap-4",
};
const sectionHeading = "my-1 flex items-center justify-between gap-0";

export function CatalogView({ path, folders, items }) {
  const current = path.at(-1);
  const parentFolder = path.length > 1 ? path.at(-2) : null;
  const backHref = current ? folderHref(parentFolder?.id ?? null) : null;
  const { view, setView, treeOpen, setTreeOpen, density, defaultSort } = useStudioPreferences();
  const { query, setQuery, filter, setFilter, sort, setSort, located, unresolved } = useCatalogFilters(items, defaultSort);
  const { selected, select, clear, selectAll } = useCatalogSelection([...located, ...unresolved]);
  const [preview, setPreview] = useState(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Detect photo-album folders on mobile (contains images, and no folders or videos in located list)
  const isPhotoFolder =
    located.length > 0 &&
    located.every(item => item.kind === "image") &&
    !located.some(item => item.kind === "folder" || item.kind === "video");

  const cards = isPhotoFolder
    ? `grid max-md:grid-view:grid-cols-3 max-md:grid-view:gap-0.5 max-md:grid-view:-mx-4 md:grid-view:grid-cols-2 list-view:grid-cols-1 py-2 ${cardDensities[density]}`
    : `grid grid-view:grid-cols-2 list-view:grid-cols-1 py-2 ${cardDensities[density]}`;

  // Playable media items in the current view so the mobile viewer can swipe prev/next
  const mediaList = located.filter(item => item.kind === "image" || item.kind === "video");

  useEffect(() => {
    function onScroll() {
      setShowScrollTop(window.scrollY > 360);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function renderItem(item, allowPhotoTile = false) {
    return (
      <CatalogItem
        key={item.id}
        item={item}
        selected={selected.has(item.id)}
        onSelect={select}
        onClear={clear}
        onSelectAll={selectAll}
        onPreview={setPreview}
        mobilePhotoTile={allowPhotoTile && isPhotoFolder && item.kind === "image"}
      />
    );
  }

  return (
    <>
      <StudioPage header={
        <>
          {/* Mobile-Only Compact Header (< md) */}
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-3 pt-2.5 pb-2.5 backdrop-blur-md md:hidden">
            <div className="flex items-center gap-1.5">
              {backHref && (
                <Link
                  href={backHref}
                  aria-label="ย้อนกลับไปโฟลเดอร์ก่อนหน้า"
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-foreground hover:bg-panel active:scale-95"
                >
                  <ChevronLeft size={21} aria-hidden="true" />
                </Link>
              )}
              <div className="min-w-0 flex-1 pl-0.5">
                <h1
                  className={`truncate text-[1.02rem] leading-tight font-semibold text-foreground ${current ? (catalogFontClass(current.name) ?? "") : ""}`}
                  title={current?.name ?? "คลังของฉัน"}
                >
                  {current?.name ?? "คลังของฉัน"}
                </h1>
                <p className="mt-0.5 text-[11.5px] leading-tight text-muted" aria-live="polite">
                  {located.length} รายการ
                </p>
              </div>
              <button
                type="button"
                aria-label={mobileSearchOpen ? "ปิดค้นหา" : "ค้นหาในหน้านี้"}
                aria-expanded={mobileSearchOpen || Boolean(query)}
                onClick={() => {
                  if (mobileSearchOpen && query) {
                    setQuery("");
                  }
                  setMobileSearchOpen(prev => !prev);
                }}
                className={`grid size-9 shrink-0 place-items-center rounded-xl border transition-colors ${
                  mobileSearchOpen || query
                    ? "border-accent/60 bg-accent/15 text-accent-text"
                    : "border-transparent text-muted hover:bg-panel hover:text-foreground"
                }`}
              >
                <Search size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="โครงสร้างโฟลเดอร์"
                aria-haspopup="dialog"
                aria-expanded={treeOpen}
                aria-controls={treeOpen ? "catalog-tree" : undefined}
                onClick={() => setTreeOpen(true)}
                className="grid size-9 shrink-0 place-items-center rounded-xl border border-transparent text-muted hover:bg-panel hover:text-foreground"
              >
                <ListTree size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Expandable Mobile Search Field */}
            {(mobileSearchOpen || query) && (
              <div className="mt-2">
                <label className={`${field} flex min-h-9 items-center gap-2 px-3 text-sm text-muted focus-within:border-accent-text [&>svg]:shrink-0`}>
                  <Search size={16} />
                  <input
                    className="w-full min-w-0 text-sm text-foreground outline-none!"
                    type="search"
                    autoFocus
                    aria-label="ค้นหารายการในโฟลเดอร์นี้"
                    placeholder="ค้นหาในหน้านี้…"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="ล้างคำค้นหา"
                      onClick={() => setQuery("")}
                      className="grid size-6 place-items-center rounded-md text-muted hover:text-foreground"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </label>
              </div>
            )}

            {/* Mobile Filter Chips + View Switch Row */}
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <Select
                  label="กรองตามข้อมูลไฟล์"
                  value={filter}
                  onChange={setFilter}
                  className="[&_button]:min-h-8 [&_button]:rounded-full [&_button]:px-3 [&_button]:text-xs"
                  options={[["all", "ทั้งหมด"], ["known", "เคยเปิดแล้ว"], ["unknown", "ยังไม่เคยเปิด"]]}
                />
                <Select
                  label="เรียงรายการ"
                  value={sort}
                  onChange={setSort}
                  className="[&_button]:min-h-8 [&_button]:rounded-full [&_button]:px-3 [&_button]:text-xs"
                  options={[["asc", "ชื่อ A–Z"], ["desc", "ชื่อ Z–A"]]}
                />
              </div>
              <SegmentedControl
                label="รูปแบบรายการ"
                value={view}
                onChange={setView}
                iconOnly
                className="min-h-8 rounded-full p-0.5 [&_button]:min-h-7 [&_button]:min-w-8 [&_button]:rounded-full"
                options={[["grid", "ตาราง", Grid2X2], ["list", "รายการ", List]]}
              />
            </div>
          </header>

          {/* Desktop Header (md and above — unchanged) */}
          <div className="hidden md:block">
            <StudioPageHeader
              heading={current?.name ?? "คลังของฉัน"}
              headingClass={current ? catalogFontClass(current.name) : undefined}
              label={<CatalogBreadcrumbs path={path} />}
              actions={
                <button className={`${control} shrink-0`} aria-haspopup="dialog" aria-expanded={treeOpen}
                  aria-controls={treeOpen ? "catalog-tree" : undefined}
                  onClick={() => setTreeOpen(true)}><ListTree size={18} /> โครงสร้างโฟลเดอร์</button>
              }
            >
              <div className="mt-[18px] mb-2 flex flex-wrap items-stretch gap-2 md:mt-5 md:mb-3 md:flex-nowrap md:gap-2.5">
                <label className={`${field} flex flex-1 basis-full items-center gap-2.5 px-3 text-muted focus-within:border-accent-text md:basis-auto [&>svg]:shrink-0`}><Search size={18} /><input className="w-full min-w-0 text-foreground outline-none!" type="search" aria-label="ค้นหารายการในโฟลเดอร์นี้"
                  placeholder="ค้นหาในหน้านี้" value={query} onChange={event => setQuery(event.target.value)} /></label>
                <Select label="กรองตามข้อมูลไฟล์" value={filter} onChange={setFilter}
                  options={[["all", "ทั้งหมด"], ["known", "เคยเปิดใน Desktop"], ["unknown", "ยังไม่มีประวัติเปิด"]]} />
                <Select label="เรียงรายการ" value={sort} onChange={setSort}
                  options={[["asc", "ชื่อ A–Z"], ["desc", "ชื่อ Z–A"]]} />
                <SegmentedControl label="รูปแบบรายการ" value={view} onChange={setView} iconOnly className="ml-auto md:ml-0"
                  options={[["grid", "ตาราง", Grid2X2], ["list", "รายการ", List]]} />
              </div>
            </StudioPageHeader>
          </div>
        </>
      }>
        <section className={!located.length && !unresolved.length ? "mt-2 md:mt-4 flex flex-1 flex-col" : "mt-1 md:mt-4"}
          aria-labelledby="items-heading">
          <div className={`${sectionHeading} hidden md:flex`}>
            <h2 className={subtitle} id="items-heading">{current ? "รายการ" : "แชร์หลัก"}</h2>
            <span className="text-xs text-muted" aria-live="polite">{located.length} รายการ</span>
          </div>
          {located.length ? (
            <div className={cards}>
              {located.map(item => renderItem(item, true))}
            </div>
          ) : (
            <EmptyState heading={query || filter !== "all" ? "ไม่พบรายการที่ตรงกัน" :
              current ? "โฟลเดอร์นี้ยังไม่มีรายการ" : "ยังไม่มีแชร์หลัก"} />
          )}
        </section>
        {unresolved.length > 0 && (
          <section className="mt-7" aria-labelledby="unresolved-heading">
            <div className={sectionHeading}>
              <h2 className={subtitle} id="unresolved-heading">รายการที่ยังไม่ทราบตำแหน่ง</h2>
              <span className="text-xs text-muted">{unresolved.length} รายการ</span>
            </div>
            <div className={`grid grid-view:grid-cols-2 list-view:grid-cols-1 py-2 ${cardDensities[density]}`}>
              {unresolved.map(item => renderItem(item, false))}
            </div>
          </section>
        )}
      </StudioPage>

      {/* Mobile Floating Scroll-to-Top FAB */}
      {showScrollTop && (
        <button
          type="button"
          aria-label="เลื่อนกลับขึ้นด้านบนสุด"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-4 bottom-[calc(70px+env(safe-area-inset-bottom))] z-20 grid size-10 place-items-center rounded-full border border-border bg-panel/95 text-foreground shadow-lg backdrop-blur-md active:scale-90 md:hidden"
        >
          <ArrowUp size={18} aria-hidden="true" />
        </button>
      )}

      {treeOpen && (
        <FolderDrawer folders={folders} path={path} onClose={() => setTreeOpen(false)} />
      )}
      {preview && (
        <MediaDialog
          key={preview.id}
          item={preview}
          items={mediaList}
          onSelectItem={setPreview}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
