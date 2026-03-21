package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"musicserver/internal/api"
	"musicserver/internal/schema"

	_ "github.com/mattn/go-sqlite3"
)

func main() {
	configPath := flag.String("config", "", "path to config file")
	flag.Parse()

	if *configPath == "" {
		fmt.Println("Error: -config flag is required")
		flag.Usage()
		os.Exit(1)
	}

	config, err := schema.LoadConfig(*configPath)
	if err != nil {
		fmt.Printf("Error loading config: %v\n", err)
		os.Exit(1)
	}

	// Open sql database in db_path/${SQL_DB_PATH}
	dbPath := filepath.Join(config.DbPath, schema.SQL_DB_PATH)

	// Ensure the directory exists
	if err := os.MkdirAll(config.DbPath, 0755); err != nil {
		log.Printf("Error creating database directory: %v\n", err)
		os.Exit(1)
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Printf("Error opening database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Create API interface and initialize database
	iface := api.NewInterface(db)
	if err := iface.InitDb(); err != nil {
		fmt.Printf("Error initializing database: %v\n", err)
		os.Exit(1)
	}

	// Bind http server to http_bind
	httpRouter := api.NewHTTPRouter(iface)
	http.HandleFunc("/", httpRouter.Serve)

	go func() {
		log.Printf("Starting HTTP server on %s\n", config.HTTPBind)
		if err := http.ListenAndServe(config.HTTPBind, nil); err != nil {
			log.Printf("HTTP server error: %v\n", err)
			os.Exit(1)
		}
	}()

	if *config.UnixBindEnabled {
		// Bind unix socket in another socket
		unixServer := api.NewUnixSocketServer(iface)

		// Ensure the socket directory exists
		socketDir := filepath.Dir(config.UnixBind)
		if err := os.MkdirAll(socketDir, 0755); err != nil {
			log.Printf("Error creating Unix socket directory: %v\n", err)
			os.Exit(1)
		}

		log.Printf("Starting Unix socket server on %s\n", config.UnixBind)
		if err := unixServer.Start(config.UnixBind); err != nil {
			log.Printf("Unix socket server error: %v\n", err)
			os.Exit(1)
		}
	} else {
		// Wait indefinitely if only HTTP server is running
		select {}
	}
}
