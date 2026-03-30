package org.msxrv.musicserver;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

public class SettingsBridge {
	private static final String PREFS_NAME = "musicserver_settings";
	private final SharedPreferences sharedPreferences;

	public SettingsBridge(Context context) {
		this.sharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
	}

	@JavascriptInterface
	public void setItem(String key, String value) {
		sharedPreferences.edit().putString(key, value).apply();
	}

	@JavascriptInterface
	public String getItem(String key) {
		return sharedPreferences.getString(key, null);
	}

	@JavascriptInterface
	public void removeItem(String key) {
		sharedPreferences.edit().remove(key).apply();
	}

	@JavascriptInterface
	public void clear() {
		sharedPreferences.edit().clear().apply();
	}
}
