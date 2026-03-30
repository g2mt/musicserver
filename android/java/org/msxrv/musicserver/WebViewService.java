package org.msxrv.musicserver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.IBinder;
import android.util.Log;

// Keeps the WebView alive in the background as a foreground service.
public class WebViewService extends Service {
	private static final String CHANNEL_ID = "webview_service";
	private static final int NOTIFICATION_ID = 100;
	private static final String ACTION_QUIT = "org.msxrv.musicserver.ACTION_QUIT";

	private final BroadcastReceiver quitReceiver = new BroadcastReceiver() {
		@Override
		public void onReceive(Context context, Intent intent) {
			if (ACTION_QUIT.equals(intent.getAction())) {
				Log.d("[msxrv] WebViewService", "Quit action received");
				stopSelf();
				Intent quitIntent = new Intent(context, MainActivity.class);
				quitIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
				quitIntent.putExtra("quit", true);
				startActivity(quitIntent);
			}
		}
	};

	@Override
	public void onCreate() {
		super.onCreate();
		Log.d("[msxrv] WebViewService", "onCreate");
		registerReceiver(quitReceiver, new IntentFilter(ACTION_QUIT), Context.RECEIVER_NOT_EXPORTED);
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
		unregisterReceiver(quitReceiver);
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

		Intent quitIntent = new Intent(ACTION_QUIT);
		quitIntent.setPackage(getPackageName());
		PendingIntent quitPendingIntent = PendingIntent.getBroadcast(
			this, 0, quitIntent, PendingIntent.FLAG_IMMUTABLE);

		return new Notification.Builder(this, CHANNEL_ID)
			.setContentTitle("Music Server")
			.setContentText("Running in background")
			.setSmallIcon(android.R.drawable.ic_media_play)
			.setContentIntent(pendingIntent)
			.setOngoing(true)
			.addAction(android.R.drawable.ic_delete, "Quit", quitPendingIntent)
			.build();
	}
}
