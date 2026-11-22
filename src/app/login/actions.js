"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { closeStudioSession, openStudioSession } from "@/lib/server/session";
import { getAuth } from "@/lib/server/auth";

export async function signIn(formData) {
  if (!await openStudioSession(formData.get("accessKey"))) redirect("/login?invalid=1");
  redirect("/library");
}

export async function signOut() {
  await closeStudioSession();
  const auth = getAuth();
  if (auth) await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
