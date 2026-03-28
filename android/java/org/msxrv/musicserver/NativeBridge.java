package org.msxrv.musicserver;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.util.Log;
import android.webkit.JavascriptInterface;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

public class NativeBridge {
	static {
		System.loadLibrary("musicserver");
		System.loadLibrary("musicserverbind");
	}

	private Activity activity;
	private long interfaceHandle;

	public NativeBridge(Activity activity) {
		this.activity = activity;
		String id = msrvIdentify();
		if (!"musicserver".equals(id)) {
			Log.e("[msxrv] Native", "msrvIdentify returned: " + id);
			new AlertDialog.Builder(activity)
				.setMessage("Failed to connect through JNI. Quit?")
				.setPositiveButton(android.R.string.yes, new DialogInterface.OnClickListener() {
					@Override
					public void onClick(DialogInterface dialog, int which) {
						activity.finish();
					}
				})
				.setNegativeButton(android.R.string.no, null)
				.show();
		}

		String[] outErr = new String[1];
		interfaceHandle = 0; // TODO: call msrvNewInterfaceFromConfigJson(...);
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

		// Parse params JSON
		String[] keys = new String[0];
		String[] values = new String[0];
		try {
			JSONObject jsonParams = new JSONObject(params);
			int len = jsonParams.length();
			keys = new String[len];
			values = new String[len];
			int i = 0;
			for (Iterator<String> it = jsonParams.keys(); it.hasNext(); ) {
				String key = it.next();
				keys[i] = key;
				values[i] = jsonParams.getString(key);
				i++;
			}
		} catch (JSONException e) {
			Log.e("[msxrv] Native", "Failed to parse params", e);
		}

		String[] outContentType = new String[1];
		String[] outErr = new String[1];
		long readerHandle = msrvHandleRequest(interfaceHandle, path, method, keys, values, outContentType, outErr);

		if (outErr[0] != null) {
			Log.e("[msxrv] Native", "Request failed: " + outErr[0]);
			return null;
		}

		// Read all content from the reader
		StringBuilder content = new StringBuilder();
		byte[] buffer = new byte[4096];

		while (true) {
			String[] readErr = new String[1];
			int bytesRead = msrvRead(readerHandle, buffer, readErr);

			if (readErr[0] != null) {
				Log.e("[msxrv] Native", "Read failed: " + readErr[0]);
				break;
			}

			if (bytesRead <= 0) {
				break;
			}

			content.append(new String(buffer, 0, bytesRead));
		}

		msrvDeleteHandle(readerHandle);

		return content.toString();
	}

}
