# References:
# - https://www.hanshq.net/command-line-android.html
# - https://gist.github.com/stkptr/709d279212d4ee45133a8924724e2dc5

include ../mk/android.mk

PKG_NAME = org.msxrv.musicserver
PKG_PATH = $(subst .,/,$(PKG_NAME))
PKG_SRCS = $(wildcard java/$(PKG_PATH)/*.java)

.PHONY: all
all: build/$(PKG_NAME).unsigned.apk

.classpath: .classpath.m4
	m4 $< >$@

build/$(PKG_NAME).unsigned.apk: $(PKG_SRCS) AndroidManifest.xml | init_build
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
	"$(AN_BUILD_TOOLS)/zipalign" -f 4 build/resource.apk build/$(PKG_NAME).unsigned.apk

.PHONY: init_build
init_build:
	@mkdir -vp build/{gen,obj,apk}
