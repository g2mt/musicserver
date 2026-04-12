package migration

import "database/sql"

type MigratorV2 struct{}

func (m MigratorV2) Migrate(tx *sql.Tx) error {
	_, err := tx.Exec(`
		ALTER TABLE tracks ADD COLUMN ck_last_modified INTEGER NOT NULL DEFAULT 0;
		ALTER TABLE tracks ADD COLUMN ck_size INTEGER NOT NULL DEFAULT 0;
	`)
	return err
}
