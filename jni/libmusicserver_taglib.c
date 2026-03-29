#include "taglib/bindings.h"
#include <jni.h>
#include <string.h>

JNIEXPORT jobject JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvTlExtractCoverArt(
    JNIEnv *env, jobject obj, jstring filepath, jobjectArray outMimeType) {
  const char *cFilepath = (*env)->GetStringUTFChars(env, filepath, NULL);

  CoverArt coverArt = {0};
  BindingResult result = MsrvTlExtractCoverArt(cFilepath, &coverArt);

  (*env)->ReleaseStringUTFChars(env, filepath, cFilepath);

  if (result.err != NULL || coverArt.data == NULL) {
    MsrvTlFreeCoverArt(&coverArt);
    return NULL;
  }

  jstring mimeTypeStr = (*env)->NewStringUTF(env, coverArt.mimeType);
  (*env)->SetObjectArrayElement(env, outMimeType, 0, mimeTypeStr);

  jbyteArray jData = (*env)->NewByteArray(env, coverArt.dataLength);
  (*env)->SetByteArrayRegion(env, jData, 0, coverArt.dataLength,
                             (jbyte *)coverArt.data);

  MsrvTlFreeCoverArt(&coverArt);
  return jData;
}
