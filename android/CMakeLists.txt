cmake_minimum_required(VERSION 3.20)
project(musicserver_android)

set(PKG_NAME "org.msxrv.musicserver")
string(REPLACE "." "/" PKG_PATH ${PKG_NAME})

set(AN_TARGET "" CACHE STRING "List of Android target architectures (aarch64, armv7a, x86_64, or empty for all targets)")

### Android versions

set(AN_SDK_VER "33.0.2" CACHE STRING "Android SDK version")
set(AN_NDK_VER "27.3.13750724" CACHE STRING "Android NDK version")
set(AN_JAVA_VER "11" CACHE STRING "Java version")

### Prefixes

if(NOT DEFINED ANDROID_HOME)
  message(FATAL_ERROR "ANDROID_HOME environment variable must be set")
endif()

set(AN_BUILD_TOOLS ${ANDROID_HOME}/build-tools/${AN_SDK_VER})

### Build rules

