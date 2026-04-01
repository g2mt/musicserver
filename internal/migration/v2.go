package migration

import "database/sql"

type MigratorV2 struct{}

func (m MigratorV2) Migrate(tx *sql.Tx) error {
	if err := setVersion(tx, 2); err != nil {
		return err
	}
	_, err := tx.Exec(`
	ALTER TABLE tracks ADD COLUMN ck_last_modified INTEGER;
	ALTER TABLE tracks ADD COLUMN ck_size INTEGER;
	`)
	return err
}
