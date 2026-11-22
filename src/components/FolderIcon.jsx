export function FolderIcon({ className }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path fill="#e5a02d" d="M2 8a5 5 0 0 1 5-5h7l4 3h7a5 5 0 0 1 5 5v13H2Z" />
      <rect x="4" y="8" width="24" height="13" rx="2.5" fill="#fff0cb" />
      <path fill="var(--color-folder)" d="M2 13h28v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5Z" />
    </svg>
  );
}
