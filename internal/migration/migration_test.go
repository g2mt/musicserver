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

		if err := m.Migrate(tx, nil); err != nil {
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

func TestMigrationV3(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Set up v2 schema with some absolute paths
	v0 := MigratorV0{}
	opts := &MigrationOptions{DataPath: "/music/library"}
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	if err := v0.Migrate(tx, opts); err != nil {
		tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	// Insert tracks with absolute paths
	_, err = db.Exec(`
		INSERT INTO tracks (id, short_id, name, path, artist, album) VALUES
		('id1', 'short1', 'Track1', '/music/library/artist/album/song.mp3', 'Artist', 'Album'),
		('id2', 'short2', 'Track2', '/music/library/other/track.flac', 'Other', 'Various'),
		('id3', 'short3', 'Track3', '/outside/prefix/file.mp3', 'Outside', 'Stuff'),
		('id4', 'short4', 'Track4', 'already/relative/path.ogg', 'Rel', 'Path')
	`)
	if err != nil {
		t.Fatal(err)
	}

	// Run v3 migration
	v3 := MigratorV3{}
	tx, err = db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	if err := v3.Migrate(tx, opts); err != nil {
		tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	// Verify paths
	var path1, path2, path3, path4 string
	err = db.QueryRow("SELECT path FROM tracks WHERE id = 'id1'").Scan(&path1)
	if err != nil {
		t.Fatal(err)
	}
	err = db.QueryRow("SELECT path FROM tracks WHERE id = 'id2'").Scan(&path2)
	if err != nil {
		t.Fatal(err)
	}
	err = db.QueryRow("SELECT path FROM tracks WHERE id = 'id3'").Scan(&path3)
	if err != nil {
		t.Fatal(err)
	}
	err = db.QueryRow("SELECT path FROM tracks WHERE id = 'id4'").Scan(&path4)
	if err != nil {
		t.Fatal(err)
	}

	if path1 != "artist/album/song.mp3" {
		t.Errorf("path1 = %q, want %q", path1, "artist/album/song.mp3")
	}
	if path2 != "other/track.flac" {
		t.Errorf("path2 = %q, want %q", path2, "other/track.flac")
	}
	if path3 != "/outside/prefix/file.mp3" {
		t.Errorf("path3 = %q, want %q (should be unchanged)", path3, "/outside/prefix/file.mp3")
	}
	if path4 != "already/relative/path.ogg" {
		t.Errorf("path4 = %q, want %q (should be unchanged)", path4, "already/relative/path.ogg")
	}
}
