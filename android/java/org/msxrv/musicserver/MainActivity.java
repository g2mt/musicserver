package org.msxrv.musicserver;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;

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

		WebView webView = (WebView)findViewById(R.id.my_webview);
		webView.loadUrl("file:///android_asset/index.html");
	}
}
