include mk/android.mk

.PHONY: taglib_android
taglib_android: | require_android
	cd internal/taglib && CXX=$(AN_NDK_CXX) CC=$(AN_NDK_CC) ARCH=$(AN_ARCH) make build_static

.PHONY: native_lib_android
native_lib_android: \
	build/musicserverbind.android_$(AN_ARCH).so \
	build/musicserver.android_$(AN_ARCH).so

build/musicserverbind.android_$(AN_ARCH).so: jni/libmusicserver.c build/musicserverbind.android_$(AN_ARCH).so | build
	$(AN_NDK_CC) -fpic -shared -o $@ $^

# c-archive is not supported
build/musicserver.android_$(AN_ARCH).so: taglib_android | build
	PKG_CONFIG_PATH=./taglib/.pkg_$(AN_ARCH)/lib/pkgconfig/ \
	CXX=$(AN_NDK_CXX) CC=$(AN_NDK_CC) \
	CGO_ENABLED=1 GOOS=android GOARCH=$(AN_GOARCH) \
	go build -v -buildmode=c-shared -o $@ musicserver

build:
	mkdir -p build

