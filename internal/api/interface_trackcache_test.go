package api

import (
	"database/sql"
	"musicserver/internal/schema"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func setupCacheIface(t *testing.T) *Interface {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}
	enabled := true
	return &Interface{
		db: db,
		config: &schema.Config{
			DataPath:        "/",
			IgnoreTrackPath: true,
			CacheDbEnabled:  &enabled,
			CacheDbPath:     ":memory:",
		},
	}
}

func TestInterface_CacheInit(t *testing.T) {
	iface := setupCacheIface(t)
	ccacheDb, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	iface.ccacheDb = ccacheDb

	if err := iface.initCacheDb(); err != nil {
		t.Fatalf("initCacheDb failed: %v", err)
	}

	var version int
	err = iface.ccacheDb.QueryRow("SELECT value FROM stats WHERE key = 'version'").Scan(&version)
	if err != nil {
		t.Fatalf("Failed to query version: %v", err)
	}
	if version != CoverCacheVersion {
		t.Errorf("Expected version %d, got %d", CoverCacheVersion, version)
	}
}

func TestInterface_CacheGetSet(t *testing.T) {
	iface := setupCacheIface(t)
	ccacheDb, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	iface.ccacheDb = ccacheDb
	iface.initCacheDb()

	path := "test/path.jpg"
	data := []byte("fake-image-data")
	mime := "image/jpeg"

	// Test miss
	d, m, err := iface.getTrackCoverCached(path)
	if err != nil {
		t.Fatal(err)
	}
	if d != nil {
		t.Error("Expected nil data on cache miss")
	}

	iface.insertCoverCacheEntry(coverCacheData{
		path:     path,
		data:     data,
		mimeType: mime,
	})

	d, m, err = iface.getTrackCoverCached(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(d) != string(data) || m != mime {
		t.Errorf("Cache hit mismatch. Got %s, %s; want %s, %s", string(d), m, string(data), mime)
	}
}

func TestInterface_CacheEviction(t *testing.T) {
	iface := setupCacheIface(t)
	ccacheDb, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	iface.ccacheDb = ccacheDb
	iface.initCacheDb()

	// Set a small limit: enough for 2 entries of 10 bytes
	iface.config.CacheDbMaxBytes = 25

	entries := []struct {
		path string
		data []byte
	}{
		{"1", []byte("0123456789")}, // 10 bytes
		{"2", []byte("0123456789")}, // 10 bytes
		{"3", []byte("0123456789")}, // 10 bytes -> should evict "1"
	}

	for _, e := range entries {
		iface.insertCoverCacheEntry(coverCacheData{
			path:     e.path,
			data:     e.data,
			mimeType: "image/jpeg",
		})
	}

	hits := 0
	paths := []string{"1", "2", "3"}
	for _, p := range paths {
		d, _, _ := iface.getTrackCoverCached(p)
		if d != nil {
			hits++
		}
	}

	// Expected: "1" was evicted, "2" and "3" remain. Hit ratio 2/3
	if hits != 2 {
		t.Errorf("Expected 2 hits after eviction, got %d", hits)
	}

	// Verify "1" is specifically gone
	d, _, _ := iface.getTrackCoverCached("1")
	if d != nil {
		t.Error("Expected entry '1' to be evicted")
	}
}

func TestInterface_CleanCoverCache(t *testing.T) {
	iface := setupCacheIface(t)
	ccacheDb, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	iface.ccacheDb = ccacheDb
	iface.initCacheDb()

	iface.insertCoverCacheEntry(coverCacheData{
		path:     "a",
		data:     []byte("b"),
		mimeType: "c",
	})

	if err := iface.CleanCoverCache(); err != nil {
		t.Fatal(err)
	}

	var count int
	iface.ccacheDb.QueryRow("SELECT COUNT(*) FROM cover_cache").Scan(&count)
	if count != 0 {
		t.Errorf("Expected 0 rows after clean, got %d", count)
	}
}
