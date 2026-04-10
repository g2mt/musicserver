package org.msxrv.musicserver;

import android.app.Application;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.os.Handler;
import android.os.Looper;

public class MusicServerApp extends Application {
	private static final String CHANNEL_ID = "musicserver_service";
	public static final int NOTIFICATION_ID = 100;
	private static final String TAG = "[msxrv] MusicServerApp";

	private AtomicBoolean isFirstLoaded = new AtomicBoolean(true);
	public boolean getIsFirstLoaded() {
		return isFirstLoaded.get();
	}
	public void setIsFirstLoaded() {
		isFirstLoaded.set(false);
	}

	private WebView webView;
	public WebView getWebView() {
		return webView;
	}
	public void loadWebView() {
		webView.loadUrl("file:///android_asset/index.html");
	}

	private NativeBridge nativeBridge;
	public NativeBridge getNativeBridge() {
		return nativeBridge;
	}

	private NativeAudioBridge nativeAudioBridge;
	public NativeAudioBridge getNativeAudioBridge() {
		return nativeAudioBridge;
	}

	private SettingsBridge settingsBridge;
	public SettingsBridge getSettingsBridge() {
		return settingsBridge;
	}

	@Override
	public void onCreate() {
		super.onCreate();

		registerReceiver(quitReceiver, new IntentFilter(ACTION_QUIT), Context.RECEIVER_NOT_EXPORTED);
		createNotificationChannel();

		// WebView must be created on the main thread with an Application context
		webView = new WebView(this);
		WebSettings webSettings = webSettings = webView.getSettings();
		webSettings.setJavaScriptEnabled(true);
		webSettings.setDomStorageEnabled(true);
		webSettings.setDatabaseEnabled(true);
		webSettings.setAlgorithmicDarkeningAllowed(true);
		webView.clearCache(true);
	}

	// Called once MainActivity has set up musicDir/dbDir and is ready to finish init
	public void initBridges(MainActivity activity) {
		if (nativeBridge != null) return;

		try {
			nativeBridge = new NativeBridge(activity);
			webView.addJavascriptInterface(nativeBridge, "_native");
		} catch (NativeBridge.NativeBridgeException e) {
			Log.e(TAG, "NativeBridge init failed: " + e.getMessage());
			return;
		}

		nativeAudioBridge = new NativeAudioBridge(activity);
		webView.addJavascriptInterface(nativeAudioBridge, "_native_audio_bridge");

		settingsBridge = new SettingsBridge(activity);
		webView.addJavascriptInterface(settingsBridge, "_native_settings");
	}

	// Notifications

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

	public Notification buildNotification(String title, String artist, Bitmap cover) {
		Intent launchIntent = new Intent(this, MainActivity.class);
		launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
		PendingIntent pendingIntent = PendingIntent.getActivity(
			this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE);

		Intent quitIntent = new Intent(ACTION_QUIT);
		quitIntent.setPackage(getPackageName());
		PendingIntent quitPendingIntent = PendingIntent.getBroadcast(
			this, 0, quitIntent, PendingIntent.FLAG_IMMUTABLE);

		Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
			.setSmallIcon(android.R.drawable.ic_media_play)
			.setContentIntent(pendingIntent)
			.setOngoing(true)
			.addAction(android.R.drawable.ic_delete, "Quit", quitPendingIntent);

		if (title != null && !title.isEmpty()) {
			builder.setContentTitle(title);
			builder.setContentText(artist != null ? artist : "");
			if (nativeAudioBridge != null && nativeAudioBridge.getMediaSession() != null) {
				Notification.MediaStyle style = new Notification.MediaStyle()
					.setMediaSession(nativeAudioBridge.getMediaSession().getSessionToken());
				builder.setStyle(style);
			}
		} else {
			builder.setContentTitle("Music Server");
			builder.setContentText("Running in background");
		}

		if (cover != null) {
			builder.setLargeIcon(cover);
		}

		return builder.build();
	}

	public void updateNotification(String title, String artist, Bitmap cover) {
		NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
		nm.notify(NOTIFICATION_ID, buildNotification(title, artist, cover));
	}

	// Quitting

	public static final String ACTION_QUIT = "org.msxrv.musicserver.ACTION_QUIT";
	private final BroadcastReceiver quitReceiver = new BroadcastReceiver() {
		@Override
		public void onReceive(Context context, Intent intent) {
			if (ACTION_QUIT.equals(intent.getAction())) {
				Log.d(TAG, "Quit action received");
				quit();
			}
		}
	};
	public void quit() {
		if (nativeAudioBridge != null) {
			nativeAudioBridge.terminate();
		}
		if (nativeBridge != null) {
			nativeBridge.terminate();
		}

		stopService(new Intent(this, WebViewService.class));
		stopService(new Intent(this, ScanTracksService.class));
		NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
		nm.cancelAll();

		Intent quitIntent = new Intent(this, MainActivity.class);
		quitIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
		quitIntent.putExtra("quit", true);
		startActivity(quitIntent);

		new Handler(Looper.getMainLooper()).postDelayed(
			new Runnable() {
				public void run() {
					System.exit(1);
				}
			}, 
		1000);
	}
}
