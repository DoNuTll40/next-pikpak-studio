export function LoadingStatus({ children }) {
  return (
    <div className="grid min-h-[calc(100dvh-59px-env(safe-area-inset-bottom))] place-items-center px-4 text-center text-muted desktop:min-h-dvh">
      <p role="status">{children}</p>
    </div>
  );
}
