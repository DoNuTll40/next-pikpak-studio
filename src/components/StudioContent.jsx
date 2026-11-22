export function StudioContent({ children }) {
  return (
    <main id="main-content" className="mx-auto flex min-h-dvh w-full min-w-0 max-w-[1440px] flex-col pb-[calc(59px+env(safe-area-inset-bottom))] md:pb-0">
      {children}
    </main>
  );
}

export function StudioPage({ header, children, footer, footerClassName = "" }) {
  return (
    <>
      {header}
      <div className="flex flex-1 flex-col px-4">{children}</div>
      {footer && <footer className={`px-4 pt-5 pb-4 ${footerClassName}`}>{footer}</footer>}
    </>
  );
}
