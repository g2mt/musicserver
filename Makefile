GOFLAGS ?= -v -ldflags="-X musicserver/internal/api.Version=$$(git rev-parse --short HEAD)"

build/musicserver:
	go build -o $@ $(GOFLAGS) .

ifneq ($(strip $(ANDROID_HOME)),)
include mk/android.mk

.PHONY: taglib_android
taglib_android:
	cd internal/taglib && CXX=$(AN_NDK_CXX) CC=$(AN_NDK_CC) ARCH=$(AN_ARCH) make build_static

.PHONY: native_lib_android
native_lib_android:
	mkdir -p build/$(AN_ARCH)
	make native_lib_android_stage1

.PHONY: native_lib_android_stage1
native_lib_android_stage1: \
	build/$(AN_ARCH)/libmusicserverbind.so \
	build/$(AN_ARCH)/libmusicserver.so

build/$(AN_ARCH)/libmusicserverbind.so: \
	jni/libmusicserver.c build/$(AN_ARCH)/libmusicserver.so
	$(AN_NDK_CC) -fpic -shared -Ibuild/$(AN_ARCH) -Lbuild/$(AN_ARCH) -o $@ $< -lmusicserver

# c-archive is not supported
# rule also builds corresponding .h file
.PHONY: build/$(AN_ARCH)/libmusicserver.so
build/$(AN_ARCH)/libmusicserver.so: taglib_android
	PKG_CONFIG_PATH=./taglib/.pkg_$(AN_ARCH)/lib/pkgconfig/ \
		CXX=$(AN_NDK_CXX) CC=$(AN_NDK_CC) \
		CGO_ENABLED=1 GOOS=android GOARCH=$(AN_GOARCH) \
		go build -buildmode=c-shared -o $@ $(GOFLAGS) musicserver

endif
