"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { availableProviders, getAuth } from "@/lib/server/auth";
import { closeStudioSession } from "@/lib/server/session";

function safeCallbackPath(raw) {
  if (typeof raw !== "string") return "/library";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\r") || trimmed.includes("\n")) {
    return "/library";
  }
  return trimmed;
}

export async function signInWithProvider(formData) {
  const provider = formData.get("provider");
  if (!availableProviders().includes(provider)) redirect("/login?oauth=failed");

  const callbackURL = safeCallbackPath(formData.get("next"));
  let result;
  try {
    result = await getAuth().api.signInSocial({
      headers: await headers(),
      body: { provider, callbackURL, errorCallbackURL: "/login?oauth=failed" },
    });
  } catch {
    redirect("/login?oauth=failed");
  }

  if (!result?.url) redirect("/login?oauth=failed");
  await closeStudioSession();
  redirect(result.url);
}
