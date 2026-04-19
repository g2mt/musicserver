package migration

import "database/sql"

type MigratorV2 struct{}

func (m MigratorV2) Migrate(tx *sql.Tx) error {
	if !columnExists(tx, "tracks", "ck_last_modified") {
		_, err := tx.Exec(`
			ALTER TABLE tracks ADD COLUMN ck_last_modified INTEGER NOT NULL DEFAULT 0;
		`)
		if err != nil {
			return err
		}
	}

	if !columnExists(tx, "tracks", "ck_size") {
		_, err := tx.Exec(`
			ALTER TABLE tracks ADD COLUMN ck_size INTEGER NOT NULL DEFAULT 0;
		`)
		if err != nil {
			return err
		}
	}

	return nil
}

func columnExists(tx *sql.Tx, tableName, columnName string) bool {
	var count int
	// pragma_table_info is a SQLite specific function to get table schema info
	err := tx.QueryRow("SELECT count(*) FROM pragma_table_info(?) WHERE name = ?", tableName, columnName).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}
