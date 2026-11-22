"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { control } from "@/lib/ui-styles";

export function Select({ label, value, onChange, options, className = "" }) {
  const id = useId();
  const trigger = useRef(null);
  const popup = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = Math.max(0, options.findIndex(([key]) => key === value));

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event) {
      if (!event.composedPath().includes(trigger.current) &&
          !event.composedPath().includes(popup.current)) popup.current?.hidePopover();
    }
    function dismissOnMove(event) {
      if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) popup.current?.hidePopover();
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    window.addEventListener("scroll", dismissOnMove, true);
    window.addEventListener("resize", dismissOnMove);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      window.removeEventListener("scroll", dismissOnMove, true);
      window.removeEventListener("resize", dismissOnMove);
    };
  }, [open]);

  function show(index = selected) {
    const menu = popup.current;
    const rect = trigger.current.getBoundingClientRect();
    const { clientHeight, clientWidth } = document.documentElement;
    menu.style.minWidth = `${rect.width}px`;
    menu.style.maxHeight = "min(18rem, 50dvh)";
    menu.showPopover();
    const below = Math.max(0, clientHeight - rect.bottom - 12);
    const above = Math.max(0, rect.top - 12);
    const placeAbove = menu.offsetHeight > below && above > below;
    menu.style.maxHeight = `min(18rem, ${placeAbove ? above : below}px)`;
    menu.style.left = `${Math.max(8, Math.min(rect.right - menu.offsetWidth, clientWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${placeAbove ? rect.top - menu.offsetHeight - 4 : rect.bottom + 4}px`;
    setActive(index);
    trigger.current.focus();
  }

  function choose(index) {
    popup.current.hidePopover();
    trigger.current.focus();
    onChange(options[index][0]);
  }

  function handleKey(event) {
    const expanded = popup.current.matches(":popover-open");
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      event.stopPropagation();
      popup.current.hidePopover();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!expanded) return show(selected);
      const index = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: options.length - 1 }[event.key];
      const next = Math.max(0, Math.min(index, options.length - 1));
      setActive(next);
      document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: "nearest" });
    } else if (expanded && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Tab" && expanded) {
      popup.current.hidePopover();
    }
  }

  return (
    <div className={`inline-flex min-w-0 max-w-full ${className}`}>
      <button ref={trigger} type="button" role="combobox" aria-label={label} aria-expanded={open}
        aria-controls={id} aria-activedescendant={open ? `${id}-${active}` : undefined}
        className={`${control} min-w-0 justify-between text-start aria-expanded:border-accent-text`}
        onClick={() => popup.current.matches(":popover-open") ? popup.current.hidePopover() : show()}
        onKeyDown={handleKey}>
        <span className="truncate">{options[selected]?.[1]}</span>
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-muted" />
      </button>
      <div ref={popup} id={id} popover="auto" role="listbox" aria-label={label}
        className="studio-dropdown fixed right-auto bottom-auto m-0 max-w-[calc(100vw-1rem)] overflow-y-auto motion-safe:animate-dropdown-in"
        onToggle={event => setOpen(event.newState === "open")}>
        {options.map(([key, name], index) => (
          <div key={key} id={`${id}-${index}`} role="option" aria-selected={index === selected}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm data-[active=true]:bg-accent/10 aria-selected:bg-accent/20 aria-selected:text-accent-text"
            data-active={index === active} onPointerMove={() => setActive(index)}
            onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
            <Check size={14} aria-hidden="true" className={index === selected ? "shrink-0" : "invisible shrink-0"} />
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
