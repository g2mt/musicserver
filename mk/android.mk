AN_SDK_VER = 33.0.2
AN_JAVA_VER = 11
AN_NDK_VER = 27.3.13750724
AN_ARCH ?= x86_64 # x86_64, armv7a, aarch64

ifeq ($(AN_ARCH),aarch64)
AN_GOARCH=arm64
endif
ifeq ($(AN_ARCH),armv7a)
AN_GOARCH=arm
endif
ifeq ($(AN_ARCH),x86_64)
AN_GOARCH=amd64
endif

ifeq ($(strip $(ANDROID_HOME)),)

.PHONY: require_android
require_android:
	$(error ANDROID_HOME is empty)

else

AN_SDK_VER_MAJOR = $(shell echo $(AN_SDK_VER) | cut -d. -f1)

AN_BUILD_TOOLS ?= $(ANDROID_HOME)/build-tools/$(AN_SDK_VER)
AN_PLATFORM ?= $(ANDROID_HOME)/platforms/android-$(AN_SDK_VER_MAJOR)
AN_NDK_PREFIX ?= $(ANDROID_HOME)/ndk/$(AN_NDK_VER)/toolchains/llvm/prebuilt/linux-x86_64/bin
AN_NDK_CXX ?= $(AN_NDK_PREFIX)/$(AN_ARCH)-linux-android$(AN_SDK_VER_MAJOR)-clang++
AN_NDK_CC ?= $(AN_NDK_PREFIX)/$(AN_ARCH)-linux-android$(AN_SDK_VER_MAJOR)-clang

.PHONY: require_android
require_android:

endif

