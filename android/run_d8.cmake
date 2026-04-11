file(GLOB_RECURSE CLASS_FILES RELATIVE "${CLASS_DIR}" "${CLASS_DIR}/*.class")
foreach(FILE ${CLASS_FILES})
  list(APPEND ABS_CLASS_FILES "${CLASS_DIR}/${FILE}")
endforeach()

execute_process(
  COMMAND "${AN_BUILD_TOOLS}/d8"
    ${ABS_CLASS_FILES}
    --lib "${AN_PLATFORM}/android.jar"
    --output "${OUTPUT_DIR}"
  COMMAND_ERROR_IS_FATAL ANY
)
