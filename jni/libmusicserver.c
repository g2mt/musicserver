#include <stdlib.h>
#include <jni.h>

#include "libmusicserver.h"

JNIEXPORT jstring JNICALL
Java_org_msxrv_musicserver_NativeBridge_getMessage(JNIEnv *env, jobject obj)
{
  return (*env)->NewStringUTF(env, MsrvIdentify());
}
