package org.msxrv.musicserver;

import android.util.Log;
import android.webkit.JavascriptInterface;

public class NativeBridge {
	static {
		System.loadLibrary("musicserver");
		System.loadLibrary("musicserverbind");
	}

	public native String msrvIdentify();

	public native long msrvNewInterface(
		String httpBind,
		boolean unixBindEnabled,
		String unixBind,
		String dataPath,
		String dbDir,
		String mediaDownloader,
		String[] outErr);

	public native long msrvHandleRequest(
		long ifaceHandle,
		String path,
		String method,
		String[] keys,
		String[] values,
		String[] outContentType,
		String[] outErr);

	public native int msrvRead(long readerHandle, byte[] buf, String[] outErr);

	public native void msrvDeleteHandle(long handle);

	@JavascriptInterface
	public String identify() {
		return msrvIdentify();
	}

	@JavascriptInterface
	public long newInterface(
		String httpBind,
		boolean unixBindEnabled,
		String unixBind,
		String dataPath,
		String dbDir,
		String mediaDownloader)
	{
		String[] err = new String[1];
		long handle = msrvNewInterface(httpBind, unixBindEnabled, unixBind, dataPath, dbDir, mediaDownloader, err);
		if (err[0] != null) {
			Log.e("[msxrv] NativeBridge", "newInterface error: " + err[0]);
			return 0;
		}
		return handle;
	}

	@JavascriptInterface
	public String handleRequest(long ifaceHandle, String path, String method, String[] keys, String[] values) {
		String[] outContentType = new String[1];
		String[] err = new String[1];
		long readerHandle = msrvHandleRequest(ifaceHandle, path, method, keys, values, outContentType, err);
		if (err[0] != null) {
			Log.e("[msxrv] NativeBridge", "handleRequest error: " + err[0]);
			return null;
		}
		return outContentType[0] + ":" + readerHandle;
	}

	@JavascriptInterface
	public int read(long readerHandle, byte[] buf) {
		String[] err = new String[1];
		int n = msrvRead(readerHandle, buf, err);
		if (err[0] != null) {
			Log.e("[msxrv] NativeBridge", "read error: " + err[0]);
		}
		return n;
	}

	@JavascriptInterface
	public void deleteHandle(long handle) {
		msrvDeleteHandle(handle);
	}
}
