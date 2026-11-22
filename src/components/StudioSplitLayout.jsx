"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import dynamic from "next/dynamic";
import { createContext, useContext, useRef, useState } from "react";
import "react-splitter-layout/lib/index.css";
import { useStudioPreference } from "@/hooks/useStudioPreference";
import { StudioSidebar } from "./StudioSidebar";

const EDGE_TAB_PATH = "M0 0 C0 18 32 16 32 34 L32 54 C32 72 0 70 0 88 Z";

const PaneContent = createContext(null);
const SplitterLayout = dynamic(
  () => import("react-splitter-layout").then(module => module.default?.default ?? module.default),
  { ssr: false, loading: StaticPanes },
);

export function StudioSplitLayout({ account, children }) {
  const [sidebarState, setSidebarState] = useStudioPreference("sidebar", "open", ["closed"]);
  const collapsed = sidebarState === "closed";
  const [animateToggle, setAnimateToggle] = useState(false);
  const [width, setWidth] = useState(224);
  const dragging = useRef(false);
  const openButton = useRef(null);
  const closeButton = useRef(null);

  function toggle(next, event) {
    setAnimateToggle(true);
    setSidebarState(next ? "closed" : "open");
    if (event.detail === 0) {
      requestAnimationFrame(() => (next ? openButton : closeButton).current?.focus());
    }
  }

  function followEdgePointer(event) {
    if (event.pointerType !== "mouse" || event.clientX >= event.currentTarget.clientWidth) return;
    event.currentTarget.style.setProperty("--sidebar-trigger-y", `${event.clientY}px`);
  }

  const sidebar = (
    <StudioSidebar toggle={(
      <SidebarButton buttonRef={closeButton} label="ซ่อนแถบด้านข้าง" expanded onClick={event => toggle(true, event)} />
    )} account={account} />
  );
  const content = (
    <div className="min-w-0">
      {collapsed && (
        <div className="group/edge fixed inset-y-0 left-0 z-20 hidden w-1.5 desktop:block"
          onPointerEnter={followEdgePointer} onPointerMove={followEdgePointer}>
          <SidebarEdgeTab buttonRef={openButton} onClick={event => toggle(false, event)} />
        </div>
      )}
      {children}
    </div>
  );

  return (
    <div className="studio-split" data-sidebar={sidebarState}
      data-sidebar-animate={animateToggle ? "" : undefined}
      style={{ "--sidebar-width": `${width}px` }}
      onDragStart={event => event.preventDefault()}>
      <PaneContent value={{ sidebar, content }}>
        <SplitterLayout customClassName="studio-panes" primaryIndex={1} secondaryInitialSize={224}
          secondaryMinSize={184} primaryMinSize={360}
          onDragStart={() => { dragging.current = true; }}
          onDragEnd={() => { dragging.current = false; }}
          onSecondaryPaneSizeChange={size => { if (dragging.current) setWidth(size); }}>
          {sidebar}
          {content}
        </SplitterLayout>
      </PaneContent>
    </div>
  );
}

// The splitter's published bundle references window during import.
function StaticPanes() {
  const { sidebar, content } = useContext(PaneContent);
  return (
    <div className="splitter-layout studio-panes">
      <div className="layout-pane">{sidebar}</div>
      <div className="layout-splitter" aria-hidden="true" />
      <div className="layout-pane layout-pane-primary">{content}</div>
    </div>
  );
}

function SidebarButton({ buttonRef, label, expanded, onClick, className = "" }) {
  const Icon = expanded ? PanelLeftClose : PanelLeftOpen;
  return (
    <button ref={buttonRef} type="button" aria-label={label} title={label} aria-expanded={expanded}
      aria-controls="studio-sidebar-navigation"
      className={`grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel hover:text-foreground ${className}`}
      onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

function SidebarEdgeTab({ buttonRef, onClick }) {
  return (
    <button ref={buttonRef} type="button" aria-label="เปิดแถบด้านข้าง" title="เปิดแถบด้านข้าง"
      aria-expanded={false} aria-controls="studio-sidebar-navigation"
      className="group/tab absolute top-[clamp(3rem,var(--sidebar-trigger-y,50%),calc(100%-3rem))] left-0 grid h-[88px] w-8 -translate-x-full -translate-y-1/2 place-items-center pr-0.5 text-muted opacity-0 hover:text-foreground focus-visible:translate-x-0 focus-visible:opacity-100 focus-visible:outline-none! group-hover/edge:translate-x-0 group-hover/edge:opacity-100 pointer-coarse:translate-x-0 pointer-coarse:opacity-100 motion-safe:transition-[translate,opacity,color] motion-safe:duration-200"
      onClick={onClick}>
      <svg aria-hidden="true" viewBox="0 0 32 88"
        className="pointer-events-none absolute inset-0 size-full overflow-visible drop-shadow-sm">
        <path d={EDGE_TAB_PATH}
          className="fill-panel stroke-transparent group-focus-visible/tab:stroke-accent-text group-focus-visible/tab:stroke-2" />
      </svg>
      <PanelLeftOpen size={16} className="relative z-1" aria-hidden="true" />
    </button>
  );
}
