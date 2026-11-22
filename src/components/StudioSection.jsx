"use client";

import Link from "next/link";
import { control, subtitle, surface } from "@/lib/ui-styles";
import { studioSections } from "@/lib/studio-sections";
import { HistoryList } from "./HistoryList";
import { EmptyState } from "./EmptyState";
import { EmptyHistoryArtwork, EmptyScanArtwork } from "./EmptyStateArtwork";
import { ScanTree } from "./ScanTree";
import { SettingsPage } from "./SettingsPage";
import { StudioPage } from "./StudioContent";
import { StudioPageHeader } from "./StudioPageHeader";

export function StudioSection({ section, folders, history, accountSettings }) {
  const title = studioSections.find(([id]) => id === section)[1];
  if (section === "settings") return <SettingsPage title={title}>{accountSettings}</SettingsPage>;

  return (
    <StudioPage header={<StudioPageHeader heading={title} />}>
      {section === "scans" ? (
        folders.length ? (
          <section className={`${surface} mt-5 p-4`}>
            <h2 className={`${subtitle} mb-3.5`}>โฟลเดอร์ที่สแกน</h2>
            <ScanTree folders={folders} />
          </section>
        ) : <EmptyState heading="ยังไม่มีสถานะสแกน" illustration={EmptyScanArtwork} />
      ) : history.length ? <HistoryList history={history} /> : (
        <EmptyState heading="ยังไม่มีประวัติการเปิดไฟล์" illustration={EmptyHistoryArtwork}>
          <Link href="/library" className={control}>เปิดคลัง</Link>
        </EmptyState>
      )}
    </StudioPage>
  );
}
