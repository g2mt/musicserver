package org.msxrv.musicserver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadata;
import android.media.MediaPlayer;
import android.media.audiofx.LoudnessEnhancer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.widget.Toast;
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
import java.nio.ByteBuffer;
import java.nio.file.Paths;
import java.nio.file.Path;
import java.util.ArrayList;

public class NativeAudioBridge {
	private static final String TAG = "[msxrv] NativeAudioBridge";
	private static final String MUSIC_SCHEME = "music://";

	private MainActivity activity;
	private WebView webView;
	private MediaPlayer mediaPlayer;
	private LoudnessEnhancer loudnessEnhancer;

	private WebMessagePort messagePort;

	private final Handler mainHandler = new Handler(Looper.getMainLooper());
	private Runnable timeUpdateRunnable;
	private MediaSession mediaSession;
	private PlaybackState playbackState;
	private String currentFilePath;

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
					queue.prev();
					return;
				}
				wv.evaluateJavascript("window._handleBack()", null);
			}

			@Override
			public void onSkipToNext() {
				if (queue != null) {
					queue.next();
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
		if (loudnessEnhancer != null) {
			loudnessEnhancer.release();
			loudnessEnhancer = null;
		}
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

	// ### Path resolution

	private Path resolveMusicPath(String src) {
		if (src == null) return null;

		if (src.startsWith(MUSIC_SCHEME)) {
			src = src.substring(MUSIC_SCHEME.length());
		}

		src = BridgeUtils.decodeURI(src);

		Path p = Paths.get(src).normalize();
		if (!p.isAbsolute()) {
			p = activity.getMusicDir().resolve(p);
		}
		return p;
	}

	// ### Media session

	private void updateMediaSession(Path path) {
		if (path == null) return;
		String absPath = path.toString();

		Log.d(TAG, "updateMediaSession: filePath=" + absPath);
		try {
			mediaPlayer.reset();
			mediaPlayer.setDataSource(absPath);
			mediaPlayer.prepare();
		} catch (Exception e) {
			e.printStackTrace();
			Toast.makeText(activity, e.getMessage(), Toast.LENGTH_LONG).show();
		}
		currentFilePath = absPath;

		NativeBridge bridge = activity.getApp().getNativeBridge();

		TrackUtils.TrackMetadata metadata = TrackUtils.getTrackMetadata(absPath);
		String title  = (metadata != null && metadata.title  != null && !metadata.title.isEmpty()) ? metadata.title  : Paths.get(absPath).getFileName().toString();
		String artist = (metadata != null && metadata.artist != null) ? metadata.artist : "";
		String album  = (metadata != null && metadata.album  != null) ? metadata.album  : "";

		String[] outContentType = new String[1];
		byte[] coverBytes = TrackUtils.getTrackCover(absPath, outContentType);
		Bitmap coverBitmap = null;
		if (coverBytes != null && coverBytes.length > 0) {
			coverBitmap = BitmapFactory.decodeByteArray(coverBytes, 0, coverBytes.length);
		}

		MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
			.putLong(MediaMetadata.METADATA_KEY_DURATION, mediaPlayer.getDuration())
			.putString(MediaMetadata.METADATA_KEY_TITLE, title)
			.putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
			.putString(MediaMetadata.METADATA_KEY_ALBUM, album);
		if (coverBitmap != null) {
			metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, coverBitmap);
		}
		mediaSession.setMetadata(metaBuilder.build());

		activity.getApp().updateNotification(title, artist, coverBitmap);
	}

	// ### Playback state

	private void updatePlaybackState() {
		boolean playing = mediaPlayer != null && mediaPlayer.isPlaying();
		int state = playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
		long position = mediaPlayer != null ? mediaPlayer.getCurrentPosition() : PlaybackState.PLAYBACK_POSITION_UNKNOWN;
		float speed = playing ? 1.0f : 0.0f;
		Log.d(TAG, "position="+position);

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
	private void scheduleTimeUpdates() {
		if (timeUpdateRunnable != null) {
			mainHandler.removeCallbacks(timeUpdateRunnable);
		}
		timeUpdateRunnable = new Runnable() {
			@Override
			public void run() {
				if (mediaPlayer != null && mediaPlayer.isPlaying()) {
					fireEvent(currentInstanceId, "timeupdate");
					mainHandler.postDelayed(this, 250);
				}
			}
		};
		mainHandler.postDelayed(timeUpdateRunnable, 250);
	}

	private void cancelTimeUpdates() {
		if (timeUpdateRunnable != null) {
			mainHandler.removeCallbacks(timeUpdateRunnable);
			timeUpdateRunnable = null;
		}
	}

	// ### Playback queue

	private class Queue {
		public ArrayList<Path> paths = new ArrayList<>();
		public int index = -1;

		public void next() {
			if (index < paths.size() - 1) {
				index++;
				loadTrack();
			}
		}

		public void prev() {
			if (index > 0) {
				index--;
				loadTrack();
			}
		}

		public void loadTrack() {
			if (index < 0 || index >= paths.size()) return;
			Path path = paths.get(index);
			mainHandler.post(() -> {
				updateMediaSession(path);
				mediaPlayer.start();
				updatePlaybackState();
			});
		}
	}

	private Queue queue; // non-null if the main activity (webview) is suspended

	// ### JS utils

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

	// ### JS interface

	// Called by NativeAudio constructor. Returns the instance ID.
	@JavascriptInterface
	public int createInstance() {
		mainHandler.post(() -> {
			WebMessagePort[] channel = webView.createWebMessageChannel();
			if (messagePort != null)
				messagePort.close();
			messagePort = channel[0];
			webView.postWebMessage(
				new WebMessage("_audio_port", new WebMessagePort[]{channel[1]}),
				android.net.Uri.parse("*")
			);
		});

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
			Log.d(TAG, "prepared");
			fireEvent(instanceId, "canplay");
		});

		mediaPlayer.setOnCompletionListener(mp -> {
			Log.d(TAG, "ended");
			if (queue != null) {
				queue.next();
				updatePlaybackState();
				return;
			}
			updatePlaybackState();
			fireEvent(instanceId, "ended");
		});

		return instanceId;
	}

	@JavascriptInterface
	public void setSrc(int instanceId, String src) {
		if (!isActive(instanceId)) return;
		Log.d(TAG, "src=" + src);
		updateMediaSession(resolveMusicPath(src));
	}

	@JavascriptInterface
	public void play(int instanceId) {
		if (!isActive(instanceId)) return;
		Log.d(TAG, "play");
		mediaPlayer.start();
		updatePlaybackState();
		scheduleTimeUpdates();
	}

	@JavascriptInterface
	public void pause(int instanceId) {
		if (!isActive(instanceId)) return;
		cancelTimeUpdates();
		if (mediaPlayer.isPlaying()) {
			mediaPlayer.pause();
			updatePlaybackState();
		}
	}

	@JavascriptInterface
	public void setCurrentTime(int instanceId, float time) {
		if (!isActive(instanceId)) return;
		mediaPlayer.seekTo((int)(time * 1000));
		updatePlaybackState();
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

	private native long ebur128Init(int channels, int samplerate);
	private native void ebur128Destroy(long handle);
	private native void ebur128AddFrames(long handle, byte[] frames, int nr_frames);
	private native double ebur128LoudnessGlobal(long handle);

	@JavascriptInterface
	public float loudness(int instanceId) {
		if (!isActive(instanceId) || currentFilePath == null) return 0.0f;
		Log.d(TAG, "Calculating loudness for: " + currentFilePath);

		MediaExtractor extractor = new MediaExtractor();
		long handle = 0;
		try {
			extractor.setDataSource(currentFilePath);
			int trackIndex = -1;
			for (int i = 0; i < extractor.getTrackCount(); i++) {
				MediaFormat format = extractor.getTrackFormat(i);
				if (format.getString(MediaFormat.KEY_MIME).startsWith("audio/")) {
					trackIndex = i;
					break;
				}
			}
			if (trackIndex < 0) return 0.0f;

			extractor.selectTrack(trackIndex);
			MediaFormat format = extractor.getTrackFormat(trackIndex);
			int channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
			int sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE);
			Log.d(TAG, "Format: " + channels + " channels, " + sampleRate + "Hz");

			handle = ebur128Init(channels, sampleRate);
			MediaCodec codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME));
			// Request low-latency decoding where supported to reduce per-buffer overhead.
			format.setInteger(MediaFormat.KEY_LOW_LATENCY, 1);
			codec.configure(format, null, null, 0);
			codec.start();

			MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
			boolean sawInputEOS = false;
			boolean sawOutputEOS = false;
			final int frameBytes = 2 * channels;
			byte[] chunk = null;

			while (!sawOutputEOS) {
				if (!sawInputEOS) {
					// Feed as many input buffers as the codec will accept without blocking.
					while (true) {
						int inputBufferIndex = codec.dequeueInputBuffer(0);
						if (inputBufferIndex < 0) break;
						ByteBuffer inputBuffer = codec.getInputBuffer(inputBufferIndex);
						int sampleSize = extractor.readSampleData(inputBuffer, 0);
						if (sampleSize < 0) {
							codec.queueInputBuffer(inputBufferIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
							sawInputEOS = true;
							break;
						}
						// Pass 0 for presentationTimeUs - EBU R128 doesn't need timestamps.
						codec.queueInputBuffer(inputBufferIndex, 0, sampleSize, 0, 0);
						extractor.advance();
					}
				}

				int outputBufferIndex = codec.dequeueOutputBuffer(info, 100000);
				if (outputBufferIndex >= 0) {
					if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) sawOutputEOS = true;
					if (info.size > 0) {
						ByteBuffer outputBuffer = codec.getOutputBuffer(outputBufferIndex);
						// Reuse the chunk buffer across iterations, growing only when needed.
						if (chunk == null || chunk.length < info.size) {
							chunk = new byte[info.size];
						}
						outputBuffer.position(info.offset);
						outputBuffer.get(chunk, 0, info.size);
						ebur128AddFrames(handle, chunk, info.size / frameBytes);
					}
					codec.releaseOutputBuffer(outputBufferIndex, false);
				}
			}

			codec.stop();
			codec.release();
			float result = (float) ebur128LoudnessGlobal(handle);
			Log.d(TAG, "Loudness result: " + result + " LUFS");
			return result;
		} catch (Exception e) {
			Log.e(TAG, "Loudness calculation failed", e);
			return 0.0f;
		} finally {
			if (handle != 0) ebur128Destroy(handle);
			extractor.release();
		}
	}

	@JavascriptInterface
	public void setAmplification(int instanceId, float decibels) {
		if (!isActive(instanceId)) return;
		if (decibels == 0) {
			if (loudnessEnhancer != null) {
				loudnessEnhancer.setEnabled(false);
				loudnessEnhancer.release();
				loudnessEnhancer = null;
			}
			return;
		}

		if (loudnessEnhancer == null) {
			loudnessEnhancer = new LoudnessEnhancer(mediaPlayer.getAudioSessionId());
		}
		loudnessEnhancer.setTargetGain((int) (decibels * 100));
		loudnessEnhancer.setEnabled(true);
	}

	@JavascriptInterface
	public void saveTrackQueue(String serialized) {
		if (this.queue != null)
			throw new RuntimeException("queue should be null");
		try {
			JSONObject obj = new JSONObject(serialized);
			JSONArray pathsArr = obj.getJSONArray("paths");
			int index = obj.optInt("index", -1);

			Queue newQueue = new Queue();
			for (int i = 0; i < pathsArr.length(); i++) {
				newQueue.paths.add(resolveMusicPath(pathsArr.getString(i)));
			}
			newQueue.index = index;
			this.queue = newQueue;
		} catch (JSONException e) {
			Log.e(TAG, "Failed to parse track queue", e);
		}
	}

	@JavascriptInterface
	public String loadAudioState() {
		JSONObject result = new JSONObject();

		try {
			String relativePath = "";
			if (currentFilePath != null) {
				try {
					relativePath = activity.getMusicDir().relativize(Paths.get(currentFilePath)).toString();
				} catch (Exception e) {
					relativePath = currentFilePath;
				}
			}

			JSONObject audioObj = new JSONObject();
			audioObj.put("path", relativePath);
			audioObj.put("isPlaying", mediaPlayer != null && mediaPlayer.isPlaying());
			audioObj.put("progress", mediaPlayer != null ? mediaPlayer.getCurrentPosition() / 1000f : 0f);
			audioObj.put("duration", mediaPlayer != null ? mediaPlayer.getDuration() / 1000f : 0f);

			JSONObject queueObj = new JSONObject();
			queueObj.put("index", queue != null ? queue.index : null);

			result.put("audio", audioObj);
			result.put("queue", queueObj);
		} catch (JSONException e) {
			e.printStackTrace();
		}

		queue = null; // Unload the queue since the function triggers when WebView is unsuspended
		return result.toString();
	}
}
