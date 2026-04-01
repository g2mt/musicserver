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

var Migrators = []Migrator{
	MigratorV0{},
	MigratorV1{},
}

func getVersion(db *sql.DB) int {
	var value string
	err := db.QueryRow("SELECT value FROM prefs WHERE key = 'version'").Scan(&value)
	if err != nil {
		return 0
	}
	version, err := strconv.Atoi(value)
	if err != nil {
		return 0
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

	for idx := current; idx < len(Migrators); idx++ {
		if err = Migrators[idx].Migrate(tx); err != nil {
			return fmt.Errorf("migration v%d failed: %w", idx, err)
		}
		slog.Debug("Migrated to", "ver", idx)
	}

	return tx.Commit()
}
