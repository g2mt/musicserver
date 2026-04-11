file(GLOB_RECURSE CLASS_FILES RELATIVE "${CLASS_DIR}" "${CLASS_DIR}/*.class")
foreach(FILE ${CLASS_FILES})
  list(APPEND ABS_CLASS_FILES "${CLASS_DIR}/${FILE}")
endforeach()

set(D8_CMD
  "${AN_BUILD_TOOLS}/d8"
  ${ABS_CLASS_FILES}
  --lib "${AN_PLATFORM}/android.jar"
  --output "${OUTPUT_DIR}"
)

if(VERBOSE)
  list(JOIN D8_CMD " " D8_CMD_STR)
  message(STATUS "${D8_CMD_STR}")
endif()

execute_process(
  COMMAND ${D8_CMD}
  COMMAND_ERROR_IS_FATAL ANY
)
