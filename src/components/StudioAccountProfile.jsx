import Link from "next/link";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { cookies } from "next/headers";
import { loginMethodCookie, readOAuthAccounts, readOAuthSession } from "@/lib/server/auth";
import { readAccessKeyUser } from "@/lib/server/session";
import { Thumbnail } from "./Thumbnail";

const providerLabels = new Map([["google", "Google"], ["line", "LINE"], ["facebook", "Facebook"]]);

export async function StudioAccountProfile({ linkToSettings = false }) {
  const session = await readOAuthSession();
  let name = "บัญชี Studio";
  let email;
  let image;
  let method;

  if (session) {
    name = session.user.name || name;
    email = session.user.email;
    if (email?.endsWith(".invalid")) email = null;
    image = session.user.image;
    try {
      if (new URL(image).protocol !== "https:") image = null;
    } catch {
      image = null;
    }

    const store = await cookies();
    const provider = store.get(loginMethodCookie)?.value ?? store.get(`__Secure-${loginMethodCookie}`)?.value;
    method = providerLabels.get(provider);
    if (!method) {
      const accounts = await readOAuthAccounts();
      if (accounts.length === 1) method = providerLabels.get(accounts[0].providerId);
    }
  } else {
    if (!await readAccessKeyUser()) return null;
    method = "คีย์เข้าคลัง";
  }

  const content = (
    <>
      <span className={`shrink-0 rounded-full border border-accent/30 bg-accent/10 ${linkToSettings
        ? "size-10 p-0.5" : "size-16 p-[3px] sm:size-[76px]"}`}>
        <span className="relative grid size-full place-items-center overflow-hidden rounded-full bg-accent/10 text-accent-text">
          <UserRound size={linkToSettings ? 18 : 26} aria-hidden="true" />
          <Thumbnail src={image} className="absolute inset-0 size-full object-cover" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-medium ${linkToSettings ? "text-sm" : "text-lg"}`} title={name}>{name}</span>
        {email && <span className="block truncate text-xs text-muted" title={email}>{email}</span>}
        <span className="block text-xs text-muted">{method ? `เข้าด้วย ${method}` : "เข้าสู่ระบบแล้ว"}</span>
      </span>
      {!linkToSettings && method === "LINE" && (
        <Image src="/line-brand.png" width={1001} height={1000} alt="" unoptimized className="h-10 w-auto shrink-0" />
      )}
    </>
  );

  const profile = "flex w-full min-w-0 items-center text-start";
  return linkToSettings
    ? <Link href="/settings" className={`${profile} gap-3 rounded-xl px-2 py-2 hover:bg-panel`}>{content}</Link>
    : <div className={`${profile} gap-4 sm:gap-5`}>{content}</div>;
}
