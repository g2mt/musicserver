// https://www.hanshq.net/command-line-android.html
#include <stdlib.h>
#include <jni.h>

JNIEXPORT jstring JNICALL
Java_org_msxrv_musicserver_MainActivity_getMessage(JNIEnv *env, jobject obj)
{
        return (*env)->NewStringUTF(env, "123");
}
