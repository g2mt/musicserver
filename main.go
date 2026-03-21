package main

import (
	"flag"
	"fmt"
	"os"

	"musicserver/internal/schema"
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

	// TODO: open sql database in db_path/${SQL_DB_PATH}

	// TODO: bind http server to http_bind

	if *config.UnixBindEnabled {
		// TODO: bind unix socket in another socket
	}
}
