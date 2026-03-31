package org.msxrv.musicserver;

import android.media.MediaMetadataRetriever;
import android.util.Base64;
import android.util.Log;

public class TrackUtils {
	private static final String TAG = "[msxrv] TrackUtils";
	private static final String COVER_FALLBACK = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAD0lEQVR4AQEEAPv/ACEhIQDKAGSaOw/yAAAAAElFTkSuQmCC";

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
		}

		// Fallback: look for image file in parent directory
		File file = new File(filepath);
		String parentDir = file.getParent();
		if (parentDir == null) {
			outContentType[0] = "image/png";
			return Base64.decode(COVER_FALLBACK, Base64.DEFAULT);
		}

		File dir = new File(parentDir);
		File[] files = dir.listFiles();
		if (files == null) {
			outContentType[0] = "image/png";
			return Base64.decode(COVER_FALLBACK, Base64.DEFAULT);
		}

		String[] extensions = {".png", ".jpg", ".webp"};
		for (File f : files) {
			if (f.isDirectory()) {
				continue;
			}
			String name = f.getName().toLowerCase();
			for (String ext : extensions) {
				if (name.endsWith(ext)) {
					try {
						byte[] imageData;
						try (FileInputStream fis = new FileInputStream(f)) {
							int size = (int) f.length();
							imageData = new byte[size];
							fis.read(imageData);
						}
						String mimeType;
						if (ext.equals(".png")) {
							mimeType = "image/png";
						} else if (ext.equals(".jpg")) {
							mimeType = "image/jpeg";
						} else {
							mimeType = "image/webp";
						}
						outContentType[0] = mimeType;
						return imageData;
					} catch (IOException e) {
						e.printStackTrace();
					}
				}
			}
		}

		outContentType[0] = "image/png";
		return Base64.decode(COVER_FALLBACK, Base64.DEFAULT);
	}
}
