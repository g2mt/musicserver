cmake_minimum_required(VERSION 3.20)
project(musicserver)

find_package(Git REQUIRED)

include(ExternalProject)
set(FETCHCONTENT_QUIET FALSE)

execute_process(
  COMMAND ${GIT_EXECUTABLE} rev-parse --short HEAD
  OUTPUT_VARIABLE GIT_SHORT_HASH
  OUTPUT_STRIP_TRAILING_WHITESPACE
)

set(MS_TAGLIB_VERSION "2.2.1")

option(MS_EMB_TAGLIB "Build taglib from source for embedding" OFF)
option(MS_EMB_EBUR128 "Build ebur128 from source for embedding" ON)
option(MS_USE_SNDFILE "Link sndfile as source" ON)

option(MS_BUILD_BIN "Build the music server executable" OFF)
option(MS_BUILD_LIB "Build the music server shared library" OFF)
option(MS_BUILD_ANDROID "Build for Android" OFF)
option(MS_USE_CCACHE "Use ccache if available" ON)
option(MS_INSTALL_SHARED "Install shared libraries" OFF)

if(MS_USE_CCACHE)
  find_program(CCACHE_PROGRAM ccache)
  if(CCACHE_PROGRAM)
    set(CMAKE_C_COMPILER_LAUNCHER "${CCACHE_PROGRAM}")
    set(CMAKE_CXX_COMPILER_LAUNCHER "${CCACHE_PROGRAM}")
  endif()
endif()

# ----------------------------------------------------------------------
# Build flags for Go
# ----------------------------------------------------------------------
set(GOFLAGS "")
list(APPEND GOFLAGS "-v")
list(APPEND GOFLAGS "-ldflags=-X musicserver/internal/api.Version=${GIT_SHORT_HASH}")

# Collect build tags in a list
set(GO_TAGS_LIST "")

if(MS_EMB_EBUR128)
  # Append ebur128 tag
  list(APPEND GO_TAGS_LIST "has_ebur128")
endif()

if(MS_USE_SNDFILE)
  # Append sndfile tag
  list(APPEND GO_TAGS_LIST "has_sndfile")
endif()

# Convert the list to a space‑separated string and add as a single -tags argument
if(GO_TAGS_LIST)
  string(JOIN " " GO_TAGS "${GO_TAGS_LIST}")
  list(APPEND GOFLAGS "-tags=${GO_TAGS}")
endif()

set(MS_GOENV "")
list(APPEND MS_GOENV "CC=${CMAKE_C_COMPILER}" "CXX=${CMAKE_CXX_COMPILER}")
if(MS_BUILD_ANDROID)
  list(APPEND MS_GOENV "CGO_ENABLED=1" "GOOS=android")

  if(NOT DEFINED MS_GOARCH)
    message(FATAL_ERROR "MS_GOARCH must be set")
  endif()
  list(APPEND MS_GOENV "GOARCH=${MS_GOARCH}")
endif()

# Helper for PKG_CONFIG_PATH
set(MS_PKG_CONFIG_PATH "")

### Dep: taglib
if(MS_EMB_TAGLIB)
  set(MS_TAGLIB_PREFIX ${CMAKE_BINARY_DIR}/taglib_install)
  ExternalProject_Add(taglib_project
    URL https://github.com/taglib/taglib/releases/download/v${MS_TAGLIB_VERSION}/taglib-${MS_TAGLIB_VERSION}.tar.gz
    URL_HASH SHA256=7e76b5299dcef427c486bffe455098470c8da91cf3ccb9ea804893df57389b5e
    CMAKE_ARGS
      -DBUILD_SHARED_LIBS=ON
      -DBUILD_TESTING=OFF
      -DCMAKE_BUILD_TYPE=MinSizeRel
      -DCMAKE_INSTALL_PREFIX=${MS_TAGLIB_PREFIX}
      -DWITH_ZLIB=OFF
      -DCMAKE_C_COMPILER=${CMAKE_C_COMPILER}
      -DCMAKE_CXX_COMPILER=${CMAKE_CXX_COMPILER}
      -DCMAKE_C_COMPILER_LAUNCHER=${CMAKE_C_COMPILER_LAUNCHER}
      -DCMAKE_CXX_COMPILER_LAUNCHER=${CMAKE_CXX_COMPILER_LAUNCHER}
  )
  list(APPEND MS_PKG_CONFIG_PATH "${MS_TAGLIB_PREFIX}/lib/pkgconfig")
  set(TAGLIB_DEP taglib_project)
else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(TAGLIB REQUIRED taglib)
  set(TAGLIB_DEP "")
endif()

### Dep: ebur128
if(MS_EMB_EBUR128)
  add_subdirectory(vendored/libebur128)
  list(APPEND MS_PKG_CONFIG_PATH "${CMAKE_BINARY_DIR}/vendored/libebur128/ebur128")
  set(EBUR128_DEP ebur128)
endif()

### Dep: sndfile
if(MS_USE_SNDFILE)
  # Ensure pkg-config is available (if not already found above)
  if(NOT TARGET PkgConfig::PkgConfig)
    find_package(PkgConfig REQUIRED)
  endif()
  pkg_check_modules(SNDFILE REQUIRED sndfile)
  # Add the pkg-config path for sndfile to the PKG_CONFIG_PATH used by Go builds
  list(APPEND MS_PKG_CONFIG_PATH "${SNDFILE_PREFIX}/lib/pkgconfig")
endif()

### Consolidate PKG_CONFIG_PATH
if(MS_PKG_CONFIG_PATH)
  string(JOIN ":" MS_PKG_CONFIG_PATH_STR ${MS_PKG_CONFIG_PATH})
  list(APPEND MS_GOENV "PKG_CONFIG_PATH=${MS_PKG_CONFIG_PATH_STR}")
endif()

### Frontend
file(GLOB_RECURSE FRONTEND_SOURCES
  "frontend/public/*"
  "frontend/src/*"
)
list(APPEND FRONTEND_SOURCES
  "frontend/index.html"
  "frontend/package-lock.json"
  "frontend/package.json"
  "frontend/vite-common.config.ts"
)

if(MS_BUILD_ANDROID)
  set(FRONTEND_CONFIG "frontend/vite-android.config.ts")
  set(FRONTEND_COMMAND npm run build-android)
  set(FRONTEND_STAMP "${CMAKE_SOURCE_DIR}/frontend/dist/stamp")
else()
  set(FRONTEND_CONFIG "frontend/vite.config.ts")
  set(FRONTEND_COMMAND npm run build)
  set(FRONTEND_STAMP "${CMAKE_SOURCE_DIR}/frontend/dist-android/stamp")
endif()

add_custom_command(
  OUTPUT ${FRONTEND_STAMP}
  COMMAND ${FRONTEND_COMMAND}
  COMMAND ${CMAKE_COMMAND} -E touch ${FRONTEND_STAMP}
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/frontend
  DEPENDS ${FRONTEND_SOURCES} ${FRONTEND_CONFIG}
  COMMENT "Building frontend"
  VERBATIM
)

add_custom_target(frontend DEPENDS ${FRONTEND_STAMP})

### Music Server executable
if(MS_BUILD_BIN)
  add_custom_target(musicserver ALL
    COMMAND ${CMAKE_COMMAND} -E env ${MS_GOENV} go build -o ${CMAKE_BINARY_DIR}/musicserver ${GOFLAGS} .
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    DEPENDS frontend ${TAGLIB_DEP} ${EBUR128_DEP} FORCE
    COMMENT "Building musicserver"
    VERBATIM
  )

  install(PROGRAMS ${CMAKE_BINARY_DIR}/musicserver DESTINATION bin)
endif()

### Music Server shared library
if(MS_BUILD_LIB)
  add_custom_command(
    OUTPUT ${CMAKE_BINARY_DIR}/libmusicserver.so ${CMAKE_BINARY_DIR}/libmusicserver.h FORCE
    COMMAND ${CMAKE_COMMAND} -E env ${MS_GOENV} go build -buildmode=c-shared -o ${CMAKE_BINARY_DIR}/libmusicserver.so ${GOFLAGS} musicserver
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    DEPENDS frontend ${TAGLIB_DEP} ${EBUR128_DEP} FORCE
    COMMENT "Building libmusicserver.so and libmusicserver.h"
    VERBATIM
  )

  add_custom_target(libmusicserver ALL
    DEPENDS ${CMAKE_BINARY_DIR}/libmusicserver.so ${CMAKE_BINARY_DIR}/libmusicserver.h
  )

  if(MS_BUILD_ANDROID)
    add_library(musicserverbind SHARED jni/libmusicserver.c)
    set_target_properties(musicserverbind PROPERTIES PREFIX "lib" IMPORT_PREFIX "lib")
    target_include_directories(musicserverbind PRIVATE ${CMAKE_BINARY_DIR}) # libmusicserver.h
    target_link_directories(musicserverbind PRIVATE ${CMAKE_BINARY_DIR}) # libmusicserver.so
    target_link_libraries(musicserverbind PRIVATE musicserver)
    add_dependencies(musicserverbind libmusicserver)

    install(FILES ${CMAKE_BINARY_DIR}/libmusicserver.so DESTINATION lib/${MS_APKARCH})
    install(TARGETS musicserverbind DESTINATION lib/${MS_APKARCH})
    if(MS_INSTALL_SHARED)
      configure_file(cmake/install_taglib.cmake.in cmake/install_taglib.cmake @ONLY)
      # install the true, non-symlinked version
      install(SCRIPT ${CMAKE_BINARY_DIR}/cmake/install_taglib.cmake)
    endif()
  else()
    install(FILES ${CMAKE_BINARY_DIR}/libmusicserver.so DESTINATION lib)
    install(FILES ${CMAKE_BINARY_DIR}/libmusicserver.h DESTINATION include)
  endif()
endif()

add_custom_target(FORCE)

### Related libraries for android
if(MS_INSTALL_SHARED)
  if(MS_SYSROOT STREQUAL "")
    message(FATAL_ERROR "MS_SYSROOT must be set")
  endif()
  if(MS_SYSROOT_TRIPLET STREQUAL "")
    message(FATAL_ERROR "MS_SYSROOT_TRIPLET must be set")
  endif()
  install(FILES "${MS_SYSROOT}/usr/lib/${MS_SYSROOT_TRIPLET}/libc++_shared.so" DESTINATION lib/${MS_APKARCH})
endif()
