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

set(GOFLAGS -v -ldflags=\"-X musicserver/internal/api.Version=${GIT_SHORT_HASH}\")

option(MS_BUILD_BIN "Build the music server executable" OFF)
option(MS_BUILD_LIB "Build the music server shared library" OFF)
option(MS_STATIC_TAGLIB "Build taglib statically from source" OFF)
option(MS_BUILD_ANDROID "Build for Android" OFF)
option(MS_USE_CCACHE "Use ccache if available" ON)

if(MS_USE_CCACHE)
  find_program(CCACHE_PROGRAM ccache)
  if(CCACHE_PROGRAM)
    set(CMAKE_C_COMPILER_LAUNCHER "${CCACHE_PROGRAM}")
    set(CMAKE_CXX_COMPILER_LAUNCHER "${CCACHE_PROGRAM}")
  endif()
endif()

set(MS_GOENV "")
string(APPEND MS_GOENV " CC=${CMAKE_C_COMPILER} CXX=${CMAKE_CXX_COMPILER}")
if(MS_BUILD_ANDROID)
  string(APPEND MS_GOENV " CGO_ENABLED=1 GOOS=android")

  if(NOT DEFINED MS_GOARCH)
    message(FATAL_ERROR "MS_GOARCH must be set")
  endif()
  string(APPEND MS_GOENV " GOARCH=${MS_GOARCH}")
endif()

### Dep: taglib
if(MS_STATIC_TAGLIB)
  set(TAGLIB_INSTALL_DIR ${CMAKE_BINARY_DIR}/taglib_install)
  ExternalProject_Add(taglib_project
    URL https://github.com/taglib/taglib/releases/download/v2.2.1/taglib-2.2.1.tar.gz
    URL_HASH SHA256=7e76b5299dcef427c486bffe455098470c8da91cf3ccb9ea804893df57389b5e
    CMAKE_ARGS
      -DBUILD_TESTING=OFF
      -DCMAKE_BUILD_TYPE=MinSizeRel
      -DCMAKE_INSTALL_PREFIX=${TAGLIB_INSTALL_DIR}
      -DWITH_ZLIB=OFF
      -DCMAKE_C_COMPILER=${CMAKE_C_COMPILER}
      -DCMAKE_CXX_COMPILER=${CMAKE_CXX_COMPILER}
  )
  string(APPEND MS_GOENV " PKG_CONFIG_PATH=${TAGLIB_INSTALL_DIR}/lib/pkgconfig")
  set(TAGLIB_DEP taglib_project)
else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(TAGLIB REQUIRED taglib)
  set(TAGLIB_DEP "")
endif()

### Frontend
if(MS_BUILD_ANDROID)
  add_custom_target(frontend
    COMMAND npm run build
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/frontend
    COMMENT "Building frontend"
  )
else()
  add_custom_target(frontend
    COMMAND npm run build-android
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/frontend
    COMMENT "Building frontend"
  )
endif()

### Music Server executable
if(MS_BUILD_BIN)
  add_custom_target(musicserver ALL
    COMMAND ${CMAKE_COMMAND} -E env ${MS_GOENV} go build -o ${CMAKE_BINARY_DIR}/musicserver ${GOFLAGS} .
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    DEPENDS frontend ${TAGLIB_DEP}
    COMMENT "Building musicserver"
  )

  install(PROGRAMS ${CMAKE_BINARY_DIR}/musicserver DESTINATION bin)
endif()

### Music Server shared library
if(MS_BUILD_LIB)
  add_custom_command(
    OUTPUT ${CMAKE_BINARY_DIR}/libmusicserver.so ${CMAKE_BINARY_DIR}/libmusicserver.h
    COMMAND ${CMAKE_COMMAND} -E env ${MS_GOENV} go build -buildmode=c-shared -o ${CMAKE_BINARY_DIR}/libmusicserver.so ${GOFLAGS} musicserver
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    DEPENDS frontend ${TAGLIB_DEP}
    COMMENT "Building libmusicserver.so and libmusicserver.h"
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
  endif()
endif()
