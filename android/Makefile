# References:
# - https://www.hanshq.net/command-line-android.html
# - https://gist.github.com/stkptr/709d279212d4ee45133a8924724e2dc5

PKG_NAME = org.msxrv.musicserver
PKG_PATH = $(subst .,/,$(PKG_NAME))
PKG_SRCS = $(wildcard java/$(PKG_PATH)/*.java)
AN_TARGET = x86_64

.PHONY: all | init_build
all: build/$(PKG_NAME).unsigned.apk

include ../mk/android.mk

.classpath: .classpath.m4 # for lsp
	m4 $< >$@

.PHONY: build/$(PKG_NAME).unsigned.apk
build/$(PKG_NAME).unsigned.apk:
	make build_apk_stage0
	make build/$(PKG_NAME).apk

.PHONY: build_apk_stage0
build_apk_stage0:
	@mkdir -vp build/{gen,obj,apk}
	@rm -rf build/apk/lib

.PHONY: build/$(PKG_NAME).apk
build/$(PKG_NAME).apk: $(PKG_SRCS) \
		AndroidManifest.xml \
		$(foreach arch,$(AN_TARGET),build/apk/lib/$(arch)) \
		build/keystore.jks
	$(AN_BUILD_TOOLS)/aapt2 compile --dir res -o build/res.zip
	$(AN_BUILD_TOOLS)/aapt2 link build/res.zip \
		-I $(AN_PLATFORM)/android.jar \
		--manifest AndroidManifest.xml \
		--java build/gen \
		-o build/resource.apk
	rm -rf build/obj/*
	$(AN_JAVAC) --release $(AN_JAVA_VER) \
 		-classpath $(AN_PLATFORM)/android.jar \
 		-d build/obj \
		build/gen/$(PKG_PATH)/R.java \
		$(PKG_SRCS)
	"$(AN_BUILD_TOOLS)/d8" $$(find build/obj -name '*.class') \
		--lib "$(AN_PLATFORM)/android.jar" \
		--output build/
	cd build && zip -u resource.apk classes.dex
	cd build/apk && zip -r -u ../resource.apk lib/*/*
	zip -r -u build/resource.apk assets
	"$(AN_BUILD_TOOLS)/zipalign" -f 4 build/resource.apk build/$(PKG_NAME).unsigned.apk
	"$(AN_BUILD_TOOLS)/apksigner" sign --ks build/keystore.jks \
		--ks-key-alias androidkey --ks-pass pass:android \
		--key-pass pass:android --out build/$(PKG_NAME).apk \
		build/$(PKG_NAME).unsigned.apk

build/keystore.jks:
	keytool -genkeypair -keystore $@ -alias androidkey \
		-validity 10000 -keyalg RSA -keysize 2048 \
		-storepass android -keypass android


# $(1) = NDK arch, $(2) = android apk arch, $(3) = sysroot arch
define rule-native-lib
.PHONY: build/apk/lib/$(1)
build/apk/lib/$(1):
	mkdir -p build/apk/lib/$(2)
	cd .. && make AN_ARCH=$(1) native_lib_android
	cp ../build/$(1)/*.so build/apk/lib/$(2)/
	cp $(AN_NDK_PREFIX)/sysroot/usr/lib/$(3)-linux-android/libc++_shared.so build/apk/lib/$(2)/
endef

$(eval $(call rule-native-lib,aarch64,arm64-v8a,aarch64))
$(eval $(call rule-native-lib,armv7a,armeabi-v7a,arm))
$(eval $(call rule-native-lib,x86_64,x86_64,x86_64))

install_adb: build/$(PKG_NAME).apk
	-adb uninstall $(PKG_NAME)
	adb install $<


