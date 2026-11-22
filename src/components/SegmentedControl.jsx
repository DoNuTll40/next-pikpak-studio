import { segment, segmented } from "@/lib/ui-styles";

export function SegmentedControl({ label, value, onChange, options, iconOnly = false, className = "" }) {
  const selected = options.findIndex(([id]) => id === value);

  return (
    <div className={`${segmented} shrink-0 self-center ${className}`} role="group" aria-label={label}>
      <div className="relative isolate grid grid-flow-col auto-cols-fr">
        {selected >= 0 && (
          <span aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 -z-10 rounded-lg bg-accent/20 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out"
            style={{ width: `${100 / options.length}%`, transform: `translateX(${selected * 100}%)` }} />
        )}
        {options.map(([id, name, Icon]) => (
          <button key={id} type="button" aria-label={iconOnly ? name : undefined} aria-pressed={id === value}
            className={`${segment} whitespace-nowrap aria-pressed:text-accent-text motion-safe:transition-colors`}
            onClick={event => onChange(id, event.currentTarget)}>
            <Icon size={iconOnly ? 18 : 16} aria-hidden="true" />
            {!iconOnly && name}
          </button>
        ))}
      </div>
    </div>
  );
}
