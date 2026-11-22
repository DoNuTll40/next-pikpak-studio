BEGIN;

ALTER TABLE studio.catalog_items
    ADD COLUMN IF NOT EXISTS detail jsonb,
    ADD COLUMN IF NOT EXISTS file_info jsonb,
    ADD COLUMN IF NOT EXISTS thumbnail_url text,
    ADD COLUMN IF NOT EXISTS share_root boolean NOT NULL DEFAULT false;

GRANT INSERT, UPDATE ON studio.catalog_items TO pikpak_web_reader;

COMMIT;
