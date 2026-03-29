package org.msxrv.musicserver;

import android.content.Context;
import android.media.MediaPlayer;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

public class NativeAudioBridge {
    private final Context context;
    private final WebView webView;
    private MediaPlayer mediaPlayer;

    // Each NativeAudio instance has an ID. Only the latest one is active.
    private int currentInstanceId = 0;

    public NativeAudioBridge(Context context, WebView webView) {
        this.context = context;
        this.webView = webView;
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

        return instanceId;
    }

    private boolean isActive(int instanceId) {
        return instanceId == currentInstanceId;
    }

    private void fireEvent(int instanceId, String eventName) {
        if (!isActive(instanceId)) return;
        // TODO: implement event firing
    }

    @JavascriptInterface
    public void setSrc(int instanceId, String src) {
        if (!isActive(instanceId)) return;
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
}
