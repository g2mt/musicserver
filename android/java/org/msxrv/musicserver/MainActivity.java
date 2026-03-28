package org.msxrv.musicserver;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

public class MainActivity extends Activity {
	static {
		System.loadLibrary("musicserver");
		System.loadLibrary("musicserverbind");
	}

	public native String getMessage();

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.activity_main);

		WebView webView = (WebView)findViewById(R.id.webview);
		webView.getSettings().setJavaScriptEnabled(true);
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
				if (url.endsWith(".js")) {
					Log.d("[msxrv] WebView", "Intercepted JS request: " + url);
				} else if (url.endsWith(".css")) {
					Log.d("[msxrv] WebView", "Intercepted CSS request: " + url);
				}
				return super.shouldInterceptRequest(view, request);
			}
		});
		webView.loadUrl("file:///android_asset/index.html");
	}
}
