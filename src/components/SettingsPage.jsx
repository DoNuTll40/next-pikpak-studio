"use client";

import Image from "next/image";
import { CheckCircle2, Download, ExternalLink, Grid2X2, List, Moon, Sun } from "lucide-react";
import { DESKTOP_RELEASE } from "@/lib/desktop-release";
import { control, subtitle, surface } from "@/lib/ui-styles";
import { SegmentedControl } from "./SegmentedControl";
import { Select } from "./Select";
import { useStudioPreferences } from "@/providers/StudioProvider";
import { StudioPage } from "./StudioContent";
import { SignOutForm } from "./SignOutForm";

const width = "mx-auto w-full max-w-[46rem]";
const row = "flex flex-wrap items-center justify-between gap-3 py-2 text-sm";

export function SettingsPage({ title, children }) {
  const {
    theme, setTheme, view, setView, density, setDensity, defaultSort, setDefaultSort,
    videoQuality, setVideoQuality, resetPreferences,
  } = useStudioPreferences();
  const isExternal = /^https?:\/\//i.test(DESKTOP_RELEASE.downloadUrl);

  return (
    <div className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 blur-3xl
        [--settings-glow:#263148] light-theme:[--settings-glow:#d8e2fb]
        bg-[radial-gradient(ellipse_34rem_18rem_at_50%_-3rem,var(--settings-glow)_0%,transparent_100%)]" />
      <StudioPage
        header={<header className="px-4 pt-5 sm:pt-6"><h1 className={`${width} text-xl font-semibold`}>{title}</h1></header>}
        footer={<SignOutForm className={`${width} [&_button]:w-full`} />}
        footerClassName="desktop:hidden"
      >
        <div className={`${width} mt-4 pb-4`}>
          <div className="mb-5">{children}</div>
          <div className={`${surface} divide-y divide-border`}>
            <section className="px-4 pt-4 pb-2 sm:px-5" aria-labelledby="display-preferences">
              <h2 id="display-preferences" className={`${subtitle} mb-1`}>การแสดงผลและคลัง</h2>
              <div className="divide-y divide-border">
                <div className={row}>
                  <span>ธีม</span>
                  <SegmentedControl label="ธีม" value={theme} onChange={setTheme}
                    options={[["dark", "มืด", Moon], ["light", "สว่าง", Sun]]} />
                </div>
                <div className={row}>
                  <span>มุมมองคลัง</span>
                  <SegmentedControl label="มุมมองคลัง" value={view} onChange={setView}
                    options={[["grid", "ตาราง", Grid2X2], ["list", "รายการ", List]]} />
                </div>
                <SelectPreference label="ความหนาแน่นของรายการ" value={density} onChange={setDensity}
                  options={[["compact", "กะทัดรัด"], ["standard", "มาตรฐาน"], ["spacious", "โปร่ง"]]} />
                <SelectPreference label="ลำดับเริ่มต้น" value={defaultSort} onChange={setDefaultSort}
                  options={[["asc", "ชื่อ A–Z"], ["desc", "ชื่อ Z–A"]]} />
              </div>
            </section>
            <section className="px-4 pt-4 pb-2 sm:px-5" aria-labelledby="video-preferences">
              <h2 id="video-preferences" className={subtitle}>การเล่นวิดีโอ</h2>
              <SelectPreference label="ความละเอียดเริ่มต้น" value={videoQuality} onChange={setVideoQuality}
                options={[["auto", "ค่าเริ่มต้นของไฟล์"], ["720", "เน้น 720p"], ["1080", "เน้น 1080p"], ["original", "ต้นฉบับ"]]} />
            </section>
            <section className="px-4 pt-4 pb-4 sm:px-5" aria-labelledby="desktop-release-info">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Image
                    src="/desktop-app-icon.png"
                    alt="ไอคอนแอป PikPak Studio Desktop"
                    width={42}
                    height={42}
                    unoptimized
                    className="size-10.5 shrink-0 rounded-xl shadow-xs"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id="desktop-release-info" className={subtitle}>PikPak Studio Desktop</h2>
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-text">
                        {DESKTOP_RELEASE.tag}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {DESKTOP_RELEASE.platform} · {DESKTOP_RELEASE.sizeLabel} · อัปเดต {DESKTOP_RELEASE.releasedAt}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={DESKTOP_RELEASE.downloadUrl}
                    download={isExternal ? undefined : DESKTOP_RELEASE.filename}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-xs font-medium text-white shadow-xs hover:bg-accent/90"
                  >
                    <Download size={14} className="shrink-0" aria-hidden="true" />
                    <span>ดาวน์โหลดตัวติดตั้ง ({DESKTOP_RELEASE.tag})</span>
                  </a>
                  <a
                    href={DESKTOP_RELEASE.githubReleaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${control} inline-flex h-9 items-center gap-1.5 text-xs`}
                  >
                    <ExternalLink size={13} className="shrink-0" aria-hidden="true" />
                    <span>GitHub Release</span>
                  </a>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-muted">
                {DESKTOP_RELEASE.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-accent-text" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 truncate font-mono text-[11px] text-muted/80" title={DESKTOP_RELEASE.sha256}>
                SHA-256: {DESKTOP_RELEASE.sha256}
              </p>
            </section>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className={control} onClick={resetPreferences}>คืนค่าเริ่มต้น</button>
          </div>
        </div>
      </StudioPage>
    </div>
  );
}

function SelectPreference({ label, value, onChange, options }) {
  return (
    <div className={row}>
      {label}
      <Select label={label} value={value} onChange={onChange} options={options} />
    </div>
  );
}
