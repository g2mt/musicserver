package org.msxrv.musicserver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebView;
import org.json.JSONException;
import org.json.JSONObject;
import android.util.Log;
import java.nio.file.Paths;

public class NativeAudioBridge {
	private static final String NOTIFICATION_CHANNEL_ID = "playback";
	private static final int NOTIFICATION_ID = 1;

	private MainActivity activity;
	private WebView webView;
	private MediaPlayer mediaPlayer;

	private WebMessagePort messagePort;
	public void setMessagePort(WebMessagePort port) {
		this.messagePort = port;
	}

	private final Handler mainHandler = new Handler(Looper.getMainLooper());
	private MediaSession mediaSession;
	private PlaybackState playbackState;


	// Each NativeAudio instance has an ID. Only the latest one is active.
	private int currentInstanceId = 0;
	private boolean isActive(int instanceId) {
		return instanceId == currentInstanceId;
	}

	public NativeAudioBridge(MainActivity activity) {
		this.activity = activity;
		this.webView = activity.getWebView();

		mediaSession = new MediaSession(activity, "NativeAudioBridge");
		mediaSession.setActive(true);
		
		PlaybackState state = new PlaybackState.Builder()
			.setState(PlaybackState.STATE_PLAYING, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1.0f)
			.setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE |
				PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SKIP_TO_NEXT)
			.build();
		mediaSession.setPlaybackState(state);

		mediaSession.setCallback(new MediaSession.Callback() {
			@Override
			public void onPlay() {
				evaluateJavascript("window._setIsPlaying && window._setIsPlaying(true)");
			}

			@Override
			public void onPause() {
				evaluateJavascript("window._setIsPlaying && window._setIsPlaying(false)");
			}

			@Override
			public void onSkipToPrevious() {
				evaluateJavascript("window._handleBack && window._handleBack()");
			}

			@Override
			public void onSkipToNext() {
				evaluateJavascript("window._handleForward && window._handleForward()");
			}
		});

		NotificationChannel channel = new NotificationChannel(
			NOTIFICATION_CHANNEL_ID,
			"Playback",
			NotificationManager.IMPORTANCE_LOW);
		NotificationManager nm = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
		nm.createNotificationChannel(channel);
	}

	// Media session

	private void updateMediaSession(String filepath) {
		if (filepath == null) return;

		try {
			mediaPlayer.reset();
			mediaPlayer.setDataSource(filepath);
			mediaPlayer.prepare();
		} catch (Exception e) {
			e.printStackTrace();
		}

		NativeBridge bridge = activity.getNativeBridge();

		NativeBridge.TrackMetadata metadata = bridge.getTrackMetadata(filepath);
		String title  = (metadata != null && metadata.title  != null) ? metadata.title  : "";
		String artist = (metadata != null && metadata.artist != null) ? metadata.artist : "";
		String album  = (metadata != null && metadata.album  != null) ? metadata.album  : "";

		String[] outContentType = new String[1];
		byte[] coverBytes = bridge.getTrackCover(filepath, outContentType);
		Bitmap coverBitmap = null;
		if (coverBytes != null && coverBytes.length > 0) {
			coverBitmap = BitmapFactory.decodeByteArray(coverBytes, 0, coverBytes.length);
		}

		MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
			.putString(MediaMetadata.METADATA_KEY_TITLE, title)
			.putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
			.putString(MediaMetadata.METADATA_KEY_ALBUM, album);
		if (coverBitmap != null) {
			metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, coverBitmap);
		}
		mediaSession.setMetadata(metaBuilder.build());

		showNotification(title, artist, coverBitmap);
	}

	private void showNotification(String title, String artist, Bitmap cover) {
		Notification.MediaStyle style = new Notification.MediaStyle()
			.setMediaSession(mediaSession.getSessionToken());

		Notification.Builder builder = new Notification.Builder(activity, NOTIFICATION_CHANNEL_ID)
			.setStyle(style)
			.setContentTitle(title)
			.setContentText(artist)
			.setSmallIcon(android.R.drawable.ic_media_play)
			.setOngoing(true);

		if (cover != null) {
			builder.setLargeIcon(cover);
		}

		NotificationManager nm = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
		nm.notify(NOTIFICATION_ID, builder.build());
	}

	// Update functions

	private void updatePlaybackState() {
		boolean playing = mediaPlayer != null && mediaPlayer.isPlaying();
		int state = playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
		long position = mediaPlayer != null ? mediaPlayer.getCurrentPosition() : PlaybackState.PLAYBACK_POSITION_UNKNOWN;
		float speed = playing ? 1.0f : 0.0f;
		playbackState = new PlaybackState.Builder()
			.setState(state, position, speed)
			.setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE |
				PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SKIP_TO_NEXT)
			.build();
		mediaSession.setPlaybackState(playbackState);
	}

	// Schedules periodic timeupdate events (~4x per second) while the player is active and playing.
	private void scheduleTimeUpdates(int instanceId) {
		mainHandler.postDelayed(new Runnable() {
			@Override
			public void run() {
				if (!isActive(instanceId)) return;
				if (mediaPlayer != null && mediaPlayer.isPlaying()) {
					updatePlaybackState();
					fireEvent(instanceId, "timeupdate");
					mainHandler.postDelayed(this, 250);
				}
			}
		}, 250);
	}

	// JS utils

	private void evaluateJavascript(String script) {
		mainHandler.post(() -> webView.evaluateJavascript(script, null));
	}

	// Posts a JSON message of the form {"instanceId": N, "event": "eventName"}
	// to the JS MessagePort. Must be called on the main thread.
	private void fireEvent(int instanceId, String eventName) {
		if (!isActive(instanceId)) return;
		if (messagePort == null) return;

		JSONObject payloadObject = new JSONObject();
		try {
			payloadObject.put("instanceId", instanceId);
			payloadObject.put("event", eventName);
		} catch (JSONException e) {
			e.printStackTrace();
			return;
		}
		String payload = payloadObject.toString();

		// WebMessagePort.postMessage must be called on the main thread
		mainHandler.post(() -> {
			try {
				messagePort.postMessage(new WebMessage(payload));
			} catch (Exception e) {
				e.printStackTrace();
			}
		});
	}


	// JS interface

	// Called by NativeAudio constructor. Returns the instance ID.
	@JavascriptInterface
	public int createInstance() {
		currentInstanceId++;

		if (mediaPlayer != null) {
			mediaPlayer.stop();
			mediaPlayer.release();
			mediaPlayer = null;
		}

		mediaPlayer = new MediaPlayer();

		final int instanceId = currentInstanceId;

		mediaPlayer.setOnInfoListener((mp, what, extra) -> {
			fireEvent(instanceId, "timeupdate");
			return true;
		});

		mediaPlayer.setOnPreparedListener(mp -> {
			MediaMetadata current = mediaSession.getController().getMetadata();
			if (current != null) {
				mediaSession.setMetadata(new MediaMetadata.Builder(current)
					.putLong(MediaMetadata.METADATA_KEY_DURATION, mp.getDuration())
					.build());
			}
			fireEvent(instanceId, "canplay");
		});

		mediaPlayer.setOnCompletionListener(mp -> {
			updatePlaybackState();
			fireEvent(instanceId, "ended");
		});

		return instanceId;
	}

	@JavascriptInterface
	public void setSrc(int instanceId, String src) {
		if (!isActive(instanceId)) return;
		Log.d("[msxrv] NativeAudioBridge", "src=" + src);

		if (src.startsWith("file://")) {
			src = src.substring("file://".length());
			src = Paths.get(src).normalize().toString();
			if (src.startsWith("/")) {
				if (!src.startsWith(activity.getMusicDir())) {
					src = null;
				}
			} else {
				src = activity.getMusicDir() + "/" + src;
			}
			if (src != null) {
				Log.d("[msxrv] NativeAudioBridge", "resolved src=" + src);
			}
		}

		updateMediaSession(src);
	}

	@JavascriptInterface
	public void play(int instanceId) {
		if (!isActive(instanceId)) return;
		Log.d("[msxrv] NativeAudioBridge", "play");
		mediaPlayer.start();
		updatePlaybackState();
		scheduleTimeUpdates(instanceId);
	}

	@JavascriptInterface
	public void pause(int instanceId) {
		if (!isActive(instanceId)) return;
		if (mediaPlayer.isPlaying()) {
			mediaPlayer.pause();
			updatePlaybackState();
		}
	}

	@JavascriptInterface
	public void setCurrentTime(int instanceId, float time) {
		if (!isActive(instanceId)) return;
		mediaPlayer.seekTo((int)(time * 1000));
	}

	@JavascriptInterface
	public float getCurrentTime(int instanceId) {
		if (!isActive(instanceId)) return 0;
		return mediaPlayer.getCurrentPosition() / 1000f;
	}

	@JavascriptInterface
	public float getDuration(int instanceId) {
		if (!isActive(instanceId)) return 0;
		return mediaPlayer.getDuration() / 1000f;
	}

	@JavascriptInterface
	public void setVolume(int instanceId, float volume) {
		if (!isActive(instanceId)) return;
		mediaPlayer.setVolume(volume, volume);
	}
}
