package api

import (
	"database/sql"
	"musicserver/internal/schema"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	_ "github.com/mattn/go-sqlite3"
)

func setupIface(t *testing.T) *Interface {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}
	return &Interface{
		db:        db,
		config:    &schema.Config{},
		LongIdGen: defaultLongIdGen,
	}
}

func TestInterface_InitDb(t *testing.T) {
	iface := setupIface(t)
	db := iface.db
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
	iface := setupIface(t)
	db := iface.db
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	track := &schema.Track{
		Name:  "Test Track",
		Path:  "/music/test.mp3",
		Album: "Test Album",
	}

	id, err := iface.AddTrack(track)
	if err != nil {
		t.Fatalf("AddTrack failed: %v", err)
	}

	if id != track.ShortID {
		t.Errorf("Expected ID %s, got %s", track.LongID, id)
	}

	// Verify track was inserted
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM tracks WHERE short_id = ?", id).Scan(&count)
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
	if longID != track.LongID {
		t.Errorf("Short ID mapping incorrect: expected %s, got %s", id, longID)
	}
}

func TestInterface_AddTrackConflictResolution(t *testing.T) {
	iface := setupIface(t)
	iface.LongIdGen = func(track *schema.Track) string {
		p := ""
		if track.Name == "Track One" {
			p = "one1234"
		} else if track.Name == "Track Two" {
			p = "one1235"
		} else {
			panic("invalid name")
		}
		return p + strings.Repeat("a", MaxIdLength-len(p))
	}
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	// Create two tracks with same first 6 characters of hash
	track1 := &schema.Track{
		Name:  "Track One",
		Path:  "/music/one.mp3",
		Album: "Album One",
	}

	shortID1, err := iface.AddTrack(track1)
	if err != nil {
		t.Fatalf("First AddTrack failed: %v", err)
	}

	// Add a different track - it should get a different short ID
	track2 := &schema.Track{
		Name:  "Track Two",
		Path:  "/music/two.mp3",
		Album: "Album Two",
	}

	shortID2, err := iface.AddTrack(track2)
	if err != nil {
		t.Fatalf("Second AddTrack failed: %v", err)
	}

	// Track 1
	// Retrieve track1 again using the API
	fetchedTrack1, err := iface.GetTrackById(shortID1)
	if err != nil {
		t.Fatalf("GetTrackById for track1 failed: %v", err)
	}
	// Assert received-track1.longid
	expectedLong1 := "one1234" + strings.Repeat("a", MaxIdLength-len("one1234"))
	if fetchedTrack1.LongID != expectedLong1 {
		t.Errorf("track1.LongID: expected %q, got %q", expectedLong1, fetchedTrack1.LongID)
	}

	// Track 2
	// According to conflict resolution, the second track's short ID should be "one1235"
	expectedShort2 := "one1235"
	if shortID2 != expectedShort2 {
		t.Errorf("track2.ShortID: expected %q, got %q", expectedShort2, shortID2)
	}
	// Also verify via GetTrackById
	fetchedTrack2, err := iface.GetTrackById(shortID2)
	if err != nil {
		t.Fatalf("GetTrackById for track2 failed: %v", err)
	}
	expectedLong2 := "one1235" + strings.Repeat("a", MaxIdLength-len("one1234"))
	if fetchedTrack2.LongID != expectedLong2 {
		t.Errorf("fetchedTrack2.LongID: expected %q, got %q", expectedLong2, fetchedTrack2.LongID)
	}

	// Track 1, old alias
	// track1 can also be retrieved via one123
	fetchedTrack1, err = iface.GetTrackById("one123")
	if fetchedTrack1.LongID != track1.LongID {
		t.Errorf("fetchedTrack1.LongID: expected %q, got %q", track1.LongID, fetchedTrack1.LongID)
	}
}

func TestInterface_GetTracks(t *testing.T) {
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	// Add some test tracks
	tracks := []*schema.Track{
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

	result, err := iface.GetTracks("")
	if err != nil {
		t.Fatalf("GetTracks failed: %v", err)
	}

	if len(result) != len(tracks) {
		t.Errorf("Expected %d tracks, got %d", len(tracks), len(result))
	}

	// Verify each track's short ID maps to correct track metadata
	for _, track := range tracks {
		resultTrack, ok := result[track.ShortID]
		if !ok {
			t.Errorf("Short ID %s not found in result", track.ShortID)
			continue
		}
		if resultTrack.LongID != track.LongID {
			t.Errorf("For short ID %s, expected long ID %s, got %s", track.ShortID, track.LongID, resultTrack.LongID)
		}
	}
}

func TestInterface_GetTrackById(t *testing.T) {
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	track := &schema.Track{
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

	if diff := cmp.Diff(fetched2, *track); diff != "" {
		t.Errorf("GetTrackById() mismatch (-want +got):\n%s", diff)
	}
}

func TestInterface_GetTrackData(t *testing.T) {
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	track := &schema.Track{
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
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	// Add tracks with different albums
	albums := []string{"Album A", "Album B", "Album C"}
	for i, album := range albums {
		track := &schema.Track{
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
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	albumName := "Test Album"
	tracks := []*schema.Track{
		{Name: "Track 1", Path: "/music/1.mp3", Album: albumName},
		{Name: "Track 2", Path: "/music/2.mp3", Album: albumName},
		{Name: "Track 3", Path: "/music/3.mp3", Album: albumName},
	}

	var trackIDs []string
	for _, track := range tracks {
		_, err := iface.AddTrack(track)
		if err != nil {
			t.Fatalf("AddTrack failed: %v", err)
		}
		trackIDs = append(trackIDs, track.LongID)
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
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	_, err := iface.GetAlbumByName("NonExistentAlbum")
	if err == nil {
		t.Error("Expected error for non-existent album")
	}
}

func TestInterface_GetTrackById_NotFound(t *testing.T) {
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	_, err := iface.GetTrackById("nonexistent")
	if err == nil {
		t.Error("Expected error for non-existent track")
	}
}

func TestInterface_GetTrackData_NotFound(t *testing.T) {
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	_, err := iface.GetTrackData("nonexistent")
	if err == nil {
		t.Error("Expected error for non-existent track data")
	}
}
