import { title } from "@/lib/ui-styles";

export function StudioPageHeader({ label, heading, headingClass = "", description, actions, children }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-4 pt-2 pb-2 backdrop-blur-md">
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
