include mk/android.mk

.PHONY: taglib_android
taglib_android: | require_android
	cd internal/taglib && CXX=$(AN_NDK_CXX) CC=$(AN_NDK_CC) ARCH=aarch64 make build_static

build:
	mkdir -p build

build/musicserver.aarch64.so: | build
	PKG_CONFIG_PATH=./taglib/.pkg_aarch64/lib/pkgconfig/ \
	CXX=$(AN_NDK_CXX) CC=$(AN_NDK_CC) \
	CGO_ENABLED=1 GOOS=android GOARCH=arm64 \
	go build -v -buildmode=c-shared -o $@ musicserver
