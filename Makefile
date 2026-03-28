ARCH=$(shell uname -m)
BUILD_ARCH=build/$(ARCH)

$(BUILD_ARCH)/musicserver: | $(BUILD_ARCH)
	go build -o $@ .

$(BUILD_ARCH)/musicserver.so: | $(BUILD_ARCH)
	go build -o $@ -buildmode=c-shared -ldflags="-r '\$$ORIGIN'" .

.PHONY: copy_linked
copy_linked: $(BUILD_ARCH)/musicserver.so
	ldd $< 2>/dev/null | grep -Po "=> \K[^ ]*" | xargs -I '{}' cp -v '{}' $(BUILD_ARCH)


$(BUILD_ARCH):
	mkdir -p $(BUILD_ARCH)
