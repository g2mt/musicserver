package org.msxrv.musicserver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.IBinder;
import android.util.Log;

import java.io.File;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class ScanTracksService extends Service {
	private static final String TAG = "[msxrv] ScanTracksService";
	private static final String CHANNEL_ID = "msxrv_scan";
	private static final int NOTIFICATION_ID = 1;
	private static final int COMPLETE_NOTIFICATION_ID = 2;

	public static final String EXTRA_MUSIC_DIR = "music_dir";
	public static final String EXTRA_SCAN_PATH = "scan_path";
	public static final String EXTRA_FORCE = "force";
	private static final String ACTION_CANCEL = "org.msxrv.musicserver.ACTION_CANCEL_SCAN";

	private static final long MAX_TOLERATED_LAST_MODIFIED_DIFF = 3;

	private static final AtomicBoolean isRunning = new AtomicBoolean(false);
	private final AtomicBoolean isCancelled = new AtomicBoolean(false);

	private NotificationManager notificationManager;
	private final Handler mainHandler = new Handler(Looper.getMainLooper());
	
	private final AtomicInteger scannedCount = new AtomicInteger(0);
	private final AtomicInteger addedCount = new AtomicInteger(0);
	private final AtomicInteger removedCount = new AtomicInteger(0);
	private final AtomicInteger totalCount = new AtomicInteger(0);
	private final AtomicBoolean isDiscovering = new AtomicBoolean(true);
	private final AtomicReference<String> currentFileName = new AtomicReference<>("");

	private class ScanThread extends Thread {
		private final String musicDir;
		private final String scanPath;
		private final boolean force;

		ScanThread(String musicDir, String scanPath, boolean force) {
			this.musicDir = musicDir;
			this.scanPath = scanPath;
			this.force = force;
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

				File baseDir = new File(musicDir);
				if (scanPath != null && !scanPath.isEmpty()) {
					baseDir = new File(baseDir, scanPath);
				}

				Set<String> toRemove = new HashSet<>();
				String[] existingPaths = bridge.getAllTrackPaths();
				if (existingPaths != null) {
					for (String path : existingPaths) {
						toRemove.add(path);
					}
				}

				// First pass: collect all files (discovery)
				isDiscovering.set(true);
				List<File> files = new ArrayList<>();
				collectFiles(baseDir, files);
				totalCount.set(files.size());
				Log.d(TAG, "Found " + totalCount.get() + " files to scan.");

				// Second pass: load each file
				isDiscovering.set(false);
				for (File file : files) {
					if (isCancelled.get()) {
						notifyCancelled();
						return;
					}

					String absPath = file.getAbsolutePath();
					toRemove.remove(absPath);
					currentFileName.set(file.getName());

					// Skip if file hasn't changed (unless force is true)
					if (!force) {
						long[] ckInfo = bridge.getTrackFileChecksumInfo(absPath);
						if (ckInfo != null) {
							long diff = Math.abs(ckInfo[0] - (file.lastModified() / 1000));
							if (diff <= MAX_TOLERATED_LAST_MODIFIED_DIFF && ckInfo[1] == file.length()) {
								scannedCount.incrementAndGet();
								continue;
							}
						}
					}

					Log.d(TAG, "Loading track: " + absPath);
					bridge.loadTrackByPath(absPath);
					addedCount.incrementAndGet();

					scannedCount.incrementAndGet();
				}

				for (String path : toRemove) {
					bridge.forgetTrackByPath(path);
					removedCount.incrementAndGet();
				}

				notificationManager.notify(COMPLETE_NOTIFICATION_ID, new Notification.Builder(ScanTracksService.this, CHANNEL_ID)
					.setSmallIcon(android.R.drawable.ic_media_play)
					.setContentTitle("Scan complete")
					.setContentText("Added " + addedCount.get() + " files, removed " + removedCount.get() + " files.")
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

		private void notifyCancelled() {
			notificationManager.notify(COMPLETE_NOTIFICATION_ID, new Notification.Builder(ScanTracksService.this, CHANNEL_ID)
				.setSmallIcon(android.R.drawable.ic_media_play)
				.setContentTitle("Scan cancelled")
				.setContentText("Scanning was stopped by user.")
				.setAutoCancel(true)
				.build());
		}

		private void collectFiles(File rootDir, List<File> result) {
			if (rootDir == null || !rootDir.exists() || !rootDir.isDirectory()) {
				return;
			}

			ArrayList<File> stack = new ArrayList<>();
			stack.add(rootDir);

			while (!stack.isEmpty()) {
				if (isCancelled.get()) {
					return;
				}

				File currentDir = stack.remove(stack.size() - 1);
				File[] entries = currentDir.listFiles();
				if (entries == null) {
					continue;
				}

				for (File entry : entries) {
					if (isCancelled.get()) {
						return;
					}
					if (entry.isDirectory()) {
						stack.add(entry);
					} else {
						result.add(entry);
					}
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
		if (intent != null && ACTION_CANCEL.equals(intent.getAction())) {
			isCancelled.set(true);
			return START_NOT_STICKY;
		}

		String musicDir = intent != null ? intent.getStringExtra(EXTRA_MUSIC_DIR) : null;
		String scanPath = intent != null ? intent.getStringExtra(EXTRA_SCAN_PATH) : null;
		boolean force = intent != null && intent.getBooleanExtra(EXTRA_FORCE, false);
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

		isCancelled.set(false);
		scannedCount.set(0);
		addedCount.set(0);
		removedCount.set(0);
		totalCount.set(0);
		final String initialFileName = "Starting scan...";
		currentFileName.set(initialFileName);

		// Start foreground immediately with an indeterminate notification
		startForeground(NOTIFICATION_ID, buildNotification());

		mainHandler.postDelayed(notificationUpdater, 1000);

		ScanThread scanThread = new ScanThread(musicDir, scanPath, force);
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
		Intent cancelIntent = new Intent(this, ScanTracksService.class);
		cancelIntent.setAction(ACTION_CANCEL);
		PendingIntent pendingCancelIntent = PendingIntent.getService(this, 0, cancelIntent, PendingIntent.FLAG_IMMUTABLE);

		Notification.Action action = new Notification.Action.Builder(
			android.R.drawable.ic_menu_close_clear_cancel,
			"Cancel",
			pendingCancelIntent
		).build();

		Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
			.setSmallIcon(android.R.drawable.ic_media_play)
			.setOngoing(true)
			.setOnlyAlertOnce(true)
			.addAction(action);

		int value = scannedCount.get();
		int maxValue = totalCount.get();
		String currentFile = currentFileName.get();

		if (isDiscovering.get()) {
			builder.setContentTitle("Discovering music library")
				   .setContentText("Found " + maxValue + " files...")
				   .setProgress(0, 0, true);
		} else {
			builder.setContentTitle("Scanning music library");
			if (maxValue > 0) {
				builder.setContentText(value + " / " + maxValue + " — " + currentFile)
					   .setProgress(maxValue, value, false);
			} else {
				builder.setContentText(currentFile)
					   .setProgress(0, 0, true);
			}
		}

		return builder.build();
	}
}
