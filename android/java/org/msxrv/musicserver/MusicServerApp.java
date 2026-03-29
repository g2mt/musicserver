package org.msxrv.musicserver;

import android.app.Application;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MusicServerApp extends Application {
	private WebView webView;
	private NativeBridge nativeBridge;
	private NativeAudioBridge nativeAudioBridge;

	public WebView getWebView() {
		return webView;
	}

	public NativeBridge getNativeBridge() {
		return nativeBridge;
	}

	public NativeAudioBridge getNativeAudioBridge() {
		return nativeAudioBridge;
	}

	@Override
	public void onCreate() {
		super.onCreate();

		// WebView must be created on the main thread with an Application context
		webView = new WebView(this);
		WebSettings webSettings = webView.getSettings();
		webSettings.setJavaScriptEnabled(true);
		webSettings.setDomStorageEnabled(true);
		webSettings.setDatabaseEnabled(true);
		webSettings.setAlgorithmicDarkeningAllowed(true);
	}

	// Called once MainActivity has set up musicDir/dbDir and is ready to finish init
	public void initBridges(MainActivity activity) {
		if (nativeBridge != null) return;

		try {
			nativeBridge = new NativeBridge(activity);
			webView.addJavascriptInterface(nativeBridge, "_native");
		} catch (NativeBridge.NativeBridgeException e) {
			Log.e("[msxrv] App", "NativeBridge init failed: " + e.getMessage());
			return;
		}

		nativeAudioBridge = new NativeAudioBridge(activity, webView);
		webView.addJavascriptInterface(nativeAudioBridge, "_native_audio_bridge");
	}
}
