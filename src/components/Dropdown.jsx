export function Dropdown({ ref, id, className = "", children }) {
  return (
    <div ref={ref} id={id} className={`studio-dropdown motion-safe:animate-dropdown-in ${className}`}>
      {children}
    </div>
  );
}
