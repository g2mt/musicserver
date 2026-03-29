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
import java.util.ArrayList;
import java.util.function.Consumer;

public class MainActivity extends Activity {
	static {
		System.loadLibrary("musicserver");
		System.loadLibrary("musicserverbind");
	}

	private WebView webView;
	public WebView getWebView() {
		return webView;
	}

	private NativeBridge nativeBridge;
	public NativeBridge getNativeBridge() {
		return nativeBridge;
	}

	private NativeAudioBridge nativeAudioBridge;

	private String musicDir;
	public String getMusicDir() {
		return musicDir;
	}

	private String dbDir;
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
					// URL is track-cover:///absolute/path/to/file.mp3
					String filepath = request.getUrl().getPath();
					String[] outContentType = new String[1];
					byte[] data = finalNativeBridge.getTrackCover(filepath, outContentType);
					String mimeType = outContentType[0] != null ? outContentType[0] : "image/png";
					Log.d("[msxrv] cover", "cover for path=" + filepath + ", mimeType=" + mimeType + ", bytes=" + data.length);
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

		requestAllPermissions();
	}

	// Permissions

	public class RequestPermissionResult {
			public int requestCode;
			public String[] permissions;
			public int[] grantResults;

			public RequestPermissionResult(
					int requestCode,
					String[] permissions,
					int[] grantResults
			) {
					this.requestCode = requestCode;
					this.permissions = permissions;
					this.grantResults = grantResults;
			}
	}

	private ArrayList<Consumer<RequestPermissionResult>> enqueuedPermissionRequests = new ArrayList<>();
	private void addPermissionRequest(Consumer<RequestPermissionResult> c) {
		enqueuedPermissionRequests.add(c);
	}

	private void requestAllPermissions() {
		requestPermissions(
			new String[]{android.Manifest.permission.READ_MEDIA_AUDIO},
			0);
		addPermissionRequest(result -> {
			requestPermissions(
				new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
				0);
		});
		addPermissionRequest(result -> {
			loadWebView();
		});
	}

	@Override
	public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
		super.onRequestPermissionsResult(requestCode, permissions, grantResults);
		if (requestCode != 0) {
			throw new Error("Unexpected requestCode=" + requestCode);
		}
		if (enqueuedPermissionRequests.size() > 0) {
			Consumer<RequestPermissionResult> c = enqueuedPermissionRequests.get(0);
			c.accept(new RequestPermissionResult(requestCode, permissions, grantResults));
			enqueuedPermissionRequests.remove(0);
		}
	}

	// Web view

	private void loadWebView() {
		webView.loadUrl("file:///android_asset/index.html");
	}

	// Dialogs

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
