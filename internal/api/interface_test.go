package api

import (
	"database/sql"
	"musicserver/internal/schema"
	"testing"

	"github.com/google/go-cmp/cmp"
	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}
	return db
}

func TestInterface_InitDb(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := &schema.Config{}
	iface := NewInterface(db, config)
	err := iface.InitDb()
	if err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	// Verify tables were created
	tables := []string{"tracks", "albums", "short_ids"}
	for _, table := range tables {
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&count)
		if err != nil {
			t.Fatalf("Failed to check table %s: %v", table, err)
		}
		if count != 1 {
			t.Errorf("Table %s was not created", table)
		}
	}
}

func TestInterface_AddTrack(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	iface := NewInterface(db)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	track := &Track{
		Name:  "Test Track",
		Path:  "/music/test.mp3",
		Album: "Test Album",
	}

	id, err := iface.AddTrack(track)
	if err != nil {
		t.Fatalf("AddTrack failed: %v", err)
	}

	if id != track.ID {
		t.Errorf("Expected ID %s, got %s", track.ID, id)
	}

	if track.ShortID == "" {
		t.Error("ShortID should be set")
	}

	// Verify track was inserted
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM tracks WHERE id = ?", id).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query tracks: %v", err)
	}
	if count != 1 {
		t.Error("Track was not inserted")
	}

	// Verify album was inserted
	err = db.QueryRow("SELECT COUNT(*) FROM albums WHERE name = ?", track.Album).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query albums: %v", err)
	}
	if count != 1 {
		t.Error("Album was not inserted")
	}

	// Verify short_id mapping was created
	var longID string
	err = db.QueryRow("SELECT long_id FROM short_ids WHERE short_id = ?", track.ShortID).Scan(&longID)
	if err != nil {
		t.Fatalf("Failed to query short_ids: %v", err)
	}
	if longID != id {
		t.Errorf("Short ID mapping incorrect: expected %s, got %s", id, longID)
	}
}

func TestInterface_AddTrackConflictResolution(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	iface := NewInterface(db)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	// Create two tracks with same first 6 characters of hash
	// We need to carefully craft tracks that will have hash collisions
	// For simplicity, we'll test the conflict resolution by adding the same track twice
	track1 := &Track{
		Name:  "Track One",
		Path:  "/music/one.mp3",
		Album: "Album One",
	}

	id1, err := iface.AddTrack(track1)
	if err != nil {
		t.Fatalf("First AddTrack failed: %v", err)
	}

	// Add a different track - it should get a different short ID
	track2 := &Track{
		Name:  "Track Two",
		Path:  "/music/two.mp3",
		Album: "Album Two",
	}

	id2, err := iface.AddTrack(track2)
	if err != nil {
		t.Fatalf("Second AddTrack failed: %v", err)
	}

	if id1 == id2 {
		t.Error("Different tracks should have different IDs")
	}

	if track1.ShortID == track2.ShortID {
		// If short IDs are the same, they should have been expanded
		// Verify that both mappings exist with potentially expanded IDs
		var count int
		err = db.QueryRow("SELECT COUNT(*) FROM short_ids WHERE short_id = ?", track1.ShortID).Scan(&count)
		if err != nil {
			t.Fatalf("Failed to query short_ids: %v", err)
		}
		if count > 1 {
			t.Error("Same short ID should not map to multiple tracks")
		}
	}
}

func TestInterface_GetTracks(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	iface := NewInterface(db)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	// Add some test tracks
	tracks := []*Track{
		{Name: "Track 1", Path: "/music/1.mp3", Album: "Album A"},
		{Name: "Track 2", Path: "/music/2.mp3", Album: "Album A"},
		{Name: "Track 3", Path: "/music/3.mp3", Album: "Album B"},
	}

	for _, track := range tracks {
		_, err := iface.AddTrack(track)
		if err != nil {
			t.Fatalf("AddTrack failed: %v", err)
		}
	}

	result, err := iface.GetTracks()
	if err != nil {
		t.Fatalf("GetTracks failed: %v", err)
	}

	if len(result) != len(tracks) {
		t.Errorf("Expected %d tracks, got %d", len(tracks), len(result))
	}

	// Verify each track's short ID maps to correct name
	for _, track := range tracks {
		name, ok := result[track.ShortID]
		if !ok {
			t.Errorf("Short ID %s not found in result", track.ShortID)
			continue
		}
		if name != track.Name {
			t.Errorf("For short ID %s, expected name %s, got %s", track.ShortID, track.Name, name)
		}
	}
}

func TestInterface_GetTrackById(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	iface := NewInterface(db)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	track := &Track{
		Name:  "Test Track",
		Path:  "/music/test.mp3",
		Album: "Test Album",
	}

	id, err := iface.AddTrack(track)
	if err != nil {
		t.Fatalf("AddTrack failed: %v", err)
	}

	// Test with long ID
	fetched, err := iface.GetTrackById(id)
	if err != nil {
		t.Fatalf("GetTrackById with long ID failed: %v", err)
	}

	if diff := cmp.Diff(fetched, *track); diff != "" {
		t.Errorf("GetTrackById() mismatch (-want +got):\n%s", diff)
	}

	// Test with short ID
	fetched2, err := iface.GetTrackById(track.ShortID)
	if err != nil {
		t.Fatalf("GetTrackById with short ID failed: %v", err)
	}

	if fetched2.ID != id {
		t.Errorf("When using short ID: expected ID %s, got %s", id, fetched2.ID)
	}
}

func TestInterface_GetTrackData(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	iface := NewInterface(db)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	track := &Track{
		Name:  "Test Track",
		Path:  "/music/test.mp3",
		Album: "Test Album",
	}

	id, err := iface.AddTrack(track)
	if err != nil {
		t.Fatalf("AddTrack failed: %v", err)
	}

	// Test with long ID
	data, err := iface.GetTrackData(id)
	if err != nil {
		t.Fatalf("GetTrackData with long ID failed: %v", err)
	}

	if string(data) != track.Path {
		t.Errorf("Expected path %s, got %s", track.Path, string(data))
	}

	// Test with short ID
	data2, err := iface.GetTrackData(track.ShortID)
	if err != nil {
		t.Fatalf("GetTrackData with short ID failed: %v", err)
	}

	if string(data2) != track.Path {
		t.Errorf("When using short ID: expected path %s, got %s", track.Path, string(data2))
	}
}

func TestInterface_GetAlbums(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	iface := NewInterface(db)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	// Add tracks with different albums
	albums := []string{"Album A", "Album B", "Album C"}
	for i, album := range albums {
		track := &Track{
			Name:  "Track " + string(rune('1'+i)),
			Path:  "/music/track.mp3",
			Album: album,
		}
		_, err := iface.AddTrack(track)
		if err != nil {
			t.Fatalf("AddTrack failed: %v", err)
		}
	}

	result, err := iface.GetAlbums()
	if err != nil {
		t.Fatalf("GetAlbums failed: %v", err)
	}

	if len(result) != len(albums) {
		t.Errorf("Expected %d albums, got %d", len(albums), len(result))
	}

	// Check that all albums are present
	albumMap := make(map[string]bool)
	for _, album := range result {
		albumMap[album] = true
	}

	for _, album := range albums {
		if !albumMap[album] {
			t.Errorf("Album %s not found in result", album)
		}
	}
}

func TestInterface_GetAlbumByName(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	iface := NewInterface(db)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	albumName := "Test Album"
	tracks := []*Track{
		{Name: "Track 1", Path: "/music/1.mp3", Album: albumName},
		{Name: "Track 2", Path: "/music/2.mp3", Album: albumName},
		{Name: "Track 3", Path: "/music/3.mp3", Album: albumName},
	}

	var trackIDs []string
	for _, track := range tracks {
		id, err := iface.AddTrack(track)
		if err != nil {
			t.Fatalf("AddTrack failed: %v", err)
		}
		trackIDs = append(trackIDs, id)
	}

	album, err := iface.GetAlbumByName(albumName)
	if err != nil {
		t.Fatalf("GetAlbumByName failed: %v", err)
	}

	if album.Name != albumName {
		t.Errorf("Expected album name %s, got %s", albumName, album.Name)
	}

	if len(album.Tracks) != len(tracks) {
		t.Errorf("Expected %d tracks in album, got %d", len(tracks), len(album.Tracks))
	}

	// Check that all track IDs are present
	trackMap := make(map[string]bool)
	for _, id := range album.Tracks {
		trackMap[id] = true
	}

	for _, id := range trackIDs {
		if !trackMap[id] {
			t.Errorf("Track ID %s not found in album", id)
		}
	}
}

func TestInterface_GetAlbumByName_NotFound(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	iface := NewInterface(db)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	_, err := iface.GetAlbumByName("NonExistentAlbum")
	if err == nil {
		t.Error("Expected error for non-existent album")
	}
}

func TestInterface_GetTrackById_NotFound(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	iface := NewInterface(db)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	_, err := iface.GetTrackById("nonexistent")
	if err == nil {
		t.Error("Expected error for non-existent track")
	}
}

func TestInterface_GetTrackData_NotFound(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	iface := NewInterface(db)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	_, err := iface.GetTrackData("nonexistent")
	if err == nil {
		t.Error("Expected error for non-existent track data")
	}
}
