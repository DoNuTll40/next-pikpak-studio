BEGIN;

CREATE FUNCTION public.studio_provision_catalog_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  catalog_id uuid;
BEGIN
  IF NEW."studioOwnerId" IS NULL THEN
    catalog_id := gen_random_uuid();
    INSERT INTO studio.users (id, email)
    VALUES (catalog_id, catalog_id::text || '@accounts.pikpak.invalid');
    NEW."studioOwnerId" := catalog_id::text;
  ELSIF NOT EXISTS (SELECT 1 FROM studio.users WHERE id = NEW."studioOwnerId"::uuid) THEN
    RAISE EXCEPTION 'Studio catalog user does not exist';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.studio_provision_catalog_user() FROM PUBLIC;

CREATE TRIGGER studio_auth_provision_catalog_user
BEFORE INSERT ON public.studio_auth_user
FOR EACH ROW EXECUTE FUNCTION public.studio_provision_catalog_user();

WITH missing AS MATERIALIZED (
  SELECT id AS auth_id, gen_random_uuid() AS catalog_id
  FROM public.studio_auth_user
  WHERE "studioOwnerId" IS NULL
), created AS (
  INSERT INTO studio.users (id, email)
  SELECT catalog_id, catalog_id::text || '@accounts.pikpak.invalid' FROM missing
  RETURNING id
)
UPDATE public.studio_auth_user AS account
SET "studioOwnerId" = missing.catalog_id::text
FROM missing JOIN created ON created.id = missing.catalog_id
WHERE account.id = missing.auth_id;

ALTER TABLE public.studio_auth_user ALTER COLUMN "studioOwnerId" SET NOT NULL;

COMMIT;
