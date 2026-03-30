package org.msxrv.musicserver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public class ScanTracksService extends Service {
	private static final String TAG = "[msxrv] ScanTracksService";
	private static final String CHANNEL_ID = "msxrv_scan";
	private static final int NOTIFICATION_ID = 1;
	private static final int COMPLETE_NOTIFICATION_ID = 2;

	public static final String EXTRA_MUSIC_DIR = "music_dir";

	private static final AtomicBoolean isRunning = new AtomicBoolean(false);

	private NotificationManager notificationManager;

	@Override
	public void onCreate() {
		super.onCreate();
		notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
		NotificationChannel channel = new NotificationChannel(
			CHANNEL_ID,
			"Music Scan",
			NotificationManager.IMPORTANCE_LOW
		);
		channel.setDescription("Shows progress while scanning for music");
		notificationManager.createNotificationChannel(channel);
	}

	@Override
	public int onStartCommand(Intent intent, int flags, int startId) {
		String musicDir = intent != null ? intent.getStringExtra(EXTRA_MUSIC_DIR) : null;
		if (musicDir == null) {
			Log.e(TAG, "No music dir provided, stopping.");
			stopSelf();
			return START_NOT_STICKY;
		}

		if (!isRunning.compareAndSet(false, true)) {
			Log.d(TAG, "Scan already in progress, ignoring request.");
			stopSelf();
			return START_NOT_STICKY;
		}

		// Start foreground immediately with an indeterminate notification
		startForeground(NOTIFICATION_ID, buildNotification(0, 0, "Starting scan..."));

		Thread scanThread = new Thread(() -> {
			try {
				runScan(musicDir);
			} finally {
				isRunning.set(false);
			}
		});
		scanThread.setDaemon(true);
		scanThread.start();

		return START_NOT_STICKY;
	}

	private void runScan(String musicDir) {
		MusicServerApp app = (MusicServerApp) getApplication();
		NativeBridge bridge = app.getNativeBridge();

		if (bridge == null) {
			Log.e(TAG, "NativeBridge is null, aborting scan.");
			stopSelf();
			return;
		}

		// First pass: collect all files
		List<File> files = new ArrayList<>();
		collectFiles(new File(musicDir), files);
		int total = files.size();
		Log.d(TAG, "Found " + total + " files to scan.");

		// Second pass: load each file
		int scanned = 0;
		for (File file : files) {
			String path = file.getAbsolutePath();
			String filename = file.getName();

			notificationManager.notify(NOTIFICATION_ID,
				buildNotification(scanned, total, filename));

			Log.d(TAG, "Loading track: " + path);
			bridge.loadTrackByPath(path);

			scanned++;
		}

		notificationManager.notify(NOTIFICATION_ID,
			buildNotification(total, total, "Done"));

		postCompleteNotification(scanned);
		stopSelf();
	}

	private void collectFiles(File dir, List<File> result) {
		if (!dir.exists() || !dir.isDirectory()) {
			return;
		}
		File[] entries = dir.listFiles();
		if (entries == null) {
			return;
		}
		for (File entry : entries) {
			if (entry.isDirectory()) {
				collectFiles(entry, result);
			} else {
				result.add(entry);
			}
		}
	}

	private Notification buildNotification(int value, int maxValue, String currentFile) {
		Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
			.setSmallIcon(android.R.drawable.ic_media_play)
			.setContentTitle("Scanning music library")
			.setOngoing(true)
			.setOnlyAlertOnce(true);

		if (maxValue > 0) {
			builder.setContentText(value + " / " + maxValue + " — " + currentFile)
				   .setProgress(maxValue, value, false);
		} else {
			builder.setContentText("Scanning...")
				   .setProgress(0, 0, true);
		}

		return builder.build();
	}

	private void postCompleteNotification(int count) {
		Notification notification = new Notification.Builder(this, CHANNEL_ID)
			.setSmallIcon(android.R.drawable.ic_media_play)
			.setContentTitle("Scan complete")
			.setContentText("Scanned " + count + " files.")
			.setAutoCancel(true)
			.build();
		notificationManager.notify(COMPLETE_NOTIFICATION_ID, notification);
	}

	@Override
	public IBinder onBind(Intent intent) {
		return null;
	}
}
