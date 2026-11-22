"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register Service Worker for PWA installability & static asset caching
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }

    // Prevent iOS Safari pinch-to-zoom on the page chrome (image viewer uses PointerEvents and still zooms freely)
    function preventPageGestureZoom(event) {
      event.preventDefault();
    }

    document.addEventListener("gesturestart", preventPageGestureZoom, { passive: false });
    document.addEventListener("gesturechange", preventPageGestureZoom, { passive: false });
    document.addEventListener("gestureend", preventPageGestureZoom, { passive: false });

    // Keep PWA status-bar theme-color in sync with in-app Light / Dark theme toggle
    function syncThemeColor() {
      const isLight = document.documentElement.dataset.theme === "light";
      const color = isLight ? "#f3f6fc" : "#111522";
      let meta = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.append(meta);
      }
      meta.content = color;
    }
    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      observer.disconnect();
      document.removeEventListener("gesturestart", preventPageGestureZoom);
      document.removeEventListener("gesturechange", preventPageGestureZoom);
      document.removeEventListener("gestureend", preventPageGestureZoom);
    };
  }, []);

  return null;
}
