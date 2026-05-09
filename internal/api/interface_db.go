package api

import (
	"context"
	"database/sql"
	"errors"

	"github.com/mattn/go-sqlite3"
)

func IsQueryReadOnly(db *sql.DB, query string) (bool, error) {
	conn, err := db.Conn(context.Background())
	if err != nil {
		return false, err
	}
	defer conn.Close()

	var isReadOnly bool
	err = conn.Raw(func(driverConn interface{}) error {
		sqliteConn := driverConn.(*sqlite3.SQLiteConn)

		stmt, err := sqliteConn.Prepare(query)
		if err != nil {
			return err
		}
		sqliteStmt := stmt.(*sqlite3.SQLiteStmt)
		defer sqliteStmt.Close()

		isReadOnly = sqliteStmt.Readonly()
		return nil
	})

	return isReadOnly, err
}

type dbQueryResult struct {
	Columns []string     `json:"columns"`
	Rows    []dbQueryRow `json:"rows"`
}

type dbQueryRow []interface{}

// ExecDbQuery executes a read-only SQL query on the database.
func (i *Interface) ExecDbQuery(query string) (*dbQueryResult, error) {
	readOnly, err := IsQueryReadOnly(i.db, query)
	if err != nil {
		return nil, err
	}
	if !readOnly {
		return nil, errors.New("only read-only queries are allowed")
	}

	rows, err := i.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var result dbQueryResult
	result.Columns = cols

	values := make([]interface{}, len(cols))
	valuePtrs := make([]interface{}, len(cols))
	for rows.Next() {
		for i := range cols {
			valuePtrs[i] = &values[i]
		}
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}
		row := make(dbQueryRow, len(cols))
		for i, val := range values {
			if val == nil {
				row[i] = nil
			} else {
				switch v := val.(type) {
				case []byte:
					row[i] = string(v)
				default:
					row[i] = v
				}
			}
		}
		result.Rows = append(result.Rows, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetDbSchema returns the CREATE TABLE statements for all tables in the database.
func (i *Interface) GetDbSchema() (string, error) {
	rows, err := i.db.Query("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name")
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var result string
	for rows.Next() {
		var sql string
		if err := rows.Scan(&sql); err != nil {
			return "", err
		}
		result += sql
		result += ";\n"
	}
	return result, rows.Err()
}
