package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/goccy/go-yaml"
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

	configData, err := os.ReadFile(*configPath)
	if err != nil {
		fmt.Printf("Error reading config file: %v\n", err)
		os.Exit(1)
	}

	var config schema.Config
	err = yaml.Unmarshal(configData, &config)
	if err != nil {
		fmt.Printf("Error parsing config file: %v\n", err)
		os.Exit(1)
	}

}
