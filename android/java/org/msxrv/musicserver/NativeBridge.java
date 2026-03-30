package org.msxrv.musicserver;

import android.app.Activity;
import android.util.Log;
import android.webkit.JavascriptInterface;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

import dalvik.annotation.optimization.FastNative;

public class NativeBridge {
	private Activity activity;
	private long interfaceHandle;

	public NativeBridge(MainActivity activity) throws NativeBridgeException {
		this.activity = activity;

		String id = msrvIdentify();
		if (!"musicserver".equals(id)) {
			Log.e("[msxrv] Native", "msrvIdentify returned: " + id);
			throw new NativeBridgeException("Failed to connect through JNI.");
		}

		JSONObject configJson = new JSONObject();
		try {
			configJson.put("data_path", activity.getMusicDir());
			configJson.put("db_dir", activity.getDbDir());
		} catch (JSONException e) {
			throw new NativeBridgeException("Failed to create config JSON: " + e.toString());
		}

		String[] outErr = new String[1];
		interfaceHandle = msrvNewInterfaceFromConfigJson(configJson.toString(), outErr);
		if (outErr[0] != null) {
			throw new NativeBridgeException("Failed to create interface: " + outErr[0]);
		}
	}

	/**
	 * Exception thrown when NativeBridge initialization fails.
	 */
	public static class NativeBridgeException extends Exception {
		public NativeBridgeException(String message) {
			super(message);
		}
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
	 * @param configJson the configuration as a JSON string
	 * @param outErr     output array to store error message if any
	 * @return the interface handle, or 0 on error
	 */
	private native long msrvNewInterfaceFromConfigJson(
		String configJson,
		String[] outErr);

	/**
	 * Handles an HTTP request to the given path.
	 *
	 * @param ifaceHandle      the interface handle
	 * @param path             the request path
	 * @param method           the HTTP method (GET, POST, etc.)
	 * @param paramsJson       the parameters as a JSON string
	 * @param outContentType   output array to store the response content type
	 * @param outErr           output array to store error message if any
	 * @return the reader handle for reading the response, or 0 on error
	 */
	private native long msrvHandleRequest(
		long ifaceHandle,
		String path,
		String method,
		String paramsJson,
		String[] outContentType,
		String[] outErr);

	/**
	 * Reads all bytes from a reader handle.
	 *
	 * @param readerHandle the reader handle obtained from handleRequest
	 * @param outErr       output array to store error message if any
	 * @return the bytes read, or null on error
	 */
	@FastNative
	private native byte[] msrvReadAll(long readerHandle, String[] outErr);


	/**
	 * Starts a scan of tracks in the background.
	 *
	 * @param ifaceHandle the interface handle
	 */
	private native void msrvStartScanTracks(long ifaceHandle);

	/**
	 * Deletes a handle to free associated resources.
	 *
	 * @param handle the handle to delete (interface or reader handle)
	 */
	private native void msrvDeleteHandle(long handle);

	/**
	 * Returns the current scan ticker state.
	 *
	 * @param ifaceHandle the interface handle
	 * @return a ScanTickerValues object
	 */
	private native ScanTickerValues msrvGetScanTickerValues(long ifaceHandle);

	public static class ScanTickerValues {
		public final boolean present;
		public final int value;
		public final int maxValue;

		public ScanTickerValues(boolean present, int value, int maxValue) {
			this.present = present;
			this.value = value;
			this.maxValue = maxValue;
		}
	}


	public ScanTickerValues getScanTickerValues() {
		return msrvGetScanTickerValues(interfaceHandle);
	}

	@JavascriptInterface
	public void scanTracks() {
		Log.d("[msxrv] Native", "scanTracks called");
		msrvStartScanTracks(interfaceHandle);
		new ScanTracksPoller(activity, this);
	}

	@JavascriptInterface
	public String fetchAPI(String path, String method, String paramsJson) {
		Log.d("[msxrv] Native", "path=" + path + " paramsJson=" + paramsJson + " method=" + method);

		String[] outContentType = new String[1];
		String[] outErr = new String[1];
		long readerHandle = msrvHandleRequest(interfaceHandle, path, method, paramsJson, outContentType, outErr);

		if (outErr[0] != null) {
			Log.e("[msxrv] Native", "Request failed: " + outErr[0]);
			return null;
		}

		String[] readErr = new String[1];
		byte[] data = msrvReadAll(readerHandle, readErr);

		msrvDeleteHandle(readerHandle);

		if (readErr[0] != null) {
			Log.e("[msxrv] Native", "Read failed: " + readErr[0]);
			return null;
		}

		return data != null ? new String(data) : null;
	}

}
