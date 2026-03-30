package org.msxrv.musicserver;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;

// Keeps the WebView alive in the background as a foreground service.
public class WebViewService extends Service {
	private static final String TAG = "[msxrv] WebViewService";
	private static final int NOTIFICATION_ID = 100;

	@Override
	public void onCreate() {
		super.onCreate();
		Log.d(TAG, "onCreate");
		MusicServerApp app = (MusicServerApp) getApplication();
		startForeground(NOTIFICATION_ID, app.buildForegroundNotification());
	}

	@Override
	public int onStartCommand(Intent intent, int flags, int startId) {
		Log.d(TAG, "onStartCommand");
		return START_STICKY;
	}

	@Override
	public void onDestroy() {
		super.onDestroy();
		Log.d(TAG, "onDestroy");
	}

	@Override
	public IBinder onBind(Intent intent) {
		return null;
	}
}
