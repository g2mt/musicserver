file(GLOB_RECURSE CLASS_FILES RELATIVE "${CMAKE_ARGV3}" "${CMAKE_ARGV3}/*.class")
foreach(FILE ${CLASS_FILES})
  list(APPEND ABS_CLASS_FILES "${CMAKE_ARGV3}/${FILE}")
endforeach()

execute_process(
  COMMAND "${AN_BUILD_TOOLS}/d8"
    ${ABS_CLASS_FILES}
    --lib "${AN_PLATFORM}/android.jar"
    --output "${CMAKE_ARGV4}"
  COMMAND_ERROR_IS_FATAL ANY
)
