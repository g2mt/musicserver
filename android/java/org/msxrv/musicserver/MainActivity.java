package org.msxrv.musicserver;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class MainActivity extends Activity {
	static {
		System.loadLibrary("musicserver");
	}

	public native String getMessage();

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.activity_main);

		TextView text = (TextView)findViewById(R.id.my_text);
		text.setText(getMessage());
	}
} 
