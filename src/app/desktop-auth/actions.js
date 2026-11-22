"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/server/auth";
import { closeStudioSession } from "@/lib/server/session";

export async function switchDesktopAccount(formData) {
  const rawNext = formData.get("next");
  const safeNext = typeof rawNext === "string" && rawNext.startsWith("/desktop-auth") && !rawNext.startsWith("//")
    ? rawNext
    : "/library";

  await closeStudioSession();
  const auth = getAuth();
  if (auth) await auth.api.signOut({ headers: await headers() });
  redirect(`/login?next=${encodeURIComponent(safeNext)}`);
}
