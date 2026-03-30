package org.msxrv.musicserver;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;

// Keeps the WebView alive in the background as a foreground service.
public class WebViewService extends Service {
	private static final String TAG = "[msxrv] WebViewService";

	@Override
	public void onCreate() {
		super.onCreate();
		Log.d(TAG, "onCreate");
		MusicServerApp app = (MusicServerApp) getApplication();
		startForeground(MusicServerApp.NOTIFICATION_ID, app.buildNotification(null, null, null));
	}

	@Override
	public IBinder onBind(Intent intent) {
		return null;
	}
}
