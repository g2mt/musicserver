package migration

import (
	"database/sql"
	"fmt"
	"log/slog"
	"strconv"
)

type Migrator interface {
	Migrate(tx *sql.Tx) error
}

// change this whenever a new version is added
var Migrators = []Migrator{
	MigratorV0{},
	MigratorV1{},
	MigratorV2{},
}

func getVersion(db *sql.DB) int {
	var value string
	err := db.QueryRow("SELECT value FROM prefs WHERE key = 'version'").Scan(&value)
	if err != nil {
		return -1 // key doesn't exist, next version is v0
	}
	version, err := strconv.Atoi(value)
	if err != nil {
		return -1
	}
	return version
}

func setVersion(tx *sql.Tx, version int) error {
	_, err := tx.Exec("INSERT OR REPLACE INTO prefs (key, value) VALUES ('version', ?)", version)
	return err
}

func Migrate(db *sql.DB) error {
	current := getVersion(db)

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	for idx := current + 1; idx < len(Migrators); idx++ {
		if err = Migrators[idx].Migrate(tx); err != nil {
			return fmt.Errorf("migration v%d failed: %w", idx, err)
		}
		if err = setVersion(tx, idx); err != nil {
			return fmt.Errorf("setting version v%d failed: %w", idx, err)
		}
		slog.Debug("Migrated to", "ver", idx)
	}

	return tx.Commit()
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
