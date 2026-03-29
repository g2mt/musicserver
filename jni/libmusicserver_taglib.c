#include "taglib/bindings.h"
#include <jni.h>
#include <string.h>

JNIEXPORT jobject JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvTlLoadTrackMetadata(
    JNIEnv *env, jobject obj, jstring filepath) {
  const char *cFilepath = (*env)->GetStringUTFChars(env, filepath, NULL);

  TrackMetadata metadata = {0};
  BindingResult result = MsrvTlLoadTrackMetadata(cFilepath, &metadata);

  (*env)->ReleaseStringUTFChars(env, filepath, cFilepath);

  if (result.err != NULL) {
    MsrvTlFreeTrackMetadata(&metadata);
    return NULL;
  }

  jclass cls = (*env)->FindClass(
      env, "org/msxrv/musicserver/NativeBridge$TrackMetadata");
  jmethodID ctor = (*env)->GetMethodID(
      env, cls, "<init>",
      "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V");

  jstring title =
      metadata.title ? (*env)->NewStringUTF(env, metadata.title) : NULL;
  jstring artist =
      metadata.artist ? (*env)->NewStringUTF(env, metadata.artist) : NULL;
  jstring album =
      metadata.album ? (*env)->NewStringUTF(env, metadata.album) : NULL;

  jobject metadataObj = (*env)->NewObject(env, cls, ctor, title, artist, album);

  MsrvTlFreeTrackMetadata(&metadata);
  return metadataObj;
}

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
