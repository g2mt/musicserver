cmake_minimum_required(VERSION 3.20)
project(musicserver)

find_package(Git REQUIRED)

execute_process(
  COMMAND ${GIT_EXECUTABLE} rev-parse --short HEAD
  OUTPUT_VARIABLE GIT_SHORT_HASH
  OUTPUT_STRIP_TRAILING_WHITESPACE
)

set(GOFLAGS -v -ldflags=\"-X musicserver/internal/api.Version=${GIT_SHORT_HASH}\")

### Frontend

add_custom_target(frontend
  COMMAND npm run build
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/frontend
  COMMENT "Building frontend"
)

### Music Server executable

add_custom_target(musicserver
  COMMAND go build -o ${CMAKE_BINARY_DIR}/musicserver ${GOFLAGS} .
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  DEPENDS frontend
  COMMENT "Building musicserver"
)

install(PROGRAMS ${CMAKE_BINARY_DIR}/musicserver DESTINATION bin)

### Music Server shared library

add_custom_target(libmusicserver
  COMMAND go build -buildmode=c-shared -o ${CMAKE_BINARY_DIR}/libmusicserver.so ${GOFLAGS} musicserver
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  COMMENT "Building libmusicserver.so"
)
