"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { FolderIcon } from "./FolderIcon";
import { catalogFontClass, folderHref, formatStudioDate, statusText } from "@/lib/catalog";

export function ScanStatus({ status }) {
  const color = status === "complete" ? "text-success" : status === "partial" ? "text-warning" : "text-muted";
  return <span className={`inline-flex w-fit items-center gap-[5px] rounded-full bg-field px-2 py-[3px] text-[.72rem] ${color}`}><i className="size-[7px] rounded-full bg-current" />{statusText[status] ?? "ยังไม่มีสถานะ"}</span>;
}

export function ScanTree({ folders, path = [], compact = false }) {
  const childrenByParent = useMemo(() => {
    const index = new Map();
    for (const folder of folders) {
      const siblings = index.get(folder.parent);
      if (siblings) siblings.push(folder);
      else index.set(folder.parent, [folder]);
    }
    return index;
  }, [folders]);

  return <TreeList childrenByParent={childrenByParent} path={path} compact={compact} />;
}

function TreeList({ childrenByParent, parent = null, path, id, compact }) {
  const nestedClass = compact
    ? "ml-[11px] grid gap-0.5 border-l border-border/70 pl-1.5"
    : "ml-3.5 grid gap-0.5 border-l border-border pl-1.5";
  return (
    <ul id={id} className={parent ? nestedClass : "grid gap-0.5"}>
      {childrenByParent.get(parent)?.map(folder => (
        <TreeBranch key={folder.id} folder={folder} childrenByParent={childrenByParent} path={path} compact={compact} />
      ))}
    </ul>
  );
}

function TreeBranch({ folder, childrenByParent, path, compact }) {
  const hasChildren = childrenByParent.has(folder.id);
  const [expanded, setExpanded] = useState(() => path.some(item => item.id === folder.id));
  const branchId = useId();
  const current = path.at(-1)?.id === folder.id;
  const href = folder.updatedAt == null ? folder.id : folder.folderId;
  const statusDotColor = folder.status === "complete" ? "bg-success" : folder.status === "partial" ? "bg-warning" : "bg-muted/60";
  const row = compact
    ? "flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-[0.8125rem] leading-snug"
    : "flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm";
  const content = compact ? (
    <>
      <FolderIcon className="w-[18px] shrink-0" />
      <span className={`min-w-0 flex-1 truncate ${catalogFontClass(folder.name) ?? ""}`} title={folder.name}>
        {folder.name}
      </span>
      {folder.status && (
        <span className={`size-1.5 shrink-0 rounded-full ${statusDotColor}`}
          title={statusText[folder.status] ?? "ยังไม่มีสถานะ"} aria-hidden="true" />
      )}
    </>
  ) : (
    <>
      <FolderIcon className="w-5 shrink-0" />
      <span className={`min-w-0 flex-1 truncate ${catalogFontClass(folder.name) ?? ""}`} title={folder.name}>
        {folder.name}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <ScanStatus status={folder.status} />
        {folder.updatedAt != null && (
          <small className="hidden text-xs text-muted sm:inline">{formatStudioDate(folder.updatedAt)}</small>
        )}
      </span>
    </>
  );
  const label = href
    ? <Link href={folderHref(href)} aria-current={current ? "page" : undefined}
        className={`${row} hover:bg-accent/10 aria-[current=page]:bg-accent/15 aria-[current=page]:font-medium aria-[current=page]:text-accent-text`}>{content}</Link>
    : <div className={row}>{content}</div>;

  return (
    <li>
      <div className={`grid items-center ${compact ? "grid-cols-[1.5rem_minmax(0,1fr)]" : "grid-cols-[1.75rem_minmax(0,1fr)]"}`}>
        {hasChildren ? (
          <button type="button"
            className={`grid place-items-center rounded-md text-muted hover:bg-accent/10 hover:text-foreground ${compact ? "size-6" : "size-7"}`}
            aria-label={`${expanded ? "ยุบ" : "กาง"} ${folder.name}`}
            aria-expanded={expanded} aria-controls={expanded ? branchId : undefined}
            onClick={() => setExpanded(!expanded)}>
            <ChevronRight size={compact ? 14 : 15} aria-hidden="true"
              className={`motion-safe:transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        ) : <span aria-hidden="true" />}
        {label}
      </div>
      {hasChildren && expanded && (
        <TreeList id={branchId} childrenByParent={childrenByParent} parent={folder.id} path={path} compact={compact} />
      )}
    </li>
  );
}

