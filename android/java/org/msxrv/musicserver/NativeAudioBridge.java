package org.msxrv.musicserver;

import android.content.Context;
import android.media.MediaPlayer;
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
	private MainActivity activity;
	private WebView webView;
	private MediaPlayer mediaPlayer;
	private WebMessagePort messagePort;
	private final Handler mainHandler = new Handler(Looper.getMainLooper());

	// Each NativeAudio instance has an ID. Only the latest one is active.
	private int currentInstanceId = 0;

	public NativeAudioBridge(MainActivity activity) {
		this.activity = activity;
		this.webView = activity.getWebView();
	}

	public void setMessagePort(WebMessagePort port) {
		this.messagePort = port;
	}

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

		mediaPlayer.setOnCompletionListener(mp -> {
			fireEvent(instanceId, "ended");
		});

		mediaPlayer.setOnInfoListener((mp, what, extra) -> {
			fireEvent(instanceId, "timeupdate");
			return true;
		});

		// Fire timeupdate periodically while playing
		mediaPlayer.setOnPreparedListener(mp -> {
			fireEvent(instanceId, "canplay");
		});

		return instanceId;
	}

	private boolean isActive(int instanceId) {
		return instanceId == currentInstanceId;
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

		try {
			mediaPlayer.reset();
			mediaPlayer.setDataSource(src);
			mediaPlayer.prepareAsync();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	@JavascriptInterface
	public void play(int instanceId) {
		if (!isActive(instanceId)) return;
		mediaPlayer.start();
		scheduleTimeUpdates(instanceId);
	}

	@JavascriptInterface
	public void pause(int instanceId) {
		if (!isActive(instanceId)) return;
		if (mediaPlayer.isPlaying()) {
			mediaPlayer.pause();
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

	// Schedules periodic timeupdate events (~4x per second) while the player is active and playing.
	private void scheduleTimeUpdates(int instanceId) {
		mainHandler.postDelayed(new Runnable() {
			@Override
			public void run() {
				if (!isActive(instanceId)) return;
				if (mediaPlayer != null && mediaPlayer.isPlaying()) {
					fireEvent(instanceId, "timeupdate");
					mainHandler.postDelayed(this, 250);
				}
			}
		}, 250);
	}
}
