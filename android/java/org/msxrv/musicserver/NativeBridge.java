package org.msxrv.musicserver;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;
import java.lang.Thread;
import java.util.concurrent.atomic.AtomicReference;

import dalvik.annotation.optimization.FastNative;

public class NativeBridge {
	private static final String TAG = "[msxrv] NativeBridge";
	private Activity activity;
	private long interfaceHandle;
	private final Handler mainHandler = new Handler(Looper.getMainLooper());

	public NativeBridge(MainActivity activity) throws NativeBridgeException {
		this.activity = activity;

		String id = msrvIdentify();
		if (!"musicserver".equals(id)) {
			Log.e(TAG, "msrvIdentify returned: " + id);
			throw new NativeBridgeException("Failed to connect through JNI.");
		}

		JSONObject configJson = new JSONObject();
		try {
			configJson.put("data_path", activity.getMusicDir().toString());
			configJson.put("db_dir", activity.getDbDir().toString());
			configJson.put("cache_db_enabled", false);
		} catch (JSONException e) {
			throw new NativeBridgeException("Failed to create config JSON: " + e.toString());
		}

		String[] outErr = new String[1];
		interfaceHandle = msrvNewInterfaceFromConfigJson(configJson.toString(), outErr);
		if (outErr[0] != null) {
			throw new NativeBridgeException("Failed to create interface: " + outErr[0]);
		}
	}

	public void terminate() {
		if (interfaceHandle != 0) {
			msrvDeleteHandle(interfaceHandle);
			interfaceHandle = 0;
		}
	}

	// Native function handlers

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
	 * Deletes a handle to free associated resources.
	 *
	 * @param handle the handle to delete (interface or reader handle)
	 */
	private native void msrvDeleteHandle(long handle);

	/**
	 * Gets the checksum info for a track from the database.
	 *
	 * @param ifaceHandle the interface handle
	 * @param path        the absolute path to the track file
	 * @param outErr      output array to store error message if any
	 * @return a long array [ckLastModified, ckSize], or null on error
	 */
	private native long[] msrvGetTrackFileChecksumInfo(long ifaceHandle, String path, String[] outErr);

	/**
	 * Loads a track from the given path and adds it to the library.
	 *
	 * @param ifaceHandle the interface handle
	 * @param path        the absolute path to the track file
	 * @param outErr      output array to store error message if any
	 * @return the short ID of the added track, or null on error
	 */
	private native String msrvLoadTrackByPath(long ifaceHandle, String path, String[] outErr);

	/**
	 * Gets all track paths from the database.
	 *
	 * @param ifaceHandle the interface handle
	 * @param outErr      output array to store error message if any
	 * @return an array of paths, or null on error
	 */
	private native String[] msrvGetAllTrackPaths(long ifaceHandle, String[] outErr);

	/**
	 * Removes a track from the database by its path.
	 *
	 * @param ifaceHandle the interface handle
	 * @param path        the absolute path to the track file
	 * @param outErr      output array to store error message if any
	 */
	private native void msrvForgetTrackByPath(long ifaceHandle, String path, String[] outErr);

	public long[] getTrackFileChecksumInfo(String path) {
		String[] outErr = new String[1];
		long[] result = msrvGetTrackFileChecksumInfo(interfaceHandle, path, outErr);

		if (outErr[0] != null) {
			return null;
		}

		return result;
	}

	public String[] getAllTrackPaths() {
		String[] outErr = new String[1];
		String[] paths = msrvGetAllTrackPaths(interfaceHandle, outErr);

		if (outErr[0] != null) {
			Log.e(TAG, "getAllTrackPaths failed: " + outErr[0]);
			return null;
		}

		return paths;
	}

	public void forgetTrackByPath(String path) {
		String[] outErr = new String[1];
		msrvForgetTrackByPath(interfaceHandle, path, outErr);

		if (outErr[0] != null) {
			Log.e(TAG, "forgetTrackByPath failed: " + outErr[0]);
		}
	}

	public String loadTrackByPath(String path) {
		Log.d(TAG, "loadTrackByPath path=" + path);

		String[] outErr = new String[1];
		String shortId = msrvLoadTrackByPath(interfaceHandle, path, outErr);

		if (outErr[0] != null) {
			Log.e(TAG, "loadTrackByPath failed: " + outErr[0]);
			return null;
		}

		return shortId;
	}

	// Javascript interface

	@JavascriptInterface
	public void scanTracks(String path, boolean force) {
		Toast.makeText(activity, "Scan tracks started...", Toast.LENGTH_SHORT).show();
		String musicDir = ((MainActivity) activity).getMusicDir().toString();
		Intent intent = new Intent(activity, ScanTracksService.class);
		intent.putExtra(ScanTracksService.EXTRA_MUSIC_DIR, musicDir);
		intent.putExtra(ScanTracksService.EXTRA_SCAN_PATH, path);
		intent.putExtra(ScanTracksService.EXTRA_FORCE, force);
		activity.startForegroundService(intent);
	}

	@JavascriptInterface
	public String fetchAPI(String encodedPath, String method, String paramsJson) {
		final String path = BridgeUtils.decodeURI(encodedPath);
		Log.d(TAG, "path=" + path + " paramsJson=" + paramsJson + " method=" + method);

		String[] outContentType = new String[1];
		String[] outErr = new String[1];
		long readerHandle = msrvHandleRequest(interfaceHandle, path, method, paramsJson, outContentType, outErr);

		if (outErr[0] != null) {
			Log.e(TAG, "Request failed: " + outErr[0]);
			return null;
		}

		String[] readErr = new String[1];
		byte[] data = msrvReadAll(readerHandle, readErr);

		msrvDeleteHandle(readerHandle);

		if (readErr[0] != null) {
			Log.e(TAG, "Read failed: " + readErr[0]);
			return null;
		}

		return data != null ? new String(data) : null;
	}
}
