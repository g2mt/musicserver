package org.msxrv.musicserver;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

public class BridgeUtils {
	public static String decodeURI(String encodedURI) {
		if (encodedURI == null) {
			return null;
		}

		StringBuilder result = new StringBuilder();
		ByteArrayOutputStream byteBuffer = new ByteArrayOutputStream();

		for (int i = 0; i < encodedURI.length(); i++) {
			char c = encodedURI.charAt(i);
			if (c == '%') {
				if (i + 2 >= encodedURI.length()) {
					throw new RuntimeException("URIError: Malformed URI");
				}

				try {
					int b = Integer.parseInt(encodedURI.substring(i + 1, i + 3), 16);
					char decodedChar = (char) b;

					if (";/?:@&=+$,#".indexOf(decodedChar) != -1) {
						if (byteBuffer.size() > 0) {
							result.append(new String(byteBuffer.toByteArray(), StandardCharsets.UTF_8));
							byteBuffer.reset();
						}
						result.append('%');
						result.append(encodedURI.substring(i + 1, i + 3).toUpperCase());
					} else {
						byteBuffer.write(b);
					}
					i += 2;
				} catch (NumberFormatException e) {
					throw new RuntimeException("URIError: Malformed URI");
				}
			} else {
				if (byteBuffer.size() > 0) {
					result.append(new String(byteBuffer.toByteArray(), StandardCharsets.UTF_8));
					byteBuffer.reset();
				}
				result.append(c);
			}
		}

		if (byteBuffer.size() > 0) {
			result.append(new String(byteBuffer.toByteArray(), StandardCharsets.UTF_8));
		}

		return result.toString();
	}
}
