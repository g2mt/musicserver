cmake_minimum_required(VERSION 3.20)
project(musicserver_android)

set(MS_DIR ${CMAKE_CURRENT_SOURCE_DIR}/..)

set(PKG_NAME "org.msxrv.musicserver")
string(REPLACE "." "/" PKG_PATH ${PKG_NAME})

set(AN_TARGET "" CACHE STRING "List of Android target architectures (aarch64, armv7a, x86_64, or empty for all targets)")
if(AN_TARGET STREQUAL "")
  set(TARGET_ARCHS aarch64 armv7a x86_64)
else()
  set(TARGET_ARCHS ${AN_TARGET})
endif()

### Android versions

set(AN_SDK_VER "33.0.2" CACHE STRING "Android SDK version")
set(AN_NDK_VER "27.3.13750724" CACHE STRING "Android NDK version")
set(AN_JAVA_VER "11" CACHE STRING "Java version")
set(AN_JAVA_PREFIX "/usr/lib/jvm/java-${AN_JAVA_VER}-openjdk" CACHE PATH "Path to Java JDK")
set(AN_JAVAC "${AN_JAVA_PREFIX}/bin/javac" CACHE FILEPATH "Path to javac executable")

### Computed build tool locations

if($ENV{ANDROID_HOME} STREQUAL "")
  message(FATAL_ERROR "ANDROID_HOME environment variable must be set")
endif()

set(AN_BUILD_TOOLS $ENV{ANDROID_HOME}/build-tools/${AN_SDK_VER})
string(REGEX REPLACE "\\..*" "" AN_SDK_VER_MAJOR ${AN_SDK_VER})
set(AN_PLATFORM $ENV{ANDROID_HOME}/platforms/android-${AN_SDK_VER_MAJOR})
set(AN_NDK_PREFIX $ENV{ANDROID_HOME}/ndk/${AN_NDK_VER}/toolchains/llvm/prebuilt/linux-x86_64)

### Build rules

if(CMAKE_BUILD_TYPE STREQUAL "Debug" OR NOT CMAKE_BUILD_TYPE)
  set(ANDROID_DEBUGGABLE "true")
else()
  set(ANDROID_DEBUGGABLE "false")
endif()

configure_file(
  ${CMAKE_CURRENT_SOURCE_DIR}/AndroidManifest.xml.in
  ${CMAKE_CURRENT_BINARY_DIR}/AndroidManifest.xml
  @ONLY
)

file(GLOB_RECURSE PKG_SRCS "java/*.java")

add_custom_command(
  OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/keystore.jks
  COMMAND keytool 
    -genkeypair 
    -keystore ${CMAKE_CURRENT_BINARY_DIR}/keystore.jks 
    -alias androidkey
    -validity 10000 
    -keyalg RSA 
    -keysize 2048
    -storepass android 
    -keypass android
  COMMENT "Generating keystore"
)

set(NATIVE_LIB_TARGETS "")
foreach(ARCH ${TARGET_ARCHS})
  set(AN_SDK_EABI "")
  if(ARCH STREQUAL "armv7a")
    set(AN_SDK_EABI "eabi")
  endif()

  set(AN_NDK_BIN ${AN_NDK_PREFIX}/bin)
  set(AN_NDK_CC ${AN_NDK_BIN}/${ARCH}-linux-android${AN_SDK_EABI}${AN_SDK_VER_MAJOR}-clang)
  set(AN_NDK_CXX ${AN_NDK_BIN}/${ARCH}-linux-android${AN_SDK_EABI}${AN_SDK_VER_MAJOR}-clang++)

  add_custom_target(
    native_${ARCH}
    COMMAND ${CMAKE_COMMAND} 
      --preset ${ARCH}-android
      -DCMAKE_C_COMPILER=${AN_NDK_CC}
      -DCMAKE_CXX_COMPILER=${AN_NDK_CXX}
      -DMS_SYSROOT=${AN_NDK_PREFIX}/sysroot
    COMMAND ${CMAKE_COMMAND} 
      --build ${MS_DIR}/build/${ARCH}-android
    COMMAND ${CMAKE_COMMAND} 
      --install ${MS_DIR}/build/${ARCH}-android 
      --prefix ${CMAKE_CURRENT_BINARY_DIR}
    COMMENT "Building and installing native libraries for ${ARCH}"
    WORKING_DIRECTORY ${MS_DIR}
  )
  list(APPEND NATIVE_LIB_TARGETS native_${ARCH})
endforeach()

add_custom_command(
  OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/gen/${PKG_PATH}/R.java ${CMAKE_CURRENT_BINARY_DIR}/resource.apk
  COMMAND ${AN_BUILD_TOOLS}/aapt2 compile 
    --dir ${CMAKE_CURRENT_SOURCE_DIR}/res 
    -o ${CMAKE_CURRENT_BINARY_DIR}/res.zip
  COMMAND ${AN_BUILD_TOOLS}/aapt2 link ${CMAKE_CURRENT_BINARY_DIR}/res.zip
    -I ${AN_PLATFORM}/android.jar
    --manifest ${CMAKE_CURRENT_BINARY_DIR}/AndroidManifest.xml
    --java ${CMAKE_CURRENT_BINARY_DIR}/gen
    -o ${CMAKE_CURRENT_BINARY_DIR}/resource.apk
  DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/AndroidManifest.xml
  COMMENT "Compiling resources"
)

add_custom_command(
  OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/classes.dex
  COMMAND ${CMAKE_COMMAND} 
    -E rm -rf ${CMAKE_CURRENT_BINARY_DIR}/obj
  COMMAND ${CMAKE_COMMAND} 
    -E make_directory ${CMAKE_CURRENT_BINARY_DIR}/obj
  COMMAND ${AN_JAVAC} 
    --release ${AN_JAVA_VER}
    -classpath ${AN_PLATFORM}/android.jar
    -d ${CMAKE_CURRENT_BINARY_DIR}/obj
    ${CMAKE_CURRENT_BINARY_DIR}/gen/${PKG_PATH}/R.java
    ${PKG_SRCS}
  COMMAND ${CMAKE_COMMAND} 
    -DAN_BUILD_TOOLS=${AN_BUILD_TOOLS} 
    -DAN_PLATFORM=${AN_PLATFORM}
    -DCLASS_DIR=${CMAKE_CURRENT_BINARY_DIR}/obj
    -DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/
    -DVERBOSE=${CMAKE_VERBOSE_MAKEFILE}
    -P "${CMAKE_CURRENT_SOURCE_DIR}/run_d8.cmake"
  DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/gen/${PKG_PATH}/R.java ${PKG_SRCS} "${CMAKE_CURRENT_SOURCE_DIR}/run_d8.cmake"
  COMMENT "Compiling Java code"
)

add_custom_command(
  OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/${PKG_NAME}.apk
  COMMAND ${CMAKE_COMMAND} 
    -E copy
    ${CMAKE_CURRENT_BINARY_DIR}/resource.apk
    ${CMAKE_CURRENT_BINARY_DIR}/resource_final.apk
  COMMAND cd ${CMAKE_CURRENT_BINARY_DIR} && zip -u resource_final.apk classes.dex
  COMMAND cd ${CMAKE_CURRENT_BINARY_DIR} && zip -r -u resource_final.apk lib
  COMMAND cd ${CMAKE_CURRENT_SOURCE_DIR} && zip -r -u ${CMAKE_CURRENT_BINARY_DIR}/resource_final.apk assets
  COMMAND "${AN_BUILD_TOOLS}/zipalign" 
    -f 4 ${CMAKE_CURRENT_BINARY_DIR}/resource_final.apk
    ${CMAKE_CURRENT_BINARY_DIR}/${PKG_NAME}.unsigned.apk
  COMMAND "${AN_BUILD_TOOLS}/apksigner" sign 
    --ks ${CMAKE_CURRENT_BINARY_DIR}/keystore.jks
    --ks-key-alias androidkey 
    --ks-pass pass:android
    --key-pass pass:android 
    --out ${CMAKE_CURRENT_BINARY_DIR}/${PKG_NAME}.apk
    ${CMAKE_CURRENT_BINARY_DIR}/${PKG_NAME}.unsigned.apk
  DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/resource.apk ${CMAKE_CURRENT_BINARY_DIR}/classes.dex ${CMAKE_CURRENT_BINARY_DIR}/keystore.jks ${NATIVE_LIB_TARGETS}
  COMMENT "Packaging APK"
)

add_custom_target(apk ALL DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/${PKG_NAME}.apk)
