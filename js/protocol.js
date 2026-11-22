/**
 * Protocol Utilities
 * Handles BLE protocol encoding/decoding, CRC calculation, and command building
 */

import { PADDING, PROTOCOL_MARKERS } from "./constants.js";

/**
 * Calculate CRC8 checksum for BLE protocol
 * @param {Uint8Array} bytes - Input bytes
 * @returns {string} - 2-character hex string
 */
export function crc8(bytes) {
	let crc = 0;
	for (const b of bytes) {
		let x = crc ^ b;
		for (let i = 0; i < 8; i++) {
			x = x & 1 ? (x >>> 1) ^ 0x8c : x >>> 1;
		}
		crc = x & 0xff;
	}
	return crc.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * Convert hex string to Uint8Array
 * @param {string} hex - Hex string (spaces allowed)
 * @returns {Uint8Array}
 */
export function hexToBytes(hex) {
	if (!hex) return new Uint8Array();
	const clean = hex.replace(/\s+/g, "");
	if (clean.length % 2 !== 0) {
		throw new Error("Hex length must be even");
	}
	const out = new Uint8Array(clean.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = parseInt(clean.substr(i * 2, 2), 16);
	}
	return out;
}

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} u8 - Byte array
 * @returns {string} - Uppercase hex string
 */
export function bytesToHex(u8) {
	return Array.from(u8, (b) =>
		b.toString(16).toUpperCase().padStart(2, "0"),
	).join("");
}

/**
 * Convert integer to hex string with specified byte length
 * @param {number} n - Integer value
 * @param {number} bytes - Number of bytes
 * @returns {string} - Uppercase hex string
 */
export function intToHex(n, bytes) {
	return (n >>> 0)
		.toString(16)
		.toUpperCase()
		.padStart(bytes * 2, "0")
		.slice(-bytes * 2);
}

/**
 * One byte as two hex digits, refusing anything that isn't an integer
 * 0-255 (intToHex would wrap it instead)
 * @param {number} value - Byte value
 * @param {string} what - What the value is, for the error
 * @returns {string} - Uppercase hex string
 */
export function byteHex(value, what) {
	if (!Number.isInteger(value) || value < 0 || value > 255) {
		throw new RangeError(`${what} must be 0-255, got ${value}`);
	}
	return intToHex(value, 1);
}

/**
 * Convert string to UTF16-LE hex representation
 * @param {string} str - Input string
 * @returns {string} - Uppercase hex string
 */
export function utf16leHex(str) {
	if (!str) return "";
	let hex = "";
	// JS strings are UTF-16 code units already (surrogate pairs included)
	for (let i = 0; i < str.length; i++) {
		const unit = str.charCodeAt(i);
		hex += intToHex(unit & 0xff, 1) + intToHex(unit >> 8, 1);
	}
	return hex;
}

/**
 * Decode UTF16-LE bytes to string
 * @param {Uint8Array} u8 - Byte array
 * @returns {string} - Decoded string
 */
export function decodeUtf16le(u8) {
	let s = "";
	for (let i = 0; i + 1 < u8.length; i += 2) {
		const lo = u8[i];
		const hi = u8[i + 1];
		const code = (hi << 8) | lo;
		if (code === 0) continue;
		s += String.fromCharCode(code);
	}
	return s;
}

/**
 * Build command with CRC
 * @param {string} tag - Command tag (4 hex chars including AA prefix)
 * @param {string} payloadHex - Payload as hex string
 * @param {number} minBytes - Minimum payload bytes (for padding)
 * @returns {Uint8Array} - Complete command bytes with CRC
 */
export function buildCommand(tag, payloadHex = "", minBytes = PADDING.DEFAULT) {
	const p = (payloadHex || "").replace(/\s+/g, "").toUpperCase();
	const minLen = Math.max(0, (minBytes | 0) * 2);
	const padded = p.length < minLen ? p + "0".repeat(minLen - p.length) : p;
	const base = tag.toUpperCase() + padded;
	const crcValue = crc8(hexToBytes(base));
	return hexToBytes(base + crcValue);
}

/**
 * Extract ASCII string from hex
 * @param {string} hexString - Hex string
 * @returns {string} - ASCII string (printable chars only)
 */
export function getAsciiFromHex(hexString) {
	const clean = hexString.replace(/[^0-9A-F]/gi, "");
	const u8 = hexToBytes(clean);
	let out = "";
	for (const b of u8) {
		if (b >= 32 && b <= 126) {
			out += String.fromCharCode(b);
		}
	}
	return out.trim();
}

/**
 * Build filename payload with marker
 * @param {string} name - Filename
 * @param {Object} [options]
 * @param {boolean} [options.withLength] - Prepend a 1-byte length
 *   (marker + name bytes) before the marker. Required by the per-file
 *   setting commands (AAF2/F3/F4/F6/F9/CA/C9); the transfer commands
 *   (AAC0/AAC3) take the bare marker instead.
 * @returns {Object} - {fullPayload}
 */
export function buildFilenamePayload(name, { withLength = false } = {}) {
	if (!name?.trim()) {
		return { fullPayload: "00" };
	}

	const nameHex = utf16leHex(name.trim());
	const marker = PROTOCOL_MARKERS.FILENAME + nameHex;
	const fullPayload = withLength
		? intToHex(marker.length / 2, 1) + marker
		: marker;

	return { fullPayload };
}

/**
 * Convert data chunk to hex (no padding)
 * @param {Uint8Array} u8 - Full data
 * @param {number} offset - Start offset
 * @param {number} length - Chunk length
 * @returns {string} - Hex string
 */
export function chunkToHex(u8, offset, length) {
	return bytesToHex(u8.subarray(offset, Math.min(offset + length, u8.length)));
}

/**
 * Clamp a number between min and max
 * @param {number} n - Input number
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped value
 */
export function clamp(n, min, max) {
	return Math.max(min, Math.min(max, Number(n) || 0));
}

/**
 * A color as a color input's value ("#rrggbb")
 * @param {number} r - Red 0-255
 * @param {number} g - Green 0-255
 * @param {number} b - Blue 0-255
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
	return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Escape HTML special characters
 * @param {string} s - Input string
 * @returns {string} - Escaped string
 */
export function escapeHtml(s) {
	return s.replace(
		/[&<>"']/g,
		(c) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[c],
	);
}

/**
 * Light effect speed scales. The UI scale runs from 0 slowest to
 * MAX_UI_EFFECT_SPEED fastest. The device uses the inverse, 0 fastest to
 * 10 slowest, the range the manufacturer's app uses. The device takes values
 * up to 254, and also reports 255 for fastest. Same as the HA integration.
 */
export const MAX_UI_EFFECT_SPEED = 10;

/**
 * Convert device speed value to UI speed value
 * Device: 255 or 0 = fastest, 10 = slowest
 * UI: 0 = slowest, 10 = fastest
 * A device speed slower than the UI's slowest (11-254, set by older versions
 * or other tools) shows as the slowest, 0.
 * @param {number} deviceSpeed - Speed value from device (0-255)
 * @returns {number} - Speed value for UI (0-10)
 */
export function deviceSpeedToUI(deviceSpeed) {
	const speed = parseInt(deviceSpeed, 10);
	// Device speed 255 is fastest (same as 0)
	if (speed >= 255) {
		return MAX_UI_EFFECT_SPEED;
	}
	// Invert: device 0 (fast) -> UI 10 (fast)
	//         device 10 (slow) -> UI 0 (slow)
	return Math.max(0, MAX_UI_EFFECT_SPEED - speed);
}

/**
 * Convert UI speed value to device speed value
 * UI: 0 = slowest, 10 = fastest
 * Device: 0 = fastest, 10 = slowest
 * @param {number} uiSpeed - Speed value from UI (0-10)
 * @returns {number} - Speed value for device (0-10)
 */
export function uiSpeedToDevice(uiSpeed) {
	const speed = clamp(uiSpeed, 0, MAX_UI_EFFECT_SPEED);
	return MAX_UI_EFFECT_SPEED - speed;
}
