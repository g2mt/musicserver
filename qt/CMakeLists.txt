cmake_minimum_required(VERSION 3.20)
project(musicserver_qt)

set(CMAKE_AUTOMOC ON)

set(MS_DIR ${CMAKE_CURRENT_SOURCE_DIR}/..)

set(MS_GOARCH "amd64" CACHE STRING "Go target architecture (amd64, arm64)")
set(QT_APP_BINARY "musicserver-qt" CACHE STRING "Qt application binary output name")
set(QT_MIN_VERSION "6.2" CACHE STRING "Minimum Qt version")

find_package(Qt6 ${QT_MIN_VERSION} REQUIRED COMPONENTS Core Widgets Multimedia Concurrent)

find_package(PkgConfig REQUIRED)
pkg_check_modules(TAGLIB REQUIRED taglib)

### Backend — libmusicserver.a built for the native target
set(BACKEND_BUILD_DIR ${CMAKE_CURRENT_BINARY_DIR}/backend)
set(BACKEND_INSTALL_DIR ${CMAKE_CURRENT_BINARY_DIR})

add_custom_target(backend ALL
  COMMAND ${CMAKE_COMMAND}
    -S ${MS_DIR}
    -B ${BACKEND_BUILD_DIR}
    -DMS_BUILD_BIN=OFF
    -DMS_BUILD_LIB_STATIC=ON
    -DMS_GOARCH=${MS_GOARCH}
    -DMS_EMB_EBUR128=ON
    -DMS_USE_SNDFILE=ON
  COMMAND ${CMAKE_COMMAND}
    --build ${BACKEND_BUILD_DIR}
    --target libmusicserver
  COMMAND ${CMAKE_COMMAND}
    --install ${BACKEND_BUILD_DIR}
    --prefix ${BACKEND_INSTALL_DIR}
  COMMENT "Building libmusicserver.a for ${MS_GOARCH}"
  VERBATIM
)

### Native Qt application
set(QT_SOURCES
  src/main.cpp
  src/ApiClient.cpp
  src/AppState.cpp
  src/AppMainWindow.cpp
  src/QtAudioPlayer.cpp
  src/TrackListModel.cpp
)

set(QT_HEADERS
  src/ApiClient.h
  src/AppState.h
  src/AppMainWindow.h
  src/QtAudioPlayer.h
  src/TrackListModel.h
  src/TrackData.h
  src/Bookmark.h
)

add_executable(musicserver_qt ${QT_SOURCES} ${QT_HEADERS})

set_target_properties(musicserver_qt PROPERTIES
  OUTPUT_NAME ${QT_APP_BINARY}
  RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
)

target_include_directories(musicserver_qt PRIVATE
  ${BACKEND_INSTALL_DIR}/include
  ${TAGLIB_INCLUDE_DIRS}
)
target_link_libraries(musicserver_qt PRIVATE
  ${BACKEND_INSTALL_DIR}/lib/libmusicserver.a
  Qt6::Widgets
  Qt6::Multimedia
  Qt6::Concurrent
  sndfile
  ${TAGLIB_LIBRARIES}
  ebur128
)
add_dependencies(musicserver_qt backend)