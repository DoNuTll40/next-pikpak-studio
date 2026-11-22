"use client";

import { useEffect, useState } from "react";

export function useMediaPreview({ id }, reloadKey = 0) {
  const [state, setState] = useState({ key: null, result: null });
  const requestKey = `${id}:${reloadKey}`;

  useEffect(() => {
    const abort = new AbortController();

    async function load() {
      try {
        const response = await fetch(`/api/media/${encodeURIComponent(id)}`, { signal: abort.signal });
        if (!response.ok || response.redirected) throw new Error("No media");
        const media = await response.json();
        if (!abort.signal.aborted) setState({ key: requestKey, result: media });
      } catch {
        if (!abort.signal.aborted) setState({ key: requestKey, result: false });
      }
    }

    load();
    return () => abort.abort();
  }, [id, requestKey]);

  return state.key === requestKey ? state.result : null;
}
