import { useCallback, useEffect, useRef, useState } from "react";

export function useCatalogSelection(items) {
  const [selected, setSelected] = useState(() => new Set());
  const anchor = useRef(null);

  function select(id, { shiftKey, ctrlKey, metaKey }) {
    const toggle = ctrlKey || metaKey;
    const from = items.findIndex(item => item.id === anchor.current);
    if (shiftKey && from !== -1) {
      const to = items.findIndex(item => item.id === id);
      const range = items.slice(Math.min(from, to), Math.max(from, to) + 1).map(item => item.id);
      setSelected(previous => new Set(toggle ? [...previous, ...range] : range));
      return;
    }

    anchor.current = id;
    setSelected(previous => {
      if (!toggle) return new Set([id]);
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const clear = useCallback(() => {
    anchor.current = null;
    setSelected(previous => previous.size ? new Set() : previous);
  }, []);

  const hasSelection = selected.size > 0;
  useEffect(() => {
    if (!hasSelection) return;
    function clearOutsideCards(event) {
      if (!event.target.closest("[data-catalog-item]")) clear();
    }
    document.addEventListener("pointerdown", clearOutsideCards);
    return () => document.removeEventListener("pointerdown", clearOutsideCards);
  }, [hasSelection, clear]);

  function selectAll() {
    setSelected(new Set(items.map(item => item.id)));
  }

  return { selected, select, clear, selectAll };
}
