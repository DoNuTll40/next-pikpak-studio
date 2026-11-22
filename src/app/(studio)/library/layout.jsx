import { Suspense } from "react";
import { LoadingStatus } from "@/components/LoadingStatus";

export default function LibraryLayout({ children }) {
  return (
    <Suspense fallback={<LoadingStatus>กำลังโหลดคลัง…</LoadingStatus>}>
      {children}
    </Suspense>
  );
}
