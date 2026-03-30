package org.msxrv.musicserver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.IBinder;
import android.util.Log;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class ScanTracksService extends Service {
	private static final String TAG = "[msxrv] ScanTracksService";
	private static final String CHANNEL_ID = "msxrv_scan";
	private static final int NOTIFICATION_ID = 1;
	private static final int COMPLETE_NOTIFICATION_ID = 2;

	public static final String EXTRA_MUSIC_DIR = "music_dir";

	private static final AtomicBoolean isRunning = new AtomicBoolean(false);

	private NotificationManager notificationManager;
	private final Handler mainHandler = new Handler(Looper.getMainLooper());
	
	private final AtomicInteger scannedCount = new AtomicInteger(0);
	private final AtomicInteger totalCount = new AtomicInteger(0);
	private final AtomicReference<String> currentFileName = new AtomicReference<>("");

	private class ScanThread extends Thread {
		private final String musicDir;

		ScanThread(String musicDir) {
			this.musicDir = musicDir;
		}

		@Override
		public void run() {
			try {
				MusicServerApp app = (MusicServerApp) getApplication();
				NativeBridge bridge = app.getNativeBridge();

				if (bridge == null) {
					Log.e(TAG, "NativeBridge is null, aborting scan.");
					return;
				}

				// First pass: collect all files (discovery)
				List<File> files = new ArrayList<>();
				collectFiles(new File(musicDir), files);
				totalCount.set(files.size());
				Log.d(TAG, "Found " + totalCount.get() + " files to scan.");

				// Second pass: load each file
				for (File file : files) {
					currentFileName.set(file.getName());

					Log.d(TAG, "Loading track: " + file.getAbsolutePath());
					bridge.loadTrackByPath(file.getAbsolutePath());

					scannedCount.incrementAndGet();
				}

				notificationManager.notify(COMPLETE_NOTIFICATION_ID, new Notification.Builder(ScanTracksService.this, CHANNEL_ID)
					.setSmallIcon(android.R.drawable.ic_media_play)
					.setContentTitle("Scan complete")
					.setContentText("Scanned " + scannedCount.get() + " files.")
					.setAutoCancel(true)
					.build());

				mainHandler.post(() ->
					app.getWebView().evaluateJavascript("window._refreshSearch()", null));

			} finally {
				isRunning.set(false);
				mainHandler.removeCallbacks(notificationUpdater);
				stopSelf();
			}
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
	}

	// Events

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

		scannedCount.set(0);
		totalCount.set(0);
		final String initialFileName = "Starting scan...";
		currentFileName.set(initialFileName);

		// Start foreground immediately with an indeterminate notification
		startForeground(NOTIFICATION_ID, buildNotification());

		mainHandler.postDelayed(notificationUpdater, 1000);

		ScanThread scanThread = new ScanThread(musicDir);
		scanThread.setDaemon(true);
		scanThread.start();

		return START_NOT_STICKY;
	}

	@Override
	public IBinder onBind(Intent intent) {
		return null;
	}

	// Notification

	private final Runnable notificationUpdater = new Runnable() {
		@Override
		public void run() {
			if (isRunning.get()) {
				notificationManager.notify(NOTIFICATION_ID, buildNotification());
				mainHandler.postDelayed(this, 1000);
			}
		}
	};

	private Notification buildNotification() {
		Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
			.setSmallIcon(android.R.drawable.ic_media_play)
			.setContentTitle("Scanning music library")
			.setOngoing(true)
			.setOnlyAlertOnce(true);

		int value = scannedCount.get();
		int maxValue = totalCount.get();
		String currentFile = currentFileName.get();

		if (maxValue > 0) {
			builder.setContentText(value + " / " + maxValue + " — " + currentFile)
				   .setProgress(maxValue, value, false);
		} else {
			builder.setContentText(currentFile)
				   .setProgress(0, 0, true);
		}

		return builder.build();
	}
}
