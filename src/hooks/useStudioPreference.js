"use client";

import { useEffect, useSyncExternalStore } from "react";

const changedEvent = "studio-preference-changed";

function subscribe(onChange) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changedEvent, onChange);
  };
}

export function useStudioPreference(name, fallback, alternatives) {
  const key = `studio-${name}`;
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const saved = localStorage.getItem(key);
      return alternatives.includes(saved) ? saved : fallback;
    },
    () => fallback,
  );

  useEffect(() => {
    document.documentElement.dataset[name] = value;
  }, [name, value]);

  function update(next) {
    localStorage.setItem(key, next);
    window.dispatchEvent(new Event(changedEvent));
  }

  return [value, update];
}
