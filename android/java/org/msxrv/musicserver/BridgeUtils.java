package org.msxrv.musicserver;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

public class BridgeUtils {
	public static String decodeURI(String encodedURI) {
		if (encodedURI == null) {
			return null;
		}

		ByteArrayOutputStream out = new ByteArrayOutputStream();
		int i = 0;

		while (i < encodedURI.length()) {
			char c = encodedURI.charAt(i);

			if (c != '%') {
				out.write((byte) c);
				i++;
				continue;
			}

			if (i + 2 >= encodedURI.length()) {
				throw new RuntimeException("URIError: Incomplete escape sequence");
			}

			int digit1 = Character.digit(encodedURI.charAt(i + 1), 16);
			int digit2 = Character.digit(encodedURI.charAt(i + 2), 16);

			if (digit1 == -1 || digit2 == -1) {
				throw new RuntimeException("URIError: Invalid escape sequence");
			}

			out.write((byte) ((digit1 << 4) | digit2));
			i += 3;
		}

		return new String(out.toByteArray(), StandardCharsets.UTF_8);
	}
}
