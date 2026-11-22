"use client";

/* Desktop thumbnails go straight to the PikPak CDN without the Next.js image proxy. */
export function Thumbnail({ src, className, onError }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={src} alt="" loading="lazy" decoding="async"
      referrerPolicy="no-referrer" onError={event => {
        event.currentTarget.hidden = true;
        onError?.();
      }} />
  );
}
