# Install

## Desktop (Linux/macOS)

### Prerequisites

- [Go](https://go.dev/) (1.21+)
- [Node.js](https://nodejs.org/) and npm
- [CMake](https://cmake.org/) (3.20+)
- [TagLib](https://taglib.org/) (built via `internal/taglib/CMakeLists.txt`)

### Build TagLib

```sh
cmake -S internal/taglib -B internal/taglib/build
cmake --build internal/taglib/build
```

### Build musicserver

```sh
cmake -S . -B build
cmake --build build
```

The compiled binary will be at `build/musicserver`.

### Install

```sh
cmake --install build
```

This installs `musicserver` to `/usr/local/bin` by default. Use `--prefix` to change the install location:

```sh
cmake --install build --prefix ~/.local
```

---

## Android

### Prerequisites

- [Android SDK](https://developer.android.com/studio) with API 33 platform and build tools
- [Android NDK](https://developer.android.com/ndk) (r26+)
- [Go](https://go.dev/) (1.21+)
- [Node.js](https://nodejs.org/) and npm
- [CMake](https://cmake.org/) (3.20+)
- `keytool` (included with the JDK)
- `adb` (optional, for installing to a device)

### Build APK

Set `ANDROID_HOME` to your Android SDK path, then configure and build:

```sh
export ANDROID_HOME=/path/to/android/sdk

cmake -S android -B android/build -DAN_TARGET=x86_64
cmake --build android/build
```

To build for all supported architectures:

```sh
cmake -S android -B android/build -DAN_TARGET=all
cmake --build android/build
```

The signed APK will be at `android/build/build/org.msxrv.musicserver.apk`.

### Install via ADB

```sh
cmake --build android/build --target install_adb
```
