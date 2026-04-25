#include <jni.h>
#include <stdlib.h>
#include "ebur128.h"

JNIEXPORT jlong JNICALL
Java_org_msxrv_musicserver_NativeAudioBridge_ebur128Init(JNIEnv *env, jobject obj, jint channels, jint samplerate) {
  ebur128_state *st = ebur128_init((unsigned)channels, (unsigned)samplerate, EBUR128_MODE_I);
  return (jlong)st;
}

JNIEXPORT void JNICALL
Java_org_msxrv_musicserver_NativeAudioBridge_ebur128Destroy(JNIEnv *env, jobject obj, jlong handle) {
  ebur128_state *st = (ebur128_state *)handle;
  if (st) ebur128_destroy(&st);
}

JNIEXPORT void JNICALL
Java_org_msxrv_musicserver_NativeAudioBridge_ebur128AddFrames(JNIEnv *env, jobject obj, jlong handle, jbyteArray frames, jint nr_frames) {
  ebur128_state *st = (ebur128_state *)handle;
  if (!st) return;

  jbyte *bytes = (*env)->GetByteArrayElements(env, frames, NULL);
  size_t len = (size_t)nr_frames * st->channels;
  
  // Convert 8-bit PCM (unsigned in Android Visualizer) to double
  double *buffer = malloc(len * sizeof(double));
  for (size_t i = 0; i < len; ++i) {
    buffer[i] = ((double)((unsigned char)bytes[i]) - 128.0) / 128.0;
  }

  ebur128_add_frames_double(st, buffer, (size_t)nr_frames);

  free(buffer);
  (*env)->ReleaseByteArrayElements(env, frames, bytes, JNI_ABORT);
}

JNIEXPORT jdouble JNICALL
Java_org_msxrv_musicserver_NativeAudioBridge_ebur128LoudnessGlobal(JNIEnv *env, jobject obj, jlong handle) {
  ebur128_state *st = (ebur128_state *)handle;
  if (!st) return 0.0;
  double loudness;
  ebur128_loudness_global(st, &loudness);
  return (jdouble)loudness;
}
