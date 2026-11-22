"use client";

import { useState } from "react";
import { FolderIcon } from "./FolderIcon";
import { EmptyFolderArtwork } from "./EmptyFolderArtwork";
import { Thumbnail } from "./Thumbnail";

export function FolderArtwork({ thumbnail, hasItems }) {
  const [failedThumbnail, setFailedThumbnail] = useState(null);
  const hasThumbnail = Boolean(thumbnail && thumbnail !== failedThumbnail);
  const hasContents = hasThumbnail || hasItems;

  return (
    <>
      <FolderIcon className="hidden w-[26px] list-view:block" />
      <span className="relative block aspect-[202/155] w-[min(72%,202px)] shrink-0 list-view:hidden" aria-hidden="true">
        {!hasContents ? (
          <EmptyFolderArtwork className="size-full" />
        ) : (
          <>
            <svg className="absolute inset-0 size-full" viewBox="0 0 202 155">
              <path fill="#e39925" d="M27 38h145c6 0 11 4 11 10l-2 63H17l-2-63c0-6 5-10 12-10Z" />
              {hasThumbnail && (
                <rect x="36" y="15" width="132" height="66" rx="6" fill="#b7bec4" />
              )}
              {hasItems && !hasThumbnail && (
                <>
                  <rect x="39" y="19" width="123" height="62" rx="5" fill="#cbd0d3" />
                  <rect x="30" y="24" width="143" height="65" rx="5" fill="#d8dcdf" />
                  <rect x="82" y="52" width="42" height="30" rx="4" fill="#f6ac36" />
                  <path fill="#fff5db" d="M86 52h34v5H86z" />
                </>
              )}
            </svg>
            {hasThumbnail && (
              <Thumbnail
                key={thumbnail}
                src={thumbnail}
                className="absolute top-[13%] left-[13%] h-[41%] w-[75%] rounded-[4%] object-cover"
                onError={() => setFailedThumbnail(thumbnail)}
              />
            )}
            <svg className="absolute inset-0 size-full" viewBox="0 0 202 155">
              <path fill="#ffc34d" d="M22 54h36c3 0 5 1 6 4l3 9c1 2 3 3 6 3h103c5 0 9 4 9 9l-3 46c-1 8-7 14-15 14H31c-8 0-14-6-15-14l-3-62c0-5 4-9 9-9Z" />
            </svg>
          </>
        )}
      </span>
    </>
  );
}
