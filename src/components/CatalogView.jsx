"use client";

import { Grid2X2, List, ListTree, Search } from "lucide-react";
import { useState } from "react";
import { catalogFontClass } from "@/lib/catalog";
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
  const { view, setView, treeOpen, setTreeOpen, density, defaultSort } = useStudioPreferences();
  const { query, setQuery, filter, setFilter, sort, setSort, located, unresolved } = useCatalogFilters(items, defaultSort);
  const { selected, select, clear, selectAll } = useCatalogSelection([...located, ...unresolved]);
  const cards = `grid grid-view:grid-cols-2 list-view:grid-cols-1 py-2 ${cardDensities[density]}`;
  const [preview, setPreview] = useState(null);

  function renderItem(item) {
    return (
      <CatalogItem key={item.id} item={item} selected={selected.has(item.id)}
        onSelect={select} onClear={clear} onSelectAll={selectAll} onPreview={setPreview} />
    );
  }

  return (
    <>
      <StudioPage header={
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
          <div className="mt-[18px] mb-[23px] flex flex-wrap items-stretch gap-2 md:mt-6 md:mb-[29px] md:flex-nowrap md:gap-2.5">
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
      }>
        <section className={!located.length && !unresolved.length ? "flex flex-1 flex-col" : undefined}
          aria-labelledby="items-heading">
          <div className={sectionHeading}><h2 className={subtitle} id="items-heading">{current ? "รายการ" : "แชร์หลัก"}</h2>
            <span className="text-xs text-muted" aria-live="polite">{located.length} รายการ</span></div>
          {located.length ? (
            <div className={cards}>
              {located.map(renderItem)}
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
            <div className={cards}>
              {unresolved.map(renderItem)}
            </div>
          </section>
        )}
      </StudioPage>
      {treeOpen && (
        <FolderDrawer folders={folders} path={path} onClose={() => setTreeOpen(false)} />
      )}
      {preview && <MediaDialog key={preview.id} item={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
