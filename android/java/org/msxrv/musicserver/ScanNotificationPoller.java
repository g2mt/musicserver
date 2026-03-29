package org.msxrv.musicserver;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

public class ScanNotificationPoller {
	private static final String CHANNEL_ID = "msxrv_scan";
	private static final int NOTIFICATION_ID = 1;
	private static final long POLL_INTERVAL_MS = 1000;

	private final Activity activity;
	private final NativeBridge bridge;
	private final NotificationManager notificationManager;
	private final Handler handler;
	private final Runnable pollRunnable;

	private static final int PERMISSION_REQUEST_CODE = 1001;

	public ScanNotificationPoller(Activity activity, NativeBridge bridge) {
		this.activity = activity;
		this.bridge = bridge;

		Log.d("[msxrv] ScanTickerValues", "starting ScanNotificationPoller");

		this.notificationManager =
			(NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
		this.handler = new Handler(Looper.getMainLooper());

		pollRunnable = new Runnable() {
			private boolean wasScanning = false;

			@Override
			public void run() {
				Log.d("[msxrv] ScanTickerValues", "polling ticker values");
				NativeBridge.ScanTickerValues vals = bridge.getScanTickerValues();
				if (!vals.present) {
					if (wasScanning) {
						postOneTimeNotification("Scan complete", "Music library scan has finished.");
						wasScanning = false;
					}
					notificationManager.cancel(NOTIFICATION_ID);
					return;
				}
				if (!wasScanning) {
					postOneTimeNotification("Scan started", "Scanning your music library...");
					wasScanning = true;
				}
				postNotification(vals.value, vals.maxValue);
				handler.postDelayed(this, POLL_INTERVAL_MS);
			}
		};
		handler.post(pollRunnable);
	}

	public static void createNotificationChannel(Activity activity) {
		NotificationManager notificationManager =
			(NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
		NotificationChannel channel = new NotificationChannel(
			CHANNEL_ID,
			"Music Scan",
			NotificationManager.IMPORTANCE_DEFAULT
		);
		channel.setDescription("Shows progress while scanning for music");
		notificationManager.createNotificationChannel(channel);
	}

	private void postOneTimeNotification(String title, String text) {
		Notification.Builder builder = new Notification.Builder(activity, CHANNEL_ID)
			.setSmallIcon(android.R.drawable.ic_media_play)
			.setContentTitle(title)
			.setContentText(text)
			.setAutoCancel(true);
		notificationManager.notify(NOTIFICATION_ID + 1, builder.build());
	}

	private void postNotification(int value, int maxValue) {
		Notification.Builder builder = new Notification.Builder(activity, CHANNEL_ID)
			.setSmallIcon(android.R.drawable.ic_media_play)
			.setContentTitle("Scanning music library")
			.setOngoing(true)
			.setOnlyAlertOnce(true);

		if (maxValue > 0) {
			builder.setContentText(value + " / " + maxValue)
				   .setProgress(maxValue, value, false);
		} else {
			builder.setContentText("Scanning...")
				   .setProgress(0, 0, true);
		}

		notificationManager.notify(NOTIFICATION_ID, builder.build());
	}
}
