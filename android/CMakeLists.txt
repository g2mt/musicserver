cmake_minimum_required(VERSION 3.20)
project(musicserver_android)

set(PKG_NAME "org.msxrv.musicserver")
string(REPLACE "." "/" PKG_PATH ${PKG_NAME})

set(AN_TARGET "x86_64" CACHE STRING "Android target architecture (aarch64, armv7a, x86_64, or all)")

if(NOT DEFINED ANDROID_HOME)
  message(FATAL_ERROR "ANDROID_HOME must be set")
endif()

include(common.cmake)

file(GLOB_RECURSE PKG_SRCS "${CMAKE_CURRENT_SOURCE_DIR}/java/*.java")

set(BUILD_DIR ${CMAKE_CURRENT_BINARY_DIR}/build)

# Keystore
add_custom_command(
  OUTPUT ${BUILD_DIR}/keystore.jks
  COMMAND ${CMAKE_COMMAND} -E make_directory ${BUILD_DIR}
  COMMAND keytool -genkeypair -keystore ${BUILD_DIR}/keystore.jks
    -alias androidkey -validity 10000 -keyalg RSA -keysize 2048
    -storepass android -keypass android
  COMMENT "Generating keystore"
)

# Frontend
add_custom_target(build_apk_frontend
  COMMAND npm run build-android
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/../frontend
  COMMENT "Building Android frontend"
)

# Helper macro to define native lib rules per architecture
# arch = NDK arch, apk_arch = APK lib dir name, sysroot_arch = sysroot triple prefix
macro(add_native_lib_target arch apk_arch sysroot_arch)
  add_custom_target(native_lib_${arch}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${BUILD_DIR}/apk/lib/${apk_arch}
    COMMAND ${CMAKE_MAKE_PROGRAM} -C ${CMAKE_CURRENT_SOURCE_DIR}/..
      AN_ARCH=${arch} native_lib_android
    COMMAND ${CMAKE_COMMAND} -E copy_directory
      ${CMAKE_CURRENT_SOURCE_DIR}/../build/${arch}
      ${BUILD_DIR}/apk/lib/${apk_arch}
    COMMAND ${CMAKE_COMMAND} -E copy
      ${AN_NDK_PREFIX}/sysroot/usr/lib/${sysroot_arch}-linux-android*/libc++_shared.so
      ${BUILD_DIR}/apk/lib/${apk_arch}/
    COMMENT "Building native libs for ${arch}"
  )
endmacro()

add_native_lib_target(aarch64 arm64-v8a aarch64)
add_native_lib_target(armv7a armeabi-v7a arm)
add_native_lib_target(x86_64 x86_64 x86_64)

if(AN_TARGET STREQUAL "all")
  set(NATIVE_LIB_TARGETS native_lib_aarch64 native_lib_armv7a native_lib_x86_64)
else()
  set(NATIVE_LIB_TARGETS native_lib_${AN_TARGET})
endif()

# Main APK build
add_custom_target(apk ALL
  COMMAND ${CMAKE_COMMAND} -E make_directory ${BUILD_DIR}/gen ${BUILD_DIR}/obj ${BUILD_DIR}/apk
  COMMAND ${CMAKE_COMMAND} -E rm -rf ${BUILD_DIR}/apk/lib

  COMMAND ${AN_BUILD_TOOLS}/aapt2 compile
    --dir ${CMAKE_CURRENT_SOURCE_DIR}/res
    -o ${BUILD_DIR}/res.zip

  COMMAND ${AN_BUILD_TOOLS}/aapt2 link ${BUILD_DIR}/res.zip
    -I ${AN_PLATFORM}/android.jar
    --manifest ${CMAKE_CURRENT_SOURCE_DIR}/AndroidManifest.xml
    --java ${BUILD_DIR}/gen
    -o ${BUILD_DIR}/resource.apk

  COMMAND ${CMAKE_COMMAND} -E rm -rf ${BUILD_DIR}/obj
  COMMAND ${CMAKE_COMMAND} -E make_directory ${BUILD_DIR}/obj

  COMMAND ${AN_JAVAC} --release ${AN_JAVA_VER}
    -classpath ${AN_PLATFORM}/android.jar
    -d ${BUILD_DIR}/obj
    ${BUILD_DIR}/gen/${PKG_PATH}/R.java
    ${PKG_SRCS}

  COMMAND ${AN_BUILD_TOOLS}/d8
    $<JOIN:$<TARGET_OBJECTS:apk>, >
    --lib ${AN_PLATFORM}/android.jar
    --output ${BUILD_DIR}/

  COMMAND ${CMAKE_COMMAND} -E chdir ${BUILD_DIR}
    zip -u resource.apk classes.dex

  COMMAND ${CMAKE_COMMAND} -E chdir ${BUILD_DIR}/apk
    zip -r -u ../resource.apk lib/*/*

  COMMAND zip -r -u ${BUILD_DIR}/resource.apk
    ${CMAKE_CURRENT_SOURCE_DIR}/assets

  COMMAND ${AN_BUILD_TOOLS}/zipalign -f 4
    ${BUILD_DIR}/resource.apk
    ${BUILD_DIR}/${PKG_NAME}.unsigned.apk

  COMMAND ${AN_BUILD_TOOLS}/apksigner sign
    --ks ${BUILD_DIR}/keystore.jks
    --ks-key-alias androidkey
    --ks-pass pass:android
    --key-pass pass:android
    --out ${BUILD_DIR}/${PKG_NAME}.apk
    ${BUILD_DIR}/${PKG_NAME}.unsigned.apk

  DEPENDS
    ${BUILD_DIR}/keystore.jks
    build_apk_frontend
    ${NATIVE_LIB_TARGETS}
  COMMENT "Building APK"
)

add_custom_target(install_adb
  COMMAND adb install -r ${BUILD_DIR}/${PKG_NAME}.apk
  DEPENDS apk
  COMMENT "Installing APK via ADB"
)
