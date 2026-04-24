execute_process(
  COMMAND ${MS_READELF} ${CMAKE_BINARY_DIR}/libmusicserver.so --elf-output-style=JSON --needed-libs
  OUTPUT_VARIABLE READELF_JSON
  RESULT_VARIABLE READELF_RESULT
)

if(NOT READELF_RESULT EQUAL 0)
  message(FATAL_ERROR "Failed to run readelf on libmusicserver.so")
endif()

string(JSON LIBTAG_SONAME_LIST GET "${READELF_JSON}" 0 "NeededLibraries")
string(JSON LIBTAG_COUNT LENGTH "${LIBTAG_SONAME_LIST}")
math(EXPR LIBTAG_MAX "${LIBTAG_COUNT} - 1")

set(MS_TAGLIB_SONAME "")
foreach(I RANGE ${LIBTAG_MAX})
  string(JSON LIB_NAME GET "${LIBTAG_SONAME_LIST}" ${I})
  if(LIB_NAME MATCHES "^libtag\\.so")
    set(MS_TAGLIB_SONAME ${LIB_NAME})
    break()
  endif()
endforeach()

if(MS_TAGLIB_SONAME STREQUAL "")
  message(FATAL_ERROR "Could not find libtag.so in libmusicserver.so dependencies")
endif()

file(INSTALL
  FILES "${TAGLIB_INSTALL_DIR}/lib/libtag.so.${MS_TAGLIB_VERSION}"
  DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/${MS_APKARCH}"
  RENAME "${MS_TAGLIB_SONAME}"
)
