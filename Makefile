include mk/android.mk

.PHONY: taglib_android
taglib_android: | require_android
	cd internal/taglib && CXX=$(AN_NDK_CXX) CC=$(AN_NDK_CC) ARCH=aarch64 make build_static
