# References:
# - https://www.hanshq.net/command-line-android.html
# - https://gist.github.com/stkptr/709d279212d4ee45133a8924724e2dc5

PKG_NAME = org.msxrv.musicserver
PKG_PATH = $(subst .,/,$(PKG_NAME))
PKG_SRCS = $(wildcard java/$(PKG_PATH)/*.java)

.PHONY: all | init_build
all: build/$(PKG_NAME).unsigned.apk

include ../mk/android.mk

.classpath: .classpath.m4 # for lsp
	m4 $< >$@

.PHONY: build/$(PKG_NAME).unsigned.apk
build/$(PKG_NAME).unsigned.apk:
	make build_apk_stage0
	make build_apk_stage1

.PHONY: build_apk_stage0
build_apk_stage0:
	@mkdir -vp build/{gen,obj,apk}
	@rm -rf build/apk/lib

.PHONY: build_apk_stage1
build_apk_stage1: $(PKG_SRCS) \
		AndroidManifest.xml \
		build/apk/lib/x86_64 build/apk/lib/aarch64
	$(AN_BUILD_TOOLS)/aapt2 compile --dir res -o build/res.zip
	$(AN_BUILD_TOOLS)/aapt2 link build/res.zip \
		-I $(AN_PLATFORM)/android.jar \
		--manifest AndroidManifest.xml \
		--java build/gen \
		-o build/resource.apk
	javac --release $(AN_JAVA_VER) \
 		-classpath $(AN_PLATFORM)/android.jar \
 		-d build/obj \
		build/gen/$(PKG_PATH)/R.java \
		$(PKG_SRCS)
	"$(AN_BUILD_TOOLS)/d8" $$(find build/obj -name '*.class') \
		--lib "$(AN_PLATFORM)/android.jar" \
		--output build/
	cd build && zip -u resource.apk classes.dex
	cd build/apk && zip -r -u ../resource.apk lib/*/*
	"$(AN_BUILD_TOOLS)/zipalign" -f 4 build/resource.apk build/$(PKG_NAME).unsigned.apk

.PHONY: build/apk/lib/aarch64
build/apk/lib/aarch64:
	mkdir -p build/apk/lib/arm64-v8a
	cd .. && make AN_ARCH=aarch64 build/musicserver.aarch64.so
	cp ../build/musicserver.aarch64.so build/apk/lib/arm64-v8a/libmusicserver.so

.PHONY: build/apk/lib/armv7a
#build/apk/lib/armv7a:
#	mkdir -p build/apk/lib/armeabi-v7a
#	cd .. && make AN_ARCH=armv7a build/musicserver.armv7a.so
#	cp ../build/musicserver.armv7a.so build/apk/lib/armeabi-v7a/libmusicserver.so

.PHONY: build/apk/lib/x86_64
build/apk/lib/x86_64:
	mkdir -p build/apk/lib/x86_64
	cd .. && make AN_ARCH=x86_64 build/musicserver.x86_64.so
	cp ../build/musicserver.x86_64.so build/apk/lib/x86_64/libmusicserver.so
