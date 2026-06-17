file(GLOB_RECURSE FRONTEND_SOURCES
  "public/*"
  "src/*"
)
list(APPEND FRONTEND_SOURCES
  "index.html"
  "package-lock.json"
  "package.json"
  "vite-common.config.ts"
)

### Desktop frontend
add_custom_command(
  OUTPUT ${CMAKE_CURRENT_SOURCE_DIR}/dist/index.html
  COMMAND npm run build
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
  DEPENDS ${FRONTEND_SOURCES} vite.config.ts
  COMMENT "Building frontend"
  VERBATIM
)
add_custom_target(frontend DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/dist/index.html)

### Android frontend
add_custom_command(
  OUTPUT ${CMAKE_CURRENT_SOURCE_DIR}/dist-android/index.html
  COMMAND npm run build-android
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
  DEPENDS ${FRONTEND_SOURCES} vite-android.config.ts
  COMMENT "Building frontend (Android)"
  VERBATIM
)
add_custom_target(frontend_android DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/dist-android/index.html)
