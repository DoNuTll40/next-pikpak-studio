import { title } from "@/lib/ui-styles";

export function StudioPageHeader({ label, heading, headingClass = "", description, actions, children }) {
  return (
    <header className="z-10 pt-2 top-0 sticky backdrop-blur-xs bg-gradient-to-b from-[#D8E2FB] dark-theme:from-[#1B2232] from-35% to-transparent px-4 pb-1">
      {label}
      <div className="flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
        <div className="min-w-0 flex-1 basis-full md:basis-auto">
          <h1 className={`${title} truncate ${headingClass}`} title={heading}>{heading}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </header>
  );
}
