package org.msxrv.musicserver;

import android.util.Log;
import android.webkit.JavascriptInterface;

public class NativeBridge {
	static {
		System.loadLibrary("musicserver");
		System.loadLibrary("musicserverbind");
	}

	/**
	 * Returns the library identifier string.
	 *
	 * @return the library name "musicserver"
	 */
	private native String msrvIdentify();

	/**
	 * Creates a new interface instance with the given configuration.
	 *
	 * @param httpBind         the HTTP bind address
	 * @param unixBindEnabled  whether to enable Unix socket binding
	 * @param unixBind         the Unix socket path
	 * @param dataPath         the data directory path
	 * @param dbDir            the database directory path
	 * @param mediaDownloader  the media downloader command
	 * @param outErr           output array to store error message if any
	 * @return the interface handle, or 0 on error
	 */
	private native long msrvNewInterface(
		String httpBind,
		boolean unixBindEnabled,
		String unixBind,
		String dataPath,
		String dbDir,
		String mediaDownloader,
		String[] outErr);

	/**
	 * Handles an HTTP request to the given path.
	 *
	 * @param ifaceHandle      the interface handle
	 * @param path             the request path
	 * @param method           the HTTP method (GET, POST, etc.)
	 * @param keys             array of parameter keys
	 * @param values           array of parameter values
	 * @param outContentType   output array to store the response content type
	 * @param outErr           output array to store error message if any
	 * @return the reader handle for reading the response, or 0 on error
	 */
	private native long msrvHandleRequest(
		long ifaceHandle,
		String path,
		String method,
		String[] keys,
		String[] values,
		String[] outContentType,
		String[] outErr);

	/**
	 * Reads bytes from a reader handle into the provided buffer.
	 *
	 * @param readerHandle the reader handle obtained from handleRequest
	 * @param buf          the byte buffer to read into
	 * @param outErr       output array to store error message if any
	 * @return the number of bytes read, -1 on EOF, -2 on error
	 */
	private native int msrvRead(long readerHandle, byte[] buf, String[] outErr);

	/**
	 * Deletes a handle to free associated resources.
	 *
	 * @param handle the handle to delete (interface or reader handle)
	 */
	private native void msrvDeleteHandle(long handle);

	@JavascriptInterface
	public String fetchAPI(String path, String params, String method) {
		Log.d("[msxrv] Native", "path=" + path + " params=" + params + " method=" + method);
		return null;
	}

}
