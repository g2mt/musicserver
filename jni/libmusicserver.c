#include <jni.h>
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

JNIEXPORT void JNICALL Java_org_msxrv_musicserver_NativeBridge_msrvDeleteHandle(
    JNIEnv *env, jobject obj, jlong handle) {
  MsrvDeleteHandle((uintptr_t)handle);
}

JNIEXPORT jstring JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvLoadTrackByPath(
    JNIEnv *env, jobject obj, jlong ifaceHandle, jstring path,
    jobjectArray outErr) {
  const char *cPath = (*env)->GetStringUTFChars(env, path, NULL);

  MsrvLoadTrackByPathResult result =
      MsrvLoadTrackByPath((uintptr_t)ifaceHandle, (char *)cPath);

  (*env)->ReleaseStringUTFChars(env, path, cPath);

  if (result.Err != NULL) {
    jstring errStr = (*env)->NewStringUTF(env, result.Err);
    (*env)->SetObjectArrayElement(env, outErr, 0, errStr);
    free(result.Err);
    return NULL;
  }

  jstring shortIdStr = (*env)->NewStringUTF(env, result.ShortId);
  free(result.ShortId);
  return shortIdStr;
}

JNIEXPORT jlongArray JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvGetTrackFileChecksumInfo(
    JNIEnv *env, jobject obj, jlong ifaceHandle, jstring path,
    jobjectArray outErr) {
  const char *cPath = (*env)->GetStringUTFChars(env, path, NULL);

  MsrvGetTrackFileChecksumInfoResult result =
      MsrvGetTrackFileChecksumInfo((uintptr_t)ifaceHandle, (char *)cPath);

  (*env)->ReleaseStringUTFChars(env, path, cPath);

  if (result.Err != NULL) {
    jstring errStr = (*env)->NewStringUTF(env, result.Err);
    (*env)->SetObjectArrayElement(env, outErr, 0, errStr);
    free(result.Err);
    return NULL;
  }

  jlongArray jArr = (*env)->NewLongArray(env, 2);
  jlong fill[2];
  fill[0] = (jlong)result.CkLastModified;
  fill[1] = (jlong)result.CkSize;
  (*env)->SetLongArrayRegion(env, jArr, 0, 2, fill);
  return jArr;
}
