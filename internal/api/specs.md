# api

This module defines the API used for the music server.

All API endpoints will return either:
  - a JSON value (content type of `text/json`)
  - a byte stream (representing audio, images, etc.)

The API will be a router mounted on an HTTP endpoint like `/api`. The paths will be implicitly prefixed with the endpoint path.

For HTTP API responses, the content type of the response will be stored in the `Content-Type` header.

HTTP API requests will follow the template:

```
GET /track/123456?OptionKey=option value
```

In the HTTP API, option keys will always start with the "X-API-" prefix.

Alternatively, the API can be mounted as a UNIX endpoint for administrative purposes. The above HTTP request can be translated as the following byte sequence (encoded in UTF-8) to be written to the unix socket:

```json
{
  "method": "GET",
  "path": "/track/123456",
  "params": {
    "OptionKey": "option value"
  }
}
```

Under the UNIX endpoint, the response will be transferred as a stream of bytes with no content type information.

> [!NOTE]
> The Go module should contain the following files:
>
>   - `http.go`: router code with:
>     - `NewHTTPRouter(Interface)`
>     - `HTTPRouter.Serve(w http.ResponseWriter, r *http.Request)`
>   - `unix.go`: UNIX socket handling code containing:
>     - a struct `UnixSocketServer` with methods:
>       - `NewUnixSocketServer(Interface)`
>       - `UnixSocketServer.Start(path)`: binds to the path and processes requests, blocking the current running thread
>       - `UnixSocketServer.Stop()`: stops the socket server, may be used in another goroutine
>   - `interface_*.go`: common interface code with:
>     - struct Interface with methods for handling each request
>       - `NewInterface(sqlite database connection)`
>       - `Interface.InitDb`: initializes every relevant table
>       - additional methods for handling each API request: `getTracks`, `getTrackById(id)`,...
>   - `external.go`: external interface code with methods for handling each API request involving external resources

## General

### GET `/props`

Returns a JSON object containing the keys:

  - `version`: the version number, or Git commit of the compiled binary
  - `config`: a JSON object containing the server configuration

## Progress

### GET `/progress`

Returns a JSON mapping between a key for an ongoing process, and its progress:

```json
{
  "abcdef": {
    "value": 0,
    "maxValue": 100,
  },
  "xyz123": {
    "value": 32,
    "maxValue": 128,
    "output": ...,
  }
}
```

### GET `/progress/[id]/output`

Returns the command output of the progress with `id`.

### GET `/progress/[id]/events`

Returns SSE events related to the progress with `id`.

Emits event types: "Value", "MaxValue", "AddOutput"

```
event: data
data: {type:"Value", data:10}
event: data
data: {type:"AddOutput", data:"output"}
```

### GET `/progress/:events`

Returns SSE events related to all progresses.

```
event: data
data: {type:"Value", data:10, source: "abc"}
event: data
data: {type:"AddOutput", data:"output", source: "abc"}
event: data
data: {type:"AddOutput", data:"output", source: "cdef"}
```

## Tracks

Tracks are music files, indexed by an ID.

IDs refer to both short IDs and long IDs. Long IDs are SHA256 hexadecimal checksum strings. Short IDs are starting prefixes of long IDs, with a length ranging from 6 to 64 characters. 64-character short IDs are long IDs.

All tracks must always be uniquely identified by their long IDs. A track's short ID may identify it, but this isn't guaranteed.

In order to index a track by a short ID, implementors should store a mapping from short IDs to long IDs. When inserting a long ID into the mapping *M*:

  1. Obtain the *long-id* of the track to be added *T*.
  2. Set *short-id* to the first 6 characters of long ID.
  3. Try to insert the key *short-id* mapped to the long ID.
    1. If the *short-id* already exists, a conflict has occurred. Resolve the conflict by:
      1. Set *old-long-id* to be *M[short-id]*
      2. Set *old-short-id* to be *short-id*
      3. Take 1 more character from the long-id to add to the old-short-id based on the old-short-id's length. For instance, if the short-id is 6 characters long, then expand it to 7 characters by setting it to the first 7 characters of *old-long-id*
      4. Do the same thing for *T*'s *short-id*. For the above example, take 7 characters of T's *long-id*.
      5. Insert the newly expanded key *M[old-short-id]* = *old-long-id*
      6. Go back to step 3.

<a id='track-fields'></a>
A track has the following fields:

  * `id`: long ID of the track. This is calculated by the hex representation of sha256sum(name+'\0'+album)
  * `short_id`: short ID of the track, updates when the short ID is updated
  * `name`: the human readable name (title) of the track
  * `path`: the path of the file relative to the data directory of the server
  * `album`: the name of the album
  * `artist`: the name of the artist
  * `thumbnail_path` (optional): path of the thumbnail

### GET `/track`

Returns a list of tracks, with a maximum of 50 items per page:

```json
[
  {"id": ..., "name": "track name 1", ...},
  {"id": ..., "name": "track name 2", ...},
]
```

If the `q` parameter is provided, then the tracks will be filtered based on the query `q`. When searching, keywords and the negation operator targets the word. The query supports the following named operators, which shows only tracks matching the filter:

  - `after`: ID comes after the parameter lexicographically
  - `before`: ID comes before the parameter lexicographically
  - `album`: album title contains the value specified
  - `artist`: artist name contains the value specified
  - `path`: path of track file starts with the specified directory
  - `limit`: show only this amount of tracks in the list. This defaults to the constant MaxPageCount (50) if not set. If set to a negative value (usually -1), then returns all tracks without limits.

Only the `limit` operator may be specified multiple times without it being guaranteed to narrow the search results. If it is specified more than once, then the last value will be used as the limit.

### GET `/track/[id]`

Returns the metadata of the track, encoded as JSON. Refer to the [track fields section above](#track-fields).

### GET `/track/[id]/data`

Returns the audio of the track as a raw stream of bytes.

### GET `/track/[id]/cover`

Returns the cover art image of the track as a raw stream of bytes.

### GET `/track/:external/[url]`

Returns the track metadata for the URL `url` using the media downloader specified in the config file.

### POST `/track/:external/[url]`

Starts downloading the URL `url` using the media downloader specified in the config file.

Returns a JSON string containing the output captured from the media downloader.

### GET `/track/:by-path/[path]`

Resolves the track ID by path and redirects to `/track/[id]`.

May return an error.

### DELETE `/track`

Deletes (forgets) every track and album in the database. This does *NOT* remove the files corresponding to the tracks.

Returns the JSON value `true`.

## Albums

Albums are collections that contain tracks.

Albums are uniquely identified based on their names.

<a id='album-fields'></a>
An album has the following fields:

  * `name`: the name of the album
  * `tracks`: a list of long IDs for the tracks 

### GET `/album`

Returns a list of every album names:

```json
["album 1", "album 2"]
```

### GET `/album/[name]`

Returns the metadata of the album, encoded as JSON.

The `name` parameter is expected to be URI encoded.

### GET `/album/by-page/[page]`

Returns a list of albums in the page `[page]`. See `/album` endpoint.

## Files

### GET `/file/[path]`

If the `[path]` relative to the data directory of the server is a directory, then returns the files and directories said path.

```json
{
  "files": ["filename1", "filename2"],
  "directories": ["directory1"],
}
```

Otherwise, returns a byte stream of the file specified in path.
