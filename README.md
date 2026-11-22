This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Neon catalog

The library, scan status, and history use Next.js Server Components to read the existing Studio tables on each request. Set the following server-only environment variables in the ignored .env.local.

- DATABASE_URL is the pooled Neon connection string for a login role with SELECT on studio.catalog_items, studio.scan_folders, and studio.watch_history, plus USAGE on the studio schema and CONNECT on pikpak_studio. Keep RLS enabled and use a role without BYPASSRLS.
- STUDIO_OWNER_ID is the existing owner's studio.users UUID.
- STUDIO_ACCESS_KEY is a random secret of at least 32 characters. Use it at /login for single-owner access until OAuth is configured.
- STUDIO_SHARE_ROOT_IDS optionally lists comma-separated folder IDs confirmed at the top level of their PikPak shares. Studio displays these folders at the library root if their saved parent is missing.

Restart the development server after configuring the environment. Use HTTPS for a production deployment.

## Thumbnails

SSR looks up thumbnail URLs in the Desktop thumbnail cache for catalog entries belonging to the signed-in owner. Set STUDIO_DESKTOP_CACHE_DIR on the Next.js server if the cache is mounted at another path. The default is the Desktop cache under APPDATA on Windows. The browser loads images directly from PikPak and uses an icon when a thumbnail is missing or expired.

## Social login

Set the Client ID and Secret for each enabled provider in .env.local. For LINE, use the channel ID and channel secret in LINE_CLIENT_ID and LINE_CLIENT_SECRET. For Facebook, use the app ID and app secret in FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET.

Register these callback URLs with the respective providers. Use the same origin as BETTER_AUTH_URL when deploying.

- Google: http://localhost:3000/api/auth/callback/google
- LINE: http://localhost:3000/api/auth/callback/line
- Facebook: http://localhost:3000/api/auth/callback/facebook

Users can sign in with any configured provider. Each new account receives its own Studio user ID, which the server uses for row-level access to the catalog, scan status, and history. The verified Google account matching STUDIO_OWNER_EMAIL can claim the existing Studio catalog identified by STUDIO_OWNER_ID. Other sign-ins start with an empty catalog. Linking different sign-in providers is disabled.

Apply database/001_studio_auth.sql and database/002_studio_catalog_accounts.sql in order when setting up a fresh database. Set AUTH_DATABASE_URL if social login uses a separate role on the same database as the catalog. Otherwise it uses DATABASE_URL. The login role needs USAGE on the public schema and SELECT, INSERT, UPDATE, and DELETE on public.studio_auth_user, public.studio_auth_session, public.studio_auth_account, and public.studio_auth_verification. The database trigger creates the corresponding Studio user. BETTER_AUTH_SECRET stays server-side. The existing access key remains available until STUDIO_ACCESS_KEY is removed. The Desktop cache on the server belongs to the existing Studio account only.

## Desktop sync

See [the Desktop integration guide](DESKTOP-SYNC.md) for the production WebView flow and request examples.

Apply `database/003_desktop_sync.sql` to the existing Studio database before releasing this version. It adds catalog columns and grants the existing `pikpak_web_reader` role insert and update access to `studio.catalog_items` under its existing row-level policy. If the deployment uses a different role for `DATABASE_URL`, adjust the migration's grantee. The migration preserves existing rows.

Desktop should send `POST /api/desktop/sync` from the production Studio origin using the signed-in Studio webview session and `Content-Type: application/json`. Make a same-origin request from the Studio webview so the session cookie and Origin header are sent. The server resolves the catalog owner from the OAuth session. The payload can contain `catalog` as an item array or `detail.files` from a PikPak listing page, plus `file_info` as one file object or an array. Every item needs `id`, `name`, and `kind` (for example, `drive#file`). Include `parent_id`, `mime_type`, `size`, `modified_time`, and `thumbnail_link` when available. Set `share_root: true` on folders that Desktop identifies as share roots.

Send up to 100 combined items and 512 KiB per request. Send each listing page separately and keep pagination and passcode tokens on Desktop. A successful response includes the number of rows inserted or updated. Retries use the same owner and file ID. Omitted items are preserved. The server stores catalog metadata, validated thumbnail links, and normalized preview information. It does not fetch remote URLs or resolve the contents of `.url` files.

