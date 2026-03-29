package org.msxrv.musicserver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;

// Keeps the WebView alive in the background as a foreground service.
public class WebViewService extends Service {
	private static final String CHANNEL_ID = "webview_service";
	private static final int NOTIFICATION_ID = 100;

	@Override
	public void onCreate() {
		super.onCreate();
		Log.d("[msxrv] WebViewService", "onCreate");
		createNotificationChannel();
		startForeground(NOTIFICATION_ID, buildNotification());
	}

	@Override
	public int onStartCommand(Intent intent, int flags, int startId) {
		Log.d("[msxrv] WebViewService", "onStartCommand");
		return START_STICKY;
	}

	@Override
	public void onDestroy() {
		super.onDestroy();
		Log.d("[msxrv] WebViewService", "onDestroy");
	}

	@Override
	public IBinder onBind(Intent intent) {
		return null;
	}

	private void createNotificationChannel() {
		NotificationChannel channel = new NotificationChannel(
			CHANNEL_ID,
			"Music Server",
			NotificationManager.IMPORTANCE_LOW
		);
		channel.setDescription("Keeps music playback running in the background");
		NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
		nm.createNotificationChannel(channel);
	}

	private Notification buildNotification() {
		Intent launchIntent = new Intent(this, MainActivity.class);
		launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
		PendingIntent pendingIntent = PendingIntent.getActivity(
			this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE);

		return new Notification.Builder(this, CHANNEL_ID)
			.setContentTitle("Music Server")
			.setContentText("Running in background")
			.setSmallIcon(android.R.drawable.ic_media_play)
			.setContentIntent(pendingIntent)
			.setOngoing(true)
			.build();
	}
}
