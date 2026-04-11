cmake_minimum_required(VERSION 3.20)
project(musicserver_android)

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

### Prefixes

if(NOT DEFINED ANDROID_HOME)
  message(FATAL_ERROR "ANDROID_HOME environment variable must be set")
endif()

set(AN_BUILD_TOOLS ${ANDROID_HOME}/build-tools/${AN_SDK_VER})
string(REGEX REPLACE "\\..*" "" AN_SDK_VER_MAJOR ${AN_SDK_VER})
set(AN_PLATFORM ${ANDROID_HOME}/platforms/android-${AN_SDK_VER_MAJOR})
set(AN_NDK_PREFIX ${ANDROID_HOME}/ndk/${AN_NDK_VER}/toolchains/llvm/prebuilt/linux-x86_64)

### Build rules

file(GLOB_RECURSE PKG_SRCS "java/*.java")

add_custom_command(
  OUTPUT build/keystore.jks
  COMMAND keytool -genkeypair -keystore build/keystore.jks -alias androidkey
    -validity 10000 -keyalg RSA -keysize 2048
    -storepass android -keypass android
  COMMENT "Generating keystore"
)

set(NATIVE_LIB_DEPS "")
foreach(ARCH ${TARGET_ARCHS})
  set(ARCH_LIB_DIR ${CMAKE_CURRENT_BINARY_DIR}/lib/${ARCH})
  
  if(ARCH STREQUAL "aarch64")
    set(APK_ARCH "arm64-v8a")
    set(SYSROOT_ARCH "aarch64")
  elseif(ARCH STREQUAL "armv7a")
    set(APK_ARCH "armeabi-v7a")
    set(SYSROOT_ARCH "arm")
  elseif(ARCH STREQUAL "x86_64")
    set(APK_ARCH "x86_64")
    set(SYSROOT_ARCH "x86_64")
  endif()

  add_custom_command(
    OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/apk/lib/${APK_ARCH}/libmusicserverbind.so
    COMMAND ${CMAKE_COMMAND} --preset ${ARCH}-android -S ${CMAKE_CURRENT_SOURCE_DIR}/..
    COMMAND ${CMAKE_COMMAND} --build --preset ${ARCH}-android
    COMMAND ${CMAKE_COMMAND} --install ${CMAKE_CURRENT_SOURCE_DIR}/../build/${ARCH}-android --prefix ${CMAKE_CURRENT_BINARY_DIR}/temp_install_${ARCH}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_CURRENT_BINARY_DIR}/apk/lib/${APK_ARCH}
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/temp_install_${ARCH}/lib/libmusicserverbind.so ${CMAKE_CURRENT_BINARY_DIR}/apk/lib/${APK_ARCH}/
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/temp_install_${ARCH}/lib/libmusicserver.so ${CMAKE_CURRENT_BINARY_DIR}/apk/lib/${APK_ARCH}/
    COMMAND ${CMAKE_COMMAND} -E copy ${AN_NDK_PREFIX}/sysroot/usr/lib/${SYSROOT_ARCH}-linux-android/libc++_shared.so ${CMAKE_CURRENT_BINARY_DIR}/apk/lib/${APK_ARCH}/
    COMMENT "Building native libraries for ${ARCH}"
  )
  list(APPEND NATIVE_LIB_DEPS ${CMAKE_CURRENT_BINARY_DIR}/apk/lib/${APK_ARCH}/libmusicserverbind.so)
endforeach()

add_custom_command(
  OUTPUT build/gen/${PKG_PATH}/R.java build/resource.apk
  COMMAND ${AN_BUILD_TOOLS}/aapt2 compile --dir res -o build/res.zip
  COMMAND ${AN_BUILD_TOOLS}/aapt2 link build/res.zip
    -I ${AN_PLATFORM}/android.jar
    --manifest AndroidManifest.xml
    --java build/gen
    -o build/resource.apk
  DEPENDS AndroidManifest.xml
  COMMENT "Compiling resources"
)

add_custom_command(
  OUTPUT build/classes.dex
  COMMAND ${CMAKE_COMMAND} -E make_directory build/obj
  COMMAND javac --release ${AN_JAVA_VER}
    -classpath ${AN_PLATFORM}/android.jar
    -d build/obj
    build/gen/${PKG_PATH}/R.java
    ${PKG_SRCS}
  COMMAND "${AN_BUILD_TOOLS}/d8" build/obj/${PKG_PATH}/*.class
    --lib "${AN_PLATFORM}/android.jar"
    --output build/
  DEPENDS build/gen/${PKG_PATH}/R.java ${PKG_SRCS}
  COMMENT "Compiling Java code"
)

add_custom_command(
  OUTPUT build/${PKG_NAME}.apk
  COMMAND ${CMAKE_COMMAND} -E copy build/resource.apk build/resource_final.apk
  COMMAND cd build && zip -u resource_final.apk classes.dex
  COMMAND cd apk && zip -r -u ../build/resource_final.apk lib/*/*
  COMMAND zip -r -u build/resource_final.apk assets
  COMMAND "${AN_BUILD_TOOLS}/zipalign" -f 4 build/resource_final.apk build/${PKG_NAME}.unsigned.apk
  COMMAND "${AN_BUILD_TOOLS}/apksigner" sign --ks build/keystore.jks
    --ks-key-alias androidkey --ks-pass pass:android
    --key-pass pass:android --out build/${PKG_NAME}.apk
    build/${PKG_NAME}.unsigned.apk
  DEPENDS build/resource.apk build/classes.dex build/keystore.jks ${NATIVE_LIB_DEPS}
  COMMENT "Packaging APK"
)

add_custom_target(apk ALL DEPENDS build/${PKG_NAME}.apk)
