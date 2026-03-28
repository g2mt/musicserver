#include <stdlib.h>
#include <string.h>
#include <jni.h>

#include "libmusicserver.h"

JNIEXPORT jstring JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvIdentify(JNIEnv *env, jobject obj)
{
	return (*env)->NewStringUTF(env, MsrvIdentify());
}

JNIEXPORT jlong JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvNewInterface(
	JNIEnv *env, jobject obj,
	jstring httpBind,
	jboolean unixBindEnabled,
	jstring unixBind,
	jstring dataPath,
	jstring dbDir,
	jstring mediaDownloader,
	jobjectArray outErr)
{
	const char *cHttpBind = (*env)->GetStringUTFChars(env, httpBind, NULL);
	const char *cUnixBind = (*env)->GetStringUTFChars(env, unixBind, NULL);
	const char *cDataPath = (*env)->GetStringUTFChars(env, dataPath, NULL);
	const char *cDbDir = (*env)->GetStringUTFChars(env, dbDir, NULL);
	const char *cMediaDownloader = (*env)->GetStringUTFChars(env, mediaDownloader, NULL);

	MsrvConfig cfg = {
		.HTTPBind        = (char *)cHttpBind,
		.UnixBindEnabled = unixBindEnabled ? 1 : 0,
		.UnixBind        = (char *)cUnixBind,
		.DataPath        = (char *)cDataPath,
		.DbDir           = (char *)cDbDir,
		.MediaDownloader = (char *)cMediaDownloader,
	};

	MsrvNewInterfaceResult result = MsrvNewInterface(cfg);

	(*env)->ReleaseStringUTFChars(env, httpBind, cHttpBind);
	(*env)->ReleaseStringUTFChars(env, unixBind, cUnixBind);
	(*env)->ReleaseStringUTFChars(env, dataPath, cDataPath);
	(*env)->ReleaseStringUTFChars(env, dbDir, cDbDir);
	(*env)->ReleaseStringUTFChars(env, mediaDownloader, cMediaDownloader);

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
	JNIEnv *env, jobject obj,
	jlong ifaceHandle,
	jstring path,
	jstring method,
	jobjectArray keys,
	jobjectArray values,
	jobjectArray outContentType,
	jobjectArray outErr)
{
	const char *cPath   = (*env)->GetStringUTFChars(env, path, NULL);
	const char *cMethod = (*env)->GetStringUTFChars(env, method, NULL);

	jint paramsLen = (*env)->GetArrayLength(env, keys);
	char **cKeys   = (char **)malloc(paramsLen * sizeof(char *));
	char **cValues = (char **)malloc(paramsLen * sizeof(char *));

	for (int i = 0; i < paramsLen; i++) {
		jstring k = (jstring)(*env)->GetObjectArrayElement(env, keys, i);
		jstring v = (jstring)(*env)->GetObjectArrayElement(env, values, i);
		cKeys[i]   = (char *)(*env)->GetStringUTFChars(env, k, NULL);
		cValues[i] = (char *)(*env)->GetStringUTFChars(env, v, NULL);
	}

	MsrvHandleRequestResult result = MsrvHandleRequest(
		(uintptr_t)ifaceHandle,
		(char *)cPath,
		(char *)cMethod,
		cKeys,
		cValues,
		(int)paramsLen);

	for (int i = 0; i < paramsLen; i++) {
		jstring k = (jstring)(*env)->GetObjectArrayElement(env, keys, i);
		jstring v = (jstring)(*env)->GetObjectArrayElement(env, values, i);
		(*env)->ReleaseStringUTFChars(env, k, cKeys[i]);
		(*env)->ReleaseStringUTFChars(env, v, cValues[i]);
	}
	free(cKeys);
	free(cValues);
	(*env)->ReleaseStringUTFChars(env, path, cPath);
	(*env)->ReleaseStringUTFChars(env, method, cMethod);

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

JNIEXPORT jint JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvRead(
	JNIEnv *env, jobject obj,
	jlong readerHandle,
	jbyteArray buf,
	jobjectArray outErr)
{
	jsize bufLen = (*env)->GetArrayLength(env, buf);
	char *cBuf = (char *)malloc(bufLen);

	MsrvReadResult result = MsrvRead((uintptr_t)readerHandle, cBuf, (int)bufLen);

	if (result.Err != NULL) {
		jstring errStr = (*env)->NewStringUTF(env, result.Err);
		(*env)->SetObjectArrayElement(env, outErr, 0, errStr);
		free(result.Err);
		free(cBuf);
		return result.N;
	}

	if (result.N > 0) {
		(*env)->SetByteArrayRegion(env, buf, 0, result.N, (jbyte *)cBuf);
	}

	free(cBuf);
	return result.N;
}

JNIEXPORT void JNICALL
Java_org_msxrv_musicserver_NativeBridge_msrvDeleteHandle(
	JNIEnv *env, jobject obj,
	jlong handle)
{
	MsrvDeleteHandle((uintptr_t)handle);
}
