import "server-only";
import { createHash } from "node:crypto";

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth, lastLoginMethod, line } from "better-auth/plugins";
import { Pool } from "pg";
import { headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";

export const loginMethodCookie = "studio_login_method";

let auth;

function credentials(provider) {
  const prefix = provider.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function providerEmail(provider, subject) {
  const hash = createHash("sha256").update(String(subject)).digest("hex");
  return `${provider}-${hash.slice(0, 40)}@oauth.pikpak.invalid`;
}

function lineProvider(credentials) {
  const provider = line({ ...credentials, scopes: ["openid", "profile"] });
  return {
    ...provider,
    async getUserInfo(tokens) {
      const profile = await provider.getUserInfo(tokens);
      if (!profile?.sub) return null;
      return { ...profile, email: providerEmail("line", profile.sub) };
    },
  };
}

export function getAuth() {
  if (auth) return auth;
  const { AUTH_DATABASE_URL, DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, STUDIO_OWNER_ID, STUDIO_OWNER_EMAIL } = process.env;
  const connectionString = AUTH_DATABASE_URL?.trim() || DATABASE_URL;
  const google = credentials("google");
  const facebook = credentials("facebook");
  const lineCredentials = credentials("line");
  if (!connectionString || !BETTER_AUTH_SECRET || !BETTER_AUTH_URL ||
      !(google || facebook || lineCredentials)) return null;

  const ownerEmail = STUDIO_OWNER_EMAIL?.trim().toLowerCase();
  const pool = new Pool({ connectionString, enableChannelBinding: true, max: 4,
    connectionTimeoutMillis: 8000 });
  pool.on("error", () => console.error("Idle OAuth database connection closed"));

  auth = betterAuth({
    appName: "PikPak Studio",
    database: pool,
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
    onAPIError: { errorURL: "/login?oauth=failed" },
    user: {
      modelName: "studio_auth_user",
      additionalFields: { studioOwnerId: { type: "string", input: false, required: false } },
    },
    session: { modelName: "studio_auth_session" },
    verification: { modelName: "studio_auth_verification" },
    account: {
      modelName: "studio_auth_account",
      encryptOAuthTokens: true,
      accountLinking: { enabled: false, disableImplicitLinking: true },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            if (STUDIO_OWNER_ID && ownerEmail && context?.path === "/callback/:id" && context.params?.id === "google" &&
                user.emailVerified === true && user.email.trim().toLowerCase() === ownerEmail) {
              return { data: { studioOwnerId: STUDIO_OWNER_ID } };
            }
          },
        },
      },
    },
    socialProviders: {
      ...(google && { google: { ...google, disableIdTokenSignIn: true } }),
      ...(facebook && { facebook: {
        ...facebook,
        disableIdTokenSignIn: true,
        disableDefaultScope: true,
        scope: ["public_profile"],
        mapProfileToUser: profile => profile.id
          ? { email: providerEmail("facebook", profile.id), emailVerified: false }
          : {},
      } }),
    },
    plugins: [
      genericOAuth({ config: lineCredentials ? [lineProvider(lineCredentials)] : [] }),
      lastLoginMethod({ cookieName: loginMethodCookie, maxAge: 60 * 60 * 24 * 7 }),
      nextCookies(),
    ],
  });

  return auth;
}

export function availableProviders() {
  return getAuth() ? ["google", "line", "facebook"].filter(provider => credentials(provider)) : [];
}

export const readOAuthSession = cache(async function readOAuthSession() {
  await connection();
  const instance = getAuth();
  if (!instance) return null;
  return instance.api.getSession({ headers: await headers() });
});

export const readOAuthAccounts = cache(async function readOAuthAccounts() {
  const auth = getAuth();
  return auth ? auth.api.listUserAccounts({ headers: await headers() }) : [];
});
