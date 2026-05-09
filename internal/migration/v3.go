package migration

import (
	"database/sql"
	"path/filepath"
	"strings"
)

type MigratorV3 struct{}

func (m MigratorV3) Migrate(tx *sql.Tx, opts *MigrationOptions) error {
	if opts == nil || opts.DataPath == "" {
		return nil
	}

	rows, err := tx.Query("SELECT id, path FROM tracks")
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var id, path string
		if err := rows.Scan(&id, &path); err != nil {
			return err
		}

		if path == "" || !strings.HasPrefix(path, opts.DataPath) {
			continue
		}

		relPath, err := filepath.Rel(opts.DataPath, path)
		if err != nil || strings.HasPrefix(relPath, "..") {
			continue
		}

		if _, err := tx.Exec("UPDATE tracks SET path = ? WHERE id = ?", relPath, id); err != nil {
			return err
		}
	}
	return rows.Err()
}
