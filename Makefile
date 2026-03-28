build/musicserver: | build
	go build -o $@ .

build:
	mkdir -p build
