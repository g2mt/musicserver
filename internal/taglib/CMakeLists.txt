cmake_minimum_required(VERSION 3.20)
project(taglib_build)

set(ARCH ${CMAKE_SYSTEM_PROCESSOR} CACHE STRING "Target architecture")
set(BUILD_DIR ${CMAKE_CURRENT_SOURCE_DIR}/taglib/.build_${ARCH})
set(PKG_DIR ${CMAKE_CURRENT_SOURCE_DIR}/taglib/.pkg_${ARCH})

add_custom_target(configure_taglib
  COMMAND ${CMAKE_COMMAND} -E make_directory ${BUILD_DIR}
  COMMAND ${CMAKE_COMMAND} -E echo "*" > ${BUILD_DIR}/.gitignore
  COMMAND ${CMAKE_COMMAND} -E make_directory ${PKG_DIR}
  COMMAND ${CMAKE_COMMAND} -E echo "*" > ${PKG_DIR}/.gitignore
  COMMAND ${CMAKE_COMMAND}
    -B ${BUILD_DIR}
    -DBUILD_TESTING=OFF
    -DCMAKE_BUILD_TYPE=MinSizeRel
    -DCMAKE_INSTALL_PREFIX=${PKG_DIR}
    -DWITH_ZLIB=OFF
    ${CMAKE_CURRENT_SOURCE_DIR}/taglib
  COMMENT "Configuring taglib"
)

add_custom_target(build_static ALL
  COMMAND ${CMAKE_COMMAND} --build ${BUILD_DIR}
  COMMAND ${CMAKE_COMMAND} --install ${BUILD_DIR}
  DEPENDS configure_taglib
  COMMENT "Building and installing taglib static"
)
