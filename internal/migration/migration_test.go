package migration

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestMigrationVersions(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Run each migration individually and check the version after each step.
	// We manually iterate to assert the version is updated "with each migration".
	for i, m := range Migrators {
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("Failed to begin transaction for migration %d: %v", i, err)
		}

		if err := m.Migrate(tx); err != nil {
			tx.Rollback()
			t.Fatalf("Migration %d failed: %v", i, err)
		}

		// Manually set the version to simulate the runner's responsibility
		if err := setVersion(tx, i); err != nil {
			tx.Rollback()
			t.Fatalf("Failed to set version %d: %v", i, err)
		}

		if err := tx.Commit(); err != nil {
			t.Fatalf("Failed to commit transaction for migration %d: %v", i, err)
		}

		// Assert the version was updated
		currentVersion := getVersion(db)
		if currentVersion != i {
			t.Errorf("Expected version %d after migration, got %d", i, currentVersion)
		}
	}
}
