package api

import (
	"testing"
)

func TestInterface_ExecDbQuery_ReadOnly(t *testing.T) {
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	result, err := iface.ExecDbQuery("SELECT COUNT(*) FROM tracks")
	if err != nil {
		t.Fatalf("ExecDbQuery failed: %v", err)
	}

	expectedCols := []string{"COUNT(*)"}
	if len(result.Columns) != 1 || result.Columns[0] != expectedCols[0] {
		t.Errorf("Expected columns %v, got %v", expectedCols, result.Columns)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("Expected 1 row, got %d", len(result.Rows))
	}
	if len(result.Rows[0]) != 1 {
		t.Fatalf("Expected 1 value in row, got %d", len(result.Rows[0]))
	}
	count, ok := result.Rows[0][0].(int64)
	if !ok || count != 0 {
		t.Errorf("Expected row value int64(0), got %v (type %T)", result.Rows[0][0], result.Rows[0][0])
	}
}

func TestInterface_ExecDbQuery_WriteQuery(t *testing.T) {
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	_, err := iface.ExecDbQuery("INSERT INTO tracks (id, short_id, name, path, artist, album) VALUES ('test', 'test', 'test', 'test', 'test', 'test')")
	if err == nil {
		t.Fatal("Expected error for write query, got nil")
	}
}

func TestInterface_ExecDbQuery_ComputedQuery(t *testing.T) {
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	result, err := iface.ExecDbQuery("SELECT 1 + 1")
	if err != nil {
		t.Fatalf("ExecDbQuery failed: %v", err)
	}

	expectedCols := []string{"1 + 1"}
	if len(result.Columns) != 1 || result.Columns[0] != expectedCols[0] {
		t.Errorf("Expected columns %v, got %v", expectedCols, result.Columns)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("Expected 1 row, got %d", len(result.Rows))
	}
	val, ok := result.Rows[0][0].(int64)
	if !ok || val != 2 {
		t.Errorf("Expected row value int64(2), got %v (type %T)", result.Rows[0][0], result.Rows[0][0])
	}
}

func TestInterface_ExecDbQuery_DeleteQuery(t *testing.T) {
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	_, err := iface.ExecDbQuery("DELETE FROM tracks")
	if err == nil {
		t.Fatal("Expected error for DELETE query, got nil")
	}
}

func TestInterface_GetDbSchema(t *testing.T) {
	iface := setupIface(t)
	if err := iface.InitDb(); err != nil {
		t.Fatalf("InitDb failed: %v", err)
	}

	schema, err := iface.GetDbSchema()
	if err != nil {
		t.Fatalf("GetDbSchema failed: %v", err)
	}

	if schema == "" {
		t.Fatal("Expected non-empty schema")
	}
}
