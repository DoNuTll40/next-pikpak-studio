"use client";

import Image from "next/image";
import { useFormStatus } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, KeyRound, LoaderCircle, Moon, ShieldCheck, Sun } from "lucide-react";
import { FolderIcon } from "@/components/FolderIcon";
import { useStudioPreference } from "@/hooks/useStudioPreference";
import { field } from "@/lib/ui-styles";
import { signIn } from "./actions";
import { signInWithProvider } from "./oauth-actions";

const PROVIDERS = [
  { id: "google", name: "Google", Icon: GoogleMark },
  { id: "line", name: "LINE", Icon: LineMark },
  { id: "facebook", name: "Facebook", Icon: FacebookMark },
];

export function LoginCard({ providers, hasAccessKey, errorSlot }) {
  const [theme, setTheme] = useStudioPreference("theme", "dark", ["light"]);
  const reducedMotion = useReducedMotion();

  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden p-4 md:p-6">
      {/* Subtle studio ambient glow matching SettingsPage */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[28rem] blur-3xl
          [--login-glow:#243458] light-theme:[--login-glow:#cddbff]
          bg-[radial-gradient(ellipse_38rem_20rem_at_50%_-4rem,var(--login-glow)_0%,transparent_100%)]" />
        <div className="absolute inset-0 opacity-[0.045] light-theme:opacity-[0.06]
          [background-image:radial-gradient(var(--foreground)_1px,transparent_1px)]
          [background-size:24px_24px]
          [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_25%,transparent_100%)]" />
      </div>

      {/* Theme toggle synced with studio-theme preference */}
      <button
        type="button"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        aria-label={theme === "light" ? "สลับเป็นธีมมืด" : "สลับเป็นธีมสว่าง"}
        title={theme === "light" ? "สลับเป็นธีมมืด" : "สลับเป็นธีมสว่าง"}
        className="fixed top-4 right-4 z-10 grid size-9 place-items-center rounded-xl border border-border bg-panel/85 text-muted shadow-xs backdrop-blur-sm hover:border-accent-text hover:text-foreground"
      >
        {theme === "light" ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
      </button>

      <motion.section
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 360, damping: 32 }}
        className="w-full max-w-[408px] rounded-[22px] border border-border bg-panel/95 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-md dark-theme:shadow-[0_24px_64px_rgba(0,0,0,0.45)] sm:p-8"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-folder/35 bg-folder/12 shadow-xs">
            <FolderIcon className="size-8" />
          </div>
          <h1 className="text-[1.6rem] font-semibold tracking-tight text-foreground">PikPak Studio</h1>
          <p className="mt-1 text-sm text-muted">เข้าสู่คลังวิดีโอและไฟล์ส่วนตัวของคุณ</p>
        </div>

        <div className="grid gap-2.5">
          {PROVIDERS.map(({ id, name, Icon }) => (
            <form key={id} action={signInWithProvider}>
              <input type="hidden" name="provider" value={id} />
              <ProviderButton name={name} Icon={Icon} available={providers.includes(id)} />
            </form>
          ))}
        </div>

        {errorSlot}

        {hasAccessKey && (
          <form action={signIn} className="mt-6 grid gap-3 border-t border-border pt-5">
            <label htmlFor="access-key" className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <KeyRound size={14} aria-hidden="true" />
              <span>หรือเข้าด้วยคีย์เข้าคลัง</span>
            </label>
            <input
              className={`${field} px-3 text-sm focus:border-accent-text focus:outline-none!`}
              id="access-key"
              name="accessKey"
              type="password"
              placeholder="กรอกคีย์เข้าคลัง"
              autoComplete="current-password"
              required
            />
            <AccessKeySubmit />
          </form>
        )}
      </motion.section>

      <p className="mt-5 flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck size={14} className="shrink-0 text-accent-text" aria-hidden="true" />
        <span>แต่ละบัญชีมีคลังและประวัติการรับชมแยกเป็นส่วนตัว</span>
      </p>
    </div>
  );
}

function ProviderButton({ name, Icon, available }) {
  const { pending } = useFormStatus();
  const disabled = !available || pending;

  return (
    <button
      type="submit"
      disabled={disabled}
      className="group flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-field px-3.5 text-sm font-medium text-foreground hover:border-accent-text hover:bg-accent/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="grid size-6 shrink-0 place-items-center">
        {pending ? <LoaderCircle size={17} className="animate-spin text-accent" aria-hidden="true" /> : <Icon />}
      </span>
      <span className="flex-1 text-start">
        {pending ? `กำลังเชื่อมต่อ ${name}…` : `ดำเนินการต่อด้วย ${name}`}
      </span>
      {available ? (
        <ArrowRight size={15} aria-hidden="true"
          className="shrink-0 text-muted opacity-60 motion-safe:transition-[transform,opacity] group-hover:translate-x-0.5 group-hover:text-accent-text group-hover:opacity-100" />
      ) : (
        <span className="rounded-md bg-panel px-1.5 py-0.5 text-[11px] font-normal text-muted">ยังไม่เปิดใช้</span>
      )}
    </button>
  );
}

function AccessKeySubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-white shadow-xs hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
      <span>{pending ? "กำลังเปิดคลัง…" : "เปิดคลัง"}</span>
    </button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="-1 -1 50 50" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function LineMark() {
  return <Image src="/line-brand.png" width={20} height={20} alt="" unoptimized className="size-5 rounded-[5px]" />;
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <defs>
        <clipPath id="fb-mark-clip">
          <circle cx="12" cy="12" r="11.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#fb-mark-clip)">
        <circle cx="12" cy="12" r="11.5" fill="#1877F2" />
        <path fill="#FFFFFF" d="M16.47 15.32 16.98 12h-3.19V9.84c0-.91.45-1.79 1.87-1.79h1.45V5.22s-1.32-.22-2.57-.22c-2.63 0-4.34 1.59-4.34 4.47V12H7.28v3.32h2.92v8.2h3.59v-8.2h2.68Z" />
      </g>
    </svg>
  );
}
