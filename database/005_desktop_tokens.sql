BEGIN;

CREATE TABLE IF NOT EXISTS public.studio_desktop_token (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  auth_user_id text NOT NULL REFERENCES public.studio_auth_user(id) ON DELETE CASCADE,
  studio_owner_id uuid NOT NULL REFERENCES studio.users(id) ON DELETE CASCADE,
  device_name text NOT NULL DEFAULT 'PikPak Studio Desktop',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS studio_desktop_token_user
  ON public.studio_desktop_token (auth_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_desktop_token TO pikpak_auth_runtime;

COMMIT;
