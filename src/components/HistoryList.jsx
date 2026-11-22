"use client";

import Link from "next/link";
import { File, Film, Image } from "lucide-react";
import { useState } from "react";
import { catalogFontClass, folderHref, formatStudioDate } from "@/lib/catalog";
import { brandIcon, control, surface, thumbnailPreview } from "@/lib/ui-styles";
import { MediaDialog } from "./MediaDialog";
import { Thumbnail } from "./Thumbnail";

export function HistoryList({ history }) {
  const [preview, setPreview] = useState(null);
  return (
    <>
      <ul className="mt-4 grid gap-2">
        {history.map(item => {
          const Icon = item.kind === "video" ? Film : item.kind === "image" ? Image : File;
          return (
            <li key={item.id} className={`${surface} grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 p-3 wrap-anywhere`}>
              <span className={`${brandIcon} relative overflow-hidden`}>
                <Icon size={20} />
                <Thumbnail src={item.thumbnail} className={thumbnailPreview} />
              </span>
              <div>
                <strong className={catalogFontClass(item.name)}>{item.name}</strong>
                <p className="text-xs text-muted">{formatStudioDate(item.viewedAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2 max-[479px]:col-start-2">
                {item.kind !== "file" && (
                  <button className={control} onClick={() => setPreview(item)}>เปิดพรีวิว</button>
                )}
                {item.parentId && <Link className={control} href={folderHref(item.parentId)}>เปิดโฟลเดอร์</Link>}
              </div>
            </li>
          );
        })}
      </ul>
      {preview && (
        <MediaDialog
          key={preview.id}
          item={preview}
          items={history.filter(entry => entry.kind === "image" || entry.kind === "video")}
          onSelectItem={setPreview}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
