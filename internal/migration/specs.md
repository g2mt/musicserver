# migration

Handles database migration by version. This module contains the following files:

- `migration.go`:

  * Defines the public `Migrator` interface, the `Migrators` array containing all the migration interfaces. The `Migrator` interface will have the functions:
    * `Migrate(tx) -> error`: migrates from the direct previous version to this version. This migration is atomic and occurs within a single transaction.

  * The `Migrators` array is sorted by version in ascending order: `MigratorV1`, ...

  * `getVersion(*sql.DB) -> int`: If there is a `prefs(key: string,value: string)` table in the db then return the integer parsed from the key "version". If it doesn't exist then return 0.

  * `Migrate(*sql.DB) -> error`: migrates the database to the latest version. Create a transaction here, then run the migration by the `Migrators` array from index=(current version+1).
    * The transaction is created once. Once rolled back, the database will be restored to before the Migrate function is called.

- `v*.go` (`v1.go`, ...): Implements the `MigratorV*` structs (`MigratorV1`, ...), constructors NewMigratorV1, ...

## New version changes

This section describes the changes between database versions:

  * 0: initial version, creates the initial table:

```sql
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  short_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS albums (
  name TEXT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS short_ids (
  short_id TEXT PRIMARY KEY,
  long_id TEXT NOT NULL
);
```

  * 1: adds the `prefs(key: string,value: string)` table with version key set to 1.
    From this verion onwards, the version key will be incremented by 1.
