AN_SDK_VER = 33.0.2
AN_JAVA_VER = 11
AN_NDK_VER = 27.3.13750724
AN_ARCH ?= x86_64

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

