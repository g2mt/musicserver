#include <jni.h>
#include <stdlib.h>
#include <string.h>

#include "libmusicserver.h"

JNIEXPORT jstring JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvIdentify(JNIEnv *env, jobject obj) {
  return (*env)->NewStringUTF(env, MsrvIdentify());
}

JNIEXPORT jlong JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvNewInterfaceFromConfigJson(
    JNIEnv *env, jobject obj, jstring configJson, jobjectArray outErr) {
  const char *cConfigJson = (*env)->GetStringUTFChars(env, configJson, NULL);

  MsrvNewInterfaceResult result =
      MsrvNewInterfaceFromConfigJson((char *)cConfigJson);

  (*env)->ReleaseStringUTFChars(env, configJson, cConfigJson);

  if (result.Err != NULL) {
    jstring errStr = (*env)->NewStringUTF(env, result.Err);
    (*env)->SetObjectArrayElement(env, outErr, 0, errStr);
    free(result.Err);
    return 0;
  }

  return (jlong)result.Handle;
}

JNIEXPORT jlong JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvHandleRequest(
    JNIEnv *env, jobject obj, jlong ifaceHandle, jstring path, jstring method,
    jstring paramsJson, jobjectArray outContentType, jobjectArray outErr) {
  const char *cPath = (*env)->GetStringUTFChars(env, path, NULL);
  const char *cMethod = (*env)->GetStringUTFChars(env, method, NULL);
  const char *cParamsJson = (*env)->GetStringUTFChars(env, paramsJson, NULL);

  MsrvHandleRequestResult result =
      MsrvHandleRequest((uintptr_t)ifaceHandle, (char *)cPath, (char *)cMethod,
                        (char *)cParamsJson);

  (*env)->ReleaseStringUTFChars(env, path, cPath);
  (*env)->ReleaseStringUTFChars(env, method, cMethod);
  (*env)->ReleaseStringUTFChars(env, paramsJson, cParamsJson);

  if (result.Err != NULL) {
    jstring errStr = (*env)->NewStringUTF(env, result.Err);
    (*env)->SetObjectArrayElement(env, outErr, 0, errStr);
    free(result.Err);
    return 0;
  }

  jstring contentTypeStr = (*env)->NewStringUTF(env, result.ContentType);
  (*env)->SetObjectArrayElement(env, outContentType, 0, contentTypeStr);
  free(result.ContentType);

  return (jlong)result.ReaderHandle;
}

JNIEXPORT jbyteArray JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvReadAll(JNIEnv *env, jobject obj,
                                                    jlong readerHandle,
                                                    jobjectArray outErr) {
  MsrvReadAllResult result = MsrvReadAll((uintptr_t)readerHandle);

  if (result.Err != NULL) {
    jstring errStr = (*env)->NewStringUTF(env, result.Err);
    (*env)->SetObjectArrayElement(env, outErr, 0, errStr);
    free(result.Err);
    return NULL;
  }

  jbyteArray jBuf = (*env)->NewByteArray(env, result.N);
  (*env)->SetByteArrayRegion(env, jBuf, 0, result.N, (jbyte *)result.Data);
  free(result.Data);
  return jBuf;
}

JNIEXPORT jlong JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvGetTrackCover(
    JNIEnv *env, jobject obj, jlong ifaceHandle, jstring id,
    jobjectArray outContentType) {
  const char *cId = (*env)->GetStringUTFChars(env, id, NULL);

  MsrvHandleRequestResult result =
      MsrvGetTrackCover((uintptr_t)ifaceHandle, (char *)cId);

  (*env)->ReleaseStringUTFChars(env, id, cId);

  jstring contentTypeStr = (*env)->NewStringUTF(env, result.ContentType);
  (*env)->SetObjectArrayElement(env, outContentType, 0, contentTypeStr);
  free(result.ContentType);

  return (jlong)result.ReaderHandle;
}

JNIEXPORT void JNICALL Java_org_msxrv_musicserver_NativeBridge_msrvDeleteHandle(
    JNIEnv *env, jobject obj, jlong handle) {
  MsrvDeleteHandle((uintptr_t)handle);
}

JNIEXPORT void JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvStartScanTracks(
    JNIEnv *env, jobject obj, jlong ifaceHandle) {
  MsrvStartScanTracks((uintptr_t)ifaceHandle);
}

JNIEXPORT jobject JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvGetScanTickerValues(
    JNIEnv *env, jobject obj, jlong ifaceHandle) {
  MsrvScanTickerValuesResult result =
      MsrvGetScanTickerValues((uintptr_t)ifaceHandle);

  jclass cls = (*env)->FindClass(env, "org/msxrv/musicserver/NativeBridge$ScanTickerValues");
  jmethodID ctor = (*env)->GetMethodID(env, cls, "<init>", "(ZII)V");
  return (*env)->NewObject(env, cls, ctor,
      (jboolean)(result.Present != 0),
      (jint)result.Value,
      (jint)result.MaxValue);
}
