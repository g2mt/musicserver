cmake_minimum_required(VERSION 3.20)
project(musicserver_qt)

set(MS_DIR ${CMAKE_CURRENT_SOURCE_DIR}/..)

set(MS_GOARCH "amd64" CACHE STRING "Go target architecture (amd64, arm64)")
set(QT_APP_BINARY "musicserver-qt" CACHE STRING "Qt application binary output name")
set(QT_MIN_VERSION "6.2" CACHE STRING "Minimum Qt version")

find_package(Qt6 ${QT_MIN_VERSION} REQUIRED COMPONENTS Core Widgets)

### Backend — libmusicserver.a built for the native target
set(BACKEND_BUILD_DIR ${CMAKE_CURRENT_BINARY_DIR}/backend)
set(BACKEND_INSTALL_DIR ${CMAKE_CURRENT_BINARY_DIR})

add_custom_command(
  OUTPUT
    ${BACKEND_INSTALL_DIR}/lib/libmusicserver.a
    ${BACKEND_INSTALL_DIR}/include/libmusicserver.h
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

add_custom_target(backend ALL
  DEPENDS
    ${BACKEND_INSTALL_DIR}/lib/libmusicserver.a
    ${BACKEND_INSTALL_DIR}/include/libmusicserver.h
)

### Native Qt application
add_executable(musicserver_qt main.cpp)

set_target_properties(musicserver_qt PROPERTIES
  OUTPUT_NAME ${QT_APP_BINARY}
  RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
)

target_include_directories(musicserver_qt PRIVATE ${BACKEND_INSTALL_DIR}/include)
target_link_libraries(musicserver_qt PRIVATE
  ${BACKEND_INSTALL_DIR}/lib/libmusicserver.a
  Qt6::Widgets
)
add_dependencies(musicserver_qt backend)