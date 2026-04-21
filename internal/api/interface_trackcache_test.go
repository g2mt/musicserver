package api

import (
	"database/sql"
	"musicserver/internal/schema"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func setupCacheIface(t *testing.T, cacheDbMaxBytes int) *Interface {
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
			CacheDbMaxBytes: cacheDbMaxBytes,
		},
	}
}

func TestInterface_CacheInit(t *testing.T) {
	iface := setupCacheIface(t, 10000)
	ccacheDb, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	iface.ccacheDb = ccacheDb

	if err := iface.initCacheDb(); err != nil {
		t.Fatalf("initCacheDb failed: %v", err)
	}
}

func TestInterface_CacheGetSet(t *testing.T) {
	iface := setupCacheIface(t, 10000)
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
	iface := setupCacheIface(t, 21) // Set a small limit: enough for 2 entries of 10 bytes
	ccacheDb, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	iface.ccacheDb = ccacheDb
	iface.initCacheDb()

	entries := []struct {
		path string
		data []byte
	}{ // each data must be different
		{"1", []byte("0123456789")}, // 10 bytes
		{"2", []byte("1234567890")}, // 10 bytes
		{"3", []byte("_123456789")}, // 10 bytes -> should evict "1"
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
}

func TestInterface_CleanCoverCache(t *testing.T) {
	iface := setupCacheIface(t, 10000)
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
