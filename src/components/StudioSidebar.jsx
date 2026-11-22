"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { studioSections } from "@/lib/studio-sections";
import { FolderIcon } from "./FolderIcon";
import { SignOutForm } from "./SignOutForm";

const DESKTOP_VERSION = "0.1.0";
const DESKTOP_FILENAME = "PikPak Studio_0.1.0_x64-setup.exe";
const DESKTOP_DOWNLOAD_URL = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ||
  `/app/release/${encodeURIComponent(DESKTOP_FILENAME)}`;

export function StudioSidebar({ account, toggle }) {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-3 border-t border-border bg-field px-1.5 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))] md:sticky md:top-0 md:flex md:h-dvh md:min-w-[184px] md:flex-col md:gap-6 md:border-t-0 md:px-3.5 md:py-5">
      <div className="hidden h-11 shrink-0 items-center justify-between gap-1 md:flex">
        <Link href="/library" className="flex min-w-0 items-center gap-2 rounded-xl">
          <FolderIcon className="size-8 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-[0.95rem] leading-tight font-semibold">PikPak Studio</span>
            <small className="mt-0.5 block truncate text-xs leading-tight text-muted">คลังส่วนตัว</small>
          </span>
        </Link>
        {toggle}
      </div>
      <Suspense fallback={<SectionNav />}>
        <ActiveSectionNav />
      </Suspense>
      <div className="mt-auto hidden flex-col gap-3 md:flex">
        <DesktopAppCard />
        <div className="space-y-2 border-t border-border pt-3.5">
          {account}
          <SignOutForm className="[&_button]:w-full" />
        </div>
      </div>
    </aside>
  );
}

function DesktopAppCard() {
  const isExternal = /^https?:\/\//i.test(DESKTOP_DOWNLOAD_URL);
  return (
    <section aria-label="ดาวน์โหลดแอป Desktop"
      className="rounded-2xl border border-border bg-gradient-to-br from-accent/[0.08] via-panel to-panel p-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <Image
          src="/desktop-app-icon.png"
          alt="ไอคอนแอป PikPak Studio Desktop"
          width={36}
          height={36}
          unoptimized
          className="size-9 shrink-0 rounded-[10px] shadow-xs"
        />
        <div className="min-w-0">
          <p className="truncate text-xs leading-tight font-semibold text-foreground">PikPak Desktop</p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted">Windows · v{DESKTOP_VERSION}</p>
        </div>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        ซิงก์คลังอัตโนมัติและดาวน์โหลดวิดีโอเต็มสปีด
      </p>
      <a
        href={DESKTOP_DOWNLOAD_URL}
        download={isExternal ? undefined : DESKTOP_FILENAME}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-2.5 text-xs font-medium text-white shadow-xs hover:bg-accent/90"
      >
        <Download size={13} className="shrink-0" aria-hidden="true" />
        <span className="truncate">ดาวน์โหลดแอป</span>
      </a>
    </section>
  );
}

function ActiveSectionNav() {
  const pathname = usePathname();
  const active = studioSections.find(([id]) => pathname === `/${id}` || pathname.startsWith(`/${id}/`));
  return <SectionNav active={active?.[0]} />;
}

function SectionNav({ active }) {
  return (
    <nav id="studio-sidebar-navigation" className="grid grid-cols-4 gap-[5px] md:grid-cols-1" aria-label="เมนูหลัก">
      {studioSections.map(([id, label, Icon]) => (
        <Link key={id}
          className="flex min-h-[50px] flex-col items-center justify-center gap-[3px] rounded-xl border border-transparent p-1 text-xs text-muted hover:bg-panel aria-[current=page]:border-accent/60 aria-[current=page]:bg-accent/15 aria-[current=page]:text-accent-text md:min-h-[46px] md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2 md:text-sm"
          href={`/${id}`} aria-current={active === id ? "page" : undefined}>
          <Icon size={19} className="shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
