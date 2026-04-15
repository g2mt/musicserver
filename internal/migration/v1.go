package migration

import "database/sql"

type MigratorV1 struct{}

func (m MigratorV1) Migrate(tx *sql.Tx) error {
	_, err := tx.Exec(`
	CREATE TABLE IF NOT EXISTS prefs (
	  key TEXT PRIMARY KEY,
	  value TEXT NOT NULL
	);
	`)
	if err != nil {
		err = setVersion(tx, 1)
	}
	return err
}
