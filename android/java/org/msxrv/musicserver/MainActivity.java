package org.msxrv.musicserver;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.content.pm.PackageManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebViewClient;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebMessage;
import android.widget.LinearLayout;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.function.Consumer;

public class MainActivity extends Activity {
	private static final String TAG = "[msxrv] MainActivity";
	static {
		System.loadLibrary("musicserver");
		System.loadLibrary("musicserverbind");
	}

	private Path musicDir;
	public Path getMusicDir() {
		return musicDir;
	}

	private Path dbDir;
	public Path getDbDir() {
		return dbDir;
	}

	public MusicServerApp getApp() {
		return (MusicServerApp) getApplication();
	}

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		if (getIntent().getBooleanExtra("quit", false)) {
			finishAndRemoveTask();
			return;
		}

		if (getActionBar() != null) {
			getActionBar().hide();
		}

		setContentView(R.layout.activity_main);

		musicDir = android.os.Environment.getExternalStoragePublicDirectory(
			android.os.Environment.DIRECTORY_MUSIC).toPath().toAbsolutePath();
		Log.e(TAG, "Setting musicDir = " + musicDir);

		dbDir = getExternalFilesDir(
			android.os.Environment.DIRECTORY_DOCUMENTS).toPath().toAbsolutePath();
		Log.e(TAG, "Setting dbDir = " + dbDir);

		// Finish initializing bridges now that we have an Activity context for paths
		getApp().initBridges(this);

		NativeBridge nativeBridge = getApp().getNativeBridge();
		NativeAudioBridge nativeAudioBridge = getApp().getNativeAudioBridge();
		if (nativeBridge == null || nativeAudioBridge == null) {
			new AlertDialog.Builder(this)
				.setMessage("Failed to initialize native bridge.\nQuit?")
				.setPositiveButton(android.R.string.yes, new DialogInterface.OnClickListener() {
					@Override
					public void onClick(DialogInterface dialog, int which) {
						finish();
					}
				})
				.setNegativeButton(android.R.string.no, null)
				.show();
			return;
		}

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
					byte[] data = TrackUtils.getTrackCover(filepath, outContentType);
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

		});

		// Start the background service to keep the WebView alive
		startForegroundService(new Intent(this, WebViewService.class));

		requestAllPermissions();
	}

	@Override
	protected void onNewIntent(Intent intent) {
		super.onNewIntent(intent);
		if (intent.getBooleanExtra("quit", false)) {
			finishAndRemoveTask();
		}
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

	@Override
	public void onBackPressed() {
		WebView webView = getApp().getWebView();
		if (webView != null && webView.canGoBack()) {
			webView.goBack();
		} else {
			super.onBackPressed();
		}
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

		webView.evaluateJavascript("window._reloadFromSuspend()", null);
	}

	// Detaches the shared WebView from this Activity's layout so it can survive in the service
	private void detachWebView() {
		WebView webView = getApp().getWebView();
		if (webView == null) return;

		// After evaluation, the JS side will call NativeAudioBridge's saveTrackQueue
		webView.evaluateJavascript("window._requestSaveTrackQueue()", null);

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

	private ArrayList<Consumer<RequestPermissionResult>> enqueuedPermissionHandlers = new ArrayList<>();
	private void addPermissionHandler(Consumer<RequestPermissionResult> c) {
		enqueuedPermissionHandlers.add(c);
	}

	private void requestAllPermissions() {
		Log.d("[msxrv]", "requestAllPermissions");
		requestPermissions(
			new String[]{android.Manifest.permission.MANAGE_EXTERNAL_STORAGE},
			0);
		addPermissionHandler(result -> {
			if (result.grantResults[0] == PackageManager.PERMISSION_DENIED) {
				requestPermissions(
					new String[]{
						android.Manifest.permission.READ_MEDIA_AUDIO,
						android.Manifest.permission.READ_MEDIA_IMAGES,
						android.Manifest.permission.READ_MEDIA_VIDEO,
					},
					0);
			} else {
				runNextPermissionHandler(result);
			}
		});
		addPermissionHandler(result -> {
			requestPermissions(
				new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
				0);
		});
		addPermissionHandler(result -> {
			getApp().loadWebView();
		});
	}

	private void runNextPermissionHandler(RequestPermissionResult result) {
		if (enqueuedPermissionHandlers.size() > 0) {
			Consumer<RequestPermissionResult> c = enqueuedPermissionHandlers.get(0);
			c.accept(result);
			enqueuedPermissionHandlers.remove(0);
		}
	}

	@Override
	public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
		super.onRequestPermissionsResult(requestCode, permissions, grantResults);
		if (requestCode != 0) {
			throw new Error("Unexpected requestCode=" + requestCode);
		}
		runNextPermissionHandler(new RequestPermissionResult(requestCode, permissions, grantResults));
	}
}
