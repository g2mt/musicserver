package org.msxrv.musicserver;

import android.app.Activity;
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
	private Activity activity;
	private long interfaceHandle;
	private final Handler mainHandler = new Handler(Looper.getMainLooper());

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
	 * Deletes a handle to free associated resources.
	 *
	 * @param handle the handle to delete (interface or reader handle)
	 */
	private native void msrvDeleteHandle(long handle);

	/**
	 * Loads a track from the given path and adds it to the library.
	 *
	 * @param ifaceHandle the interface handle
	 * @param path        the absolute path to the track file
	 * @param outErr      output array to store error message if any
	 * @return the short ID of the added track, or null on error
	 */
	private native String msrvLoadTrackByPath(long ifaceHandle, String path, String[] outErr);

	private String decodeURI(String encodedURI) {
		if (encodedURI == null) {
			return null;
		}

		StringBuilder result = new StringBuilder();
		int i = 0;

		while (i < encodedURI.length()) {
			char c = encodedURI.charAt(i);

			if (c != '%') {
				result.append(c);
				i++;
				continue;
			}

			// We have an escape sequence
			if (i + 2 >= encodedURI.length()) {
				throw new RuntimeException("URIError: Incomplete escape sequence");
			}

			int digit1 = Character.digit(encodedURI.charAt(i + 1), 16);
			int digit2 = Character.digit(encodedURI.charAt(i + 2), 16);

			if (digit1 == -1 || digit2 == -1) {
				throw new RuntimeException("URIError: Invalid escape sequence");
			}

			int firstByte = (digit1 << 4) | digit2;
			int numBytes;

			if ((firstByte & 0x80) == 0) {
				// 1-byte sequence (ASCII)
				numBytes = 1;
			} else if ((firstByte & 0xE0) == 0xC0) {
				// 2-byte sequence
				numBytes = 2;
			} else if ((firstByte & 0xF0) == 0xE0) {
				// 3-byte sequence
				numBytes = 3;
			} else if ((firstByte & 0xF8) == 0xF0) {
				// 4-byte sequence
				numBytes = 4;
			} else {
				throw new RuntimeException("URIError: Invalid UTF-8 leading byte");
			}

			if (i + (numBytes * 3) - 1 >= encodedURI.length()) {
				throw new RuntimeException("URIError: Incomplete multi-byte sequence");
			}

			int[] bytes = new int[numBytes];
			bytes[0] = firstByte;

			for (int j = 1; j < numBytes; j++) {
				if (encodedURI.charAt(i + j * 3) != '%') {
					throw new RuntimeException("URIError: Expected escape sequence");
				}

				int d1 = Character.digit(encodedURI.charAt(i + j * 3 + 1), 16);
				int d2 = Character.digit(encodedURI.charAt(i + j * 3 + 2), 16);

				if (d1 == -1 || d2 == -1) {
					throw new RuntimeException("URIError: Invalid escape sequence");
				}

				bytes[j] = (d1 << 4) | d2;
			}

			// Convert bytes to character
			char decodedChar;
			if (numBytes == 1) {
				decodedChar = (char) bytes[0];
			} else if (numBytes == 2) {
				decodedChar = (char) ((bytes[0] & 0x1F) << 6 | (bytes[1] & 0x3F));
			} else if (numBytes == 3) {
				decodedChar = (char) ((bytes[0] & 0x0F) << 12 | (bytes[1] & 0x3F) << 6 | (bytes[2] & 0x3F));
			} else {
				decodedChar = (char) ((bytes[0] & 0x07) << 18 | (bytes[1] & 0x3F) << 12 | (bytes[2] & 0x3F) << 6 | (bytes[3] & 0x3F));
			}

			result.append(decodedChar);
			i += numBytes * 3;
		}

		return result.toString();
	}

	@JavascriptInterface
	public void scanTracks() {
		// TODO
	}

	@JavascriptInterface
	public String loadTrackByPath(String path) {
		Log.d("[msxrv] Native", "loadTrackByPath path=" + path);

		String[] outErr = new String[1];
		String shortId = msrvLoadTrackByPath(interfaceHandle, path, outErr);

		if (outErr[0] != null) {
			Log.e("[msxrv] Native", "loadTrackByPath failed: " + outErr[0]);
			return null;
		}

		return shortId;
	}

	@JavascriptInterface
	public String fetchAPI(String encodedPath, String method, String paramsJson) {
		final String path = decodeURI(encodedPath);
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
