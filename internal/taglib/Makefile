ARCH ?= $(shell uname -m)
BUILD_DIR = .build_$(ARCH)
PKG_DIR = .pkg_$(ARCH)

MAKEFILE_DIR = $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

.PHONY: configure
configure:
	cd $(MAKEFILE_DIR)/taglib && \
	mkdir -p $(BUILD_DIR) && echo '*' > $(BUILD_DIR)/.gitignore && \
	mkdir -p $(PKG_DIR) && echo '*' > $(PKG_DIR)/.gitignore && \
	cmake -B $(BUILD_DIR) -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=MinSizeRel \
		-DCMAKE_INSTALL_PREFIX=$(MAKEFILE_DIR)/taglib/$(PKG_DIR) \
		-DWITH_ZLIB=OFF

.PHONY: build_static
build_static:
	cd taglib && \
	cmake --build $(BUILD_DIR) && \
	cmake --install $(BUILD_DIR)
