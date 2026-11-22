BEGIN;

GRANT INSERT, UPDATE ON studio.scan_folders TO pikpak_web_reader;
GRANT INSERT, UPDATE ON studio.watch_history TO pikpak_web_reader;

COMMIT;
