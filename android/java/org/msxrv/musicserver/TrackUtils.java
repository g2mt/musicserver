package org.msxrv.musicserver;

import android.media.MediaMetadataRetriever;
import android.util.Log;

public class TrackUtils {
	private static final String TAG = "[msxrv] TrackUtils";

	public static class TrackMetadata {
		public final String title;
		public final String artist;
		public final String album;

		public TrackMetadata(String title, String artist, String album) {
			this.title = title;
			this.artist = artist;
			this.album = album;
		}
	}

	public static TrackMetadata getTrackMetadata(String filepath) {
		try (MediaMetadataRetriever mmr = new MediaMetadataRetriever()) {
			mmr.setDataSource(filepath);
			String title  = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
			String artist = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
			String album  = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
			return new TrackMetadata(title, artist, album);
		} catch (Exception e) {
			e.printStackTrace();
			return null;
		}
	}

	public static byte[] getTrackCover(String filepath, String[] outContentType) {
		try (MediaMetadataRetriever mmr = new MediaMetadataRetriever()) {
			mmr.setDataSource(filepath);
			byte[] data = mmr.getEmbeddedPicture();
			outContentType[0] = "image/jpeg";
			return data != null ? data : new byte[0];
		} catch (Exception e) {
			e.printStackTrace();
			outContentType[0] = "image/jpeg";
			return new byte[0];
		}
	}
}
