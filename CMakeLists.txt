cmake_minimum_required(VERSION 3.20)
project(musicserver)

find_package(Git REQUIRED)

execute_process(
  COMMAND ${GIT_EXECUTABLE} rev-parse --short HEAD
  OUTPUT_VARIABLE GIT_SHORT_HASH
  OUTPUT_STRIP_TRAILING_WHITESPACE
)

set(GOFLAGS -v -ldflags=\"-X musicserver/internal/api.Version=${GIT_SHORT_HASH}\")

option(BUILD_BIN "Build the music server executable" OFF)
option(BUILD_LIB "Build the music server shared library" OFF)

### Frontend

if(BUILD_BIN)
  add_custom_target(frontend
    COMMAND npm run build
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/frontend
    COMMENT "Building frontend"
  )

### Music Server executable

  add_custom_target(musicserver ALL
    COMMAND go build -o ${CMAKE_BINARY_DIR}/musicserver ${GOFLAGS} .
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    DEPENDS frontend
    COMMENT "Building musicserver"
  )

  install(PROGRAMS ${CMAKE_BINARY_DIR}/musicserver DESTINATION bin)
endif()

### Music Server shared library

if(BUILD_LIB)
  add_custom_target(libmusicserver ALL
    COMMAND go build -buildmode=c-shared -o ${CMAKE_BINARY_DIR}/libmusicserver.so ${GOFLAGS} musicserver
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMENT "Building libmusicserver.so"
  )
endif()
