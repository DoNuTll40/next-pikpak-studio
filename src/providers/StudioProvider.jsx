"use client";

import { createContext, useContext, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useStudioPreference } from "@/hooks/useStudioPreference";

const StudioContext = createContext(null);

export function StudioProvider({ children }) {
  const [theme, saveTheme] = useStudioPreference("theme", "dark", ["light"]);
  const themeTransition = useRef(null);
  const [view, setView] = useStudioPreference("view", "grid", ["list"]);
  const [density, setDensity] = useStudioPreference("density", "standard", ["compact", "spacious"]);
  const [defaultSort, setDefaultSort] = useStudioPreference("sort", "asc", ["desc"]);
  const [videoQuality, setVideoQuality] = useStudioPreference("quality", "auto", ["720", "1080", "original"]);
  const [treeOpen, setTreeOpen] = useState(false);

  function setTheme(next, trigger) {
    const current = themeTransition.current;
    if (current?.theme === next || (!current && next === theme)) return;
    themeTransition.current = null;
    current?.animation.skipTransition();
    const root = document.documentElement;
    function clearReveal() {
      delete root.dataset.themeReveal;
      for (const name of ["--theme-x", "--theme-y", "--theme-radius"]) root.style.removeProperty(name);
    }

    if (!trigger || !document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      clearReveal();
      saveTheme(next);
      return;
    }

    const bounds = trigger.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.dataset.themeReveal = "";
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    root.style.setProperty("--theme-radius", `${radius}px`);

    const animation = document.startViewTransition(() => {
      if (themeTransition.current?.animation !== animation) return;
      flushSync(() => saveTheme(next));
      root.dataset.theme = next;
    });
    themeTransition.current = { theme: next, animation };
    function finish() {
      if (themeTransition.current?.animation !== animation) return;
      themeTransition.current = null;
      clearReveal();
    }
    animation.finished.then(finish, finish);
  }

  function resetPreferences() {
    setTheme("dark");
    setView("grid");
    setDensity("standard");
    setDefaultSort("asc");
    setVideoQuality("auto");
  }

  return (
    <StudioContext value={{
      theme, setTheme, view, setView, density, setDensity, defaultSort, setDefaultSort,
      videoQuality, setVideoQuality, treeOpen, setTreeOpen, resetPreferences,
    }}>
      {children}
    </StudioContext>
  );
}

export function useStudioPreferences() {
  const preferences = useContext(StudioContext);
  if (!preferences) throw new Error("useStudioPreferences requires StudioProvider");
  return preferences;
}
