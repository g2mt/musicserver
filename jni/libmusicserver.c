// https://www.hanshq.net/command-line-android.html
#include <stdlib.h>
#include <jni.h>

#if defined(__x86_64__)
#include "musicserver.android_x86_64.h"
#elif defined(__aarch64__)
#include "musicserver.android_aarch64.h"
#elif defined(__arm__)
#include "musicserver.android_armv7.h"
#else
#error "Unknown architecture"
#endif

JNIEXPORT jstring JNICALL
Java_org_msxrv_musicserver_MainActivity_getMessage(JNIEnv *env, jobject obj)
{
        return (*env)->NewStringUTF(env, "Hello");
}
