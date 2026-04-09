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
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import android.util.Log;
import java.nio.file.Paths;
import java.util.ArrayList;

public class NativeAudioBridge {
	private static final String TAG = "[msxrv] NativeAudioBridge";

	private MainActivity activity;
	private WebView webView;
	private MediaPlayer mediaPlayer;

	private WebMessagePort messagePort;
	public void setMessagePort(WebMessagePort port) {
		this.messagePort = port;
	}

	private final Handler mainHandler = new Handler(Looper.getMainLooper());
	private Runnable timeUpdateRunnable;
	private MediaSession mediaSession;
	private PlaybackState playbackState;

	public MediaSession getMediaSession() {
		return mediaSession;
	}

	// Each NativeAudio instance has an ID. Only the latest one is active.
	private int currentInstanceId = 0;
	private boolean isActive(int instanceId) {
		return instanceId == currentInstanceId;
	}

	public NativeAudioBridge(MainActivity activity) {
		this.activity = activity;

		WebView wv = activity.getApp().getWebView();
		this.webView = wv;

		mediaSession = new MediaSession(activity, "NativeAudioBridge");
		mediaSession.setActive(true);
		updatePlaybackState();

		mediaSession.setCallback(new MediaSession.Callback() {
			@Override
			public void onPlay() {
				if (queue != null) {
					if (mediaPlayer != null && !mediaPlayer.isPlaying()) {
						mediaPlayer.start();
						updatePlaybackState();
					}
					return;
				}
				wv.evaluateJavascript("window._setIsPlaying(true)", null);
			}

			@Override
			public void onPause() {
				if (queue != null) {
					if (mediaPlayer != null && mediaPlayer.isPlaying()) {
						mediaPlayer.pause();
						updatePlaybackState();
					}
					return;
				}
				wv.evaluateJavascript("window._setIsPlaying(false)", null);
			}

			@Override
			public void onSkipToPrevious() {
				if (queue != null) {
					if (queue.index > 0) {
						queue.index--;
						loadFromQueue();
					}
					return;
				}
				wv.evaluateJavascript("window._handleBack()", null);
			}

			@Override
			public void onSkipToNext() {
				if (queue != null) {
					if (queue.index < queue.paths.size() - 1) {
						queue.index++;
						loadFromQueue();
					}
					return;
				}
				wv.evaluateJavascript("window._handleForward()", null);
			}

			@Override
			public void onSeekTo(long pos) {
				if (mediaPlayer != null) {
					mediaPlayer.seekTo((int) pos);
					updatePlaybackState();
				}
			}

			@Override
			public void onCustomAction(String action, android.os.Bundle extras) {
				if (MusicServerApp.ACTION_QUIT.equals(action)) {
					activity.getApp().quit();
				}
			}
		});
	}

	public void terminate() {
		if (mediaPlayer != null) {
			mediaPlayer.stop();
			mediaPlayer.release();
			mediaPlayer = null;
		}
		if (mediaSession != null) {
			mediaSession.setActive(false);
			mediaSession.release();
			mediaSession = null;
		}
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

		NativeBridge bridge = activity.getApp().getNativeBridge();

		TrackUtils.TrackMetadata metadata = TrackUtils.getTrackMetadata(filepath);
		String title  = (metadata != null && metadata.title  != null) ? metadata.title  : "";
		String artist = (metadata != null && metadata.artist != null) ? metadata.artist : "";
		String album  = (metadata != null && metadata.album  != null) ? metadata.album  : "";

		String[] outContentType = new String[1];
		byte[] coverBytes = TrackUtils.getTrackCover(filepath, outContentType);
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

		activity.getApp().updateNotification(title, artist, coverBitmap);
	}

	// Playback state

	private void updatePlaybackState() {
		boolean playing = mediaPlayer != null && mediaPlayer.isPlaying();
		int state = playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
		long position = mediaPlayer != null ? mediaPlayer.getCurrentPosition() : PlaybackState.PLAYBACK_POSITION_UNKNOWN;
		float speed = playing ? 1.0f : 0.0f;

		PlaybackState.CustomAction quitAction = new PlaybackState.CustomAction.Builder(
			MusicServerApp.ACTION_QUIT, "Quit", android.R.drawable.ic_delete).build();

		playbackState = new PlaybackState.Builder()
			.setState(state, position, speed)
			.setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE |
				PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SKIP_TO_NEXT |
				PlaybackState.ACTION_SEEK_TO)
			.addCustomAction(quitAction)
			.build();
		mediaSession.setPlaybackState(playbackState);
	}

	// Schedules periodic timeupdate events (~4x per second) while the player is active and playing.
	private void scheduleTimeUpdates(int instanceId) {
		if (timeUpdateRunnable != null) {
			mainHandler.removeCallbacks(timeUpdateRunnable);
		}
		timeUpdateRunnable = new Runnable() {
			@Override
			public void run() {
				if (!isActive(instanceId)) return;
				if (mediaPlayer != null && mediaPlayer.isPlaying()) {
					updatePlaybackState();
					fireEvent(instanceId, "timeupdate");
					mainHandler.postDelayed(this, 250);
				}
			}
		};
		mainHandler.postDelayed(timeUpdateRunnable, 250);
	}

	// Queue
	public static class Queue {
		public ArrayList<String> paths = new ArrayList<>();
		public int index = -1;
	}

	public Queue queue; // non-null if the main activity (webview) is suspended

	private void loadFromQueue() {
		if (queue == null || queue.index < 0 || queue.index >= queue.paths.size()) return;
		String path = queue.paths.get(queue.index);
		mainHandler.post(() -> {
			setSrc(currentInstanceId, "file://" + path);
			play(currentInstanceId);
		});
	}

	// JS utils

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
		if (currentInstanceId == 0) {
			mainHandler.post(() -> {
				WebMessagePort[] channel = webView.createWebMessageChannel();
				setMessagePort(channel[0]);
				webView.postWebMessage(
					new WebMessage("_audio_port", new WebMessagePort[]{channel[1]}),
					android.net.Uri.parse("*")
				);
			});
		}

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
			Log.d(TAG, "ended");
			updatePlaybackState();
			fireEvent(instanceId, "ended");
		});

		return instanceId;
	}

	@JavascriptInterface
	public void setSrc(int instanceId, String src) {
		if (!isActive(instanceId)) return;
		Log.d(TAG, "src=" + src);

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
				Log.d(TAG, "resolved src=" + src);
			}
		}

		updateMediaSession(src);
	}

	@JavascriptInterface
	public void play(int instanceId) {
		if (!isActive(instanceId)) return;
		Log.d(TAG, "play");
		mediaPlayer.start();
		updatePlaybackState();
		scheduleTimeUpdates(instanceId);
	}

	@JavascriptInterface
	public void pause(int instanceId) {
		if (!isActive(instanceId)) return;
		if (timeUpdateRunnable != null) {
			mainHandler.removeCallbacks(timeUpdateRunnable);
			timeUpdateRunnable = null;
		}
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

	@JavascriptInterface
	public void saveTrackQueue(String serialized) {
		try {
			JSONObject obj = new JSONObject(serialized);
			JSONArray pathsArr = obj.getJSONArray("paths");
			int index = obj.optInt("index", -1);

			Queue newQueue = new Queue();
			for (int i = 0; i < pathsArr.length(); i++) {
				newQueue.paths.add(pathsArr.getString(i));
			}
			newQueue.index = index;
			this.queue = newQueue;
		} catch (JSONException e) {
			Log.e(TAG, "Failed to parse track queue", e);
		}
	}
}
