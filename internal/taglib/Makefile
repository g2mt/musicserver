MAKEFILE_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

.PHONY: configure
configure:
	cd $(MAKEFILE_DIR)/taglib && \
	mkdir -p .pkg && echo '*' > .pkg/.gitignore && \
	cmake -B build -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=MinSizeRel \
		-DCMAKE_INSTALL_PREFIX=$(MAKEFILE_DIR)/taglib/.pkg \
		-DWITH_ZLIB=OFF

.PHONY: build_static
build_static:
	cd taglib && \
	cmake --build build && \
	cmake --install build
