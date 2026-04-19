package migration

import "database/sql"

type MigratorV0 struct{}

func (m MigratorV0) Migrate(tx *sql.Tx) error {
	_, err := tx.Exec(`
		CREATE TABLE IF NOT EXISTS tracks (
		  id TEXT PRIMARY KEY,
		  short_id TEXT NOT NULL,
		  name TEXT NOT NULL,
		  path TEXT NOT NULL,
		  artist TEXT NOT NULL,
		  album TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS albums (
		  name TEXT PRIMARY KEY
		);
		CREATE TABLE IF NOT EXISTS short_ids (
		  short_id TEXT PRIMARY KEY,
		  long_id TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS prefs (
		  key TEXT PRIMARY KEY,
		  value TEXT NOT NULL
		);
	`)
	return err
}
