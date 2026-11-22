import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { readOAuthSession } from "@/lib/server/auth";
import { isValidChallenge } from "@/lib/server/desktop-tokens";
import { DesktopAuthClient } from "./DesktopAuthClient";

const statePattern = /^[A-Za-z0-9_-]{16,128}$/;

async function DesktopAuthView({ searchParams }) {
  await connection();
  const params = await searchParams;
  const port = Number(params?.port);
  const state = typeof params?.state === "string" ? params.state : "";
  const challenge = typeof params?.challenge === "string" ? params.challenge : "";

  const valid = Number.isInteger(port) && port >= 1024 && port <= 65535 &&
    statePattern.test(state) && isValidChallenge(challenge);

  if (!valid) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl border border-border bg-panel p-6 text-center">
          <h1 className="text-base font-semibold text-foreground">คำขอเชื่อมต่อ Desktop ไม่ถูกต้อง</h1>
          <p className="mt-2 text-xs text-muted">กรุณากดปุ่ม &ldquo;เข้าสู่ระบบ Cloud&rdquo; จากแอป PikPak Studio Desktop อีกครั้ง</p>
        </div>
      </div>
    );
  }

  const returnPath = `/desktop-auth?port=${port}&state=${encodeURIComponent(state)}&challenge=${encodeURIComponent(challenge)}`;
  const session = await readOAuthSession();
  if (!session?.user?.studioOwnerId) {
    redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  }

  const rawEmail = session.user.email;
  const email = typeof rawEmail === "string" && !rawEmail.endsWith(".invalid") ? rawEmail : null;

  return (
    <DesktopAuthClient
      user={{
        id: session.user.id,
        name: session.user.name ?? "",
        email,
        image: session.user.image ?? null,
      }}
      port={port}
      state={state}
      challenge={challenge}
      returnPath={returnPath}
    />
  );
}

export default function DesktopAuthPage({ searchParams }) {
  return (
    <main>
      <Suspense fallback={<div className="min-h-dvh bg-background" />}>
        <DesktopAuthView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
