"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Laptop, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import { FolderIcon } from "@/components/FolderIcon";
import { switchDesktopAccount } from "./actions";

export function DesktopAuthClient({ user, port, state, challenge, returnPath }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleAuthorize() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/desktop/authorize", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port, state, challenge }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.redirectUrl) {
        throw new Error(data?.error === "sign_in_required"
          ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"
          : "ไม่สามารถสร้างรหัสยืนยันได้ กรุณาลองอีกครั้ง");
      }
      setDone(true);
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err?.message || "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
      setBusy(false);
    }
  }

  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden p-4 md:p-6">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[28rem] blur-3xl
          [--login-glow:#243458] light-theme:[--login-glow:#cddbff]
          bg-[radial-gradient(ellipse_38rem_20rem_at_50%_-4rem,var(--login-glow)_0%,transparent_100%)]" />
      </div>

      <section className="w-full max-w-[420px] rounded-[22px] border border-border bg-panel/95 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.12)] sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl border border-folder/35 bg-folder/12">
              <FolderIcon className="size-7" />
            </div>
            <ArrowRight size={16} className="text-muted" aria-hidden="true" />
            <div className="grid size-12 place-items-center rounded-2xl border border-accent/35 bg-accent/12 text-accent-text">
              <Laptop size={22} aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            เชื่อมต่อ PikPak Studio Desktop
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            อนุญาตให้แอป Desktop ซิงก์คลัง สถานะสแกน และประวัติเข้าบัญชีนี้
          </p>
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-field px-3.5 py-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="size-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent-text">
              {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{user.name || "บัญชี PikPak Studio"}</p>
            {user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-warning/35 bg-warning/10 px-3.5 py-2.5 text-xs font-medium text-warning">
            {error}
          </p>
        )}

        {done ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-success/35 bg-success/10 px-4 py-3 text-sm font-medium text-success">
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>กำลังส่งกลับไปยังแอป Desktop…</span>
          </div>
        ) : (
          <div className="grid gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={handleAuthorize}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-white shadow-xs hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              <span>{busy ? "กำลังเชื่อมต่อ…" : "อนุญาตการเชื่อมต่อ"}</span>
            </button>

            <form action={switchDesktopAccount}>
              <input type="hidden" name="next" value={returnPath} />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-field px-4 text-xs font-medium text-muted hover:border-accent-text hover:text-foreground disabled:opacity-50"
              >
                <LogOut size={14} aria-hidden="true" />
                <span>ใช้บัญชีอื่น (สลับบัญชี)</span>
              </button>
            </form>
          </div>
        )}
      </section>

      <p className="mt-5 flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck size={14} className="shrink-0 text-accent-text" aria-hidden="true" />
        <span>รหัสยืนยันส่งกลับไปยังเครื่องของคุณ (127.0.0.1) เท่านั้น</span>
      </p>
    </div>
  );
}
