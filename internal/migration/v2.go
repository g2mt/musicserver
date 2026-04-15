package migration

import "database/sql"

type MigratorV2 struct{}

func (m MigratorV2) Migrate(tx *sql.Tx) error {
	_, err := tx.Exec(`
		ALTER TABLE tracks ADD COLUMN IF NOT EXISTS ck_last_modified INTEGER NOT NULL DEFAULT 0;
		ALTER TABLE tracks ADD COLUMN IF NOT EXISTS ck_size INTEGER NOT NULL DEFAULT 0;
		INSERT INTO prefs (key, value) VALUES ('version', '2')
		ON CONFLICT(key) DO UPDATE SET value = excluded.value;
	`)
	return err
}
