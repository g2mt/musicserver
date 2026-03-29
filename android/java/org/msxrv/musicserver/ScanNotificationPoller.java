package org.msxrv.musicserver;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;

public class ScanNotificationPoller {
	private static final String CHANNEL_ID = "msxrv_scan";
	private static final int NOTIFICATION_ID = 1;
	private static final long POLL_INTERVAL_MS = 1000;

	private final Activity activity;
	private final NativeBridge bridge;
	private final NotificationManager notificationManager;
	private final Handler handler;
	private final Runnable pollRunnable;

	public ScanNotificationPoller(Activity activity, NativeBridge bridge) {
		this.activity = activity;
		this.bridge = bridge;
		this.notificationManager =
			(NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
		this.handler = new Handler(Looper.getMainLooper());

		NotificationChannel channel = new NotificationChannel(
			CHANNEL_ID,
			"Music Scan",
			NotificationManager.IMPORTANCE_LOW
		);
		channel.setDescription("Shows progress while scanning for music");
		notificationManager.createNotificationChannel(channel);

		pollRunnable = new Runnable() {
			@Override
			public void run() {
				NativeBridge.ScanTickerValues vals = bridge.getScanTickerValues();
				if (!vals.present) {
					notificationManager.cancel(NOTIFICATION_ID);
					return;
				}
				postNotification(vals.value, vals.maxValue);
				handler.postDelayed(this, POLL_INTERVAL_MS);
			}
		};
		handler.post(pollRunnable);
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
