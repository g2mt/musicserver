# these vars must be passed without spaces
AN_SDK_VER = 33.0.2#
AN_JAVA_VER = 11#
AN_NDK_VER = 27.3.13750724#
AN_ARCH ?= x86_64#

AN_JAVA_PREFIX ?= /usr/lib/jvm/java-$(AN_JAVA_VER)-openjdk
AN_JAVAC ?= $(AN_JAVA_PREFIX)/bin/javac

ifeq ($(AN_ARCH),aarch64)
AN_GOARCH=arm64
endif
ifeq ($(AN_ARCH),armv7a)
AN_GOARCH=arm
AN_SDK_EABI=eabi
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
AN_NDK_PREFIX ?= $(ANDROID_HOME)/ndk/$(AN_NDK_VER)/toolchains/llvm/prebuilt/linux-x86_64
AN_NDK_BIN ?= $(AN_NDK_PREFIX)/bin
AN_NDK_CXX ?= $(AN_NDK_BIN)/$(AN_ARCH)-linux-android$(AN_SDK_EABI)$(AN_SDK_VER_MAJOR)-clang++
AN_NDK_CC ?= $(AN_NDK_BIN)/$(AN_ARCH)-linux-android$(AN_SDK_EABI)$(AN_SDK_VER_MAJOR)-clang

.PHONY: require_android
require_android:

endif

