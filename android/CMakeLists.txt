cmake_minimum_required(VERSION 3.20)
project(musicserver_android)

set(PKG_NAME "org.msxrv.musicserver")
string(REPLACE "." "/" PKG_PATH ${PKG_NAME})

set(AN_TARGET "x86_64" CACHE STRING "Android target architecture (aarch64, armv7a, x86_64)")

if(NOT DEFINED ANDROID_HOME)
  message(FATAL_ERROR "ANDROID_HOME environment variable must be set")
endif()

### Android versions

set(AN_NDK_VER "26" CACHE STRING "Android NDK version")
set(AN_SDK_VER "33" CACHE STRING "Android SDK version")
set(AN_JAVA_VER "11" CACHE STRING "Java version")

set(AN_NDK ${ANDROID_HOME}/ndk/${AN_NDK_VER})
set(AN_NDK_PREFIX ${AN_NDK}/toolchains/llvm/prebuilt/linux-x86_64)
set(AN_NDK_CXX ${AN_NDK_PREFIX}/bin/clang++)
set(AN_NDK_CC ${AN_NDK_PREFIX}/bin/clang)
set(AN_BUILD_TOOLS ${ANDROID_HOME}/build-tools/${AN_SDK_VER}.0.0)
set(AN_PLATFORM ${ANDROID_HOME}/platforms/android-${AN_SDK_VER})
set(AN_JAVAC javac)

if(AN_TARGET STREQUAL "aarch64")
  set(AN_ARCH aarch64)
  set(AN_GOARCH arm64)
elseif(AN_TARGET STREQUAL "armv7a")
  set(AN_ARCH armv7a)
  set(AN_GOARCH arm)
elseif(AN_TARGET STREQUAL "x86_64")
  set(AN_ARCH x86_64)
  set(AN_GOARCH amd64)
endif()

