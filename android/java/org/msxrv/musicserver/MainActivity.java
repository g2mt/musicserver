package org.msxrv.musicserver;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebViewClient;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebMessage;
import android.widget.LinearLayout;
import java.util.ArrayList;
import java.util.function.Consumer;

public class MainActivity extends Activity {
	static {
		System.loadLibrary("musicserver");
		System.loadLibrary("musicserverbind");
	}

	private String musicDir;
	public String getMusicDir() {
		return musicDir;
	}

	private String dbDir;
	public String getDbDir() {
		return dbDir;
	}

	private MusicServerApp getApp() {
		return (MusicServerApp) getApplication();
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

		// Finish initializing bridges now that we have an Activity context for paths
		getApp().initBridges(this);

		NativeBridge nativeBridge = getApp().getNativeBridge();
		if (nativeBridge == null) {
			showErrorDialog("Failed to initialize native bridge.\nQuit?");
			return;
		}

		NativeAudioBridge nativeAudioBridge = getApp().getNativeAudioBridge();

		nativeBridge.setScanCompleteListener(() -> {
			WebView wv = getApp().getWebView();
			wv.post(() -> wv.evaluateJavascript("window._refreshSearch()", null));
		});

		WebView webView = getApp().getWebView();

		webView.setWebChromeClient(new WebChromeClient() {
			@Override
			public boolean onConsoleMessage(ConsoleMessage msg) {
				Log.d("[msxrv] WebView", msg.message() + " (line " + msg.lineNumber() + ", " + msg.sourceId() + ")");
				return true;
			}
		});

		webView.setWebViewClient(new WebViewClient() {
			@Override
			public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
				String url = request.getUrl().toString();
				if (url.startsWith("track-cover://")) {
					String filepath = request.getUrl().getPath();
					String[] outContentType = new String[1];
					byte[] data = nativeBridge.getTrackCover(filepath, outContentType);
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
				WebMessagePort[] channel = webView.createWebMessageChannel();
				nativeAudioBridge.setMessagePort(channel[0]);
				webView.postWebMessage(
					new WebMessage("_audio_port", new WebMessagePort[]{channel[1]}),
					android.net.Uri.parse("*")
				);
			}
		});

		// Start the background service to keep the WebView alive
		startForegroundService(new Intent(this, WebViewService.class));

		requestAllPermissions();
	}

	@Override
	protected void onResume() {
		super.onResume();
		attachWebView();
	}

	@Override
	protected void onPause() {
		super.onPause();
		detachWebView();
	}

	// Attaches the shared WebView into this Activity's container
	private void attachWebView() {
		WebView webView = getApp().getWebView();
		if (webView == null) return;

		ViewGroup parent = (ViewGroup) webView.getParent();
		if (parent != null) {
			parent.removeView(webView);
		}

		LinearLayout container = findViewById(R.id.webview_container);
		if (container != null) {
			container.addView(webView, new LinearLayout.LayoutParams(
				LinearLayout.LayoutParams.MATCH_PARENT,
				LinearLayout.LayoutParams.MATCH_PARENT
			));
		}
	}

	// Detaches the shared WebView from this Activity's layout so it can survive in the service
	private void detachWebView() {
		WebView webView = getApp().getWebView();
		if (webView == null) return;

		ViewGroup parent = (ViewGroup) webView.getParent();
		if (parent != null) {
			parent.removeView(webView);
		}
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
			getApp().loadWebView();
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
