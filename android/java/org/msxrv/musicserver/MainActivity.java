package org.msxrv.musicserver;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebSettings;

public class MainActivity extends Activity {
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		if (getActionBar() != null) {
			getActionBar().hide();
		}

		setContentView(R.layout.activity_main);

		WebView webView = (WebView)findViewById(R.id.webview);
		WebSettings webSettings = webView.getSettings();
		webSettings.setJavaScriptEnabled(true);
		webSettings.setDomStorageEnabled(true);
		webSettings.setDatabaseEnabled(true);
		webSettings.setAlgorithmicDarkeningAllowed(true);
		webView.setWebChromeClient(new WebChromeClient() {
			@Override
			public boolean onConsoleMessage(ConsoleMessage msg) {
				Log.d("[msxrv] WebView", msg.message() + " (line " + msg.lineNumber() + ", " + msg.sourceId() + ")");
				return true;
			}
		});

		try {
			NativeBridge nativeBridge = new NativeBridge(this);
			webView.addJavascriptInterface(nativeBridge, "_native");

			NativeAudioBridge nativeAudioBridge = new NativeAudioBridge(this, webView);
			webView.addJavascriptInterface(nativeAudioBridge, "_native_audio_bridge");
		} catch (NativeBridge.NativeBridgeException e) {
			showErrorDialog(e.getMessage() + "\nQuit?");
		}

		requestPermissions();
	}

	private void requestPermissions() {
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
			if (checkSelfPermission(android.Manifest.permission.READ_MEDIA_AUDIO)
					!= PackageManager.PERMISSION_GRANTED) {
				requestPermissions(
					new String[]{android.Manifest.permission.READ_MEDIA_AUDIO},
					1);
			} else {
				loadWebView();
			}
		} else {
			loadWebView();
		}
	}

	@Override
	public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
		super.onRequestPermissionsResult(requestCode, permissions, grantResults);
		loadWebView();
	}

	private void loadWebView() {
		WebView webView = (WebView)findViewById(R.id.webview);
		webView.loadUrl("file:///android_asset/index.html");
	}

	private void showErrorDialog(String message) {
		new AlertDialog.Builder(this)
			.setMessage(message)
			.setPositiveButton(android.R.string.yes, new DialogInterface.OnClickListener() {
				@Override
				public void onClick(DialogInterface dialog, int which) {
					finish();
				}
			})
			.setNegativeButton(android.R.string.no, null)
			.show();
	}
}
