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
import android.webkit.WebViewClient;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebMessage;
import android.util.Base64;

public class MainActivity extends Activity {
	private WebView webView;
	public WebView getWebView() {
		return webView;
	}

	private NativeAudioBridge nativeAudioBridge;
	private String musicDir;
	private String dbDir;

	public String getMusicDir() {
		return musicDir;
	}

	public String getDbDir() {
		return dbDir;
	}

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		if (getActionBar() != null) {
			getActionBar().hide();
		}

		setContentView(R.layout.activity_main);
		ScanNotificationPoller.createNotificationChannel(this);

		musicDir = android.os.Environment.getExternalStoragePublicDirectory(
			android.os.Environment.DIRECTORY_MUSIC).getAbsolutePath();
		Log.e("[msxrv] Native", "Setting musicDir = " + musicDir);

		dbDir = getExternalFilesDir(
			android.os.Environment.DIRECTORY_DOCUMENTS).getAbsolutePath();
		Log.e("[msxrv] Native", "Setting dbDir = " + dbDir);

		webView = (WebView)findViewById(R.id.webview);
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

		NativeBridge nativeBridge;
		try {
			nativeBridge = new NativeBridge(this);
			webView.addJavascriptInterface(nativeBridge, "_native");
		} catch (NativeBridge.NativeBridgeException e) {
			showErrorDialog(e.getMessage() + "\nQuit?");
			return;
		}
		final NativeBridge finalNativeBridge = nativeBridge;

		nativeBridge.setScanCompleteListener(() ->
			webView.post(() ->
				webView.evaluateJavascript("window._refreshSearch()", null)));

		nativeAudioBridge = new NativeAudioBridge(this);
		webView.addJavascriptInterface(nativeAudioBridge, "_native_audio_bridge");

		webView.setWebViewClient(new WebViewClient() {
			@Override
			public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
				String url = request.getUrl().toString();
				if (url.startsWith("track-cover://")) {
					String id = request.getUrl().getHost();
					String[] outContentType = new String[1];
					byte[] data = finalNativeBridge.getTrackCover(id, outContentType);
					String mimeType = outContentType[0] != null ? outContentType[0] : "image/png";
					Log.d("[msxrv] cover", "cover for id=" + id + ", mimeType=" + mimeType + ", bytes=" + data.length);
					return new WebResourceResponse(
						mimeType,
						"binary",
						new java.io.ByteArrayInputStream(data)
					);
				}
				return super.shouldInterceptRequest(view, request);
			}

			@Override
			public void onPageFinished(WebView view, String url) {
				// Create a WebMessageChannel once the WebView has started loading.
				// channel[0] stays on the Java side (given to NativeAudioBridge),
				// channel[1] is transferred to the JS side via postWebMessage.
				WebMessagePort[] channel = webView.createWebMessageChannel();
				nativeAudioBridge.setMessagePort(channel[0]);

				webView.postWebMessage(
					new WebMessage("_audio_port", new WebMessagePort[]{channel[1]}),
					android.net.Uri.parse("*")
				);
			}
		});

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
			if (checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE)
					!= PackageManager.PERMISSION_GRANTED) {
				requestPermissions(
					new String[]{android.Manifest.permission.READ_EXTERNAL_STORAGE},
					1);
			} else {
				loadWebView();
			}
		}

		requestPermissions(
			new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
			2);
	}

	@Override
	public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
		super.onRequestPermissionsResult(requestCode, permissions, grantResults);
		if (requestCode == 1) {
			loadWebView();
		}
	}

	private void loadWebView() {
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
