import { Suspense } from "react";
import { connection } from "next/server";
import { AlertCircle } from "lucide-react";
import { availableProviders } from "@/lib/server/auth";
import { LoginCard } from "./LoginCard";

async function LoginView({ searchParams }) {
  await connection();
  const { invalid, oauth, next } = await searchParams;
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "";
  const message = invalid === "1"
    ? "คีย์เข้าคลังไม่ถูกต้อง"
    : oauth === "failed"
      ? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง"
      : null;

  const errorSlot = message ? (
    <p role="alert"
      className="mt-4 flex items-center gap-2 rounded-xl border border-warning/35 bg-warning/10 px-3.5 py-2.5 text-xs font-medium text-warning">
      <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  ) : null;

  return (
    <LoginCard
      providers={availableProviders()}
      hasAccessKey={Boolean(process.env.STUDIO_ACCESS_KEY)}
      nextPath={safeNext}
      errorSlot={errorSlot}
    />
  );
}

export default function Login({ searchParams }) {
  return (
    <main>
      <Suspense fallback={<div className="min-h-dvh bg-background" />}>
        <LoginView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
