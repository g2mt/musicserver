package org.msxrv.musicserver;

public class BridgeUtils {
	public static String decodeURI(String encodedURI) {
		if (encodedURI == null) {
			return null;
		}

		StringBuilder result = new StringBuilder();
		int i = 0;

		while (i < encodedURI.length()) {
			char c = encodedURI.charAt(i);

			if (c != '%') {
				result.append(c);
				i++;
				continue;
			}

			// We have an escape sequence
			if (i + 2 >= encodedURI.length()) {
				throw new RuntimeException("URIError: Incomplete escape sequence");
			}

			int digit1 = Character.digit(encodedURI.charAt(i + 1), 16);
			int digit2 = Character.digit(encodedURI.charAt(i + 2), 16);

			if (digit1 == -1 || digit2 == -1) {
				throw new RuntimeException("URIError: Invalid escape sequence");
			}

			int firstByte = (digit1 << 4) | digit2;
			int numBytes;

			if ((firstByte & 0x80) == 0) {
				// 1-byte sequence (ASCII)
				numBytes = 1;
			} else if ((firstByte & 0xE0) == 0xC0) {
				// 2-byte sequence
				numBytes = 2;
			} else if ((firstByte & 0xF0) == 0xE0) {
				// 3-byte sequence
				numBytes = 3;
			} else if ((firstByte & 0xF8) == 0xF0) {
				// 4-byte sequence
				numBytes = 4;
			} else {
				throw new RuntimeException("URIError: Invalid UTF-8 leading byte");
			}

			if (i + (numBytes * 3) - 1 >= encodedURI.length()) {
				throw new RuntimeException("URIError: Incomplete multi-byte sequence");
			}

			int[] bytes = new int[numBytes];
			bytes[0] = firstByte;

			for (int j = 1; j < numBytes; j++) {
				if (encodedURI.charAt(i + j * 3) != '%') {
					throw new RuntimeException("URIError: Expected escape sequence");
				}

				int d1 = Character.digit(encodedURI.charAt(i + j * 3 + 1), 16);
				int d2 = Character.digit(encodedURI.charAt(i + j * 3 + 2), 16);

				if (d1 == -1 || d2 == -1) {
					throw new RuntimeException("URIError: Invalid escape sequence");
				}

				bytes[j] = (d1 << 4) | d2;
			}

			// Convert bytes to character
			char decodedChar;
			if (numBytes == 1) {
				decodedChar = (char) bytes[0];
			} else if (numBytes == 2) {
				decodedChar = (char) ((bytes[0] & 0x1F) << 6 | (bytes[1] & 0x3F));
			} else if (numBytes == 3) {
				decodedChar = (char) ((bytes[0] & 0x0F) << 12 | (bytes[1] & 0x3F) << 6 | (bytes[2] & 0x3F));
			} else {
				decodedChar = (char) ((bytes[0] & 0x07) << 18 | (bytes[1] & 0x3F) << 12 | (bytes[2] & 0x3F) << 6 | (bytes[3] & 0x3F));
			}

			result.append(decodedChar);
			i += numBytes * 3;
		}

		return result.toString();
	}
}
