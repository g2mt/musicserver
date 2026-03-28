package org.msxrv.musicserver;

import android.util.Log;
import android.webkit.JavascriptInterface;

public class NativeBridge {
	static {
		System.loadLibrary("musicserver");
		System.loadLibrary("musicserverbind");
	}

	private native String msrvIdentify();

	private native long msrvNewInterface(
		String httpBind,
		boolean unixBindEnabled,
		String unixBind,
		String dataPath,
		String dbDir,
		String mediaDownloader,
		String[] outErr);

	private native long msrvHandleRequest(
		long ifaceHandle,
		String path,
		String method,
		String[] keys,
		String[] values,
		String[] outContentType,
		String[] outErr);

	private native int msrvRead(long readerHandle, byte[] buf, String[] outErr);

	private native void msrvDeleteHandle(long handle);

	@JavascriptInterface
	public String fetchAPI(String path, String params, String method) {
		Log.d("[msxrv] Native", "path=" + path + " params=" + params + " method=" + method);
		return null;
	}

}
