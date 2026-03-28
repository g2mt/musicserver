package org.msxrv.musicserver;

import android.util.Log;
import android.webkit.JavascriptInterface;

public class NativeBridge {
	static {
		System.loadLibrary("musicserver");
		System.loadLibrary("musicserverbind");
	}

	public native String getMessage();

	@JavascriptInterface
	public String fetchAPI(String path, String params, String method) {
		Log.d("[msxrv] Native", "path=" + path + " params=" + params + " method=" + method);
		return null;
	}
}
