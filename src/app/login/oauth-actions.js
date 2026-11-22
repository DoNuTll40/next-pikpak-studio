"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { availableProviders, getAuth } from "@/lib/server/auth";
import { closeStudioSession } from "@/lib/server/session";

export async function signInWithProvider(formData) {
  const provider = formData.get("provider");
  if (!availableProviders().includes(provider)) redirect("/login?oauth=failed");

  let result;
  try {
    result = await getAuth().api.signInSocial({
      headers: await headers(),
      body: { provider, callbackURL: "/library", errorCallbackURL: "/login?oauth=failed" },
    });
  } catch {
    redirect("/login?oauth=failed");
  }

  if (!result?.url) redirect("/login?oauth=failed");
  await closeStudioSession();
  redirect(result.url);
}

