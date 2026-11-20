/**
 * Skelly Ultra - Bundled Version
 * All modules combined into a single file for file:// protocol compatibility
 * 
 * Generated: 2026-11-20T17:37:27.689534
 * 
 * This is an automatically generated file.
 * To modify, edit the source modules in js/ and app-modular.js, 
 * then rebuild with: build-bundle.bat (or python3 bundle.py)
 * 
 * Source modules:
 *   - js/constants.js
 *   - js/protocol.js
 *   - js/device-settings.js
 *   - js/state-manager.js
 *   - js/ble-manager.js
 *   - js/rest-proxy.js
 *   - js/connection-manager.js
 *   - js/file-manager.js
 *   - js/protocol-parser.js
 *   - js/edit-modal.js
 *   - js/transfer-modal.js
 *   - js/elevenlabs.js
 *   - app-modular.js
 */

(() => {
  'use strict';

  // ============================================================
  // Constants and Configuration (js/constants.js)
  // ============================================================
/**
 * Constants and Configuration
 * Central location for all application constants, UUIDs, and configuration values
 */

// BLE Service UUIDs
const BLE_CONFIG = {
	SERVICE_UUID: "0000ae00-0000-1000-8000-00805f9b34fb",
	WRITE_UUID: "0000ae01-0000-1000-8000-00805f9b34fb",
	NOTIFY_UUID: "0000ae02-0000-1000-8000-00805f9b34fb",
};

// Device Types
const DEVICE_TYPES = {
	SKELLY: "skelly",
	SKELLY_12FT: "skelly12ft",
	LILY: "lily",
	SANTA: "santa",
};

// Capabilities that depend on the firmware, keys of a profile's `capabilities`.
const CAPABILITIES = {
	// Halloween and Christmas light scene presets (F1 scene byte, BBD0/BBE1 scene byte)
	LIGHT_SCENES: "lightScenes",
	// F1: set all light channels (and the scene) with one command
	SET_ALL_LIGHTS: "setAllLights",
	// CD: per-file jaw movement data, sent after an upload
	JAW_DATA: "jawData",
};

// Device Profiles — per-device UI configuration
// bleNames: the BLE names the device advertises, the first being the default.
// A device whose name contains one of them is detected as that type, and each
// is offered in the connect dialog's name filter.
// Eye images are <eyeIconFolder>/eye_icon_<1..eyeIconCount>.png
const DEVICE_PROFILES = {
	[DEVICE_TYPES.SKELLY]: {
		// "Animated Skelly" is the older (v66) firmware's name
		bleNames: ["Ultra Skelly v2", "Animated Skelly"],
		uiName: "Ultra Skelly",
		hasEyeImage: true,
		eyeIconCount: 18,
		eyeIconFolder: "images/skelly",
		movements: [
			{
				part: "all",
				label: "All",
				icon: "images/skelly/movement_all.png",
				bit: 255,
			},
			{
				part: "head",
				label: "Head",
				icon: "images/skelly/movement_head.png",
				bit: 0x01,
			},
			{
				part: "arm",
				label: "Arm",
				icon: "images/skelly/movement_arm.png",
				bit: 0x02,
			},
			{
				part: "torso",
				label: "Torso",
				icon: "images/skelly/movement_torso.png",
				bit: 0x04,
			},
		],
		lights: [
			{ label: "Torso Light", channel: "00" },
			{ label: "Head Light", channel: "01" },
		],
		lightModes: [
			{ value: 1, label: "Static" },
			{ value: 2, label: "Strobe" },
			{ value: 3, label: "Pulsing" },
		],
		// Capability -> lowest firmware version that has it (0: any version).
		// v66 (advertises "Animated Skelly") has none, v68 ("Ultra Skelly v2") has them.
		capabilities: {
			[CAPABILITIES.LIGHT_SCENES]: 68,
			[CAPABILITIES.SET_ALL_LIGHTS]: 68,
			[CAPABILITIES.JAW_DATA]: 68,
		},
	},
	[DEVICE_TYPES.SKELLY_12FT]: {
		bleNames: ["12ft Skelly"],
		uiName: "12ft Skelly",
		hasEyeImage: true,
		eyeIconCount: 20,
		eyeIconFolder: "images/skelly12ft",
		movements: [
			{
				part: "head",
				label: "Head",
				icon: "images/skelly12ft/movement_head.png",
				bit: 0x02,
			},
		],
		lights: [{ label: "Torso Light", channel: "00" }],
		lightModes: [
			{ value: 1, label: "Static" },
			{ value: 2, label: "Strobe" },
			{ value: 3, label: "Pulsing" },
		],
		capabilities: {
			[CAPABILITIES.LIGHT_SCENES]: 14,
			[CAPABILITIES.SET_ALL_LIGHTS]: 14,
			[CAPABILITIES.JAW_DATA]: 14,
		},
	},
	[DEVICE_TYPES.LILY]: {
		bleNames: ["Lethal Lily"],
		uiName: "Lethal Lily",
		hasEyeImage: false,
		movements: [
			{
				part: "all",
				label: "All",
				icon: "images/lily/movement_all.png",
				bit: 255,
			},
			{
				part: "wrist",
				label: "Wrist",
				icon: "images/lily/movement_wrist.png",
				bit: 0x01,
			},
			{
				part: "elbow",
				label: "Elbow",
				icon: "images/lily/movement_elbow.png",
				bit: 0x02,
			},
			{
				part: "head",
				label: "Head",
				icon: "images/lily/movement_head.png",
				bit: 0x10,
			},
			{
				part: "eyes",
				label: "Eyes",
				icon: "images/lily/movement_eyes.png",
				bit: 0x20,
			},
		],
		lights: [{ label: "Lantern", channel: "00" }],
		lightModes: [
			{ value: 1, label: "Flickering" },
			{ value: 2, label: "Pulsing" },
			{ value: 3, label: "Chasing" },
		],
		capabilities: {
			[CAPABILITIES.LIGHT_SCENES]: 24,
			[CAPABILITIES.SET_ALL_LIGHTS]: 24,
			[CAPABILITIES.JAW_DATA]: 24,
		},
	},
	[DEVICE_TYPES.SANTA]: {
		bleNames: ["Ultra Santa", "Santa Claus"],
		uiName: "Ultra Santa",
		hasEyeImage: false,
		movements: [
			{
				part: "all",
				label: "All",
				icon: "images/santa/movement_all.png",
				bit: 255,
			},
			{
				part: "eyes",
				label: "Eyes",
				icon: "images/santa/movement_eyes.png",
				bit: 0x01,
			},
			{
				part: "head",
				label: "Head",
				icon: "images/santa/movement_head.png",
				bit: 0x02,
			},
			{
				part: "torso",
				label: "Torso",
				icon: "images/santa/movement_torso.png",
				bit: 0x04,
			},
			{
				part: "arm",
				label: "Arm",
				icon: "images/santa/movement_arm.png",
				bit: 0x08,
			},
		],
		lights: [{ label: "Lantern", channel: "00" }],
		lightModes: [
			{ value: 1, label: "Static" },
			{ value: 2, label: "Sparkle" },
			{ value: 3, label: "Pulsing" },
		],
		// The app treats Santa as a scene model; no firmware version is known
		// yet, so any version counts as capable
		capabilities: {
			[CAPABILITIES.LIGHT_SCENES]: 0,
			[CAPABILITIES.SET_ALL_LIGHTS]: 0,
			[CAPABILITIES.JAW_DATA]: 0,
		},
	},
};

/**
 * Whether a device of this type with this firmware has a capability (one of CAPABILITIES).
 * version is the firmware as the device state holds it ("v68") or a number. Firmware below
 * the lowest tested version has none; newer, untested firmware keeps what the tested one had.
 * An unknown version (not read yet) has none.
 */
function hasCapability(deviceType, version, capability) {
	const minVersion = DEVICE_PROFILES[deviceType]?.capabilities?.[capability];
	if (minVersion == null || version == null) return false;
	const number =
		typeof version === "number"
			? version
			: Number.parseInt(String(version).replace(/^v/i, ""), 10);
	return Number.isFinite(number) && number >= minVersion;
}

// Image path for a 1-based eye icon index, or null if the device type has no eye image with that index.
function getEyeIconPath(deviceType, eyeIdx) {
	const profile = DEVICE_PROFILES[deviceType];
	if (!profile?.eyeIconFolder || eyeIdx < 1 || eyeIdx > profile.eyeIconCount) {
		return null;
	}
	return `${profile.eyeIconFolder}/eye_icon_${eyeIdx}.png`;
}

// LocalStorage Keys
const STORAGE_KEYS = {
	RISK_ACK: "skelly_ack_v2",
	ADV_RAW: "skelly_adv_raw",
	ADV_FEDC: "skelly_adv_fedc",
	CHUNK_OVERRIDE: "skelly_chunk_override",
	CHUNK_SIZE: "skelly_chunk_size",
	CHUNK_DELAY_OVERRIDE: "skelly_chunk_delay_override",
	CHUNK_DELAY: "skelly_chunk_delay",
	BITRATE_OVERRIDE: "skelly_bitrate_override",
	BITRATE: "skelly_bitrate",
	SHOW_FILE_DETAILS: "skelly_show_file_details",
	CONNECTION_TYPE: "skelly_connection_type",
	REST_URL: "skelly_rest_url",
	DEVICE_TYPE: "skelly_device_type",
	ELEVENLABS_API_KEY: "skelly_elevenlabs_api_key",
	ELEVENLABS_MODEL: "skelly_elevenlabs_model",
	ELEVENLABS_VOICE: "skelly_elevenlabs_voice",
	FILE_SOURCE: "skelly_file_source",
	LOG_FILTER_NORMAL: "skelly_log_filter_normal",
	LOG_FILTER_WARNING: "skelly_log_filter_warning",
	LOG_FILTER_TX: "skelly_log_filter_tx",
	LOG_FILTER_RX: "skelly_log_filter_rx",
};

// Protocol Padding Defaults (bytes)
const PADDING = {
	DEFAULT: 8,
};

// File Transfer Configuration
const TRANSFER_CONFIG = {
	MIN_CHUNK_SIZE: 15, // What fits the smallest BLE MTU (23 - CHUNK_OVERHEAD)
	MAX_CHUNK_SIZE: 500, // Maximum bytes per chunk (tested maximum)
	DEFAULT_CHUNK_SIZE: 250, // Conservative default for unknown MTU
	// MTU bytes a chunk can't use: the ATT write header (3) and the C1 frame
	// around the data (AA C1, index u16, CRC: 5). Same as the phone app.
	CHUNK_OVERHEAD: 8,
	// Pause between chunks, including resent ones, like the phone app's
	// 100 ms; can be overridden (MIN-MAX) in the transfer dialog
	CHUNK_DELAY_MS: 100,
	MIN_CHUNK_DELAY_MS: 10,
	MAX_CHUNK_DELAY_MS: 1000,
	// Lost chunks, handled like the phone app: after a loss report (BBC1
	// lost = 1) stop, wait LOSS_WAIT_MS then RESUME_WAIT_MS (a new report
	// starts the wait over), and resend from the reported chunk. A failed
	// BBC2 is handled the same way, followed by C2 again. Too many of either:
	// the attempt fails and the upload starts over with half-size chunks, up
	// to MAX_ATTEMPTS attempts in all.
	LOSS_WAIT_MS: 1000,
	RESUME_WAIT_MS: 2000,
	REPEAT_WINDOW_MS: 1000, // repeats of a report within this count once
	MAX_LOSSES: 10, // the app gives up after 10 loss reports
	MAX_FAILED_ENDS: 3, // failed BBC2s before the attempt counts as failed
	MAX_ATTEMPTS: 3,
	// Device silently drops the upload (transfer/confirm still ack with
	// failed=0, but the file never appears in the file list) if the filename
	// exceeds this — confirmed empirically: 33 chars works, 34 chars fails.
	// Keep in sync with the #fileName input's maxlength attribute in index.html.
	MAX_FILENAME_LENGTH: 33,
};

// Delay between per-file setting commands in "Apply All" - AAF4/AACA/etc. are
// write-without-response with no ACK, so back-to-back writes can be dropped without warning.
const APPLY_ALL_COMMAND_DELAY_MS = 40;

// Timeout Values (milliseconds)
const TIMEOUTS = {
	ACK: 5000,
	FILE_TRANSFER: 240000,
	FILE_LIST: 6000,
	FILE_ORDER: 5000, // Wait for the play order (BBD1) once the file list is complete
};

// Audio Configuration
const AUDIO_CONFIG = {
	// Uploads are mono CBR MP3 at 32 kbps, like the phone app's. Audio is resampled
	// to 44.1 kHz, the app's rate, for the encoder; lamejs can't be told the output
	// rate and encodes 32 kbps at 22.05 kHz (MPEG-2), like the app's cloud voices,
	// and 64 kbps and up at 44.1 kHz.
	TARGET_SAMPLE_RATE: 44100,
	TARGET_CHANNELS: 1, // mono
	DEFAULT_MP3_KBPS: 32,
	MP3_ENCODE_BLOCK_SIZE: 1152,
};

// BLE Command Tags
// Frames: AA <tag> <payload, padded to 8 bytes> <crc8>. Payload layouts, replies
// and device quirks are in PROTOCOL.md in the Home Assistant integration repo:
// https://github.com/martinecker/SkellyUltra/blob/main/PROTOCOL.md
const COMMANDS = {
	// File Transfer
	START_TRANSFER: "AAC0", // size u32, chunk count u16, bare name -> BBC0
	CHUNK_DATA: "AAC1", // index u16, data (the app sends MTU - 8) -> BBC1
	END_TRANSFER: "AAC2", // 00 -> BBC2
	CONFIRM_TRANSFER: "AAC3", // bare name -> BBC3
	CANCEL: "AAC4", // 00 -> BBC4
	RESUME: "AAC5", // payload unknown; the app never sends it
	PLAY_PAUSE: "AAC6", // serial u16, 01 play / 00 stop -> BBC6
	DELETE: "AAC7", // serial u16, cluster u32 -> BBC7
	FORMAT: "AAC8", // 00 -> BBC8; erases every file
	SET_ORDER: "AAC9", // total, position (1-based), serial u16, name

	// Device Queries (payload 00)
	QUERY_PARAMS: "AAE0", // -> BBE0
	QUERY_LIVE: "AAE1", // -> BBE1
	QUERY_VOLUME: "AAE5", // -> BBE5
	QUERY_BT_NAME: "AAE6", // -> BBE6
	QUERY_VERSION: "AAEE", // -> BBEE
	QUERY_FILES: "AAD0", // -> one BBD0 per file
	QUERY_ORDER: "AAD1", // -> BBD1
	QUERY_CAPACITY: "AAD2", // -> BBD2

	// Various Controls
	SET_VOLUME: "AAFA", // volume (0-100)
	SET_PIN_AND_NAME: "AAFB", // PIN 4 ASCII, password 8 ASCII, len, name ASCII
	MEDIA_PLAY_PAUSE: "AAFC", // 01 play / 00 pause (not used here)
	ENABLE_CLASSIC_BT: "AAFD", // 01 -> BBFD; live mode audio link
	SET_MUSIC_MODE: "AAFE", // 00 device music, 01 classic BT (app no longer sends it)

	// Lighting: ch is 0-5 or FF (all); cluster 0 + empty name = live settings
	SET_ALL_LIGHTS: "AAF1", // cluster u32, audioMode, scene, 6 x 7 light bytes
	SET_MODE: "AAF2", // ch, mode (1 static, 2 strobe, 3 pulsing), cluster u32, name
	SET_BRIGHTNESS: "AAF3", // ch, brightness (0-255), cluster u32, name
	SET_RGB: "AAF4", // ch, R, G, B, color cycle, cluster u32, name
	SELECT_RGB_CHANNEL: "AAF5", // ch (the channel the app's picker edits)
	SET_SPEED: "AAF6", // ch, speed (0 fastest-254 slowest; 255 is also fastest; app uses 0-10), cluster u32, name

	// Appearance: cluster 0 + empty name = live settings
	SET_EYE: "AAF9", // icon (1-based), 00, cluster u32, name
	SET_MOVEMENT: "AACA", // movement bits (per device), 00, cluster u32, name
	SET_JAW_DATA: "AACD", // cluster u32, byte count, bitmap (1 bit per 60 ms)

	// Wi-Fi (no known product has it)
	SET_WIFI_POWER: "AACB", // on/off
	QUERY_WIFI_MAC: "AACC", // 00 -> BBCC
};

// Response Prefixes
// Frames: BB <tag> <payload> <crc8>. Byte layouts are in PROTOCOL.md (section 7).
const RESPONSES = {
	DEVICE_PARAMS: "BBE0", // channels, PIN, Wi-Fi password, show mode, name
	LIVE_STATUS: "BBE1", // movement, 6 lights, eye icon, scene (scene firmware)
	CAPACITY: "BBD2", // free KB u32, file count, mode
	ORDER: "BBD1", // count, serials u16 in play order
	FILE_INFO: "BBD0", // one file: serial, cluster, total, settings, name
	VOLUME: "BBE5", // volume
	BT_NAME: "BBE6", // len, classic BT name ASCII
	VERSION: "BBEE", // firmware version, e.g. 0x44 = v68
	ENABLE_CLASSIC_BT: "BBFD", // classic BT on

	TRANSFER_START: "BBC0", // failed, written u32
	CHUNK_DROPPED: "BBC1", // lost (0 = none, 1 = resend from index), index u16
	TRANSFER_END: "BBC2", // failed, last chunk index u16
	CONFIRM_TRANSFER_ACK: "BBC3", // failed
	CANCEL_ACK: "BBC4", // failed
	RESUME_ACK: "BBC5", // written u32 (the app never uses it)
	PLAY_ACK: "BBC6", // serial u16, playing, duration u16 (s); also when a file ends
	DELETE_ACK: "BBC7", // failed (0 = deleted)
	FORMAT_ACK: "BBC8", // result (0 = done)
	WIFI_MAC: "BBCC", // Wi-Fi MAC, 6 bytes

	KEEPALIVE: "FEDC", // FE DC <payload> EF, sent by the device on its own
};

// Log CSS Classes
const LOG_CLASSES = {
	NORMAL: "",
	WARNING: "warn",
	TX: "tx",
	RX: "rx",
};

// Light scene presets, in file info (BBD0), live status (BBE1) and F1
const LIGHT_SCENES = Object.freeze({
	CUSTOM: 0, // each light channel's own settings
	HALLOWEEN: 1,
	CHRISTMAS: 2,
});

// The colors the phone app sends with a scene preset: channel 0 the first,
// all other channels the second. The device plays its own palette anyway.
const LIGHT_SCENE_COLORS = Object.freeze({
	[LIGHT_SCENES.HALLOWEEN]: ["FD942A", "7637FD"], // orange, purple
	[LIGHT_SCENES.CHRISTMAS]: ["960100", "036400"], // red, green
});

// File name marker in protocol
const PROTOCOL_MARKERS = {
	FILENAME: "5C55", // UTF16LE filename marker
};

// Firmware versions that have been tested, keyed by device type then version string.
const KNOWN_FIRMWARE = {
	[DEVICE_TYPES.SKELLY]: {
		v66: {},
		v68: {},
	},
	[DEVICE_TYPES.SKELLY_12FT]: {
		v14: {},
	},
	[DEVICE_TYPES.LILY]: {
		v24: {},
	},
};

  // ============================================================
  // Protocol Utilities (js/protocol.js)
  // ============================================================
/**
 * Protocol Utilities
 * Handles BLE protocol encoding/decoding, CRC calculation, and command building
 */

/**
 * Calculate CRC8 checksum for BLE protocol
 * @param {Uint8Array} bytes - Input bytes
 * @returns {string} - 2-character hex string
 */
function crc8(bytes) {
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
function hexToBytes(hex) {
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
function bytesToHex(u8) {
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
function intToHex(n, bytes) {
	return (n >>> 0)
		.toString(16)
		.toUpperCase()
		.padStart(bytes * 2, "0")
		.slice(-bytes * 2);
}

/**
 * Convert string to UTF16-LE hex representation
 * @param {string} str - Input string
 * @returns {string} - Uppercase hex string
 */
function utf16leHex(str) {
	if (!str) return "";
	let hex = "";
	for (const ch of str) {
		const cp = ch.codePointAt(0);
		if (cp <= 0xffff) {
			const lo = cp & 0xff;
			const hi = (cp >> 8) & 0xff;
			hex +=
				lo.toString(16).padStart(2, "0") + hi.toString(16).padStart(2, "0");
		} else {
			// Surrogate pair for characters outside BMP
			const v = cp - 0x10000;
			const hiS = 0xd800 + ((v >> 10) & 0x3ff);
			const loS = 0xdc00 + (v & 0x3ff);
			hex +=
				(hiS & 0xff).toString(16).padStart(2, "0") +
				((hiS >> 8) & 0xff).toString(16).padStart(2, "0");
			hex +=
				(loS & 0xff).toString(16).padStart(2, "0") +
				((loS >> 8) & 0xff).toString(16).padStart(2, "0");
		}
	}
	return hex.toUpperCase();
}

/**
 * Decode UTF16-LE bytes to string
 * @param {Uint8Array} u8 - Byte array
 * @returns {string} - Decoded string
 */
function decodeUtf16le(u8) {
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
function buildCommand(tag, payloadHex = "", minBytes = PADDING.DEFAULT) {
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
function getAsciiFromHex(hexString) {
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
function buildFilenamePayload(name, { withLength = false } = {}) {
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
function chunkToHex(u8, offset, length) {
	const end = Math.min(offset + length, u8.length);
	const chunk = u8.subarray(offset, end);
	return Array.from(chunk, (b) =>
		b.toString(16).toUpperCase().padStart(2, "0"),
	).join("");
}

/**
 * Clamp a number between min and max
 * @param {number} n - Input number
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped value
 */
function clamp(n, min, max) {
	return Math.max(min, Math.min(max, Number(n) || 0));
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Escape HTML special characters
 * @param {string} s - Input string
 * @returns {string} - Escaped string
 */
function escapeHtml(s) {
	return s.replace(
		/[&<>"]/g,
		(c) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
			})[c],
	);
}

/**
 * Light effect speed scales. The UI scale runs from 0 slowest to
 * MAX_UI_EFFECT_SPEED fastest. The device uses the inverse, 0 fastest to
 * 10 slowest, the range the manufacturer's app uses. The device takes values
 * up to 254, and also reports 255 for fastest. Same as the HA integration.
 */
const MAX_UI_EFFECT_SPEED = 10;

/**
 * Convert device speed value to UI speed value
 * Device: 255 or 0 = fastest, 10 = slowest
 * UI: 0 = slowest, 10 = fastest
 * A device speed slower than the UI's slowest (11-254, set by older versions
 * or other tools) shows as the slowest, 0.
 * @param {number} deviceSpeed - Speed value from device (0-255)
 * @returns {number} - Speed value for UI (0-10)
 */
function deviceSpeedToUI(deviceSpeed) {
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
function uiSpeedToDevice(uiSpeed) {
	const speed = clamp(uiSpeed, 0, MAX_UI_EFFECT_SPEED);
	return MAX_UI_EFFECT_SPEED - speed;
}

  // ============================================================
  // Device Settings Commands (js/device-settings.js)
  // ============================================================
/**
 * Device Settings Commands
 * Convenience wrappers for the per-file light/movement/eye setting commands
 * (AAF2/F3/F4/F6/F9/CA), which all share the same cluster+filename addressing
 * scheme. Centralizes payload construction so callers (Apply All in the edit
 * modal, and the post-overwrite settings restore in the file manager) don't
 * each reimplement it.
 */

function hex2(n) {
	return (n || 0).toString(16).padStart(2, "0").toUpperCase();
}

function targetPayload(cluster, fileName, dataHex) {
	const clusterHex = cluster.toString(16).padStart(8, "0").toUpperCase();
	const { fullPayload: filenamePart } = buildFilenamePayload(fileName, {
		withLength: true,
	});
	return dataHex + clusterHex + filenamePart;
}

/**
 * Send movement animation (CA).
 * @param {number} actionBits - Bitfield (0x01 head, 0x02 arm, 0x04 torso, 0xFF all)
 */
function sendSetMovement(connection, cluster, fileName, actionBits) {
	return connection.send(
		buildCommand(
			COMMANDS.SET_MOVEMENT,
			targetPayload(cluster, fileName, `${hex2(actionBits)}00`),
			8,
		),
	);
}

/**
 * Send eye icon (F9). Only meaningful on devices with an eye image (e.g.
 * Skelly, not Lily) — callers should gate on DEVICE_PROFILES[...].hasEyeImage.
 */
function sendSetEye(connection, cluster, fileName, eyeIcon) {
	return connection.send(
		buildCommand(
			COMMANDS.SET_EYE,
			targetPayload(cluster, fileName, `${hex2(eyeIcon)}00`),
			8,
		),
	);
}

/** Send light brightness (F3) for a channel (0-5, or 0xFF for all). */
function sendSetLightBrightness(
	connection,
	cluster,
	fileName,
	channel,
	brightness,
) {
	return connection.send(
		buildCommand(
			COMMANDS.SET_BRIGHTNESS,
			targetPayload(
				cluster,
				fileName,
				`${intToHex(channel, 1)}${hex2(brightness)}`,
			),
			8,
		),
	);
}

/** Send light effect mode (F2) for a channel (1=static, 2=strobe, 3=pulsing). */
function sendSetLightMode(
	connection,
	cluster,
	fileName,
	channel,
	effectMode,
) {
	return connection.send(
		buildCommand(
			COMMANDS.SET_MODE,
			targetPayload(
				cluster,
				fileName,
				`${intToHex(channel, 1)}${hex2(effectMode)}`,
			),
			8,
		),
	);
}

/**
 * Send light effect speed (F6) for a channel. Expects a device-scale value
 * (use uiSpeedToDevice() first if converting from the UI slider scale).
 */
function sendSetLightSpeed(
	connection,
	cluster,
	fileName,
	channel,
	effectSpeed,
) {
	return connection.send(
		buildCommand(
			COMMANDS.SET_SPEED,
			targetPayload(
				cluster,
				fileName,
				`${intToHex(channel, 1)}${hex2(effectSpeed)}`,
			),
			8,
		),
	);
}

/** Send light RGB color + color-cycle flag (F4) for a channel. */
function sendSetLightRgb(
	connection,
	cluster,
	fileName,
	channel,
	r,
	g,
	b,
	colorCycle,
) {
	const cycleHex = colorCycle ? "01" : "00";
	return connection.send(
		buildCommand(
			COMMANDS.SET_RGB,
			targetPayload(
				cluster,
				fileName,
				`${intToHex(channel, 1)}${hex2(r)}${hex2(g)}${hex2(b)}${cycleHex}`,
			),
			8,
		),
	);
}

// F1 always carries this many light channels
const ALL_LIGHT_CHANNELS = 6;

function byteHex(value, what) {
	if (!Number.isInteger(value) || value < 0 || value > 255) {
		throw new RangeError(`${what} must be 0-255, got ${value}`);
	}
	return value.toString(16).padStart(2, "0").toUpperCase();
}

/**
 * Build F1: every light channel and the light scene in one command.
 *
 * Only for firmware with the setAllLights capability (see
 * hasCapability): older firmware (the v66 Ultra) doesn't know F1.
 * applyFileSettings uses it when given a scene (see currentLightScene).
 *
 * @param {Array<Object>} lights - Channels from 0 on (1-6), each
 *   {effectMode, brightness, r, g, b, colorCycle, effectSpeed} in device
 *   units. F1 always carries 6; the missing ones repeat the given channels
 *   in turn, as the phone app fills them.
 * @param {number} [cluster] - 0 for the live lights, else that file's.
 *   Unlike F2-F6 there is no file name; the app sends audio mode 0 with
 *   cluster 0 and 1 with a file's cluster, and so does this.
 * @param {number} [scene] - LIGHT_SCENES value
 * @returns {Uint8Array} The command frame
 */
function buildSetAllLightsCommand(
	lights,
	cluster = 0,
	scene = LIGHT_SCENES.CUSTOM,
) {
	if (!Array.isArray(lights) || lights.length < 1) {
		throw new RangeError("F1 needs at least one light channel");
	}
	if (lights.length > ALL_LIGHT_CHANNELS) {
		throw new RangeError(
			`F1 takes at most ${ALL_LIGHT_CHANNELS} light channels, got ${lights.length}`,
		);
	}
	if (!Number.isInteger(cluster) || cluster < 0 || cluster > 0xffffffff) {
		throw new RangeError(`Cluster must be 0-${0xffffffff}, got ${cluster}`);
	}
	let channelsHex = "";
	for (let channel = 0; channel < ALL_LIGHT_CHANNELS; channel++) {
		const light = lights[channel % lights.length];
		if (![1, 2, 3].includes(light.effectMode)) {
			throw new RangeError(`Light mode must be 1-3, got ${light.effectMode}`);
		}
		channelsHex +=
			byteHex(light.effectMode, "Light mode") +
			byteHex(light.brightness, "Brightness") +
			byteHex(light.r, "Red") +
			byteHex(light.g, "Green") +
			byteHex(light.b, "Blue") +
			byteHex(light.colorCycle ? 1 : 0, "Color cycle") +
			byteHex(light.effectSpeed, "Speed");
	}
	return buildCommand(
		COMMANDS.SET_ALL_LIGHTS,
		intToHex(cluster, 4) +
			(cluster === 0 ? "00" : "01") + // audio mode: live / file
			byteHex(scene, "Scene") +
			channelsHex,
		8,
	);
}

/**
 * The current light scene, to send when setting all lights at once (F1), or
 * null when the lights must go out channel by channel instead: firmware
 * without F1 (or not read yet), or a scene that isn't known. F1 always sets the scene too, so sending the one the file
 * (or the device) already has keeps a Halloween or Christmas scene on.
 *
 * @param {string} deviceType - DEVICE_PROFILES key
 * @param {string|number|null} version - Firmware ("v68") or null
 * @param {number|null|undefined} scene - Current LIGHT_SCENES value
 * @returns {number|null}
 */
function currentLightScene(deviceType, version, scene) {
	if (!Number.isInteger(scene)) return null;
	return hasCapability(deviceType, version, CAPABILITIES.SET_ALL_LIGHTS)
		? scene
		: null;
}

/**
 * Whether the light scene picker (Custom / Halloween / Christmas) applies:
 * the firmware knows scenes and F1, which is the only command that sets one.
 *
 * @param {string} deviceType - DEVICE_PROFILES key
 * @param {string|number|null} version - Firmware ("v68") or null
 * @returns {boolean}
 */
function supportsLightScenes(deviceType, version) {
	return (
		hasCapability(deviceType, version, CAPABILITIES.LIGHT_SCENES) &&
		hasCapability(deviceType, version, CAPABILITIES.SET_ALL_LIGHTS)
	);
}

/**
 * Whether a scene preset is on (Halloween or Christmas). The device then
 * ignores the channel colors and color cycle and plays the scene's own
 * colors; mode, brightness and speed still apply.
 *
 * @param {number|null|undefined} scene - LIGHT_SCENES value or null
 * @returns {boolean}
 */
function isScenePreset(scene) {
	return Number.isInteger(scene) && scene !== LIGHT_SCENES.CUSTOM;
}

/**
 * The color a light channel shows (and F1 carries) in a scene preset, as
 * the phone app sends it: channel 0 the scene's first color, the others
 * the second, no color cycle.
 *
 * @param {number} scene - LIGHT_SCENES value
 * @param {number} channel - Light channel from 0
 * @returns {{r: number, g: number, b: number, colorCycle: number}|null}
 *   null for Custom or a scene without known colors
 */
function sceneLightColor(scene, channel) {
	const colors = LIGHT_SCENE_COLORS[scene];
	if (!colors) return null;
	const hex = colors[channel === 0 ? 0 : 1];
	return {
		r: parseInt(hex.slice(0, 2), 16),
		g: parseInt(hex.slice(2, 4), 16),
		b: parseInt(hex.slice(4, 6), 16),
		colorCycle: 0,
	};
}

// All channels 0..n-1 present with a mode F1 takes; otherwise per channel.
function allChannelsComplete(lights) {
	return (
		lights.length > 0 &&
		lights.length <= ALL_LIGHT_CHANNELS &&
		lights.every((light) => light && [1, 2, 3].includes(light.effectMode))
	);
}

/**
 * Send the full set of per-file settings (movement, eye, every light
 * channel) in the order the device expects, pacing writes with `delayMs`
 * between each (write-without-response commands can be dropped if sent
 * back-to-back).
 *
 * @param {Object} connection - BLE connection manager (has .send)
 * @param {number} cluster - Device-assigned cluster for the file
 * @param {string} fileName - Filename to address
 * @param {Object} settings
 * @param {number} settings.action - Movement bitfield
 * @param {number} [settings.eye] - Eye icon (ignored unless hasEyeImage)
 * @param {Array<Object>} settings.lights - One entry per light channel, index
 *   = channel number (device supports up to 6, but most device types only
 *   use 1 or 2). Each entry: {brightness, effectMode, effectSpeed, r, g, b, colorCycle}
 * @param {Object} [options]
 * @param {boolean} [options.hasEyeImage] - Whether to send the eye command
 * @param {number} [options.delayMs] - Delay between commands
 * @param {(label: string) => void} [options.onStep] - Called after each command sends
 * @param {number|null} [options.scene] - From currentLightScene: when set, all
 *   lights go in one F1 with this scene instead of F2/F3/F4/F6 per channel
 * @returns {Promise<void>}
 */
async function applyFileSettings(
	connection,
	cluster,
	fileName,
	settings,
	{ hasEyeImage = false, delayMs = 0, onStep, scene = null } = {},
) {
	const step = async (label, send) => {
		await send();
		onStep?.(label);
		if (delayMs) await sleep(delayMs);
	};

	await step(`Movement (CA) action=${settings.action}`, () =>
		sendSetMovement(connection, cluster, fileName, settings.action),
	);

	if (hasEyeImage) {
		await step(`Eye (F9) icon=${settings.eye}`, () =>
			sendSetEye(connection, cluster, fileName, settings.eye),
		);
	}

	// Devices can report up to 6 light channels; how many are actually used
	// depends on the device type (currently 1 for Lily, 2 for Skelly), so
	// iterate whatever the caller provides rather than assuming a fixed count.
	const lights = settings.lights || [];
	if (scene != null && allChannelsComplete(lights)) {
		// F1 has no file name: it addresses the file by cluster alone
		await step(`All lights (F1) channels=${lights.length} scene=${scene}`, () =>
			connection.send(buildSetAllLightsCommand(lights, cluster, scene)),
		);
		return;
	}
	for (let channel = 0; channel < lights.length; channel++) {
		const light = lights[channel];
		if (!light) continue;

		await step(
			`Light ${channel} Brightness (F3) brightness=${light.brightness}`,
			() =>
				sendSetLightBrightness(
					connection,
					cluster,
					fileName,
					channel,
					light.brightness,
				),
		);

		await step(
			`Light ${channel} Effect Mode (F2) mode=${light.effectMode}`,
			() =>
				sendSetLightMode(
					connection,
					cluster,
					fileName,
					channel,
					light.effectMode,
				),
		);

		if ((light.effectMode || 1) !== 1) {
			await step(
				`Light ${channel} Effect Speed (F6) speed=${light.effectSpeed}`,
				() =>
					sendSetLightSpeed(
						connection,
						cluster,
						fileName,
						channel,
						light.effectSpeed,
					),
			);
		}

		await step(
			`Light ${channel} Color (F4) rgb=${light.r},${light.g},${light.b} cycle=${light.colorCycle}`,
			() =>
				sendSetLightRgb(
					connection,
					cluster,
					fileName,
					channel,
					light.r,
					light.g,
					light.b,
					light.colorCycle,
				),
		);
	}
}

  // ============================================================
  // State Manager (js/state-manager.js)
  // ============================================================
/**
 * State Manager
 * Centralized application state with observer pattern for reactive updates
 */

/**
 * Application State Manager
 * Manages device status, file list, and transfer state with change notifications
 */
class StateManager {
	constructor() {
		// Device state
		this.device = {
			name: "",
			btName: "",
			connected: false,
			showMode: null,
			version: null,
			channels: [],
			volume: null,
			capacity: null,
			filesReported: null, // Count reported by device in capacity query
			filesReceived: null, // Count of files actually received in file list
			order: null, // Music play order
			pin: null, // Device PIN
		};

		// Active device type (drives UI profile)
		this.deviceType = DEVICE_TYPES.SKELLY;

		// Live status (action, eye icon, lights, LIGHT_SCENES value or null without scenes)
		this.live = {
			action: null,
			eye: null,
			lights: [],
			scene: null,
		};

		// File list state
		this.files = {
			expected: null,
			items: new Map(), // serial -> file object
			activeFetch: false, // When true, UI is disabled waiting for complete list
			fetchTimer: null,
			orderRequested: false, // D2/D1 sent for this refresh (the list was complete)
			lastRefresh: null, // Timestamp of last successful refresh
		};

		// Transfer state
		this.transfer = {
			inProgress: false,
			cancel: false,
		};

		// Observers: key -> Set of callbacks
		this.observers = new Map();
	}

	/**
	 * Subscribe to state changes
	 * @param {string} key - State key to watch (e.g., 'device', 'files', 'transfer')
	 * @param {Function} callback - Callback function to invoke on changes
	 * @returns {Function} - Unsubscribe function
	 */
	subscribe(key, callback) {
		if (!this.observers.has(key)) {
			this.observers.set(key, new Set());
		}
		this.observers.get(key).add(callback);

		// Return unsubscribe function
		return () => {
			const observers = this.observers.get(key);
			if (observers) {
				observers.delete(callback);
			}
		};
	}

	/**
	 * Notify observers of state changes
	 * @param {string} key - State key that changed
	 */
	notify(key) {
		const observers = this.observers.get(key);
		if (observers) {
			observers.forEach((callback) => {
				try {
					callback(this[key]);
				} catch (error) {
					console.error(`Error in observer for ${key}:`, error);
				}
			});
		}
	}

	/**
	 * Set the active device type and notify observers
	 * @param {string} type - DEVICE_TYPES value
	 */
	setDeviceType(type) {
		this.deviceType = type;
		this.notify("deviceType");
	}

	// === Device State Methods ===

	/**
	 * Update device state
	 * @param {Object} updates - Partial device state updates
	 */
	updateDevice(updates) {
		Object.assign(this.device, updates);
		this.notify("device");
	}

	/**
	 * Set connection status
	 * @param {boolean} connected - Connection status
	 */
	setConnected(connected) {
		this.device.connected = connected;
		this.notify("device");
	}

	/**
	 * Update live status
	 * @param {Object} updates - Partial live status updates
	 */
	updateLive(updates) {
		Object.assign(this.live, updates);
		this.notify("live");
	}

	// === File State Methods ===

	/**
	 * Reset file list state and clear old items
	 */
	resetFiles() {
		this.files.expected = null;
		this.files.items.clear(); // Clear old items immediately at start of refresh
		this.files.activeFetch = false;
		this.files.orderRequested = false;
		if (this.files.fetchTimer) {
			clearTimeout(this.files.fetchTimer);
			this.files.fetchTimer = null;
		}
		this.notify("files");
	}

	/**
	 * Add or update a file in the list
	 * @param {number} serial - File serial number
	 * @param {Object} fileData - File data object
	 */
	setFile(serial, fileData) {
		this.files.items.set(serial, fileData);
		// Never notify during active fetch - wait until order arrives
		if (!this.files.activeFetch) {
			this.notify("files");
		}
	}

	/**
	 * Get file by serial number
	 * @param {number} serial - File serial number
	 * @returns {Object|undefined} - File data or undefined
	 */
	getFile(serial) {
		return this.files.items.get(serial);
	}

	/**
	 * Check if a filename exists on device
	 * @param {string} name - Filename to check
	 * @returns {Object|null} - File object if found, null otherwise
	 */
	hasFileName(name) {
		if (!name) return null;
		const needle = name.trim().toLowerCase();
		for (const file of this.files.items.values()) {
			if ((file.name || "").trim().toLowerCase() === needle) {
				return file;
			}
		}
		return null;
	}

	/**
	 * Update file list metadata
	 * @param {Object} updates - Updates to files metadata
	 */
	updateFilesMetadata(updates) {
		Object.assign(this.files, updates);
		this.notify("files");
	}

	/**
	 * Check if file list is complete
	 * @returns {boolean}
	 */
	isFileListComplete() {
		return (
			this.files.expected !== null &&
			this.files.items.size >= this.files.expected
		);
	}

	// === Transfer State Methods ===

	/**
	 * Start a transfer
	 */
	startTransfer() {
		this.transfer.inProgress = true;
		this.transfer.cancel = false;
		this.notify("transfer");
	}

	/**
	 * Cancel transfer
	 */
	cancelTransfer() {
		this.transfer.cancel = true;
		this.notify("transfer");
	}

	/**
	 * End transfer
	 */
	endTransfer() {
		this.transfer.inProgress = false;
		this.transfer.cancel = false;
		this.notify("transfer");
	}
}

  // ============================================================
  // BLE Manager (js/ble-manager.js)
  // ============================================================
/**
 * BLE Manager
 * Handles all Bluetooth Low Energy communication with the device
 */

/**
 * BLE Connection and Communication Manager
 */
class BLEManager {
	constructor(stateManager, logger) {
		this.state = stateManager;
		this.log = logger;

		// BLE objects
		this.device = null;
		this.server = null;
		this.service = null;
		this.writeCharacteristic = null;
		this.notifyCharacteristic = null;

		// Connection state
		this.isConnecting = false;

		// Notification handlers
		this.notificationHandlers = [];

		// ACK waiters for request/response patterns
		this.waiters = [];

		// Bind methods to preserve 'this' context
		this.handleDisconnect = this.handleDisconnect.bind(this);
		this.handleNotification = this.handleNotification.bind(this);
	}

	/**
	 * Check if device is connected
	 * @returns {boolean}
	 */
	isConnected() {
		return !!(this.device?.gatt?.connected && this.writeCharacteristic);
	}

	/**
	 * Get the BLE MTU size if available
	 * @returns {number|null} MTU size in bytes, or null if not available
	 */
	getMtuSize() {
		try {
			// Web Bluetooth API doesn't expose MTU directly in most browsers
			// Some browsers may have it on the server object
			if (this.server && typeof this.server.mtu === "number") {
				return this.server.mtu;
			}

			// Check if device has mtu property (non-standard)
			if (this.device && typeof this.device.mtu === "number") {
				return this.device.mtu;
			}
		} catch (_error) {
			// Silently fail - MTU not available
		}
		return null;
	}

	/**
	 * Connect to a BLE device
	 * @param {string} nameFilter - Optional device name prefix filter
	 * @returns {Promise<void>}
	 */
	async connect(nameFilter = "") {
		try {
			// Set connecting flag to prevent disconnect handler from clearing device during retries
			this.isConnecting = true;

			// Request device
			const options = nameFilter.trim()
				? {
						filters: [{ namePrefix: nameFilter.trim() }],
						optionalServices: [BLE_CONFIG.SERVICE_UUID],
					}
				: {
						acceptAllDevices: true,
						optionalServices: [BLE_CONFIG.SERVICE_UUID],
					};

			this.device = await navigator.bluetooth.requestDevice(options);
			this.device.addEventListener(
				"gattserverdisconnected",
				this.handleDisconnect,
			);

			this.log(
				`Selected: ${this.device.name || "(unnamed)"} ${this.device.id}`,
				LOG_CLASSES.WARNING,
			);

			// Connect to GATT server with retry logic
			const maxRetries = 3;
			let lastError = null;

			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				try {
					// Add small delay before connection attempt (helps with timing issues)
					if (attempt > 1) {
						this.log(`Retry ${attempt}/${maxRetries}...`, LOG_CLASSES.WARNING);
						await new Promise((resolve) => setTimeout(resolve, 500));
					}

					// Connect to GATT server
					this.server = await this.device.gatt.connect();

					// Small delay after connection to let it stabilize
					await new Promise((resolve) => setTimeout(resolve, 100));

					// Verify still connected
					if (!this.server.connected) {
						throw new Error("Connection lost immediately after connect");
					}

					this.service = await this.server.getPrimaryService(
						BLE_CONFIG.SERVICE_UUID,
					);

					// Get characteristics
					this.writeCharacteristic = await this.service.getCharacteristic(
						BLE_CONFIG.WRITE_UUID,
					);
					this.notifyCharacteristic = await this.service.getCharacteristic(
						BLE_CONFIG.NOTIFY_UUID,
					);

					// Start notifications
					await this.notifyCharacteristic.startNotifications();
					this.notifyCharacteristic.addEventListener(
						"characteristicvaluechanged",
						this.handleNotification,
					);

					// Update state
					this.state.updateDevice({
						name: this.device.name || "",
						connected: true,
					});

					this.log(
						"Connected and notifications started ✓",
						LOG_CLASSES.WARNING,
					);

					// Clear connecting flag on success
					this.isConnecting = false;

					return true;
				} catch (error) {
					lastError = error;

					// If not the last attempt, continue to retry
					if (attempt < maxRetries) {
						this.log(
							`Connection attempt ${attempt} failed: ${error.message}`,
							LOG_CLASSES.WARNING,
						);
					}
				}
			}

			// All retries exhausted
			throw new Error(
				`Failed after ${maxRetries} attempts. Last error: ${lastError?.message || "Unknown error"}`,
			);
		} catch (error) {
			this.log(`Connect error: ${error.message}`, LOG_CLASSES.WARNING);

			// Clear connecting flag on error
			this.isConnecting = false;

			// Clean up on connection failure
			if (this.device) {
				this.device.removeEventListener(
					"gattserverdisconnected",
					this.handleDisconnect,
				);
				this.device = null;
			}
			this.server = null;
			this.service = null;
			this.writeCharacteristic = null;
			this.notifyCharacteristic = null;
			this.state.setConnected(false);

			throw error;
		}
	}

	/**
	 * Disconnect from device
	 * @returns {Promise<void>}
	 */
	async disconnect() {
		try {
			// Stop notifications
			if (this.notifyCharacteristic) {
				try {
					await this.notifyCharacteristic.stopNotifications();
				} catch (_error) {
					// Ignore errors during cleanup
				}
				this.notifyCharacteristic.removeEventListener(
					"characteristicvaluechanged",
					this.handleNotification,
				);
			}

			// Disconnect GATT. handleDisconnect runs below, so the
			// gattserverdisconnected event must not run it a second time.
			if (this.device) {
				this.device.removeEventListener(
					"gattserverdisconnected",
					this.handleDisconnect,
				);
				if (this.device.gatt.connected) {
					this.device.gatt.disconnect();
				}
			}
		} finally {
			this.handleDisconnect();
		}
	}

	/**
	 * Handle disconnect event
	 */
	handleDisconnect() {
		// If we're in the middle of connecting, don't clear the device reference
		// as the retry logic needs it. Only log the disconnect.
		if (this.isConnecting) {
			this.log(
				"Disconnected during connection attempt (will retry)",
				LOG_CLASSES.WARNING,
			);
			return;
		}

		this.log("Disconnected", LOG_CLASSES.WARNING);

		// Clear BLE objects
		this.device = null;
		this.server = null;
		this.service = null;
		this.writeCharacteristic = null;
		this.notifyCharacteristic = null;

		// Fail pending waiters now rather than at their timeout
		this.clearWaiters();

		// Update state
		this.state.setConnected(false);
		this.state.updateFilesMetadata({ activeFetch: false });
		if (this.state.files.fetchTimer) {
			clearTimeout(this.state.files.fetchTimer);
		}
	}

	/**
	 * Send command bytes to device
	 * @param {Uint8Array} commandBytes - Command bytes to send
	 * @returns {Promise<void>}
	 */
	async send(commandBytes) {
		if (!this.isConnected()) {
			this.log("Not connected", LOG_CLASSES.WARNING);
			throw new Error("Device not connected");
		}

		const hex = bytesToHex(commandBytes);
		this.log(`TX ${hex}`, LOG_CLASSES.TX);

		await this.writeCharacteristic.writeValue(commandBytes);
	}

	/**
	 * Handle incoming notification
	 * @param {Event} event - Characteristic value changed event
	 */
	handleNotification(event) {
		const data = event.target.value; // DataView, may be a slice of its buffer
		const value = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
		const hex = bytesToHex(value);

		this.log(`RX ${hex}`, LOG_CLASSES.RX);

		// Notify all registered handlers
		for (const handler of this.notificationHandlers) {
			try {
				handler(hex, value);
			} catch (error) {
				console.error("Error in notification handler:", error);
			}
		}

		// Handle waiters for request/response patterns
		this.handleWaiters(hex);
	}

	/**
	 * Register a notification handler
	 * @param {Function} handler - Handler function (hex, bytes) => void
	 * @returns {Function} - Unsubscribe function
	 */
	onNotification(handler) {
		this.notificationHandlers.push(handler);

		// Return unsubscribe function
		return () => this.offNotification(handler);
	}

	/**
	 * Unregister a notification handler
	 * @param {Function} handler - Handler passed to onNotification
	 */
	offNotification(handler) {
		const index = this.notificationHandlers.indexOf(handler);
		if (index >= 0) {
			this.notificationHandlers.splice(index, 1);
		}
	}

	/**
	 * Clear all notification handlers
	 */
	clearNotificationHandlers() {
		this.notificationHandlers = [];
	}

	/**
	 * Wait for a response with specific prefix
	 * @param {string} prefix - Response prefix to wait for
	 * @param {number} timeoutMs - Timeout in milliseconds
	 * @returns {Promise<string>} - Response hex string
	 */
	waitForResponse(prefix, timeoutMs = TIMEOUTS.ACK) {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				// Remove waiter from list
				const index = this.waiters.indexOf(waiter);
				if (index >= 0) {
					this.waiters.splice(index, 1);
				}
				reject(new Error(`Timeout waiting for ${prefix}`));
			}, timeoutMs);

			const waiter = {
				prefix,
				resolve,
				reject,
				timer,
			};

			this.waiters.push(waiter);
		});
	}

	/**
	 * Handle waiters by checking if any match the received response
	 * @param {string} hex - Received hex string
	 */
	handleWaiters(hex) {
		for (let i = this.waiters.length - 1; i >= 0; i--) {
			const waiter = this.waiters[i];
			if (hex.startsWith(waiter.prefix)) {
				clearTimeout(waiter.timer);
				waiter.resolve(hex);
				this.waiters.splice(i, 1);
			}
		}
	}

	/**
	 * Clear all pending waiters (useful on disconnect)
	 */
	clearWaiters() {
		for (const waiter of this.waiters) {
			clearTimeout(waiter.timer);
			waiter.reject(new Error("Disconnected"));
		}
		this.waiters.splice(0);
	}

	/**
	 * Get device info
	 * @returns {Object|null} - Device info or null if not connected
	 */
	getDeviceInfo() {
		if (!this.device) return null;

		return {
			name: this.device.name || "Unknown",
			id: this.device.id,
			connected: this.isConnected(),
		};
	}
}

  // ============================================================
  // REST Proxy Client (js/rest-proxy.js)
  // ============================================================
/**
 * REST Proxy Client
 * Implements BLE communication via the Skelly Ultra REST server
 */

/**
 * REST Server Proxy for BLE Communication
 */
class RestProxy {
	constructor(stateManager, logger) {
		this.state = stateManager;
		this.log = logger;

		// Connection state
		this.baseUrl = "";
		this.sessionId = null;
		this.connected = false;
		this.mtuSize = null;
		this.deviceAddress = null;
		this.deviceName = null;

		// Notification handling
		this.notificationHandlers = [];
		this.pollingActive = false;
		this.nextSequence = 0;
		// Sequence numbers already handled this session. Older REST proxy servers can send
		// a buffered notification more than once.
		this.seenSequences = new Set();
		this.pollingAbortController = null;
		this.pollingErrorCount = 0;
		this.maxPollingErrors = 3; // Give up after 3 consecutive errors

		// Response waiters (for waitForResponse)
		this.waiters = [];

		// Keepalive
		this.keepaliveInterval = null;

		// Bind methods
		this.pollNotifications = this.pollNotifications.bind(this);
	}

	/**
	 * Check if device is connected
	 * @returns {boolean}
	 */
	isConnected() {
		return this.connected && this.sessionId !== null;
	}

	/**
	 * Get the MTU size
	 * @returns {number|null} MTU size in bytes, or null if not available
	 */
	getMtuSize() {
		return this.mtuSize;
	}

	/**
	 * Scan for BLE devices via REST proxy
	 * @param {string} baseUrl - REST server base URL
	 * @param {string} nameFilter - Optional device name filter
	 * @param {number} timeout - Scan timeout in seconds
	 * @returns {Promise<Array>} - Array of discovered devices
	 */
	async scanDevices(baseUrl, nameFilter = "", timeout = 10) {
		try {
			this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash

			const params = new URLSearchParams();
			if (nameFilter.trim()) {
				params.append("name_filter", nameFilter.trim());
			}
			params.append("timeout", timeout.toString());

			const scanUrl = `${this.baseUrl}/ble/scan_devices?${params.toString()}`;
			this.log(`Scanning for devices via REST proxy...`, LOG_CLASSES.WARNING);

			let response;
			try {
				response = await fetch(scanUrl);
			} catch (fetchError) {
				console.error("Fetch failed:", fetchError);
				// Check for common network issues
				if (
					fetchError.message.includes("Failed to fetch") ||
					fetchError.name === "TypeError"
				) {
					throw new Error(
						`Cannot connect to ${this.baseUrl}. Please check: 1) Server is running, 2) URL is correct, 3) Not a mixed content issue (HTTPS→HTTP blocked)`,
					);
				}
				throw new Error(`Network error: ${fetchError.message}`);
			}

			if (!response.ok) {
				const errorText = await response.text();
				console.error("Scan error response:", errorText);
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || "Scan failed");
			}

			return data.devices || [];
		} catch (error) {
			console.error("Scan error:", error);
			this.log(`REST proxy scan error: ${error.message}`, LOG_CLASSES.WARNING);
			throw error;
		}
	}

	/**
	 * Connect to a BLE device via REST proxy
	 * @param {string} baseUrl - REST server base URL (e.g., "http://localhost:8765")
	 * @param {string} deviceAddress - Device MAC address or name filter
	 * @returns {Promise<void>}
	 */
	async connect(baseUrl, deviceAddress = "") {
		try {
			this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash

			// Prepare connect request
			const requestBody = {};
			if (deviceAddress.trim()) {
				// If it looks like a MAC address, use address field, otherwise use name_filter
				if (deviceAddress.match(/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i)) {
					requestBody.address = deviceAddress.trim();
				} else {
					requestBody.name_filter = deviceAddress.trim();
				}
			}

			this.log(
				`Connecting via REST proxy: ${this.baseUrl}`,
				LOG_CLASSES.WARNING,
			);

			// Send connect request
			const connectUrl = `${this.baseUrl}/ble/connect`;

			let response;
			try {
				response = await fetch(connectUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				});
			} catch (fetchError) {
				console.error("Fetch failed:", fetchError);
				if (
					fetchError.message.includes("Failed to fetch") ||
					fetchError.name === "TypeError"
				) {
					throw new Error(
						`Cannot connect to ${this.baseUrl}. Please check: 1) Server is running, 2) URL is correct, 3) Not a mixed content issue (HTTPS→HTTP blocked)`,
					);
				}
				throw new Error(`Network error: ${fetchError.message}`);
			}

			if (!response.ok) {
				const errorText = await response.text();
				console.error("Error response:", errorText);
				throw new Error(
					`HTTP ${response.status}: ${response.statusText} - ${errorText}`,
				);
			}

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || "Connection failed");
			}

			// Store session info
			this.sessionId = data.session_id;
			this.deviceAddress = data.address;
			this.deviceName = data.name || "Unknown";
			this.mtuSize = data.mtu || null;
			this.connected = true;
			this.nextSequence = 0;
			this.seenSequences.clear();

			// Update state
			this.state.updateDevice({
				name: this.deviceName,
				connected: true,
			});

			this.log(
				`Connected via REST proxy: session=${this.sessionId}, address=${this.deviceAddress}, mtu=${this.mtuSize}`,
				LOG_CLASSES.WARNING,
			);

			// Start notification polling
			this.startPolling();

			// Start keepalive
			this.startKeepalive();

			return true;
		} catch (error) {
			this.log(
				`REST proxy connect error: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
			this.cleanup();
			throw error;
		}
	}

	/**
	 * Disconnect from device
	 * @returns {Promise<void>}
	 */
	async disconnect() {
		try {
			// Stop polling and keepalive first
			this.stopPolling();
			this.stopKeepalive();

			if (this.sessionId) {
				// Send disconnect request
				const response = await fetch(`${this.baseUrl}/ble/disconnect`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						session_id: this.sessionId,
					}),
				});

				if (response.ok) {
					this.log("Disconnected from REST proxy", LOG_CLASSES.WARNING);
				}
			}
		} catch (error) {
			this.log(
				`REST proxy disconnect error: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
		} finally {
			this.cleanup();
		}
	}

	/**
	 * Send command bytes to device
	 * @param {Uint8Array} commandBytes - Command bytes to send
	 * @returns {Promise<void>}
	 */
	async send(commandBytes) {
		if (!this.isConnected()) {
			this.log("Not connected to REST proxy", LOG_CLASSES.WARNING);
			throw new Error("Device not connected");
		}

		const hex = bytesToHex(commandBytes);
		this.log(`TX ${hex}`, LOG_CLASSES.TX);

		try {
			const response = await fetch(`${this.baseUrl}/ble/send_command`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					session_id: this.sessionId,
					command: hex,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || "Send command failed");
			}
		} catch (error) {
			this.log(`REST proxy send error: ${error.message}`, LOG_CLASSES.WARNING);
			throw error;
		}
	}

	/**
	 * Register a notification handler
	 * @param {Function} handler - Handler function (hex, bytes) => void
	 * @returns {Function} - Unsubscribe function
	 */
	onNotification(handler) {
		this.notificationHandlers.push(handler);

		// Return unsubscribe function
		return () => this.offNotification(handler);
	}

	/**
	 * Unregister a notification handler
	 * @param {Function} handler - Handler passed to onNotification
	 */
	offNotification(handler) {
		const index = this.notificationHandlers.indexOf(handler);
		if (index >= 0) {
			this.notificationHandlers.splice(index, 1);
		}
	}

	/**
	 * Clear all notification handlers
	 */
	clearNotificationHandlers() {
		this.notificationHandlers = [];
	}

	/**
	 * Start long-polling for notifications
	 */
	startPolling() {
		if (this.pollingActive) return;

		this.pollingActive = true;
		this.pollingErrorCount = 0; // Reset error count
		this.pollNotifications();
	}

	/**
	 * Stop notification polling
	 */
	stopPolling() {
		this.pollingActive = false;

		if (this.pollingAbortController) {
			this.pollingAbortController.abort();
			this.pollingAbortController = null;
		}
	}

	/**
	 * Long-poll for notifications
	 */
	async pollNotifications() {
		while (this.pollingActive && this.isConnected()) {
			try {
				// Create abort controller for this request
				this.pollingAbortController = new AbortController();

				const url = `${this.baseUrl}/ble/notifications?session_id=${encodeURIComponent(this.sessionId)}&since=${this.nextSequence}&timeout=30`;

				const response = await fetch(url, {
					signal: this.pollingAbortController.signal,
				});

				if (!response.ok) {
					// Check if session expired
					if (response.status === 400) {
						const data = await response.json();
						if (data.error?.includes("session")) {
							this.log("REST proxy session expired", LOG_CLASSES.WARNING);
							this.handleDisconnect();
							return;
						}
					}
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const data = await response.json();

				// Reset error count on successful poll
				this.pollingErrorCount = 0;

				// Update next sequence
				if (data.next_sequence !== undefined) {
					this.nextSequence = data.next_sequence;
				}

				// Process notifications
				if (data.notifications && data.notifications.length > 0) {
					for (const notification of data.notifications) {
						const seq = notification.sequence;
						if (Number.isInteger(seq)) {
							if (this.seenSequences.has(seq)) {
								continue;
							}
							this.seenSequences.add(seq);
							// Keep the set small; repeats are always recent
							if (this.seenSequences.size > 500) {
								for (const old of this.seenSequences) {
									if (old < seq - 250) {
										this.seenSequences.delete(old);
									}
								}
							}
						}
						this.handleNotification(notification);
					}
				}

				// If has_more is true, poll again immediately
				if (data.has_more) {
					continue;
				}

				// Small delay before next poll
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (error) {
				// Ignore abort errors (normal when stopping polling)
				if (error.name === "AbortError") {
					break;
				}

				this.pollingErrorCount++;
				this.log(
					`REST proxy polling error: ${error.message} (${this.pollingErrorCount}/${this.maxPollingErrors})`,
					LOG_CLASSES.WARNING,
				);

				// Give up after too many consecutive errors
				if (this.pollingErrorCount >= this.maxPollingErrors) {
					this.log(
						"REST proxy: Too many polling errors, treating as disconnected",
						LOG_CLASSES.WARNING,
					);
					this.handleDisconnect();
					return;
				}

				// Back off on errors
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		}
	}

	/**
	 * Handle incoming notification
	 * @param {Object} notification - Notification object from REST server
	 */
	handleNotification(notification) {
		try {
			const hex = notification.data.replace(/\s+/g, ""); // Remove spaces
			const bytes = hexToBytes(hex);

			this.log(`RX ${hex}`, LOG_CLASSES.RX);

			// Handle any pending waiters first
			this.handleWaiters(hex);

			// Notify all registered handlers
			for (const handler of this.notificationHandlers) {
				try {
					handler(hex, bytes);
				} catch (error) {
					console.error("Error in notification handler:", error);
				}
			}
		} catch (error) {
			console.error("Error processing notification:", error);
		}
	}

	/**
	 * Wait for a response with specific prefix
	 * @param {string} prefix - Response prefix to wait for
	 * @param {number} timeoutMs - Timeout in milliseconds
	 * @returns {Promise<string>} - Response hex string
	 */
	waitForResponse(prefix, timeoutMs = TIMEOUTS.ACK) {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				// Remove waiter from list
				const index = this.waiters.indexOf(waiter);
				if (index >= 0) {
					this.waiters.splice(index, 1);
				}
				reject(new Error(`Timeout waiting for ${prefix}`));
			}, timeoutMs);

			const waiter = {
				prefix,
				resolve,
				reject,
				timer,
			};

			this.waiters.push(waiter);
		});
	}

	/**
	 * Handle waiters by checking if any match the received response
	 * @param {string} hex - Received hex string
	 */
	handleWaiters(hex) {
		for (let i = this.waiters.length - 1; i >= 0; i--) {
			const waiter = this.waiters[i];
			if (hex.startsWith(waiter.prefix)) {
				clearTimeout(waiter.timer);
				waiter.resolve(hex);
				this.waiters.splice(i, 1);
			}
		}
	}

	/**
	 * Clear all pending waiters (useful on disconnect)
	 */
	clearWaiters() {
		for (const waiter of this.waiters) {
			clearTimeout(waiter.timer);
			waiter.reject(new Error("Disconnected"));
		}
		this.waiters.splice(0);
	}

	/**
	 * Start keepalive pings
	 */
	startKeepalive() {
		this.stopKeepalive(); // Clear any existing interval

		// Query status endpoint every 30 seconds
		this.keepaliveInterval = setInterval(async () => {
			if (!this.isConnected()) {
				this.stopKeepalive();
				return;
			}

			try {
				const response = await fetch(`${this.baseUrl}/ble/sessions`);
				if (response.ok) {
					const data = await response.json();

					// Verify our session still exists
					const sessionExists = data.sessions?.some(
						(s) => s.session_id === this.sessionId,
					);

					if (!sessionExists) {
						this.log("REST proxy session lost", LOG_CLASSES.WARNING);
						this.handleDisconnect();
					}
				}
			} catch (error) {
				this.log(`Keepalive error: ${error.message}`, LOG_CLASSES.WARNING);
			}
		}, 30000); // 30 seconds
	}

	/**
	 * Stop keepalive pings
	 */
	stopKeepalive() {
		if (this.keepaliveInterval) {
			clearInterval(this.keepaliveInterval);
			this.keepaliveInterval = null;
		}
	}

	/**
	 * Handle disconnect event
	 */
	handleDisconnect() {
		this.log("REST proxy disconnected", LOG_CLASSES.WARNING);
		this.cleanup();
	}

	/**
	 * Cleanup connection state
	 */
	cleanup() {
		this.stopPolling();
		this.stopKeepalive();

		this.sessionId = null;
		this.connected = false;
		this.deviceAddress = null;
		this.deviceName = null;
		this.mtuSize = null;
		this.nextSequence = 0;
		this.seenSequences.clear();

		// Fail pending waiters now rather than at their timeout
		this.clearWaiters();

		// Update state
		this.state.setConnected(false);
		this.state.updateFilesMetadata({ activeFetch: false });
		if (this.state.files.fetchTimer) {
			clearTimeout(this.state.files.fetchTimer);
		}
	}

	/**
	 * Get device info
	 * @returns {Object|null} - Device info or null if not connected
	 */
	getDeviceInfo() {
		if (!this.isConnected()) return null;

		return {
			name: this.deviceName || "Unknown",
			id: this.deviceAddress || "unknown",
			connected: this.connected,
			restUrl: this.baseUrl,
		};
	}
}

  // ============================================================
  // Connection Manager (js/connection-manager.js)
  // ============================================================
/**
 * Connection Manager
 * Abstraction layer that wraps both direct BLE and REST proxy connections
 */

/**
 * Connection types
 */
const ConnectionType = {
	DIRECT_BLE: "direct",
	REST_PROXY: "rest",
};

/**
 * Connection Manager - Unified interface for BLE and REST connections
 */
class ConnectionManager {
	constructor(stateManager, logger) {
		this.state = stateManager;
		this.log = logger;

		// Create both connection implementations
		this.bleManager = new BLEManager(stateManager, logger);
		this.restProxy = new RestProxy(stateManager, logger);

		// Active connection
		this.activeConnection = null;
		this.connectionType = null;

		// Store notification handlers to register with active connection
		this.notificationHandlers = [];

		// Writes go out one at a time: Web Bluetooth rejects a write while
		// another GATT operation is in progress, and overlapping REST posts
		// can reach the device out of order. Each send waits for the one
		// before it; a failed send doesn't hold up the ones after it.
		this.writeQueue = Promise.resolve();
	}

	/**
	 * Check if device is connected
	 * @returns {boolean}
	 */
	isConnected() {
		if (!this.activeConnection) return false;
		return this.activeConnection.isConnected();
	}

	/**
	 * Get the MTU size
	 * @returns {number|null} MTU size in bytes, or null if not available
	 */
	getMtuSize() {
		if (!this.activeConnection) return null;
		return this.activeConnection.getMtuSize();
	}

	/**
	 * Connect to a device
	 * @param {Object} options - Connection options
	 * @param {string} options.type - Connection type ('direct' or 'rest')
	 * @param {string} options.nameFilter - Optional device name filter
	 * @param {string} options.restUrl - REST server URL (required if type is 'rest')
	 * @returns {Promise<void>}
	 */
	async connect(options) {
		const { type, nameFilter = "", restUrl = "" } = options;

		// Disconnect any existing connection
		if (this.activeConnection) {
			await this.disconnect();
		}

		// Writes still queued for the old connection fail on their own; the
		// new one doesn't wait for them
		this.writeQueue = Promise.resolve();

		if (type === ConnectionType.REST_PROXY) {
			if (!restUrl) {
				throw new Error("REST server URL is required");
			}
		} else if (type !== ConnectionType.DIRECT_BLE) {
			throw new Error(`Unknown connection type: ${type}`);
		}

		// Set before connecting, so state observers that run during the
		// connect already find the backend; cleared again if it fails
		this.activeConnection =
			type === ConnectionType.REST_PROXY ? this.restProxy : this.bleManager;
		this.connectionType = type;
		try {
			if (type === ConnectionType.REST_PROXY) {
				await this.restProxy.connect(restUrl, nameFilter);
			} else {
				await this.bleManager.connect(nameFilter);
			}
		} catch (error) {
			this.activeConnection = null;
			this.connectionType = null;
			throw error;
		}

		// Clear any existing handlers in the active connection to avoid duplicates
		// then register all stored notification handlers
		this.activeConnection.clearNotificationHandlers();
		for (const handler of this.notificationHandlers) {
			this.activeConnection.onNotification(handler);
		}

		return true;
	}

	/**
	 * Disconnect from device
	 * @returns {Promise<void>}
	 */
	async disconnect() {
		if (this.activeConnection) {
			await this.activeConnection.disconnect();
			this.activeConnection = null;
			this.connectionType = null;
		}
	}

	/**
	 * Send command bytes to device, after any sends still in progress
	 * (see writeQueue)
	 * @param {Uint8Array} commandBytes - Command bytes to send
	 * @returns {Promise<void>} Settles when this write has gone out or failed
	 */
	send(commandBytes) {
		const connection = this.activeConnection;
		if (!connection) {
			return Promise.reject(new Error("No active connection"));
		}

		const write = this.writeQueue.then(() => connection.send(commandBytes));
		this.writeQueue = write.catch(() => {});
		return write;
	}

	/**
	 * Register a notification handler
	 * @param {Function} handler - Handler function (hex, bytes) => void
	 * @returns {Function} - Unsubscribe function
	 */
	onNotification(handler) {
		// Store handler for registration with active connection
		this.notificationHandlers.push(handler);

		// If already connected, register with active connection immediately
		if (this.activeConnection) {
			this.activeConnection.onNotification(handler);
		}

		// Return unsubscribe function
		return () => {
			const index = this.notificationHandlers.indexOf(handler);
			if (index >= 0) {
				this.notificationHandlers.splice(index, 1);
			}
			// The active connection holds its own copy of the handler
			this.activeConnection?.offNotification?.(handler);
		};
	}

	/**
	 * Wait for a response with specific prefix
	 * @param {string} prefix - Response prefix to wait for
	 * @param {number} timeoutMs - Timeout in milliseconds
	 * @returns {Promise<string>} - Response hex string
	 */
	waitForResponse(prefix, timeoutMs) {
		if (!this.activeConnection) {
			return Promise.reject(new Error("No active connection"));
		}

		if (this.activeConnection.waitForResponse) {
			return this.activeConnection.waitForResponse(prefix, timeoutMs);
		}

		return Promise.reject(
			new Error("waitForResponse not supported by active connection"),
		);
	}

	/**
	 * Get device info
	 * @returns {Object|null} - Device info or null if not connected
	 */
	getDeviceInfo() {
		if (!this.activeConnection) return null;

		const info = this.activeConnection.getDeviceInfo();

		// Add connection type to info
		if (info) {
			info.connectionType = this.connectionType;
		}

		return info;
	}

	/**
	 * Check if Web Bluetooth is available
	 * @returns {boolean}
	 */
	static isWebBluetoothAvailable() {
		return "bluetooth" in navigator;
	}
}

  // ============================================================
  // File Manager (js/file-manager.js)
  // ============================================================
/**
 * File Manager
 * Handles file transfers, audio conversion, and file list management
 */

/**
 * The device's replies to chunks (BBC1) and to C2 (BBC2) during one upload
 * attempt, in arrival order
 */
class TransferReports {
	constructor(connection) {
		this.chunkReports = []; // { lost, index }
		this.ends = []; // failed byte of each BBC2
		this.stop = connection.onNotification((hex) => {
			if (hex.startsWith(RESPONSES.CHUNK_DROPPED)) {
				this.chunkReports.push({
					lost: parseInt(hex.slice(4, 6), 16),
					index: parseInt(hex.slice(6, 10), 16),
				});
			} else if (hex.startsWith(RESPONSES.TRANSFER_END)) {
				this.ends.push(parseInt(hex.slice(4, 6), 16));
			}
		});
	}

	takeChunkReports() {
		return this.chunkReports.splice(0);
	}

	hasFailedEnd() {
		return this.ends.some((failed) => failed !== 0);
	}

	/** The first failed BBC2, removed; null if there is none */
	takeFailedEnd() {
		const at = this.ends.findIndex((failed) => failed !== 0);
		return at < 0 ? null : this.ends.splice(at, 1)[0];
	}

	/** The first BBC2, removed; null if there is none */
	takeEnd() {
		return this.ends.length > 0 ? this.ends.shift() : null;
	}
}

/** The device's loss reports (BBC1 lost = 1) during one upload attempt */
class LossTracker {
	constructor() {
		this.count = 0; // loss reports, repeats not counted
		this.pending = null; // resend from here, not yet done
		this.lastIndex = null; // index of the latest report
		this.lastTime = 0;
	}

	/**
	 * Take one BBC1. lost = 0 means no loss (the app ignores it too). A
	 * repeat of the latest report within REPEAT_WINDOW_MS counts once, like
	 * in the app.
	 * @returns {boolean} whether it is a new loss report
	 */
	note(lost, index, now) {
		if (lost === 0) {
			return false;
		}
		if (
			index === this.lastIndex &&
			now - this.lastTime < TRANSFER_CONFIG.REPEAT_WINDOW_MS
		) {
			return false;
		}
		this.count += 1;
		this.pending = index;
		this.lastIndex = index;
		this.lastTime = now;
		return true;
	}
}

/**
 * File Transfer and Management
 */
class FileManager {
	constructor(bleManager, stateManager, logger, progressCallback = null) {
		this.connection = bleManager;
		this.state = stateManager;
		this.log = logger;
		this.onProgress = progressCallback;

		// File picker state
		this.lastPickedFile = null;
		this.lastOriginalBytes = null;
		this.lastFileBytes = null;
		this.lastFileName = "";
	}

	/**
	 * Start fetching file list from device
	 * @returns {Promise<void>}
	 */
	async startFetchFiles() {
		if (!this.connection.isConnected()) {
			this.log("Not connected — cannot refresh files.", LOG_CLASSES.WARNING);
			return;
		}

		// Clear old list and start fresh
		this.state.resetFiles();
		this.state.updateFilesMetadata({ activeFetch: true });

		// Set timeout for no response, or an incomplete list (e.g. device-reported
		// count doesn't match the entries it actually sends) — either way, stop
		// waiting so the UI doesn't spin forever. Set before sending, since the
		// whole list can arrive before send() returns.
		const timer = setTimeout(() => {
			if (this.state.files.activeFetch && !this.state.isFileListComplete()) {
				const received = this.state.files.items.size;
				const expected = this.state.files.expected;
				this.state.updateFilesMetadata({ activeFetch: false });
				if (received > 0) {
					this.log(
						`File list incomplete: received ${received} of ${expected} (timeout). Showing partial list.`,
						LOG_CLASSES.WARNING,
					);
				} else {
					this.log("No file info received (timeout).", LOG_CLASSES.WARNING);
				}
			}
		}, TIMEOUTS.FILE_LIST);
		this.state.updateFilesMetadata({ fetchTimer: timer });

		try {
			await this.connection.send(buildCommand(COMMANDS.QUERY_FILES, "", 8));
		} catch (error) {
			this.log(
				`Couldn't ask for the file list: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
			this.endFetch();
		}
	}

	/**
	 * End the refresh: stop its timeout and enable the file list again
	 */
	endFetch() {
		clearTimeout(this.state.files.fetchTimer);
		this.state.updateFilesMetadata({ activeFetch: false, fetchTimer: null });
	}

	/**
	 * Check if file list is complete and trigger follow-up queries. Called
	 * for every file info (BBD0); asks for capacity and play order once.
	 * Never throws: the parser calls it without waiting.
	 */
	async finalizeFilesIfDone() {
		const files = this.state.files;
		if (!files.activeFetch || !files.expected || files.orderRequested) {
			return;
		}
		if (!this.state.isFileListComplete()) {
			return;
		}

		// Keep activeFetch true - the play order (BBD1) ends the refresh. If
		// it doesn't come, end it after FILE_ORDER so the list isn't stuck.
		clearTimeout(files.fetchTimer);
		const timer = setTimeout(() => {
			if (this.state.files.activeFetch) {
				this.log(
					"No play order received (timeout). Showing the list without it.",
					LOG_CLASSES.WARNING,
				);
				this.endFetch();
			}
		}, TIMEOUTS.FILE_ORDER);
		this.state.updateFilesMetadata({
			lastRefresh: new Date(),
			fetchTimer: timer,
			orderRequested: true,
		});

		// Update the received file count
		const filesReceived = files.items.size;
		this.state.updateDevice({ filesReceived });

		this.log("File list complete ✔", LOG_CLASSES.WARNING);

		// Send follow-up queries - order response will trigger UI update
		try {
			await this.connection.send(buildCommand(COMMANDS.QUERY_CAPACITY, "", 8));
			await this.connection.send(buildCommand(COMMANDS.QUERY_ORDER, "", 8));
		} catch (error) {
			this.log(
				`Couldn't ask for the play order: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
			this.endFetch();
		}
	}

	/**
	 * Determine safe chunk size based on BLE MTU
	 * @param {number|null} override - Optional override chunk size from user
	 * @returns {number} Safe chunk size in bytes
	 */
	getChunkSize(override = null) {
		// If user has specified an override, use it
		if (
			override !== null &&
			typeof override === "number" &&
			override >= 50 &&
			override <= TRANSFER_CONFIG.MAX_CHUNK_SIZE
		) {
			this.log(
				`Using override chunk size: ${override} bytes`,
				LOG_CLASSES.INFO,
			);
			return override;
		}

		// Try to get MTU from the BLE manager
		const mtu = this.connection.getMtuSize();

		if (mtu !== null && typeof mtu === "number" && mtu > 0) {
			// A whole C1 frame fills one write (MTU - 3 bytes), like the app's.
			// A bigger frame doesn't fit and gets lost.
			const safeSize = mtu - TRANSFER_CONFIG.CHUNK_OVERHEAD;
			// Cap at tested maximum
			const chunkSize = Math.min(safeSize, TRANSFER_CONFIG.MAX_CHUNK_SIZE);
			this.log(
				`Using MTU-based chunk size: ${chunkSize} bytes (MTU=${mtu})`,
				LOG_CLASSES.INFO,
			);
			return chunkSize;
		}

		// MTU not available, use conservative default
		this.log(
			`Using default chunk size: ${TRANSFER_CONFIG.DEFAULT_CHUNK_SIZE} bytes (MTU unknown)`,
			LOG_CLASSES.INFO,
		);
		return TRANSFER_CONFIG.DEFAULT_CHUNK_SIZE;
	}

	/**
	 * Send a command and wait for its reply
	 * The wait starts before the send, since the reply can arrive before
	 * send() returns (the REST proxy polls for it separately).
	 * @param {Uint8Array} commandBytes - Command to send
	 * @param {string} prefix - Reply prefix to wait for
	 * @param {number} timeoutMs - Timeout in milliseconds
	 * @returns {Promise<string>} - Reply hex string
	 */
	async sendAndWait(commandBytes, prefix, timeoutMs) {
		const reply = this.connection.waitForResponse(prefix, timeoutMs);
		try {
			await this.connection.send(commandBytes);
		} catch (error) {
			reply.catch(() => {}); // It times out unanswered
			throw error;
		}
		return reply;
	}

	/**
	 * Throw if the device has no room for a file of this size, like the app
	 * (D2 before C0). If the device doesn't answer, the upload goes ahead.
	 * @param {number} size - File size in bytes
	 * @returns {Promise<void>}
	 */
	async checkFreeSpace(size) {
		let reply;
		try {
			reply = await this.sendAndWait(
				buildCommand(COMMANDS.QUERY_CAPACITY, "", 8),
				RESPONSES.CAPACITY,
				TIMEOUTS.ACK,
			);
		} catch (error) {
			this.log(
				`Couldn't read the free space, uploading anyway: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
			return;
		}
		const freeKB = parseInt(reply.slice(4, 12), 16);
		// The app divides by 1000. If the device's KB are 1024 bytes, that
		// overestimates a little, which is safe.
		const neededKB = Math.ceil(size / 1000);
		if (neededKB >= freeKB) {
			throw new Error(
				`Not enough space on the device: the file needs ${neededKB} KB, ${freeKB} KB are free. Delete files to make room.`,
			);
		}
	}

	/**
	 * Pause between chunks: the override if it's in range, else 100 ms
	 * @param {number|null} override - Optional override from the user (ms)
	 * @returns {number} Pause in ms
	 */
	getChunkDelay(override = null) {
		if (
			typeof override === "number" &&
			override >= TRANSFER_CONFIG.MIN_CHUNK_DELAY_MS &&
			override <= TRANSFER_CONFIG.MAX_CHUNK_DELAY_MS
		) {
			this.log(`Using override chunk delay: ${override} ms`, LOG_CLASSES.INFO);
			return override;
		}
		return TRANSFER_CONFIG.CHUNK_DELAY_MS;
	}

	/**
	 * Upload file to device
	 * @param {Uint8Array} fileBytes - File data
	 * @param {string} fileName - Target filename
	 * @param {number|null} chunkSizeOverride - Optional chunk size override
	 * @param {number|null} chunkDelayOverride - Optional pause between chunks (ms)
	 * @returns {Promise<void>}
	 */
	async uploadFile(
		fileBytes,
		fileName,
		chunkSizeOverride = null,
		chunkDelayOverride = null,
	) {
		if (!this.connection.isConnected()) {
			this.log("Not connected — cannot send file.", LOG_CLASSES.WARNING);
			throw new Error("Device not connected");
		}

		// If this upload overwrites an existing file, the device resets that
		// file's light/movement/eye settings to default. Capture them now so
		// they can be restored once the new upload lands.
		const existingFile = this.state.hasFileName(fileName);

		// A new file makes the device rewrite the play order, and it gets that
		// wrong (it drops the first entry and lists the last one twice).
		// Remember the order by name, so it can be put right afterwards.
		const previousOrderNames = existingFile ? null : this.orderedFileNames();

		this.state.startTransfer();

		try {
			const size = fileBytes.length;
			let chunkSize = this.getChunkSize(chunkSizeOverride); // Use dynamic chunk size based on MTU or override
			const chunkDelay = this.getChunkDelay(chunkDelayOverride);

			// Like the phone app: refuse a file the device has no room for.
			// Overwrites are checked too.
			await this.checkFreeSpace(size);

			// === Phases 1-3: Start (C0), Data Chunks (C1), End (C2) ===
			// If the device keeps losing chunks, start over with smaller ones
			for (let attempt = 1; ; attempt++) {
				if (await this.sendOnce(fileBytes, fileName, chunkSize, chunkDelay)) {
					break;
				}
				if (attempt >= TRANSFER_CONFIG.MAX_ATTEMPTS) {
					// Leave nothing open on the device
					await this.connection.send(buildCommand(COMMANDS.CANCEL, "", 8));
					throw new Error(
						`Transfer failed after ${attempt} attempts with smaller chunks`,
					);
				}
				chunkSize = Math.max(
					TRANSFER_CONFIG.MIN_CHUNK_SIZE,
					Math.floor(chunkSize / 2),
				);
				this.log(
					`Transfer failed, starting over with ${chunkSize}-byte chunks (retry ${attempt}/${TRANSFER_CONFIG.MAX_ATTEMPTS - 1})`,
					LOG_CLASSES.WARNING,
				);
				await this.connection.send(buildCommand(COMMANDS.CANCEL, "", 8));
				await sleep(1000); // Give the device time to reset
				this.checkTransferGoing();
			}

			// === Phase 4: Confirm Transfer (C3) ===
			const { fullPayload: c3Payload } = buildFilenamePayload(fileName);
			const c3Response = await this.sendAndWait(
				buildCommand(COMMANDS.CONFIRM_TRANSFER, c3Payload, 8),
				RESPONSES.CONFIRM_TRANSFER_ACK,
				TIMEOUTS.ACK,
			);
			const c3Failed = parseInt(c3Response.slice(4, 6), 16);
			if (c3Failed !== 0) {
				throw new Error("Device failed to confirm transfer");
			}

			this.log("File transfer complete ✔", LOG_CLASSES.WARNING);

			// If this was an overwrite, restore the previous light/movement/eye
			// settings right away — the device resets them to default on upload.
			if (existingFile) {
				await this.restoreFileSettings(
					existingFile.cluster,
					fileName,
					existingFile,
				);
			}

			// Refresh file list
			this.startFetchFiles();

			if (previousOrderNames) {
				await this.putNewFileFirst(fileName, previousOrderNames);
			}

			// Verify the restored settings actually stuck, since these are
			// unacknowledged writes the device can silently drop.
			if (existingFile) {
				const updatedFile = await this.waitForFileByName(fileName);
				if (updatedFile) {
					this.verifyRestoredSettings(existingFile, updatedFile);
				} else {
					this.log(
						"Could not verify restored settings — file not found after refresh.",
						LOG_CLASSES.WARNING,
					);
				}
			}
		} catch (error) {
			this.log(`File send error: ${error.message}`, LOG_CLASSES.WARNING);
			throw error;
		} finally {
			this.state.endTransfer();
		}
	}

	/**
	 * One upload attempt: C0, the chunks (C1) and C2, resending lost chunks
	 * like the phone app (see TRANSFER_CONFIG.LOSS_WAIT_MS).
	 * @returns {Promise<boolean>} true once BBC2 says ok; false if the device
	 *   kept losing chunks, so the caller starts over with smaller ones
	 */
	async sendOnce(fileBytes, fileName, chunkSize, chunkDelay) {
		const size = fileBytes.length;
		const maxPackets = Math.ceil(size / chunkSize);
		const { fullPayload: filenamePart } = buildFilenamePayload(fileName);
		const c0Payload =
			intToHex(size, 4) + intToHex(maxPackets, 2) + filenamePart;
		const c0Response = await this.sendAndWait(
			buildCommand(COMMANDS.START_TRANSFER, c0Payload, 8),
			RESPONSES.TRANSFER_START,
			TIMEOUTS.ACK,
		);
		if (parseInt(c0Response.slice(4, 6), 16) !== 0) {
			throw new Error("Device rejected transfer start");
		}

		// Only replies from this attempt count
		const reports = new TransferReports(this.connection);
		try {
			// Resume from last written position if applicable
			const c0Written = parseInt(c0Response.slice(6, 14), 16) || 0;
			let index = Math.floor(c0Written / chunkSize);
			if (index > 0) {
				this.log(
					`Resuming at chunk ${index} (written=${c0Written})`,
					LOG_CLASSES.WARNING,
				);
			}

			const losses = new LossTracker();
			let failedEnds = 0;
			for (;;) {
				const sent = await this.sendChunks(
					reports,
					losses,
					fileBytes,
					index,
					chunkSize,
					chunkDelay,
				);
				if (!sent) {
					return false;
				}

				// Unless the device already ended it while chunks were being sent
				let failed = reports.takeFailedEnd();
				if (failed === null) {
					await this.connection.send(
						buildCommand(COMMANDS.END_TRANSFER, "", 8),
					);
					failed = await this.waitForEnd(reports);
				}
				if (failed === 0) {
					return true;
				}

				// Like the app: resend from the last lost chunk. Without a loss
				// report nobody knows what is missing, so all of it.
				failedEnds += 1;
				this.noteChunkReports(reports, losses);
				index = losses.lastIndex ?? 0;
				this.log(
					`Device reported the transfer failed (${failedEnds}/${TRANSFER_CONFIG.MAX_FAILED_ENDS}); resending from chunk ${index}`,
					LOG_CLASSES.WARNING,
				);
				if (failedEnds >= TRANSFER_CONFIG.MAX_FAILED_ENDS) {
					return false;
				}
				losses.pending = index;
				index = await this.waitOutLosses(reports, losses);
				if (index === null) {
					return false;
				}
				// A BBC2 still buffered now answers an earlier C2 (e.g. one that
				// crossed an early failed BBC2); don't take it for this round's
				reports.ends.length = 0;
			}
		} finally {
			reports.stop();
		}
	}

	/**
	 * Send chunks from index on, going back after a loss report. Stops early
	 * when the device ends the transfer as failed (left for the caller).
	 * @returns {Promise<boolean>} false after more than MAX_LOSSES losses
	 */
	async sendChunks(reports, losses, fileBytes, index, chunkSize, chunkDelay) {
		const maxPackets = Math.ceil(fileBytes.length / chunkSize);
		for (;;) {
			this.checkTransferGoing();

			if (reports.hasFailedEnd()) {
				this.log(
					`Device ended the transfer at chunk ${index} of ${maxPackets}`,
					LOG_CLASSES.WARNING,
				);
				return true;
			}

			this.noteChunkReports(reports, losses);
			if (losses.pending !== null) {
				const resume = await this.waitOutLosses(reports, losses);
				if (resume === null) {
					return false;
				}
				index = resume;
				continue;
			}

			if (index >= maxPackets) {
				return true;
			}

			const dataHex = chunkToHex(fileBytes, index * chunkSize, chunkSize);
			await this.connection.send(
				buildCommand(COMMANDS.CHUNK_DATA, intToHex(index, 2) + dataHex, 0),
			);
			index += 1;

			if (this.onProgress) {
				this.onProgress(index, maxPackets);
			}

			await sleep(chunkDelay);
		}
	}

	/**
	 * Note the BBC1s received so far
	 * @returns {boolean} whether one was a new loss report
	 */
	noteChunkReports(reports, losses) {
		let found = false;
		for (const { lost, index } of reports.takeChunkReports()) {
			if (losses.note(lost, index, Date.now())) {
				found = true;
				this.log(
					`Device lost chunk ${index} (loss ${losses.count}/${TRANSFER_CONFIG.MAX_LOSSES})`,
					LOG_CLASSES.WARNING,
				);
			}
		}
		return found;
	}

	/**
	 * Pause after a loss like the app: LOSS_WAIT_MS + RESUME_WAIT_MS after
	 * the latest new loss report
	 * @returns {Promise<number|null>} the chunk to resend from; null after
	 *   more than MAX_LOSSES loss reports
	 */
	async waitOutLosses(reports, losses) {
		const pause = TRANSFER_CONFIG.LOSS_WAIT_MS + TRANSFER_CONFIG.RESUME_WAIT_MS;
		let resumeAt = Date.now() + pause;
		for (;;) {
			if (losses.count > TRANSFER_CONFIG.MAX_LOSSES) {
				this.log(
					`Device lost ${losses.count} chunks; giving up`,
					LOG_CLASSES.WARNING,
				);
				return null;
			}
			this.checkTransferGoing();
			const remaining = resumeAt - Date.now();
			if (remaining <= 0) {
				break;
			}
			await sleep(Math.min(100, remaining));
			if (this.noteChunkReports(reports, losses)) {
				resumeAt = Date.now() + pause;
			}
		}
		const index = losses.pending ?? 0;
		losses.pending = null;
		this.log(`Resending from chunk ${index}`, LOG_CLASSES.WARNING);
		return index;
	}

	/**
	 * Wait for the BBC2 that answers C2
	 * @returns {Promise<number>} its failed byte
	 */
	async waitForEnd(reports) {
		const deadline = Date.now() + TIMEOUTS.FILE_TRANSFER;
		for (;;) {
			const failed = reports.takeEnd();
			if (failed !== null) {
				return failed;
			}
			this.checkTransferGoing();
			if (Date.now() >= deadline) {
				throw new Error("Timeout waiting for transfer end acknowledgment");
			}
			await sleep(50);
		}
	}

	/** Throw if the upload was cancelled or the connection is gone */
	checkTransferGoing() {
		if (!this.connection.isConnected()) {
			throw new Error("Disconnected during transfer");
		}
		if (this.state.transfer.cancel) {
			throw new Error("Transfer cancelled");
		}
	}

	/**
	 * Cancel ongoing transfer
	 * @returns {Promise<void>}
	 */
	async cancelTransfer() {
		if (!this.state.transfer.inProgress) {
			return;
		}

		this.state.cancelTransfer();

		if (this.connection.isConnected()) {
			try {
				await this.connection.send(buildCommand(COMMANDS.CANCEL, "", 8));
			} catch (error) {
				this.log(`Cancel command error: ${error.message}`, LOG_CLASSES.WARNING);
			}
		}
	}

	/**
	 * Poll until ALL named files appear in the file list state, or timeout.
	 * Used after delete to confirm the refreshed list has arrived before
	 * remapping names to their new (renumbered) serials.
	 * @param {string[]} names
	 * @param {number} timeoutMs
	 * @returns {Promise<boolean>} true if all found before timeout
	 */
	async waitForFilesByName(names, timeoutMs = TIMEOUTS.FILE_LIST) {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			if (names.every((name) => this.state.hasFileName(name))) return true;
			await sleep(100);
		}
		return false;
	}

	/**
	 * Return the names of the enabled files, in play order
	 * @returns {string[]|null} null if the play order hasn't been read yet
	 */
	orderedFileNames() {
		const order = this.state.device?.order;
		if (!order) return null;
		return JSON.parse(order)
			.map((serial) => this.state.getFile(serial)?.name)
			.filter(Boolean);
	}

	/**
	 * Poll until a file list refresh has finished, including the play order
	 * that follows the list. Call right after startFetchFiles().
	 * @param {number} timeoutMs
	 * @returns {Promise<boolean>} true if the full list and order arrived
	 */
	async waitForFileListRefresh(timeoutMs = TIMEOUTS.FILE_LIST + 2000) {
		const deadline = Date.now() + timeoutMs;
		// startFetchFiles() sets activeFetch before its first await, so a false
		// here means it never started (not connected)
		while (this.state.files.activeFetch && Date.now() < deadline) {
			await sleep(100);
		}
		return !this.state.files.activeFetch && this.state.isFileListComplete();
	}

	/**
	 * After a new upload, make the new file first in the play order and keep
	 * the other files in the order and enabled state they had before.
	 * Problems are logged, not thrown, since the upload itself succeeded.
	 * @param {string} fileName - The uploaded file
	 * @param {string[]} previousOrderNames - Enabled file names before the upload
	 * @returns {Promise<void>}
	 */
	async putNewFileFirst(fileName, previousOrderNames) {
		if (!(await this.waitForFileListRefresh())) {
			this.log(
				"File list refresh didn't finish; play order left as the device set it.",
				LOG_CLASSES.WARNING,
			);
			return;
		}

		const newFile = this.state.hasFileName(fileName);
		if (!newFile) {
			this.log(
				`${fileName} isn't in the file list; play order left as the device set it.`,
				LOG_CLASSES.WARNING,
			);
			return;
		}

		// Map the names to the serials the device uses now
		const previous = previousOrderNames
			.map((name) => this.state.hasFileName(name)?.serial)
			.filter((serial) => serial != null);
		const wanted = [...new Set([newFile.serial, ...previous])];
		const current = JSON.parse(this.state.device?.order || "[]");
		const same = (a, b) =>
			a.length === b.length && a.every((value, i) => value === b[i]);

		// Nothing to do if the order is right, or if the device didn't touch it
		// (the file was there already, under a name the list didn't show)
		if (same(current, wanted) || same(current, previous)) return;

		this.log(
			`Device changed the play order from ${JSON.stringify(previous)} to ${JSON.stringify(current)} on upload; setting ${JSON.stringify(wanted)}`,
			LOG_CLASSES.INFO,
		);
		try {
			await this.updateFileOrder(wanted);
		} catch (error) {
			this.log(
				`Failed to put the play order right: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
		}
	}

	/**
	 * Poll until the named file appears in the file list state, or timeout.
	 * Used after upload to obtain the device-assigned cluster for the file.
	 * @param {string} fileName
	 * @param {number} timeoutMs
	 * @returns {Promise<Object|null>} File object or null on timeout
	 */
	async waitForFileByName(fileName, timeoutMs = TIMEOUTS.FILE_LIST) {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			const file = this.state.hasFileName(fileName);
			if (file) return file;
			await sleep(100);
		}
		return null;
	}

	/**
	 * Re-send a file's light/movement/eye settings after an overwrite, since
	 * the device resets them to default whenever a file is re-uploaded.
	 * @param {number} cluster - Device-assigned cluster for the file
	 * @param {string} fileName - Filename (for the name payload)
	 * @param {Object} savedFile - Previously captured file record (lights/action/eye)
	 * @returns {Promise<void>}
	 */
	async restoreFileSettings(cluster, fileName, savedFile) {
		this.log("Restoring saved settings after overwrite...", LOG_CLASSES.INFO);

		// The raw file record can carry up to 6 light channel slots regardless
		// of device type; only restore as many as this device actually has.
		const profile = DEVICE_PROFILES[this.state.deviceType];
		const lightCount = profile?.lights?.length || 1;

		await applyFileSettings(
			this.connection,
			cluster,
			fileName,
			{
				action: savedFile.action,
				eye: savedFile.eye ?? 1,
				lights: (savedFile.lights || []).slice(0, lightCount),
			},
			{
				hasEyeImage: profile?.hasEyeImage,
				delayMs: APPLY_ALL_COMMAND_DELAY_MS,
				scene: currentLightScene(
					this.state.deviceType,
					this.state.device?.version,
					savedFile.scene,
				),
			},
		);

		this.log("Settings restored ✔", LOG_CLASSES.INFO);
	}

	/**
	 * Compare a refreshed file record against the settings that were saved
	 * before an overwrite and warn if any didn't stick — restoreFileSettings
	 * uses unacknowledged writes the device can silently drop.
	 * @param {Object} expected - Previously captured file record
	 * @param {Object} actual - Freshly refreshed file record
	 */
	verifyRestoredSettings(expected, actual) {
		const profile = DEVICE_PROFILES[this.state.deviceType];
		const lightCount = profile?.lights?.length || 1;
		const mismatches = [];

		const expectedAction = expected.action || 0;
		const actualAction = actual.action || 0;
		if (expectedAction !== actualAction) {
			mismatches.push(
				`movement (expected ${expectedAction}, got ${actualAction})`,
			);
		}

		if (profile?.hasEyeImage) {
			const expectedEye = expected.eye ?? 1;
			const actualEye = actual.eye ?? 1;
			if (expectedEye !== actualEye) {
				mismatches.push(`eye icon (expected ${expectedEye}, got ${actualEye})`);
			}
		}

		for (let ch = 0; ch < lightCount; ch++) {
			const exp = expected.lights?.[ch];
			const act = actual.lights?.[ch];
			if (!exp) continue;
			if (!act) {
				mismatches.push(`light ${ch} (missing after refresh)`);
				continue;
			}
			const fields = ["brightness", "effectMode", "r", "g", "b", "colorCycle"];
			if ((exp.effectMode || 1) !== 1) fields.push("effectSpeed");
			for (const field of fields) {
				if ((exp[field] || 0) !== (act[field] || 0)) {
					mismatches.push(
						`light ${ch} ${field} (expected ${exp[field]}, got ${act[field]})`,
					);
				}
			}
		}

		if (mismatches.length > 0) {
			this.log(
				`Settings did not fully stick after overwrite: ${mismatches.join("; ")}. Use Apply All in the Edit view to retry.`,
				LOG_CLASSES.WARNING,
			);
		} else {
			this.log("Restored settings verified ✔", LOG_CLASSES.INFO);
		}
	}

	/**
	 * Delete a file
	 * @param {number} serial - File serial number
	 * @param {number} cluster - File cluster
	 * @returns {Promise<boolean>} Whether the device deleted it (BBC7 failed
	 *   byte 0). Throws if the command can't be sent or isn't answered.
	 */
	async deleteFile(serial, cluster) {
		const payload = intToHex(serial, 2) + intToHex(cluster, 4);
		this.log(
			`Delete request (C7) serial=${serial} cluster=${cluster}`,
			LOG_CLASSES.WARNING,
		);
		const reply = await this.sendAndWait(
			buildCommand(COMMANDS.DELETE, payload, 8),
			RESPONSES.DELETE_ACK,
			TIMEOUTS.ACK,
		);
		return parseInt(reply.slice(4, 6), 16) === 0;
	}

	/**
	 * Update file order on device by sending C9 commands for each enabled file
	 * @param {Array<number>} enabledSerials - Array of serial numbers in desired order
	 */
	async updateFileOrder(enabledSerials) {
		if (!this.connection.isConnected()) {
			this.log("Not connected", LOG_CLASSES.WARNING);
			return;
		}

		const enabledCount = enabledSerials.length;
		this.log(
			`Updating file order with ${enabledCount} enabled files...`,
			LOG_CLASSES.INFO,
		);

		// Validate all files first before sending any commands
		for (const serial of enabledSerials) {
			const file = this.state.getFile(serial);

			if (!file) {
				this.log(
					`Error: File ${serial} not found in state`,
					LOG_CLASSES.WARNING,
				);
				return;
			}

			if (!file.name?.trim()) {
				this.log(
					`Error: File ${serial} has no name, cannot update order`,
					LOG_CLASSES.WARNING,
				);
				return;
			}
		}

		// All files validated, now send C9 commands
		for (let i = 0; i < enabledSerials.length; i++) {
			const serial = enabledSerials[i];
			const file = this.state.getFile(serial);
			const fileOrder = i + 1; // 1-indexed position
			const { fullPayload: filenamePart } = buildFilenamePayload(file.name, {
				withLength: true,
			});

			// AA C9 <enabled file count> <file order> 00 <file serial> <filename payload>
			const payload =
				intToHex(enabledCount, 1) +
				intToHex(fileOrder, 1) +
				intToHex(serial, 2) +
				filenamePart;

			await this.connection.send(buildCommand(COMMANDS.SET_ORDER, payload, 8));
			this.log(
				`Set order: serial=${serial} position=${fileOrder}/${enabledCount}`,
				LOG_CLASSES.INFO,
			);

			// Small delay between commands
			await sleep(50);
		}

		// Query the new order from device
		this.log("Querying updated file order...", LOG_CLASSES.INFO);
		await this.connection.send(buildCommand(COMMANDS.QUERY_ORDER, "", 8));
	}

	/**
	 * Store file picker data
	 * @param {File} file - Selected file
	 * @param {Uint8Array} originalBytes - Original file bytes
	 * @param {Uint8Array} processedBytes - Processed file bytes (may be converted)
	 * @param {string} fileName - Final filename
	 */
	storeFilePickerData(file, originalBytes, processedBytes, fileName) {
		this.lastPickedFile = file;
		this.lastOriginalBytes = originalBytes;
		this.lastFileBytes = processedBytes;
		this.lastFileName = fileName;
	}

	/**
	 * Get stored file data
	 * @returns {Object} - {file, originalBytes, fileBytes, fileName}
	 */
	getFilePickerData() {
		return {
			file: this.lastPickedFile,
			originalBytes: this.lastOriginalBytes,
			fileBytes: this.lastFileBytes,
			fileName: this.lastFileName,
		};
	}

	/**
	 * Clear file picker data
	 */
	clearFilePickerData() {
		this.lastPickedFile = null;
		this.lastOriginalBytes = null;
		this.lastFileBytes = null;
		this.lastFileName = "";
	}
}

/**
 * Audio Converter
 * Handles audio file conversion to device-compatible format
 */
class AudioConverter {
	constructor(logger) {
		this.log = logger;
	}

	/**
	 * Get audio duration from file
	 * @param {File} file - Audio file
	 * @returns {Promise<number|null>} - Duration in seconds or null
	 */
	async getAudioDuration(file) {
		// Try HTML audio element first (fast)
		try {
			const duration = await this.getDurationViaAudioElement(file);
			if (duration) return duration;
		} catch (_error) {
			// Fall through to Web Audio API
		}

		// Fallback: decode with Web Audio API
		try {
			return await this.getDurationViaWebAudio(file);
		} catch (error) {
			this.log(
				`Failed to get audio duration: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
			return null;
		}
	}

	/**
	 * Get duration via HTML audio element
	 * @private
	 */
	getDurationViaAudioElement(file) {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const audio = new Audio();
			audio.preload = "metadata";

			audio.onloadedmetadata = () => {
				const duration = audio.duration;
				URL.revokeObjectURL(url);
				if (Number.isFinite(duration) && duration > 0) {
					resolve(duration);
				} else {
					reject(new Error("Non-finite duration"));
				}
			};

			audio.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error("Audio element failed"));
			};

			audio.src = url;
		});
	}

	/**
	 * Get duration via Web Audio API
	 * @private
	 */
	async getDurationViaWebAudio(file) {
		const buffer = await file.arrayBuffer();
		const AudioContext = window.AudioContext || window.webkitAudioContext;
		if (!AudioContext) {
			throw new Error("Web Audio API not supported");
		}

		const context = new AudioContext();
		const audioBuffer = await context.decodeAudioData(buffer.slice(0));
		context.close?.();

		return audioBuffer?.duration ?? null;
	}

	/**
	 * Convert audio file to device-compatible MP3
	 * @param {File} file - Source audio file
	 * @param {number} kbps - Target bitrate
	 * @returns {Promise<{u8: Uint8Array, name: string}>}
	 */
	async convertToDeviceMp3(file, kbps = AUDIO_CONFIG.DEFAULT_MP3_KBPS) {
		if (typeof lamejs === "undefined" || !lamejs.Mp3Encoder) {
			throw new Error("MP3 encoder library (lamejs) not loaded");
		}

		// Decode audio
		const buffer = await file.arrayBuffer();
		const AudioContext = window.AudioContext || window.webkitAudioContext;
		if (!AudioContext) {
			throw new Error("Web Audio API not supported");
		}

		const context = new AudioContext();
		const audioBuffer = await context.decodeAudioData(buffer.slice(0));
		context.close?.();

		// Downmix to mono
		const monoData = this.downmixToMono(audioBuffer);

		// Resample to target rate
		const resampledData = this.resampleLinear(
			monoData,
			audioBuffer.sampleRate,
			AUDIO_CONFIG.TARGET_SAMPLE_RATE,
		);

		// Convert to 16-bit PCM
		const pcm16 = this.floatTo16BitPCM(resampledData);

		// Encode to MP3
		const encoder = new lamejs.Mp3Encoder(
			AUDIO_CONFIG.TARGET_CHANNELS,
			AUDIO_CONFIG.TARGET_SAMPLE_RATE,
			kbps | 0 || AUDIO_CONFIG.DEFAULT_MP3_KBPS,
		);

		const blockSize = AUDIO_CONFIG.MP3_ENCODE_BLOCK_SIZE;
		const mp3Parts = [];

		for (let i = 0; i < pcm16.length; i += blockSize) {
			const chunk = pcm16.subarray(i, Math.min(i + blockSize, pcm16.length));
			const mp3Data = encoder.encodeBuffer(chunk);
			if (mp3Data?.length) {
				mp3Parts.push(mp3Data);
			}
		}

		const endData = encoder.flush();
		if (endData?.length) {
			mp3Parts.push(endData);
		}

		// Create output
		const mp3Blob = new Blob(mp3Parts, { type: "audio/mpeg" });
		const u8 = new Uint8Array(await mp3Blob.arrayBuffer());
		const outputName = `${(file.name || "audio").replace(/\.\w+$/i, "")}.mp3`;

		return { u8, name: outputName };
	}

	/**
	 * Downmix audio to mono
	 * @private
	 */
	downmixToMono(audioBuffer) {
		if (audioBuffer.numberOfChannels === 1) {
			return new Float32Array(audioBuffer.getChannelData(0));
		}

		const length = audioBuffer.length;
		const output = new Float32Array(length);
		const channelCount = audioBuffer.numberOfChannels;

		for (let ch = 0; ch < channelCount; ch++) {
			const channelData = audioBuffer.getChannelData(ch);
			for (let i = 0; i < length; i++) {
				output[i] += channelData[i];
			}
		}

		for (let i = 0; i < length; i++) {
			output[i] /= channelCount;
		}

		return output;
	}

	/**
	 * Resample audio using linear interpolation
	 * @private
	 */
	resampleLinear(sourceData, sourceRate, targetRate) {
		if (sourceRate === targetRate) {
			return sourceData;
		}

		const ratio = sourceRate / targetRate;
		const targetLength = Math.max(1, Math.round(sourceData.length / ratio));
		const output = new Float32Array(targetLength);

		for (let i = 0; i < targetLength; i++) {
			const position = i * ratio;
			const i0 = Math.floor(position);
			const i1 = Math.min(i0 + 1, sourceData.length - 1);
			const t = position - i0;
			output[i] = (1 - t) * sourceData[i0] + t * sourceData[i1];
		}

		return output;
	}

	/**
	 * Convert float32 PCM to 16-bit PCM
	 * @private
	 */
	floatTo16BitPCM(float32Array) {
		const output = new Int16Array(float32Array.length);
		for (let i = 0; i < float32Array.length; i++) {
			const sample = Math.max(-1, Math.min(1, float32Array[i]));
			output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
		}
		return output;
	}
}

  // ============================================================
  // Protocol Parser (js/protocol-parser.js)
  // ============================================================
/**
 * Protocol Parser
 * Parses incoming BLE notifications and updates application state
 */

/**
 * Protocol Response Parser
 */
class ProtocolParser {
	constructor(stateManager, fileManager, logger, onPlayPauseCallback = null) {
		this.state = stateManager;
		this.fileManager = fileManager;
		this.log = logger;
		this.onPlayPause = onPlayPauseCallback;
	}

	/**
	 * Parse incoming BLE notification
	 * @param {string} hex - Hex string
	 * @param {Uint8Array} bytes - Byte array
	 */
	parse(hex, _bytes) {
		// Keepalive (FEDC)
		if (hex.startsWith(RESPONSES.KEEPALIVE)) {
			// Optionally log if advanced option is enabled
			const advFEDC = document.querySelector("#advFEDC");
			if (advFEDC?.checked) {
				this.log("Keepalive (FEDC)", LOG_CLASSES.WARNING);
			}
			return;
		}

		// Device parameters (BBE0)
		if (hex.startsWith(RESPONSES.DEVICE_PARAMS)) {
			this.parseDeviceParams(hex);
			return;
		}

		// Live status (BBE1)
		if (hex.startsWith(RESPONSES.LIVE_STATUS)) {
			this.parseLiveStatus(hex);
			return;
		}

		// Volume (BBE5)
		if (hex.startsWith(RESPONSES.VOLUME)) {
			this.parseVolume(hex);
			return;
		}

		// BT name (BBE6)
		if (hex.startsWith(RESPONSES.BT_NAME)) {
			this.parseBTName(hex);
			return;
		}

		// Version (BBEE)
		if (hex.startsWith(RESPONSES.VERSION)) {
			this.parseVersion(hex);
			return;
		}

		// Capacity (BBD2)
		if (hex.startsWith(RESPONSES.CAPACITY)) {
			this.parseCapacity(hex);
			return;
		}

		// Play order (BBD1)
		if (hex.startsWith(RESPONSES.ORDER)) {
			this.parseOrder(hex);
			return;
		}

		// File info (BBD0)
		if (hex.startsWith(RESPONSES.FILE_INFO)) {
			this.parseFileInfo(hex);
			return;
		}

		// Enable Classic BT response (BBFD)
		if (hex.startsWith(RESPONSES.ENABLE_CLASSIC_BT)) {
			this.parseEnableClassicBT(hex);
			return;
		}

		// Transfer responses
		if (hex.startsWith(RESPONSES.TRANSFER_START)) {
			this.parseTransferStart(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.CHUNK_DROPPED)) {
			this.parseChunkDropped(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.TRANSFER_END)) {
			this.parseTransferEnd(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.CONFIRM_TRANSFER_ACK)) {
			this.parseConfirmTransferAck(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.CANCEL_ACK)) {
			this.parseCancelAck(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.RESUME_ACK)) {
			this.parseResumeAck(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.PLAY_ACK)) {
			this.parsePlayAck(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.DELETE_ACK)) {
			this.parseDeleteAck(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.FORMAT_ACK)) {
			this.parseFormatAck(hex);
			return;
		}
	}

	/**
	 * Parse device parameters (BBE0)
	 */
	parseDeviceParams(hex) {
		const channels = [4, 6, 8, 10, 12, 14].map((i) =>
			parseInt(hex.slice(i, i + 2), 16),
		);
		const pin = getAsciiFromHex(hex.slice(16, 24));
		const wifiPassword = getAsciiFromHex(hex.slice(24, 40));
		const showMode = parseInt(hex.slice(40, 42), 16);
		const nameLen = parseInt(hex.slice(56, 58), 16);
		const name = getAsciiFromHex(hex.slice(58, 58 + nameLen * 2));

		this.state.updateDevice({
			channels,
			showMode,
			name: name || this.state.device.name,
			pin,
		});

		this.log(
			`Parsed Params: channels=${channels} pin=${pin} wifi=${wifiPassword} showMode=${showMode} name=${name}`,
		);
	}

	/**
	 * Parse live status (BBE1)
	 */
	parseLiveStatus(hex) {
		const action = parseInt(hex.slice(4, 6), 16);
		const lightData = hex.slice(6, 90);
		const lights = [];

		for (let i = 0; i < 6; i++) {
			const ch = lightData.slice(i * 14, (i + 1) * 14);
			if (ch.length < 14) continue;

			const light = {
				effectMode: parseInt(ch.slice(0, 2), 16),
				brightness: parseInt(ch.slice(2, 4), 16),
				r: parseInt(ch.slice(4, 6), 16),
				g: parseInt(ch.slice(6, 8), 16),
				b: parseInt(ch.slice(8, 10), 16),
				colorCycle: parseInt(ch.slice(10, 12), 16),
				effectSpeed: parseInt(ch.slice(12, 14), 16),
			};
			lights.push(light);
		}

		const eyeIcon = parseInt(hex.slice(90, 92), 16);
		// Scene firmware adds the live LIGHT_SCENES value after the eye icon; null: no scenes.
		const scene = hex.length > 94 ? parseInt(hex.slice(92, 94), 16) : null;

		this.state.updateLive({
			action,
			eye: eyeIcon,
			lights,
			scene,
		});

		this.log(
			`Parsed Live: action=${action} eyeIcon=${eyeIcon} scene=${scene} lights=${JSON.stringify(lights)}`,
		);
	}

	/**
	 * Parse volume (BBE5)
	 */
	parseVolume(hex) {
		const volume = parseInt(hex.slice(4, 6), 16);
		this.state.updateDevice({ volume });
		this.log(`Parsed Volume: ${volume}`);
	}

	/**
	 * Parse version (BBEE)
	 * Response format: BBEE<byte>...
	 * e.g. BBEE44... → byte 0x44 = 68 → "v68"
	 */
	parseVersion(hex) {
		const version = `v${parseInt(hex.slice(4, 6), 16)}`;
		this.state.updateDevice({ version });
		this.log(`Parsed Version: ${version}`);
	}

	/**
	 * Parse BT name (BBE6)
	 */
	parseBTName(hex) {
		const len = parseInt(hex.slice(4, 6), 16);
		const nameHex = hex.slice(6, 6 + len * 2);
		const btName = getAsciiFromHex(nameHex);
		this.state.updateDevice({ btName });
		this.log(`Parsed Classic BT Name: ${btName}`);
	}

	/**
	 * Parse capacity (BBD2): free KB u32, file count, mode (one byte, 0 =
	 * transfer mode; meaning unverified, see PROTOCOL.md)
	 */
	parseCapacity(hex) {
		const capacityKB = parseInt(hex.slice(4, 12), 16);
		const count = parseInt(hex.slice(12, 14), 16);
		const mode = parseInt(hex.slice(14, 16), 16);

		this.state.updateDevice({
			capacity: capacityKB,
			filesReported: count,
		});

		this.log(
			`Capacity ${capacityKB}KB remaining, filesReported=${count}, mode=${mode}`,
		);
	}

	/**
	 * Parse play order (BBD1)
	 */
	parseOrder(hex) {
		let count = parseInt(hex.slice(4, 6), 16);
		const data = hex.slice(6);
		if (data.length < count * 4) {
			count = Math.floor(data.length / 4);
		}

		const orders = Array.from({ length: count }, (_, i) =>
			parseInt(data.slice(i * 4, i * 4 + 4), 16),
		);

		const ordersAsString = JSON.stringify(orders);

		this.state.updateDevice({ order: ordersAsString });
		this.log(`File Order by Serial: ${ordersAsString}`);

		// Order arrival completes the refresh - enable UI and trigger update
		if (this.state.files.activeFetch) {
			clearTimeout(this.state.files.fetchTimer);
			this.state.updateFilesMetadata({ activeFetch: false, fetchTimer: null });
		}
	}

	/**
	 * Parse file info (BBD0)
	 */
	parseFileInfo(hex) {
		const serial = parseInt(hex.slice(4, 8), 16);
		const cluster = parseInt(hex.slice(8, 16), 16);
		const total = parseInt(hex.slice(16, 20), 16);
		// hex.slice(20, 24) is skipped: observed as always 0 on real devices.
		const action = parseInt(hex.slice(24, 26), 16);

		// Parse light data (6 channels, 7 bytes each = 84 hex chars)
		const lightData = hex.slice(26, 110);
		const lights = [];
		for (let i = 0; i < 6; i++) {
			const ch = lightData.slice(i * 14, (i + 1) * 14);
			if (ch.length < 14) continue;

			const light = {
				effectMode: parseInt(ch.slice(0, 2), 16),
				brightness: parseInt(ch.slice(2, 4), 16),
				r: parseInt(ch.slice(4, 6), 16),
				g: parseInt(ch.slice(6, 8), 16),
				b: parseInt(ch.slice(8, 10), 16),
				colorCycle: parseInt(ch.slice(10, 12), 16),
				effectSpeed: parseInt(ch.slice(12, 14), 16),
			};
			lights.push(light);
		}

		const eyeIcon = parseInt(hex.slice(110, 112), 16);

		// The tail layout depends on the firmware; tell it apart by where the name
		// marker sits (byte offsets, hex offsets are twice that):
		// - scene firmware (12ft Skelly, Lethal Lily, Ultra Skelly v68): byte 56 light
		//   scene (LIGHT_SCENES), byte 57 position, marker at 58
		// - older firmware (Ultra Skelly v66): byte 56 position, marker at 57
		const markerAt = (byte) =>
			hex.slice(byte * 2, byte * 2 + 4) === PROTOCOL_MARKERS.FILENAME;
		let markerPos = -1;
		let scene = null;
		let dbPos = 0;
		if (markerAt(58)) {
			markerPos = 58 * 2;
			scene = parseInt(hex.slice(112, 114), 16);
			dbPos = parseInt(hex.slice(114, 116), 16);
		} else if (markerAt(57)) {
			markerPos = 57 * 2;
			dbPos = parseInt(hex.slice(112, 114), 16);
		}

		// Extract filename after marker
		let name = "";
		if (markerPos >= 0) {
			const nameHex = hex.slice(markerPos + 4, hex.length - 2);
			try {
				name = decodeUtf16le(hexToBytes(nameHex)).trim();
			} catch (_error) {
				// Ignore decode errors
			}
		}

		// A different total than the one this refresh started with is a late
		// reply to an earlier refresh, or the files changed meanwhile: count
		// again from this report on, so a stale entry can't stay in the list
		// or end the refresh early.
		const expected = this.state.files.expected;
		if (
			this.state.files.activeFetch &&
			total &&
			expected &&
			total !== expected
		) {
			this.log(
				`File list total changed from ${expected} to ${total}, starting over.`,
				LOG_CLASSES.WARNING,
			);
			this.state.files.items.clear();
			this.state.updateFilesMetadata({
				expected: total,
				orderRequested: false,
			});
		}

		// Update expected count
		if (total && !this.state.files.expected) {
			this.state.updateFilesMetadata({ expected: total });
		}

		// Add file to list
		this.state.setFile(serial, {
			serial,
			cluster,
			total,
			action,
			lights,
			eye: eyeIcon,
			db: dbPos,
			scene,
			name,
		});

		// Check if list is complete
		this.fileManager.finalizeFilesIfDone();
	}

	/**
	 * Parse Enable Classic BT response (BBFD)
	 */
	parseEnableClassicBT(hex) {
		const status = hex.slice(4, 6);
		this.log(`Parsed Enable Classic BT: ${status}`);
	}

	/**
	 * Parse transfer start (BBC0)
	 */
	parseTransferStart(hex) {
		const failed = parseInt(hex.slice(4, 6), 16);
		const written = parseInt(hex.slice(6, 14), 16);
		this.log(`Start Transfer: failed=${failed} written=${written}`);
	}

	/**
	 * Parse chunk dropped (BBC1)
	 */
	parseChunkDropped(hex) {
		const dropped = parseInt(hex.slice(4, 6), 16);
		const index = parseInt(hex.slice(6, 10), 16);
		// lost = 0 is a status without a loss; the upload (FileManager)
		// handles lost = 1
		this.log(
			dropped === 0
				? `Chunk status: no loss (@${index})`
				: `Chunk lost: device wants chunks from ${index} again`,
		);
	}

	/**
	 * Parse transfer end (BBC2)
	 */
	parseTransferEnd(hex) {
		const failed = parseInt(hex.slice(4, 6), 16);
		this.log(`End Transfer: failed=${failed}`);
	}

	/**
	 * Parse confirm transfer ACK (BBC3)
	 */
	parseConfirmTransferAck(hex) {
		const failed = parseInt(hex.slice(4, 6), 16);
		this.log(`Confirm Transfer: failed=${failed}`);
	}

	/**
	 * Parse cancel ACK (BBC4)
	 */
	parseCancelAck(hex) {
		const failed = parseInt(hex.slice(4, 6), 16);
		this.log(`Cancel: failed=${failed}`);
	}

	/**
	 * Parse resume ACK (BBC5)
	 */
	parseResumeAck(hex) {
		const written = parseInt(hex.slice(4, 12), 16);
		this.log(`Resume written=${written}`);
	}

	/**
	 * Parse play/pause ACK (BBC6)
	 */
	parsePlayAck(hex) {
		const serial = parseInt(hex.slice(4, 8), 16);
		const playing = !!parseInt(hex.slice(8, 10), 16);
		const duration = parseInt(hex.slice(10, 14), 16);
		this.log(
			`Play/Pause serial=${serial} playing=${playing} duration=${duration}`,
		);

		// Notify callback if provided
		if (this.onPlayPause) {
			this.onPlayPause(serial, playing, duration);
		}
	}

	/**
	 * Parse delete ACK (BBC7)
	 */
	parseDeleteAck(hex) {
		const ok = parseInt(hex.slice(4, 6), 16) === 0;
		// The delete itself waits for this reply (FileManager.deleteFile)
		this.log(`Delete ${ok ? "OK" : "FAIL"}`);
	}

	/**
	 * Parse format ACK (BBC8)
	 */
	parseFormatAck(hex) {
		const failed = parseInt(hex.slice(4, 6), 16);
		if (failed === 0) {
			this.log("Format done ✔");
		} else {
			this.log(`Format failed (result=${failed})`, LOG_CLASSES.WARNING);
		}
	}
}

  // ============================================================
  // Edit Modal Manager (js/edit-modal.js)
  // ============================================================
/**
 * Edit Modal Manager
 * Handles the per-file edit modal functionality
 */

/**
 * Simple UI Helper
 */
const $ = (selector) => document.querySelector(selector);

/**
 * Edit Modal Manager Class
 */
class EditModalManager {
	constructor(bleManager, stateManager, fileManager, logger) {
		this.connection = bleManager;
		this.state = stateManager;
		this.fileManager = fileManager;
		this.mainLogger = logger;

		// Current edit state
		this.currentFile = {
			serial: null,
			cluster: 0,
			name: "",
			eye: 1,
			scene: null, // LIGHT_SCENES value from the file list; null: unknown
		};
		// Custom colors kept while a scene preset shows its own (showSceneColors)
		this.customColors = null;

		this.initializeModal();
	}

	/**
	 * Initialize the edit modal and all its handlers
	 */
	initializeModal() {
		// Get modal elements
		this.modal = $("#editModal");
		this.eyeGrid = $("#eyeGrid");
		this.logElement = $("#edLog");

		if (!this.modal) {
			console.warn("Edit modal not found in DOM");
			return;
		}

		// Initialize all handlers
		this.initializeLightingControls();
		this.initializeMovementControls();
		this.initializeColorControls();
		this.initializeEyeGrid();
		this.initializeFileControls();
		this.initializeActionButtons();
	}

	/**
	 * Log to both main log and edit modal log
	 */
	log(message, className = "normal") {
		// Log to main page
		this.mainLogger(message, className);

		// Also log to edit modal if open
		if (this.logElement) {
			const div = document.createElement("div");
			div.className = `line ${className}`;
			const time = new Date().toLocaleTimeString();
			div.textContent = `[${time}] ${message}`;
			this.logElement.appendChild(div);

			// Auto-scroll to bottom
			this.logElement.scrollTop = this.logElement.scrollHeight;
		}
	}

	/**
	 * Initialize lighting type and speed controls
	 */
	initializeLightingControls() {
		// Light 1 brightness controls
		const edLight1BrightnessRange = $("#edLight1BrightnessRange");
		const edLight1BrightnessNum = $("#edLight1Brightness");

		// Sync Light 1 brightness inputs
		if (edLight1BrightnessRange && edLight1BrightnessNum) {
			edLight1BrightnessRange.addEventListener(
				"input",
				(e) => (edLight1BrightnessNum.value = e.target.value),
			);
			edLight1BrightnessNum.addEventListener(
				"input",
				(e) => (edLight1BrightnessRange.value = clamp(e.target.value, 0, 255)),
			);
		}

		// Light 1 effect controls
		const edLight1EffectMode = $("#edLight1EffectMode");
		const edLight1EffectSpeedBlock = $("#edLight1EffectSpeedBlock");
		const edLight1EffectSpeedRange = $("#edLight1EffectSpeedRange");
		const edLight1EffectSpeedNum = $("#edLight1EffectSpeed");

		// Toggle Light 1 speed UI for Static vs Strobe/Pulsing
		edLight1EffectMode?.addEventListener("change", () => {
			const v = parseInt(edLight1EffectMode.value, 10);
			edLight1EffectSpeedBlock?.classList.toggle("hidden", v === 1); // hide when Static
		});

		// Sync Light 1 speed inputs
		if (edLight1EffectSpeedRange && edLight1EffectSpeedNum) {
			edLight1EffectSpeedRange.addEventListener(
				"input",
				(e) => (edLight1EffectSpeedNum.value = e.target.value),
			);
			edLight1EffectSpeedNum.addEventListener(
				"input",
				(e) =>
					(edLight1EffectSpeedRange.value = clamp(
						e.target.value,
						0,
						MAX_UI_EFFECT_SPEED,
					)),
			);
		}

		// Light 0 brightness controls
		const edLight0BrightnessRange = $("#edLight0BrightnessRange");
		const edLight0BrightnessNum = $("#edLight0Brightness");

		// Sync Light 0 brightness inputs
		if (edLight0BrightnessRange && edLight0BrightnessNum) {
			edLight0BrightnessRange.addEventListener(
				"input",
				(e) => (edLight0BrightnessNum.value = e.target.value),
			);
			edLight0BrightnessNum.addEventListener(
				"input",
				(e) => (edLight0BrightnessRange.value = clamp(e.target.value, 0, 255)),
			);
		}

		// Light 0 effect controls
		const edLight0EffectMode = $("#edLight0EffectMode");
		const edLight0EffectSpeedBlock = $("#edLight0EffectSpeedBlock");
		const edLight0EffectSpeedRange = $("#edLight0EffectSpeedRange");
		const edLight0EffectSpeedNum = $("#edLight0EffectSpeed");

		// Toggle Light 0 speed UI for Static vs Strobe/Pulsing
		edLight0EffectMode?.addEventListener("change", () => {
			const v = parseInt(edLight0EffectMode.value, 10);
			edLight0EffectSpeedBlock?.classList.toggle("hidden", v === 1); // hide when Static
		});

		// Sync Light 0 speed inputs
		if (edLight0EffectSpeedRange && edLight0EffectSpeedNum) {
			edLight0EffectSpeedRange.addEventListener(
				"input",
				(e) => (edLight0EffectSpeedNum.value = e.target.value),
			);
			edLight0EffectSpeedNum.addEventListener(
				"input",
				(e) =>
					(edLight0EffectSpeedRange.value = clamp(
						e.target.value,
						0,
						MAX_UI_EFFECT_SPEED,
					)),
			);
		}
	}

	/**
	 * Initialize movement controls
	 */
	initializeMovementControls() {
		const edMoveGrid = $("#edMove");
		if (!edMoveGrid) return;

		const allBtn = edMoveGrid.querySelector('[data-part="all"]');
		const partBtns = edMoveGrid.querySelectorAll(
			'[data-part]:not([data-part="all"])',
		);

		// "All" button handler
		allBtn?.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			allBtn.classList.toggle("selected");
			if (allBtn.classList.contains("selected")) {
				partBtns.forEach((btn) => {
					btn.classList.remove("selected");
				});
			}
		});

		// Part button handlers
		partBtns.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				btn.classList.toggle("selected");
				allBtn?.classList.remove("selected");
			});
		});
	}

	/**
	 * Initialize color/RGB controls
	 */
	initializeColorControls() {
		// Light 1 color sync
		const edLight1ColorPick = $("#edLight1ColorPick");
		const edLight1R = $("#edLight1R");
		const edLight1G = $("#edLight1G");
		const edLight1B = $("#edLight1B");

		// Sync Light 1 RGB inputs to color picker
		[edLight1R, edLight1G, edLight1B].forEach((inp) => {
			inp?.addEventListener("input", () => {
				const r = clamp(edLight1R.value, 0, 255);
				const g = clamp(edLight1G.value, 0, 255);
				const b = clamp(edLight1B.value, 0, 255);
				const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
				if (edLight1ColorPick && edLight1ColorPick.value !== hex) {
					edLight1ColorPick.value = hex;
				}
			});
		});

		// Sync Light 1 color picker to RGB inputs
		edLight1ColorPick?.addEventListener("input", () => {
			const v = edLight1ColorPick.value.replace("#", "");
			if (v.length === 6) {
				edLight1R.value = parseInt(v.slice(0, 2), 16);
				edLight1G.value = parseInt(v.slice(2, 4), 16);
				edLight1B.value = parseInt(v.slice(4, 6), 16);
			}
		});

		// Light 1 color cycle button (toggle visual state only)
		$("#edLight1ColorCycle")?.addEventListener("click", (e) => {
			e.currentTarget.classList.toggle("selected");
		});

		// Light 0 color sync
		const edLight0ColorPick = $("#edLight0ColorPick");
		const edLight0R = $("#edLight0R");
		const edLight0G = $("#edLight0G");
		const edLight0B = $("#edLight0B");

		// Sync Light 0 RGB inputs to color picker
		[edLight0R, edLight0G, edLight0B].forEach((inp) => {
			inp?.addEventListener("input", () => {
				const r = clamp(edLight0R.value, 0, 255);
				const g = clamp(edLight0G.value, 0, 255);
				const b = clamp(edLight0B.value, 0, 255);
				const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
				if (edLight0ColorPick && edLight0ColorPick.value !== hex) {
					edLight0ColorPick.value = hex;
				}
			});
		});

		// Sync Light 0 color picker to RGB inputs
		edLight0ColorPick?.addEventListener("input", () => {
			const v = edLight0ColorPick.value.replace("#", "");
			if (v.length === 6) {
				edLight0R.value = parseInt(v.slice(0, 2), 16);
				edLight0G.value = parseInt(v.slice(2, 4), 16);
				edLight0B.value = parseInt(v.slice(4, 6), 16);
			}
		});

		// Light 0 color cycle button (toggle visual state only)
		$("#edLight0ColorCycle")?.addEventListener("click", (e) => {
			e.currentTarget.classList.toggle("selected");
		});

		// Light scene picker: Apply All sends it with the lights (F1)
		$("#edScene")?.addEventListener("change", (e) => {
			const from = this.currentFile.scene;
			this.currentFile.scene = parseInt(e.target.value, 10);
			this.showSceneColors(from, this.currentFile.scene);
			this.updateSceneControls();
		});

		// Note: Individual apply buttons removed - use "Apply All Settings" button instead
	}

	/** Color and color cycle of the light controls, channels 0 and 1 */
	readColors() {
		return [0, 1].map((ch) => ({
			r: clamp($(`#edLight${ch}R`)?.value, 0, 255),
			g: clamp($(`#edLight${ch}G`)?.value, 0, 255),
			b: clamp($(`#edLight${ch}B`)?.value, 0, 255),
			colorCycle: $(`#edLight${ch}ColorCycle`)?.classList.contains("selected")
				? 1
				: 0,
		}));
	}

	/** Show colors (from readColors or sceneLightColor) in the light controls */
	showColors(colors) {
		colors.forEach((color, ch) => {
			if (!color) return;
			if ($(`#edLight${ch}R`)) $(`#edLight${ch}R`).value = color.r;
			if ($(`#edLight${ch}G`)) $(`#edLight${ch}G`).value = color.g;
			if ($(`#edLight${ch}B`)) $(`#edLight${ch}B`).value = color.b;
			const hex = [color.r, color.g, color.b]
				.map((c) => Math.round(c).toString(16).padStart(2, "0"))
				.join("");
			if ($(`#edLight${ch}ColorPick`))
				$(`#edLight${ch}ColorPick`).value = `#${hex}`;
			$(`#edLight${ch}ColorCycle`)?.classList.toggle(
				"selected",
				color.colorCycle === 1,
			);
		});
	}

	/**
	 * Going from `from` to scene `to`: a preset shows (and Apply All sends)
	 * its own colors, as in the phone app; the custom colors are kept and
	 * come back with Custom.
	 */
	showSceneColors(from, to) {
		if (isScenePreset(to)) {
			if (!isScenePreset(from) || !this.customColors) {
				this.customColors = this.readColors();
			}
			this.showColors([0, 1].map((ch) => sceneLightColor(to, ch)));
		} else if (this.customColors) {
			this.showColors(this.customColors);
			this.customColors = null;
		}
	}

	/**
	 * Show the scene picker on scene firmware when the file list gave the
	 * file's scene, and gray out color and color cycle while a scene preset
	 * plays its own colors (the colors are still sent and kept).
	 */
	updateSceneControls() {
		const scene = this.currentFile.scene;
		const shown =
			Number.isInteger(scene) &&
			supportsLightScenes(this.state.deviceType, this.state.device?.version);
		const preset = shown && isScenePreset(scene);
		$("#edSceneRow")?.classList.toggle("hidden", !shown);
		$("#edSceneHint")?.classList.toggle("hidden", !preset);
		const picker = $("#edScene");
		if (picker && shown) {
			// A scene this page doesn't know (newer firmware) still shows as a number
			if (![...picker.options].some((o) => o.value === String(scene))) {
				picker.add(new Option(`Scene ${scene}`, String(scene)));
			}
			picker.value = String(scene);
		}
		for (const ch of [0, 1]) {
			for (const field of ["ColorPick", "R", "G", "B", "ColorCycle"]) {
				const el = $(`#edLight${ch}${field}`);
				if (!el) continue;
				el.disabled = preset;
				el.title = preset
					? "The light scene plays its own colors"
					: field === "ColorCycle"
						? "Cycle all colors"
						: "";
			}
		}
	}

	/**
	 * Initialize eye icon grid
	 */
	initializeEyeGrid() {
		if (!this.eyeGrid) return;

		// Build eye grid on initialization
		this.buildEyeGrid();

		// Eye selection handler
		this.eyeGrid.addEventListener("click", (e) => {
			const cell = e.target.closest(".eye-opt");
			if (!cell) return;

			this.currentFile.eye = parseInt(cell.dataset.eye, 10);
			this.eyeGrid.querySelectorAll(".eye-opt").forEach((el) => {
				el.classList.remove("selected");
			});
			cell.classList.add("selected");
		});
	}

	/**
	 * Build the eye icon grid
	 */
	buildEyeGrid() {
		if (!this.eyeGrid) return;

		this.eyeGrid.innerHTML = "";

		// Create eye options for images 1..eyeIconCount of the active profile
		const eyeCount = DEVICE_PROFILES[this.state.deviceType]?.eyeIconCount || 0;
		for (let imgIdx = 1; imgIdx <= eyeCount; imgIdx++) {
			const eyeNum = imgIdx;
			const div = document.createElement("div");
			div.className = "eye-opt";
			div.dataset.eye = String(eyeNum);
			div.title = `Eye ${eyeNum}`;

			// Create image element
			const img = document.createElement("img");
			img.className = "eye-thumb";
			img.src = getEyeIconPath(this.state.deviceType, imgIdx);
			img.alt = `eye ${eyeNum}`;

			div.appendChild(img);
			this.eyeGrid.appendChild(div);
		}
	}

	/**
	 * Initialize file-related controls
	 */
	initializeFileControls() {
		// Replace File button
		$("#btnReplaceFile")?.addEventListener("click", () => {
			if (this._onReplaceFile) {
				this._onReplaceFile(this.currentFile.name);
			}
		});
	}

	/**
	 * Set the callback invoked when user clicks Replace File.
	 * @param {function(string):void} fn - receives the current filename
	 */
	setReplaceFileHandler(fn) {
		this._onReplaceFile = fn;
	}

	/**
	 * Initialize action buttons
	 */
	initializeActionButtons() {
		// Close button
		$("#edClose")?.addEventListener("click", () => this.close());
		$("#edCloseTop")?.addEventListener("click", () => this.close());

		// Escape key to close modal (but not when transfer modal is on top)
		document.addEventListener("keydown", (e) => {
			if (
				e.key === "Escape" &&
				!e.defaultPrevented &&
				this.modal &&
				!this.modal.classList.contains("hidden") &&
				(document
					.querySelector("#transferModal")
					?.classList.contains("hidden") ??
					true)
			) {
				e.preventDefault();
				this.close();
			}
		});

		// Delete button (C7)
		$("#edDelete")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const delName = $("#edName")?.value || `serial #${$("#edSerial")?.value}`;
			if (!confirm(`Delete "${delName}" from device? This cannot be undone.`))
				return;

			const serial = Math.max(0, parseInt($("#edSerial")?.value || "0", 10));
			const cluster = Math.max(0, parseInt($("#edCluster")?.value || "0", 10));

			// Disable delete button and show waiting state
			const deleteBtn = $("#edDelete");
			if (deleteBtn) {
				deleteBtn.disabled = true;
				deleteBtn.textContent = "Deleting...";
			}

			// Send C7 and wait for its BBC7
			let success = false;
			try {
				success = await this.fileManager.deleteFile(serial, cluster);
				if (!success) {
					this.log("Device reported the delete failed", LOG_CLASSES.WARNING);
				}
			} catch (error) {
				this.log(`Delete failed: ${error.message}`, LOG_CLASSES.WARNING);
			} finally {
				if (deleteBtn) {
					deleteBtn.disabled = false;
					deleteBtn.textContent = "Delete";
				}
			}

			if (success) {
				this.log(
					"Delete confirmed, refreshing file list...",
					LOG_CLASSES.WARNING,
				);

				// Device renumbers serials after delete (all serials above the deleted
				// one shift down by 1). Capture ordered names NOW before the refresh
				// clears local state, then remap to new serials once the updated file
				// list has arrived.
				const currentOrder = JSON.parse(this.state.device?.order || "[]");
				const orderedNames = currentOrder
					.filter((s) => s !== serial)
					.map((s) => this.state.getFile(s)?.name)
					.filter(Boolean);

				// Refresh file list (receives new serial assignments from device)
				this.fileManager.startFetchFiles();

				if (orderedNames.length > 0) {
					const allFound =
						await this.fileManager.waitForFilesByName(orderedNames);

					if (!allFound) {
						this.log(
							"File list refresh timed out; play order update skipped.",
							LOG_CLASSES.WARNING,
						);
					} else {
						// Remap names to new serials and push updated order to device
						const newOrder = orderedNames
							.map((name) => this.state.hasFileName(name)?.serial)
							.filter((s) => s != null);

						if (newOrder.length > 0) {
							this.log(
								`Updating play order with renumbered serials: ${JSON.stringify(newOrder)}`,
								LOG_CLASSES.INFO,
							);
							await this.fileManager.updateFileOrder(newOrder);
						}
					}
				}

				this.close();
			}
		});

		// Apply All button - sends all settings to device
		$("#edApplyAll")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const cluster = Math.max(0, parseInt($("#edCluster")?.value || "0", 10));
			const name = ($("#edName")?.value || "").trim();

			this.log("Applying all settings to device...", LOG_CLASSES.INFO);

			// Movement bitfield from the selected toggle icons
			let actionBits = 0;
			const grid = $("#edMove");
			if (grid) {
				grid.querySelectorAll(".iconToggle.selected").forEach((btn) => {
					if (btn.getAttribute("data-part") === "all") {
						actionBits = 255;
					} else if (actionBits !== 255) {
						actionBits |= parseInt(btn.dataset.bit || "0", 10);
					}
				});
			}

			const readLight = (prefix, defaults) => {
				const effectMode = parseInt(
					$(`#ed${prefix}EffectMode`)?.value || "1",
					10,
				);
				return {
					brightness: clamp(
						$(`#ed${prefix}Brightness`)?.value || defaults.brightness,
						0,
						255,
					),
					effectMode,
					effectSpeed: uiSpeedToDevice(
						clamp(
							$(`#ed${prefix}EffectSpeed`)?.value || 0,
							0,
							MAX_UI_EFFECT_SPEED,
						),
					),
					r: clamp($(`#ed${prefix}R`)?.value || defaults.r, 0, 255),
					g: clamp($(`#ed${prefix}G`)?.value || defaults.g, 0, 255),
					b: clamp($(`#ed${prefix}B`)?.value || defaults.b, 0, 255),
					colorCycle: $(`#ed${prefix}ColorCycle`)?.classList.contains(
						"selected",
					)
						? 1
						: 0,
				};
			};

			// Only send as many light channels as this device type actually has
			// (e.g. Lily has 1, Skelly has 2) — the UI only exposes fields for
			// channels 0 and 1 today, but this stays correct if that grows.
			const profile = DEVICE_PROFILES[this.state.deviceType];
			const lightDefaults = [
				{ brightness: 200, r: 0, g: 0, b: 255 },
				{ brightness: 200, r: 255, g: 0, b: 0 },
			];
			const lightCount = Math.min(profile?.lights?.length || 1, 2);
			const lights = [];
			for (let ch = 0; ch < lightCount; ch++) {
				lights.push(readLight(`Light${ch}`, lightDefaults[ch]));
			}

			await applyFileSettings(
				this.connection,
				cluster,
				name,
				{
					action: actionBits,
					eye: this.currentFile.eye,
					lights,
				},
				{
					hasEyeImage: profile?.hasEyeImage,
					delayMs: APPLY_ALL_COMMAND_DELAY_MS,
					onStep: (label) => this.log(`✓ ${label}`),
					scene: currentLightScene(
						this.state.deviceType,
						this.state.device?.version,
						this.currentFile.scene,
					),
				},
			);

			this.log(
				`All settings applied successfully for file "${name || "(no name)"}"`,
				LOG_CLASSES.SUCCESS,
			);

			// Refresh the file list to show updated data
			this.log("Refreshing file list from device...");
			await this.fileManager.startFetchFiles();

			this.close();
		});
	}

	/**
	 * Open the edit modal for a specific file
	 */
	open(file) {
		if (!file) return;

		// Store current file data
		this.currentFile.serial = file.serial;
		this.currentFile.cluster = file.cluster;
		this.currentFile.name = file.name || "";
		this.currentFile.eye = file.eye || 1;
		this.currentFile.scene = file.scene ?? null;

		// Populate form fields
		if ($("#edSerial")) $("#edSerial").value = file.serial;
		if ($("#edCluster")) $("#edCluster").value = file.cluster;
		if ($("#edName")) $("#edName").value = file.name || "";

		// Populate lighting data from file if available
		const light1 = file.lights?.[1];
		const light0 = file.lights?.[0];

		if (light1) {
			// Light 1 brightness
			if ($("#edLight1Brightness"))
				$("#edLight1Brightness").value = light1.brightness ?? 200;
			if ($("#edLight1BrightnessRange"))
				$("#edLight1BrightnessRange").value = light1.brightness ?? 200;

			// Light 1 effect mode
			if ($("#edLight1EffectMode"))
				$("#edLight1EffectMode").value = light1.effectMode || 1;

			// Light 1 effect speed
			const light1UISpeed = deviceSpeedToUI(light1.effectSpeed || 0);
			if ($("#edLight1EffectSpeed"))
				$("#edLight1EffectSpeed").value = light1UISpeed;
			if ($("#edLight1EffectSpeedRange"))
				$("#edLight1EffectSpeedRange").value = light1UISpeed;
			$("#edLight1EffectSpeedBlock")?.classList.toggle(
				"hidden",
				light1.effectMode === 1,
			);

			// Light 1 color
			if ($("#edLight1R")) $("#edLight1R").value = light1.r;
			if ($("#edLight1G")) $("#edLight1G").value = light1.g;
			if ($("#edLight1B")) $("#edLight1B").value = light1.b;
			const light1Hex = `#${light1.r.toString(16).padStart(2, "0")}${light1.g.toString(16).padStart(2, "0")}${light1.b.toString(16).padStart(2, "0")}`;
			if ($("#edLight1ColorPick")) $("#edLight1ColorPick").value = light1Hex;

			// Light 1 color cycle
			const edLight1ColorCycle = $("#edLight1ColorCycle");
			if (edLight1ColorCycle) {
				if (light1.colorCycle === 1) {
					edLight1ColorCycle.classList.add("selected");
				} else {
					edLight1ColorCycle.classList.remove("selected");
				}
			}
		} else {
			// Defaults for Light 1
			if ($("#edLight1Brightness")) $("#edLight1Brightness").value = 200;
			if ($("#edLight1BrightnessRange"))
				$("#edLight1BrightnessRange").value = 200;
			if ($("#edLight1EffectMode")) $("#edLight1EffectMode").value = "1";
			if ($("#edLight1EffectSpeed")) $("#edLight1EffectSpeed").value = 0;
			if ($("#edLight1EffectSpeedRange"))
				$("#edLight1EffectSpeedRange").value = 0;
			$("#edLight1EffectSpeedBlock")?.classList.add("hidden");

			if ($("#edLight1R")) $("#edLight1R").value = 255;
			if ($("#edLight1G")) $("#edLight1G").value = 0;
			if ($("#edLight1B")) $("#edLight1B").value = 0;
			if ($("#edLight1ColorPick")) $("#edLight1ColorPick").value = "#ff0000";
			$("#edLight1ColorCycle")?.classList.remove("selected");
		}

		if (light0) {
			// Light 0 brightness
			if ($("#edLight0Brightness"))
				$("#edLight0Brightness").value = light0.brightness ?? 200;
			if ($("#edLight0BrightnessRange"))
				$("#edLight0BrightnessRange").value = light0.brightness ?? 200;

			// Light 0 effect mode
			if ($("#edLight0EffectMode"))
				$("#edLight0EffectMode").value = light0.effectMode || 1;

			// Light 0 effect speed
			const light0UISpeed = deviceSpeedToUI(light0.effectSpeed || 0);
			if ($("#edLight0EffectSpeed"))
				$("#edLight0EffectSpeed").value = light0UISpeed;
			if ($("#edLight0EffectSpeedRange"))
				$("#edLight0EffectSpeedRange").value = light0UISpeed;
			$("#edLight0EffectSpeedBlock")?.classList.toggle(
				"hidden",
				light0.effectMode === 1,
			);

			// Light 0 color
			if ($("#edLight0R")) $("#edLight0R").value = light0.r;
			if ($("#edLight0G")) $("#edLight0G").value = light0.g;
			if ($("#edLight0B")) $("#edLight0B").value = light0.b;
			const light0Hex = `#${light0.r.toString(16).padStart(2, "0")}${light0.g.toString(16).padStart(2, "0")}${light0.b.toString(16).padStart(2, "0")}`;
			if ($("#edLight0ColorPick")) $("#edLight0ColorPick").value = light0Hex;

			// Light 0 color cycle
			const edLight0ColorCycle = $("#edLight0ColorCycle");
			if (edLight0ColorCycle) {
				if (light0.colorCycle === 1) {
					edLight0ColorCycle.classList.add("selected");
				} else {
					edLight0ColorCycle.classList.remove("selected");
				}
			}
		} else {
			// Defaults for Light 0
			if ($("#edLight0Brightness")) $("#edLight0Brightness").value = 200;
			if ($("#edLight0BrightnessRange"))
				$("#edLight0BrightnessRange").value = 200;
			if ($("#edLight0EffectMode")) $("#edLight0EffectMode").value = "1";
			if ($("#edLight0EffectSpeed")) $("#edLight0EffectSpeed").value = 0;
			if ($("#edLight0EffectSpeedRange"))
				$("#edLight0EffectSpeedRange").value = 0;
			$("#edLight0EffectSpeedBlock")?.classList.add("hidden");

			if ($("#edLight0R")) $("#edLight0R").value = 0;
			if ($("#edLight0G")) $("#edLight0G").value = 0;
			if ($("#edLight0B")) $("#edLight0B").value = 255;
			if ($("#edLight0ColorPick")) $("#edLight0ColorPick").value = "#0000ff";
			$("#edLight0ColorCycle")?.classList.remove("selected");
		}

		// Populate movement from action field (bitfield: 0x01=head, 0x02=arm, 0x04=torso, 0xFF=all)
		const actionBits = file.action || 0;
		const edMoveGrid = $("#edMove");
		edMoveGrid?.querySelectorAll(".iconToggle").forEach((btn) => {
			btn.classList.remove("selected");
		});

		if (edMoveGrid) {
			if (actionBits === 255) {
				edMoveGrid
					.querySelector('[data-part="all"]')
					?.classList.add("selected");
			} else {
				edMoveGrid
					.querySelectorAll('[data-part]:not([data-part="all"])')
					.forEach((btn) => {
						const bit = parseInt(btn.dataset.bit || "0", 10);
						if (bit && actionBits & bit) btn.classList.add("selected");
					});
			}
		}

		// Update eye grid selection
		if (this.eyeGrid) {
			this.eyeGrid.querySelectorAll(".eye-opt").forEach((el) => {
				const eyeNum = parseInt(el.dataset.eye, 10);
				el.classList.toggle("selected", eyeNum === this.currentFile.eye);
			});
		}

		// A file in a preset: its colors are kept as the custom ones
		this.customColors = null;
		if (
			supportsLightScenes(this.state.deviceType, this.state.device?.version)
		) {
			this.showSceneColors(null, this.currentFile.scene);
		}
		this.updateSceneControls();

		// Clear the log when opening
		if (this.logElement) {
			this.logElement.innerHTML = "";
		}

		// Show modal
		this.modal?.classList.remove("hidden");
	}

	/**
	 * Close the edit modal
	 */
	close() {
		this.modal?.classList.add("hidden");
	}
}

  // ============================================================
  // Transfer Modal Manager (js/transfer-modal.js)
  // ============================================================
/**
 * Transfer Modal Manager
 * Handles the file transfer modal functionality
 */

// $ helper already defined above

/**
 * Truncate a filename to fit the device's length limit, preserving the
 * extension where possible.
 */
function truncateFilename(name, maxLength) {
	if (name.length <= maxLength) return name;
	const dotIndex = name.lastIndexOf(".");
	const hasExt = dotIndex > 0 && name.length - dotIndex <= 6;
	if (!hasExt) return name.slice(0, maxLength);
	const ext = name.slice(dotIndex);
	const keep = maxLength - ext.length;
	return keep > 0 ? name.slice(0, keep) + ext : name.slice(0, maxLength);
}

/**
 * Device file name for ElevenLabs speech: the start of the text as a slug
 * ("hello_there.mp3"), short enough for the device's name limit.
 */
function ttsFileName(text) {
	const ext = ".mp3";
	const slug =
		(text || "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")
			.replace(/^_+/, "")
			.slice(0, TRANSFER_CONFIG.MAX_FILENAME_LENGTH - ext.length)
			.replace(/_+$/, "") || "tts";
	return slug + ext;
}

/**
 * Transfer Modal Manager Class
 */
class TransferModalManager {
	constructor(connection, state, fileManager, audioConverter, logger) {
		this.connection = connection;
		this.state = state;
		this.fileManager = fileManager;
		this.audioConverter = audioConverter;
		this.mainLogger = logger;

		this.elevenLabs = new ElevenLabsClient();
		this.elCache = { key: null, bytes: null };
		this.elPreviewAudio = null;
		this._mode = null;
		this._lockedFilename = "";
		this._onReplaceSuccess = null;
		// Tracks whether the user has manually typed into the filename field,
		// so picking a new file only auto-fills it when they haven't.
		this._fileNameUserEdited = false;

		this.initializeModal();
	}

	/**
	 * Initialize the transfer modal and all its handlers
	 */
	initializeModal() {
		this.modal = $("#transferModal");

		if (!this.modal) {
			console.warn("Transfer modal not found in DOM");
			return;
		}

		this.initializeSourceSelector();
		this.initializeElevenLabsControls();
		this.initializeBitrateControls();
		this.initializeChunkSizeControls();
		this.initializeChunkDelayControls();
		this.initializeButtons();
		this.initializeFileInputHandler();

		this.state.subscribe("transfer", (transfer) => {
			this.updateButtons(transfer);
		});
	}

	/**
	 * Store a callback to invoke when a replace transfer succeeds
	 */
	setReplaceSuccessHandler(fn) {
		this._onReplaceSuccess = fn;
	}

	/**
	 * Open the File Transfer modal.
	 * @param {"add"|"replace"} mode
	 * @param {string} [lockedFilename] - Required when mode is "replace"
	 */
	open(mode, lockedFilename = "") {
		this._mode = mode;
		this._lockedFilename = lockedFilename;

		// Reset file picker and progress
		this.fileManager.clearFilePickerData();
		const fileInput = $("#fileInput");
		if (fileInput) fileInput.value = "";
		if ($("#progText")) $("#progText").textContent = "0 / 0";
		if ($("#progPct")) $("#progPct").textContent = "0%";
		if ($("#progBar")) $("#progBar").style.width = "0%";

		this._fileNameUserEdited = false;

		const fileNameEl = $("#fileName");
		const lockNotice = $("#transferModalLockNotice");
		const title = $("#transferModalTitle");
		if (mode === "replace") {
			if (fileNameEl) {
				fileNameEl.value = lockedFilename;
				fileNameEl.readOnly = true;
			}
			if (lockNotice) lockNotice.classList.remove("hidden");
			if (title) title.textContent = "Replace File";
		} else {
			if (fileNameEl) {
				fileNameEl.value = "";
				fileNameEl.readOnly = false;
			}
			if (lockNotice) lockNotice.classList.add("hidden");
			if (title) title.textContent = "Add File";
		}

		this.modal?.classList.remove("hidden");
	}

	/**
	 * Close and reset the File Transfer modal.
	 */
	close() {
		this.modal?.classList.add("hidden");
		this._mode = null;
		this._lockedFilename = "";
		this.fileManager.clearFilePickerData();
		const fileInput = $("#fileInput");
		if (fileInput) fileInput.value = "";
	}

	/**
	 * Log to the main logger
	 */
	log(message, className = "normal") {
		this.mainLogger(message, className);
	}

	/**
	 * Update disabled state of send/cancel buttons based on transfer state
	 */
	updateButtons(transfer) {
		const btnSend = $("#btnSendFile");
		const btnCancel = $("#btnCancelFile");

		if (btnSend) btnSend.disabled = transfer.inProgress;
		if (btnCancel) btnCancel.disabled = !transfer.inProgress;
	}

	/**
	 * Toggle File Transfer source panels (local file vs ElevenLabs TTS)
	 */
	initializeSourceSelector() {
		const select = $("#sourceSelect");
		if (!select) return;

		const showSource = (value) => {
			$("#panelLocalFile")?.classList.toggle("hidden", value !== "local");
			$("#panelElevenLabs")?.classList.toggle("hidden", value !== "elevenlabs");
		};

		// Restore persisted selection
		const saved = localStorage.getItem(STORAGE_KEYS.FILE_SOURCE);
		if (saved) select.value = saved;

		showSource(select.value);

		select.addEventListener("change", (e) => {
			localStorage.setItem(STORAGE_KEYS.FILE_SOURCE, e.target.value);
			showSource(e.target.value);
		});
	}

	/**
	 * Initialize ElevenLabs controls: API key persistence, model/voice persistence,
	 * and auto-fetch voices when the key changes.
	 */
	initializeElevenLabsControls() {
		const apiKeyInput = $("#elApiKey");
		const modelSelect = $("#elModel");
		const voiceSelect = $("#elVoice");
		const voiceStatus = $("#elVoiceStatus");
		const btnClear = $("#btnClearElApiKey");

		if (!apiKeyInput) return;

		// Restore persisted values
		const savedKey =
			localStorage.getItem(STORAGE_KEYS.ELEVENLABS_API_KEY) || "";
		const savedModel =
			localStorage.getItem(STORAGE_KEYS.ELEVENLABS_MODEL) || "";
		const savedVoice =
			localStorage.getItem(STORAGE_KEYS.ELEVENLABS_VOICE) || "";

		if (savedKey) apiKeyInput.value = savedKey;
		if (savedModel && modelSelect) modelSelect.value = savedModel;

		// Invalidate TTS cache whenever any synthesis input changes
		const invalidateCache = () => {
			this.elCache = { key: null, bytes: null };
		};

		// Persist model selection + invalidate cache
		modelSelect?.addEventListener("change", (e) => {
			localStorage.setItem(STORAGE_KEYS.ELEVENLABS_MODEL, e.target.value);
			invalidateCache();
		});

		// Clear key
		btnClear?.addEventListener("click", () => {
			apiKeyInput.value = "";
			localStorage.removeItem(STORAGE_KEYS.ELEVENLABS_API_KEY);
			if (voiceSelect) {
				voiceSelect.innerHTML =
					'<option value="">— enter API key to load voices —</option>';
				voiceSelect.disabled = true;
			}
			if (voiceStatus) voiceStatus.textContent = "";
			invalidateCache();
		});

		// Auto-fetch voices (debounced) when API key changes
		let debounceTimer = null;
		const triggerFetch = () => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(
				() => this.fetchElevenLabsVoices(savedVoice),
				600,
			);
		};

		apiKeyInput.addEventListener("input", () => {
			localStorage.setItem(
				STORAGE_KEYS.ELEVENLABS_API_KEY,
				apiKeyInput.value.trim(),
			);
			invalidateCache();
			triggerFetch();
		});

		// Persist voice selection + invalidate cache
		voiceSelect?.addEventListener("change", (e) => {
			localStorage.setItem(STORAGE_KEYS.ELEVENLABS_VOICE, e.target.value);
			invalidateCache();
		});

		// Invalidate cache when text changes
		$("#elText")?.addEventListener("input", invalidateCache);

		// Preview button
		$("#btnPreviewTTS")?.addEventListener("click", () =>
			this.handleTTSPreview(),
		);

		// Save button
		$("#btnSaveTTS")?.addEventListener("click", () => this.handleTTSSave());

		// Fetch on load if key is already saved
		if (savedKey) {
			this.fetchElevenLabsVoices(savedVoice);
		}
	}

	/**
	 * Preview ElevenLabs TTS audio in the browser.
	 * Uses cached bytes when available; stops any currently playing preview.
	 */
	async handleTTSPreview() {
		const btn = $("#btnPreviewTTS");

		// If already playing, stop it
		if (this.elPreviewAudio) {
			this.elPreviewAudio.pause();
			this.elPreviewAudio = null;
			if (btn) btn.textContent = "🔊 Preview";
			return;
		}

		const apiKey = $("#elApiKey")?.value?.trim();
		const voiceId = $("#elVoice")?.value;
		const modelId = $("#elModel")?.value;
		const text = $("#elText")?.value?.trim();

		if (!apiKey || !voiceId || !text) {
			this.log(
				"Fill in API key, voice, and text to preview.",
				LOG_CLASSES.WARNING,
			);
			return;
		}

		const rawMp3 = await this.getElTTSBytes(apiKey, voiceId, modelId, text);
		if (!rawMp3) return;

		const blob = new Blob([rawMp3], { type: "audio/mpeg" });
		const url = URL.createObjectURL(blob);
		const audio = new Audio(url);
		this.elPreviewAudio = audio;
		if (btn) btn.textContent = "⏹ Stop";

		audio.addEventListener("ended", () => {
			URL.revokeObjectURL(url);
			this.elPreviewAudio = null;
			if (btn) btn.textContent = "🔊 Preview";
		});
		audio.addEventListener("error", () => {
			URL.revokeObjectURL(url);
			this.elPreviewAudio = null;
			if (btn) btn.textContent = "🔊 Preview";
			this.log("Audio playback error.", LOG_CLASSES.WARNING);
		});

		audio.play().catch((err) => {
			URL.revokeObjectURL(url);
			this.elPreviewAudio = null;
			if (btn) btn.textContent = "🔊 Preview";
			this.log(`Preview failed: ${err.message}`, LOG_CLASSES.WARNING);
		});
	}

	/**
	 * Save ElevenLabs TTS audio to disk as an MP3 file.
	 * Synthesizes (or reuses cache) and triggers a browser download.
	 */
	async handleTTSSave() {
		const apiKey = $("#elApiKey")?.value?.trim();
		const voiceId = $("#elVoice")?.value;
		const modelId = $("#elModel")?.value;
		const text = $("#elText")?.value?.trim();

		if (!apiKey || !voiceId || !text) {
			this.log(
				"Fill in API key, voice, and text to save.",
				LOG_CLASSES.WARNING,
			);
			return;
		}

		const rawMp3 = await this.getElTTSBytes(apiKey, voiceId, modelId, text);
		if (!rawMp3) return;

		const suggestedName = ttsFileName(text);

		const blob = new Blob([rawMp3], { type: "audio/mpeg" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = suggestedName;
		a.click();
		URL.revokeObjectURL(url);
	}

	/**
	 * @returns {Promise<Uint8Array|null>}
	 */
	async getElTTSBytes(apiKey, voiceId, modelId, text) {
		const cacheKey = `${apiKey}||${voiceId}||${modelId}||${text}`;
		if (this.elCache.key === cacheKey && this.elCache.bytes) {
			this.log("Using cached ElevenLabs audio.");
			return this.elCache.bytes;
		}

		this.log("Synthesizing speech via ElevenLabs…");
		try {
			const bytes = await this.elevenLabs.synthesize(
				apiKey,
				voiceId,
				modelId,
				text,
			);
			this.elCache = { key: cacheKey, bytes };
			return bytes;
		} catch (error) {
			this.log(`ElevenLabs error: ${error.message}`, LOG_CLASSES.WARNING);
			return null;
		}
	}

	/**
	 * Fetch voice list from ElevenLabs and populate the dropdown
	 * @param {string} restoreVoiceId - Voice ID to re-select after populating
	 */
	async fetchElevenLabsVoices(restoreVoiceId = "") {
		const apiKeyInput = $("#elApiKey");
		const voiceSelect = $("#elVoice");
		const voiceStatus = $("#elVoiceStatus");

		const apiKey = apiKeyInput?.value?.trim();
		if (!apiKey || !voiceSelect) return;

		if (voiceStatus) voiceStatus.textContent = "(loading…)";

		try {
			const voices = await this.elevenLabs.fetchVoices(apiKey);

			voiceSelect.innerHTML = "";
			if (voices.length === 0) {
				voiceSelect.innerHTML = '<option value="">— no voices found —</option>';
				voiceSelect.disabled = true;
			} else {
				for (const v of voices) {
					const opt = document.createElement("option");
					opt.value = v.id;
					opt.textContent = v.name;
					voiceSelect.appendChild(opt);
				}
				voiceSelect.disabled = false;

				// Restore previously selected voice if still available
				const toRestore =
					restoreVoiceId ||
					localStorage.getItem(STORAGE_KEYS.ELEVENLABS_VOICE) ||
					"";
				if (
					toRestore &&
					voiceSelect.querySelector(`option[value="${CSS.escape(toRestore)}"]`)
				) {
					voiceSelect.value = toRestore;
				}
			}

			if (voiceStatus) voiceStatus.textContent = `(${voices.length} voices)`;
		} catch (error) {
			if (voiceStatus) voiceStatus.textContent = "(error)";
			this.log(
				`ElevenLabs voice fetch failed: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
		}
	}

	/**
	 * Initialize bitrate override controls
	 */
	initializeBitrateControls() {
		const chkBitrateOverride = $("#chkBitrateOverride");
		const convertOpts = $("#convertOpts");
		const mp3Kbps = $("#mp3Kbps");

		// Load saved bitrate preferences from localStorage
		const savedBitrateOverride =
			localStorage.getItem(STORAGE_KEYS.BITRATE_OVERRIDE) === "true";
		const savedBitrate = localStorage.getItem(STORAGE_KEYS.BITRATE);

		// Restore checkbox state and visibility
		if (chkBitrateOverride) {
			chkBitrateOverride.checked = savedBitrateOverride;
			if (savedBitrateOverride) {
				convertOpts?.classList.remove("hidden");
			}
		}

		// Restore bitrate selection
		if (mp3Kbps && savedBitrate) {
			mp3Kbps.value = savedBitrate;
		}

		// Toggle bitrate options and save preference
		chkBitrateOverride?.addEventListener("change", (e) => {
			convertOpts?.classList.toggle("hidden", !e.target.checked);
			localStorage.setItem(
				STORAGE_KEYS.BITRATE_OVERRIDE,
				e.target.checked.toString(),
			);
		});

		// Save bitrate selection when changed
		mp3Kbps?.addEventListener("change", (e) => {
			localStorage.setItem(STORAGE_KEYS.BITRATE, e.target.value);
		});
	}

	/**
	 * Initialize chunk size override controls
	 */
	initializeChunkSizeControls() {
		const chkChunkOverride = $("#chkChunkOverride");
		const chunkOverrideOpts = $("#chunkOverrideOpts");
		const chunkSizeSlider = $("#chunkSizeSlider");
		const chunkSizeValue = $("#chunkSizeValue");

		// Load saved preferences from localStorage
		const savedOverride =
			localStorage.getItem(STORAGE_KEYS.CHUNK_OVERRIDE) === "true";
		const savedChunkSize = parseInt(
			localStorage.getItem(STORAGE_KEYS.CHUNK_SIZE),
			10,
		);

		// Initialize slider with saved or auto-determined chunk size
		if (chunkSizeSlider && chunkSizeValue) {
			const autoChunkSize = this.fileManager.getChunkSize();
			const initialSize =
				savedChunkSize >= 50 && savedChunkSize <= 500
					? savedChunkSize
					: autoChunkSize;
			chunkSizeSlider.value = initialSize;
			chunkSizeValue.textContent = initialSize;
		}

		// Restore checkbox state and visibility
		if (chkChunkOverride) {
			chkChunkOverride.checked = savedOverride;
			if (savedOverride) {
				chunkOverrideOpts?.classList.remove("hidden");
			}
		}

		// Toggle chunk override options
		chkChunkOverride?.addEventListener("change", (e) => {
			chunkOverrideOpts?.classList.toggle("hidden", !e.target.checked);

			// Save preference
			localStorage.setItem(
				STORAGE_KEYS.CHUNK_OVERRIDE,
				e.target.checked.toString(),
			);

			// If enabling override, update slider to current auto value (if not previously saved)
			if (
				e.target.checked &&
				chunkSizeSlider &&
				chunkSizeValue &&
				!savedChunkSize
			) {
				const autoChunkSize = this.fileManager.getChunkSize();
				chunkSizeSlider.value = autoChunkSize;
				chunkSizeValue.textContent = autoChunkSize;
			}
		});

		// Update chunk size display when slider changes and save to localStorage
		chunkSizeSlider?.addEventListener("input", (e) => {
			if (chunkSizeValue) {
				chunkSizeValue.textContent = e.target.value;
			}
			localStorage.setItem(STORAGE_KEYS.CHUNK_SIZE, e.target.value);
		});
	}

	/**
	 * Initialize chunk delay override controls
	 */
	initializeChunkDelayControls() {
		const chkDelayOverride = $("#chkChunkDelayOverride");
		const delayOverrideOpts = $("#chunkDelayOverrideOpts");
		const chunkDelaySlider = $("#chunkDelaySlider");
		const chunkDelayValue = $("#chunkDelayValue");

		// Load saved preferences from localStorage
		const savedOverride =
			localStorage.getItem(STORAGE_KEYS.CHUNK_DELAY_OVERRIDE) === "true";
		const savedDelay = parseInt(
			localStorage.getItem(STORAGE_KEYS.CHUNK_DELAY),
			10,
		);

		if (chunkDelaySlider && chunkDelayValue) {
			const initialDelay =
				savedDelay >= TRANSFER_CONFIG.MIN_CHUNK_DELAY_MS &&
				savedDelay <= TRANSFER_CONFIG.MAX_CHUNK_DELAY_MS
					? savedDelay
					: TRANSFER_CONFIG.CHUNK_DELAY_MS;
			chunkDelaySlider.value = initialDelay;
			chunkDelayValue.textContent = initialDelay;
		}

		if (chkDelayOverride) {
			chkDelayOverride.checked = savedOverride;
			delayOverrideOpts?.classList.toggle("hidden", !savedOverride);
		}

		chkDelayOverride?.addEventListener("change", (e) => {
			delayOverrideOpts?.classList.toggle("hidden", !e.target.checked);
			localStorage.setItem(
				STORAGE_KEYS.CHUNK_DELAY_OVERRIDE,
				e.target.checked.toString(),
			);
		});

		chunkDelaySlider?.addEventListener("input", (e) => {
			if (chunkDelayValue) {
				chunkDelayValue.textContent = e.target.value;
			}
			localStorage.setItem(STORAGE_KEYS.CHUNK_DELAY, e.target.value);
		});
	}

	/**
	 * Initialize file transfer buttons (send/cancel) and modal close handlers
	 */
	initializeButtons() {
		$("#btnSendFile")?.addEventListener("click", async () => {
			const success = await this.handleFileSend();
			if (success) {
				const wasReplace = this._mode === "replace";
				this.close();
				if (wasReplace) this._onReplaceSuccess?.();
			}
		});

		$("#btnCancelFile")?.addEventListener("click", async () => {
			await this.fileManager.cancelTransfer();
		});

		// Transfer modal close buttons (top X and bottom Close)
		$("#btnCloseTransferModal")?.addEventListener("click", () => {
			if (!this.state.transfer.inProgress) this.close();
		});
		$("#btnCloseTransferModalBottom")?.addEventListener("click", () => {
			if (!this.state.transfer.inProgress) this.close();
		});

		// Escape key closes transfer modal (higher priority than edit modal
		// handler, which skips an Escape handled here), unless the overwrite
		// confirmation is open on top: its own handler cancels just that
		document.addEventListener("keydown", (e) => {
			const overwriteOpen = !(
				$("#overwriteModal")?.classList.contains("hidden") ?? true
			);
			if (
				e.key === "Escape" &&
				!e.defaultPrevented &&
				!overwriteOpen &&
				!this.modal?.classList.contains("hidden") &&
				!this.state.transfer.inProgress
			) {
				e.preventDefault();
				this.close();
			}
		});
	}

	/**
	 * Wire the #fileInput change handler
	 */
	initializeFileInputHandler() {
		$("#fileInput")?.addEventListener("change", async (e) => {
			await this.handleFileSelection(e.target.files?.[0]);
		});

		// Only fires on genuine user input, not our own programmatic auto-fills
		// (setting .value directly doesn't dispatch "input"), so this reliably
		// tracks whether the user has taken over the filename field.
		$("#fileName")?.addEventListener("input", () => {
			this._fileNameUserEdited = true;
		});
	}

	/**
	 * Handle file selection
	 */
	async handleFileSelection(file) {
		if (!file) return;

		try {
			// Read file bytes immediately so pickerData is available right away
			const buffer = await file.arrayBuffer();
			const originalBytes = new Uint8Array(buffer);

			// Store raw file data — conversion happens lazily in handleFileSend
			this.fileManager.storeFilePickerData(
				file,
				originalBytes,
				originalBytes,
				file.name,
			);

			this.log(`Picked file: ${file.name} (${originalBytes.length} bytes)`);

			// Fill in the filename from the picked file (truncated to fit the
			// device's limit), unless the user has manually edited it — picking a
			// different file should still update an untouched/auto-filled name.
			if (!this._fileNameUserEdited || !$("#fileName")?.value) {
				const truncated = truncateFilename(
					file.name,
					TRANSFER_CONFIG.MAX_FILENAME_LENGTH,
				);
				if (truncated !== file.name) {
					this.log(
						`Device filename truncated to fit ${TRANSFER_CONFIG.MAX_FILENAME_LENGTH}-char limit: "${truncated}"`,
						LOG_CLASSES.WARNING,
					);
				}
				$("#fileName").value = truncated;
			}

			// Check for name conflicts
			this.checkFileNameConflict($("#fileName")?.value || file.name);
		} catch (error) {
			this.log(`File error: ${error.message}`, LOG_CLASSES.WARNING);
		}
	}

	/**
	 * Handle file send
	 */
	async handleFileSend() {
		if (!this.connection.isConnected()) {
			this.log("Not connected", LOG_CLASSES.WARNING);
			return false;
		}

		const source = $("#sourceSelect")?.value || "local";

		let fileBytes;
		let fileName;

		if (source === "elevenlabs") {
			// --- ElevenLabs TTS path ---
			const apiKey = $("#elApiKey")?.value?.trim();
			const voiceId = $("#elVoice")?.value;
			const modelId = $("#elModel")?.value;
			const text = $("#elText")?.value?.trim();

			if (!apiKey) {
				this.log("Enter your ElevenLabs API key.", LOG_CLASSES.WARNING);
				return false;
			}
			if (!voiceId) {
				this.log("Select a voice.", LOG_CLASSES.WARNING);
				return false;
			}
			if (!text) {
				this.log("Enter the text to synthesize.", LOG_CLASSES.WARNING);
				return false;
			}

			const rawMp3 = await this.getElTTSBytes(apiKey, voiceId, modelId, text);
			if (!rawMp3) return false;

			const rawName = ttsFileName(text);

			if ($("#chkConvert")?.checked) {
				const kbps = $("#chkBitrateOverride")?.checked
					? parseInt($("#mp3Kbps")?.value || "32", 10)
					: 32;
				this.log(`Converting ElevenLabs audio to MP3 mono (${kbps} kbps)…`);
				const file = new File([rawMp3], rawName, { type: "audio/mpeg" });
				const result = await this.audioConverter.convertToDeviceMp3(file, kbps);
				fileBytes = result.u8;
				fileName = result.name;
				this.log(
					`Converted: ${fileName} (${fileBytes.length} bytes)`,
					LOG_CLASSES.WARNING,
				);
			} else {
				fileBytes = rawMp3;
				fileName = rawName;
				this.log(`ElevenLabs audio: ${fileName} (${fileBytes.length} bytes)`);
			}

			// Auto-fill device filename if empty
			if (!$("#fileName")?.value) {
				$("#fileName").value = fileName;
			}
		} else {
			// --- Local file path ---
			const pickerData = this.fileManager.getFilePickerData();
			if (!pickerData.file && !pickerData.fileBytes) {
				this.log("Pick a file first.", LOG_CLASSES.WARNING);
				return false;
			}

			fileBytes = pickerData.fileBytes;
			fileName = pickerData.fileName;

			// If user toggled "Convert" AFTER selecting the file, convert now
			try {
				if ($("#chkConvert")?.checked && pickerData.file) {
					const kbps = $("#chkBitrateOverride")?.checked
						? parseInt($("#mp3Kbps")?.value || "32", 10)
						: 32;
					this.log(`Converting to MP3 mono (${kbps} kbps) before send…`);
					const result = await this.audioConverter.convertToDeviceMp3(
						pickerData.file,
						kbps,
					);
					fileBytes = result.u8;
					const typed = ($("#fileName")?.value || "").trim();
					if (!typed || typed === pickerData.fileName) {
						$("#fileName").value = result.name;
					}
					fileName = result.name;
				} else if (!$("#chkConvert")?.checked && pickerData.originalBytes) {
					fileBytes = pickerData.originalBytes;
					fileName = pickerData.file?.name || pickerData.fileName;
				}
			} catch (error) {
				this.log(
					`Convert error: ${error.message} — sending original file`,
					LOG_CLASSES.WARNING,
				);
				if (pickerData.originalBytes) {
					fileBytes = pickerData.originalBytes;
					fileName = pickerData.file?.name || pickerData.fileName;
				}
			}
		}

		// Filename to send (auto .mp3 if converting; locked in replace mode)
		let finalName =
			this._mode === "replace"
				? this._lockedFilename
				: ($("#fileName")?.value || fileName || "skelly.bin").trim();
		if (this._mode !== "replace") {
			if ($("#chkConvert")?.checked && !/\.mp3$/i.test(finalName)) {
				finalName = `${finalName.replace(/\.\w+$/, "")}.mp3`;
				$("#fileName").value = finalName;
			}
		}
		if (!finalName) {
			this.log("Provide a device filename.", LOG_CLASSES.WARNING);
			return false;
		}

		// Device silently drops uploads whose filename exceeds the length limit:
		// transfer/confirm still ack with failed=0, but the file never appears in
		// the file list afterward. Block here instead of failing silently.
		if (finalName.length > TRANSFER_CONFIG.MAX_FILENAME_LENGTH) {
			this.log(
				`Filename too long: "${finalName}" is ${finalName.length} chars, device limit is ${TRANSFER_CONFIG.MAX_FILENAME_LENGTH}.`,
				LOG_CLASSES.WARNING,
			);
			return false;
		}

		// Check for filename conflict (skipped in replace mode — intentional overwrite)
		if (this._mode !== "replace") {
			const conflict = this.checkFileNameConflict(finalName);
			if (conflict) {
				const confirmed = await this.showOverwriteConfirmation(conflict.name);
				if (!confirmed) {
					this.log("Upload cancelled by user", LOG_CLASSES.INFO);
					return false;
				}
			}
		}

		// Check if chunk size override is enabled
		let chunkSizeOverride = null;
		const chkChunkOverride = $("#chkChunkOverride");
		const chunkSizeSlider = $("#chunkSizeSlider");
		if (chkChunkOverride?.checked && chunkSizeSlider) {
			chunkSizeOverride = parseInt(chunkSizeSlider.value, 10);
		}

		// And the chunk delay override
		let chunkDelayOverride = null;
		const chunkDelaySlider = $("#chunkDelaySlider");
		if ($("#chkChunkDelayOverride")?.checked && chunkDelaySlider) {
			chunkDelayOverride = parseInt(chunkDelaySlider.value, 10);
		}

		try {
			await this.fileManager.uploadFile(
				fileBytes,
				finalName,
				chunkSizeOverride,
				chunkDelayOverride,
			);
			return true;
		} catch (error) {
			this.log(`Upload error: ${error.message}`, LOG_CLASSES.WARNING);
			return false;
		}
	}

	/**
	 * Show overwrite confirmation modal
	 * @param {string} fileName - Name of the existing file
	 * @returns {Promise<boolean>} - True if user confirms, false if cancelled
	 */
	async showOverwriteConfirmation(fileName) {
		return new Promise((resolve) => {
			const modal = $("#overwriteModal");
			const message = $("#overwriteMessage");
			const confirmBtn = $("#overwriteConfirm");
			const cancelBtn = $("#overwriteCancel");

			if (!modal || !message || !confirmBtn || !cancelBtn) {
				resolve(false);
				return;
			}

			// Update message with filename
			message.textContent = `A file named "${fileName}" already exists on the device.`;

			// Show modal
			modal.classList.remove("hidden");

			// Handle confirm
			const handleConfirm = () => {
				cleanup();
				resolve(true);
			};

			// Handle cancel
			const handleCancel = () => {
				cleanup();
				resolve(false);
			};

			// Handle escape key
			const handleEscape = (e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					handleCancel();
				}
			};

			// Cleanup function
			const cleanup = () => {
				modal.classList.add("hidden");
				confirmBtn.removeEventListener("click", handleConfirm);
				cancelBtn.removeEventListener("click", handleCancel);
				document.removeEventListener("keydown", handleEscape);
			};

			// Add event listeners
			confirmBtn.addEventListener("click", handleConfirm);
			cancelBtn.addEventListener("click", handleCancel);
			document.addEventListener("keydown", handleEscape);
		});
	}

	/**
	 * Check for filename conflicts
	 * @param {string} name - Filename to check
	 * @returns {Object|null} - Conflict object if found, null otherwise
	 */
	checkFileNameConflict(name) {
		const conflict = this.state.hasFileName(name);
		const inputEl = $("#fileName");
		if (inputEl) {
			inputEl.classList.toggle("warn-border", !!conflict);
		}
		return conflict;
	}
}

  // ============================================================
  // ElevenLabs TTS Client (js/elevenlabs.js)
  // ============================================================
/**
 * ElevenLabs TTS Client
 * Wraps the ElevenLabs REST API for voice listing and text-to-speech synthesis
 */

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

class ElevenLabsClient {
	/**
	 * Fetch available voices for the given API key
	 * @param {string} apiKey
	 * @returns {Promise<Array<{id: string, name: string}>>}
	 */
	async fetchVoices(apiKey) {
		const response = await fetch(`${ELEVENLABS_BASE}/voices`, {
			headers: { "xi-api-key": apiKey },
		});

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(`ElevenLabs voices error ${response.status}: ${text}`);
		}

		const data = await response.json();
		return (data.voices || [])
			.map((v) => ({ id: v.voice_id, name: v.name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Synthesize speech and return raw MP3 bytes
	 * @param {string} apiKey
	 * @param {string} voiceId
	 * @param {string} modelId
	 * @param {string} text
	 * @returns {Promise<Uint8Array>}
	 */
	async synthesize(apiKey, voiceId, modelId, text) {
		const response = await fetch(
			`${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`,
			{
				method: "POST",
				headers: {
					"xi-api-key": apiKey,
					"Content-Type": "application/json",
					Accept: "audio/mpeg",
				},
				body: JSON.stringify({ text, model_id: modelId }),
			},
		);

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(`ElevenLabs TTS error ${response.status}: ${text}`);
		}

		const buffer = await response.arrayBuffer();
		return new Uint8Array(buffer);
	}
}

  // ============================================================
  // Main Application (app-modular.js)
  // ============================================================
﻿/**
 * Main Application Entry Point
 * Orchestrates all modules and initializes the application
 */

/**
 * Simple Logger
 */
class Logger {
	constructor(logElement, autoscrollElement) {
		this.logElement = logElement;
		this.autoscrollElement = autoscrollElement;
		this.filterCallback = null;
	}

	setFilterCallback(callback) {
		this.filterCallback = callback;
	}

	log(message, className = LOG_CLASSES.NORMAL) {
		if (!this.logElement) return;
		const div = document.createElement("div");
		div.className = `line ${className}`;
		const time = new Date().toLocaleTimeString();
		div.textContent = `[${time}] ${message}`;
		this.logElement.appendChild(div);

		// Apply filter to the new line
		if (this.filterCallback) {
			this.filterCallback();
		}

		// Auto-scroll if enabled
		if (!this.autoscrollElement || this.autoscrollElement.checked) {
			this.logElement.scrollTop = this.logElement.scrollHeight;
		}
	}
}

// $ helper already defined above

/**
 * Set progress display
 */
function setProgress(idx, total) {
	const pct = total ? Math.round((idx / total) * 100) : 0;
	const progText = $("#progText");
	const progPct = $("#progPct");
	const progBar = $("#progBar");
	if (progText) progText.textContent = `${idx} / ${total}`;
	if (progPct) progPct.textContent = `${pct}%`;
	if (progBar) progBar.style.width = `${pct}%`;
}

/**
 * Main Application
 */
class SkellyApp {
	constructor() {
		try {
			// Initialize logger
			this.logger = new Logger($("#log"), $("#chkAutoscroll"));
			this.logger.setFilterCallback(() => this.applyLogFilter());

			// Initialize state manager
			this.state = new StateManager();

			// Initialize play state tracking
			this.playState = {
				serial: null,
				playing: false,
				duration: 0,
				startTime: null,
				timerInterval: null,
			};

			// Initialize connection manager (wraps both BLE and REST proxy)
			this.connection = new ConnectionManager(
				this.state,
				this.logger.log.bind(this.logger),
			);

			// Initialize file manager with progress callback
			this.fileManager = new FileManager(
				this.connection,
				this.state,
				this.logger.log.bind(this.logger),
				(current, total) => setProgress(current, total),
			);

			// Initialize audio converter
			this.audioConverter = new AudioConverter(
				this.logger.log.bind(this.logger),
			);

			// Initialize edit modal manager (before parser so we can pass callback)
			this.editModal = new EditModalManager(
				this.connection,
				this.state,
				this.fileManager,
				this.logger.log.bind(this.logger),
			);
			// Initialize transfer modal manager
			this.transferModal = new TransferModalManager(
				this.connection,
				this.state,
				this.fileManager,
				this.audioConverter,
				this.logger.log.bind(this.logger),
			);
			this.transferModal.setReplaceSuccessHandler(() => this.editModal.close());
			this.editModal.setReplaceFileHandler((filename) => {
				this.transferModal.open("replace", filename);
			});

			// Initialize protocol parser with callbacks
			this.parser = new ProtocolParser(
				this.state,
				this.fileManager,
				this.logger.log.bind(this.logger),
				this.handlePlayPauseMessage.bind(this),
			);

			// Register protocol parser with connection manager
			this.connection.onNotification((hex, bytes) => {
				this.parser.parse(hex, bytes);
			});

			// Subscribe to state changes
			this.subscribeToStateChanges();

			// Initialize UI
			this.initializeUI();

			// Set initial UI state
			this.updateDeviceUI(this.state.device);
			this.updateFilesTable();
			this.transferModal.updateButtons(this.state.transfer);

			this.logger.log("Application initialized", LOG_CLASSES.WARNING);
		} catch (error) {
			console.error("Failed to initialize application:", error);
			console.error("Error stack:", error.stack);
			alert("Failed to initialize application. Check console for details.");
			throw error;
		}
	}

	/**
	 * Subscribe to state changes
	 */
	subscribeToStateChanges() {
		// Device state changes
		this.state.subscribe("device", (device) => {
			this.updateDeviceUI(device);
		});

		// Live status changes
		this.state.subscribe("live", (live) => {
			this.updateLiveUI(live);
		});

		// File list changes
		this.state.subscribe("files", () => {
			this.updateFilesTable();
		});
	}

	/**
	 * Initialize UI and event handlers
	 */
	initializeUI() {
		// Initial disconnected state
		document.body.classList.add("disconnected");

		// Connection controls
		const btnConnect = $("#btnConnect");
		const btnDisconnect = $("#btnDisconnect");

		if (btnConnect) {
			btnConnect.addEventListener("click", () => {
				this.handleConnect();
			});
		} else {
			console.error("Connect button not found!");
		}

		if (btnDisconnect) {
			btnDisconnect.addEventListener("click", () => this.handleDisconnect());
		} else {
			console.error("Disconnect button not found!");
		}

		// Log controls
		const btnClearLog = $("#btnClearLog");
		if (btnClearLog) {
			btnClearLog.addEventListener("click", () => {
				const logEl = $("#log");
				if (logEl) logEl.innerHTML = "";
			});
		}

		const btnSaveLog = $("#btnSaveLog");
		if (btnSaveLog) {
			btnSaveLog.addEventListener("click", () => {
				this.saveLog();
			});
		}

		this.initializeWarningModal();
		this.initializeFirmwareWarningModal();
		this.initializeConnectionModal();
		this.initializeDeviceTypeControl();
		this.initializeAdvancedMenu();
		this.initializeLogFilter();
		this.initializeQueryButtons();
		this.initializeMediaControls();
		this.initializeFileControls();
		this.initializeLiveControls();

		// Check for Web Bluetooth support
		if (!ConnectionManager.isWebBluetoothAvailable()) {
			console.error("Web Bluetooth not supported");
			this.logger.log(
				"Web Bluetooth not supported. For direct BLE, use Chrome/Edge. For other browsers, use the REST Server Proxy: https://github.com/martinecker/SkellyUltra/tree/main/custom_components/skelly_ultra/skelly_ultra_srv",
				LOG_CLASSES.WARNING,
			);
			// Don't show blocking alert - REST proxy is available as alternative
		} else {
			// Check for secure context (HTTPS or localhost)
			if (!window.isSecureContext) {
				console.error(
					"Not in secure context - Web Bluetooth requires HTTPS or localhost",
				);
				this.logger.log(
					"Web Bluetooth requires HTTPS or localhost for direct BLE. Use HTTPS or the REST Server Proxy.",
					LOG_CLASSES.WARNING,
				);
			}
		}

		// Apply persisted device profile on startup
		const startupDeviceType =
			localStorage.getItem(STORAGE_KEYS.DEVICE_TYPE) || DEVICE_TYPES.SKELLY;
		this.state.setDeviceType(startupDeviceType);
		this.applyDeviceProfile(startupDeviceType);
	}

	/**
	 * Initialize device type dropdown (post-connect override)
	 */
	initializeDeviceTypeControl() {
		const deviceTypeSelect = $("#deviceTypeSelect");
		if (!deviceTypeSelect) return;

		// Sync with persisted value
		const saved =
			localStorage.getItem(STORAGE_KEYS.DEVICE_TYPE) || DEVICE_TYPES.SKELLY;
		deviceTypeSelect.value = saved;

		deviceTypeSelect.addEventListener("change", () => {
			const newType = deviceTypeSelect.value;
			const oldType = this.state.deviceType;
			if (newType === oldType) return;

			const apply = () => {
				localStorage.setItem(STORAGE_KEYS.DEVICE_TYPE, newType);
				this.state.setDeviceType(newType);
				this.applyDeviceProfile(newType);
			};

			const modal = $("#deviceTypeChangeModal");
			if (!modal) {
				apply();
				return;
			}

			const newName = DEVICE_PROFILES[newType]?.uiName ?? newType;
			const oldName = DEVICE_PROFILES[oldType]?.uiName ?? oldType;
			const msg = $("#deviceTypeChangeMsgDetail");
			if (msg) {
				msg.textContent = `You are switching from "${oldName}" to "${newName}".`;
			}

			modal.classList.remove("hidden");

			const onConfirm = () => {
				modal.classList.add("hidden");
				cleanup();
				apply();
			};
			const onCancel = () => {
				modal.classList.add("hidden");
				cleanup();
				// Revert select back to the current type
				deviceTypeSelect.value = oldType;
			};
			const cleanup = () => {
				$("#deviceTypeChangeConfirm")?.removeEventListener("click", onConfirm);
				$("#deviceTypeChangeCancel")?.removeEventListener("click", onCancel);
			};

			$("#deviceTypeChangeConfirm")?.addEventListener("click", onConfirm);
			$("#deviceTypeChangeCancel")?.addEventListener("click", onCancel);
		});
	}

	/**
	 * Apply a device profile — rebuilds the movement grids and reconfigures all
	 * profile-driven UI elements (lights, eye section, file table columns, etc.)
	 * @param {string} deviceType - one of DEVICE_TYPES
	 */
	applyDeviceProfile(deviceType) {
		const profile = DEVICE_PROFILES[deviceType];
		if (!profile) return;

		// Sync the post-connect dropdown
		const deviceTypeSelect = $("#deviceTypeSelect");
		if (deviceTypeSelect) deviceTypeSelect.value = deviceType;

		// Rebuild movement grids
		for (const gridId of ["liveMove", "edMove"]) {
			const grid = $(`#${gridId}`);
			if (!grid) continue;
			grid.innerHTML = "";
			profile.movements.forEach(({ part, label, icon, bit }) => {
				const btn = document.createElement("button");
				btn.className = "iconToggle";
				btn.dataset.part = part;
				btn.dataset.bit = String(bit);
				btn.title = label;
				const img = document.createElement("img");
				img.src = icon;
				img.alt = label;
				img.style.width = "36px";
				img.style.height = "36px";
				btn.appendChild(img);
				grid.appendChild(btn);
			});
		}
		// Re-bind live movement grid handlers
		this.bindMovementGrid("liveMove");
		// Re-bind edit modal movement handlers
		this.editModal?.initializeMovementControls();

		// Rebuild eye grids (icon count and images vary per profile)
		this.buildLiveEyeGrid();
		this.editModal?.buildEyeGrid();

		// Show/hide eye sections
		const hasEyeImage = profile.hasEyeImage;
		for (const id of ["liveEyeSection", "editEyeSection"]) {
			const el = $(`#${id}`);
			if (el) el.style.display = hasEyeImage ? "" : "none";
		}

		// Show/hide Light 1 group
		const hasLight1 = profile.lights.length > 1;
		for (const id of ["liveLight1Group", "editLight1Group"]) {
			const el = $(`#${id}`);
			if (el) el.style.display = hasLight1 ? "" : "none";
		}

		// Update Light 0 label
		const light0 = profile.lights[0];
		const light0Label = light0 ? light0.label : "Light";
		for (const id of ["liveLight0Label", "editLight0Label"]) {
			const el = $(`#${id}`);
			if (el) el.textContent = light0Label;
		}

		// Repopulate effect mode selects
		const modeSelects = [
			"light1EffectMode",
			"light0EffectMode",
			"edLight1EffectMode",
			"edLight0EffectMode",
		];
		for (const selectId of modeSelects) {
			const sel = $(`#${selectId}`);
			if (!sel) continue;
			const current = sel.value;
			sel.innerHTML = "";
			profile.lightModes.forEach(({ value, label }) => {
				const opt = document.createElement("option");
				opt.value = String(value);
				opt.textContent = label;
				sel.appendChild(opt);
			});
			// Try to restore previously selected value; fall back to first option
			sel.value = current;
			if (!sel.value) sel.value = String(profile.lightModes[0].value);
		}

		// Update files table column visibility and labels
		const light1 = profile.lights[1];
		const light1Label = light1 ? light1.label : "Light 1";
		const filesLight1Col = $("#filesLight1Col");
		if (filesLight1Col) {
			filesLight1Col.style.display = hasLight1 ? "" : "none";
			filesLight1Col.textContent = light1Label;
		}

		const filesEyeCol = $("#filesEyeCol");
		if (filesEyeCol) filesEyeCol.style.display = hasEyeImage ? "" : "none";

		const filesLight0Col = $("#filesLight0Col");
		if (filesLight0Col) filesLight0Col.textContent = light0Label;

		// Keep body cell classes in sync — add/remove display style via dynamic <style>
		let dynStyle = document.getElementById("_profileColStyle");
		if (!dynStyle) {
			dynStyle = document.createElement("style");
			dynStyle.id = "_profileColStyle";
			document.head.appendChild(dynStyle);
		}
		const rules = [];
		if (!hasLight1) rules.push("td.col-light1 { display: none; }");
		if (!hasEyeImage) rules.push("td.col-eye { display: none; }");
		dynStyle.textContent = rules.join("\n");

		// Scenes depend on the device type too
		this.updateScenePicker();
	}

	/**
	 * Bind click handlers for a live movement grid.
	 * Buttons must already be in the DOM with data-part and data-bit attributes.
	 * @param {string} gridId
	 */
	bindMovementGrid(gridId) {
		const grid = document.getElementById(gridId);
		if (!grid) return;

		const allBtn = grid.querySelector('[data-part="all"]');
		const partBtns = Array.from(
			grid.querySelectorAll('[data-part]:not([data-part="all"])'),
		);

		const sendMovementCommand = async () => {
			if (!this.connection.isConnected()) return;
			if (allBtn?.classList.contains("selected")) {
				await this.connection.send(
					buildCommand(COMMANDS.SET_MOVEMENT, "FF00000000", 8),
				);
				this.logger.log("Applied movement: all");
			} else {
				let bitfield = 0;
				partBtns.forEach((btn) => {
					if (btn.classList.contains("selected")) {
						bitfield |= parseInt(btn.dataset.bit || "0", 10);
					}
				});
				if (bitfield > 0) {
					const bitfieldHex = bitfield
						.toString(16)
						.padStart(2, "0")
						.toUpperCase();
					await this.connection.send(
						buildCommand(COMMANDS.SET_MOVEMENT, `${bitfieldHex}00000000`, 8),
					);
					const parts = partBtns
						.filter((b) => b.classList.contains("selected"))
						.map((b) => b.dataset.part);
					this.logger.log(`Applied movement: ${parts.join(", ")}`);
				} else {
					await this.connection.send(
						buildCommand(COMMANDS.SET_MOVEMENT, "0000000000", 8),
					);
					this.logger.log("Disabled movement");
				}
			}
		};

		allBtn?.addEventListener("click", () => {
			allBtn.classList.toggle("selected");
			if (allBtn.classList.contains("selected")) {
				partBtns.forEach((btn) => {
					btn.classList.remove("selected");
				});
			}
			sendMovementCommand();
		});

		partBtns.forEach((btn) => {
			btn.addEventListener("click", () => {
				btn.classList.toggle("selected");
				allBtn?.classList.remove("selected");
				sendMovementCommand();
			});
		});
	}

	/**
	 * Initialize warning modal
	 */
	initializeWarningModal() {
		const riskModal = $("#riskModal");
		const showRisk = () => riskModal?.classList.remove("hidden");
		const hideRisk = () => riskModal?.classList.add("hidden");

		window.addEventListener("load", () => {
			if (!localStorage.getItem(STORAGE_KEYS.RISK_ACK)) {
				showRisk();
			}
		});

		$("#riskAccept")?.addEventListener("click", () => {
			localStorage.setItem(STORAGE_KEYS.RISK_ACK, "1");
			hideRisk();
		});

		$("#riskCancel")?.addEventListener("click", () => {
			window.location.href = "about:blank";
		});
	}

	initializeFirmwareWarningModal() {
		$("#fwWarningOk")?.addEventListener("click", () => {
			$("#fwWarningModal")?.classList.add("hidden");
		});
	}

	/**
	 * Initialize connection modal
	 */
	initializeConnectionModal() {
		const connectModal = $("#connectModal");
		const connectFilterDefault = $("#connectFilterDefault");
		const connectDefaultDevice = $("#connectDefaultDevice");
		const connectAllDevices = $("#connectAllDevices");
		const connectionTypeDirect = $("#connectionTypeDirect");
		const connectionTypeRest = $("#connectionTypeRest");
		const restUrlContainer = $("#restUrlContainer");
		const restServerUrl = $("#restServerUrl");
		const webBluetoothWarning = $("#webBluetoothWarning");
		const connectionTypeDirectLabel = $("#connectionTypeDirectLabel");

		// Check Web Bluetooth availability
		const isWebBluetoothAvailable = ConnectionManager.isWebBluetoothAvailable();

		// Load saved preferences
		const savedConnectionType =
			localStorage.getItem(STORAGE_KEYS.CONNECTION_TYPE) || "direct";
		const savedRestUrl =
			localStorage.getItem(STORAGE_KEYS.REST_URL) || "http://localhost:8765";
		const savedDeviceType =
			localStorage.getItem(STORAGE_KEYS.DEVICE_TYPE) || DEVICE_TYPES.SKELLY;

		// One name filter option per profile BLE name: "<type>" for the
		// default name, "<type>:<index>" for the others
		if (connectDefaultDevice) {
			connectDefaultDevice.replaceChildren(
				...Object.entries(DEVICE_PROFILES).flatMap(([type, profile]) =>
					profile.bleNames.map((name, index) => {
						const option = document.createElement("option");
						option.value = index === 0 ? type : `${type}:${index}`;
						option.textContent =
							name === profile.uiName ? name : `${name} (${profile.uiName})`;
						return option;
					}),
				),
			);
			// Restore saved device type in dropdown
			connectDefaultDevice.value = savedDeviceType;
		}

		// Handle Web Bluetooth unavailability
		if (!isWebBluetoothAvailable) {
			if (webBluetoothWarning) webBluetoothWarning.style.display = "block";
			if (connectionTypeDirect) connectionTypeDirect.disabled = true;
			if (connectionTypeDirectLabel) {
				connectionTypeDirectLabel.style.opacity = "0.5";
				connectionTypeDirectLabel.style.cursor = "not-allowed";
			}
			if (connectionTypeRest) connectionTypeRest.checked = true;
		} else {
			if (savedConnectionType === "rest" && connectionTypeRest) {
				connectionTypeRest.checked = true;
			} else if (connectionTypeDirect) {
				connectionTypeDirect.checked = true;
			}
		}

		if (restServerUrl) {
			restServerUrl.value = savedRestUrl;
		}

		// Show/hide REST URL input based on connection type
		const updateConnectionTypeUI = () => {
			if (restUrlContainer) {
				restUrlContainer.style.display = connectionTypeRest?.checked
					? "block"
					: "none";
			}
		};

		connectionTypeDirect?.addEventListener("change", updateConnectionTypeUI);
		connectionTypeRest?.addEventListener("change", updateConnectionTypeUI);

		// Enable/disable device dropdown based on radio selection
		const updateFilterState = () => {
			const isDefault = connectFilterDefault?.checked;
			if (connectDefaultDevice) connectDefaultDevice.disabled = !isDefault;
		};

		connectFilterDefault?.addEventListener("change", updateFilterState);
		connectAllDevices?.addEventListener("change", updateFilterState);

		// Initialize state
		updateConnectionTypeUI();
		updateFilterState();

		// Close modal function
		const closeModal = () => {
			connectModal?.classList.add("hidden");
		};

		// Cancel button
		$("#connectCancel")?.addEventListener("click", closeModal);

		// Escape key to close modal
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && !connectModal?.classList.contains("hidden")) {
				closeModal();
			}
		});

		// Connect button
		$("#connectOk")?.addEventListener("click", async () => {
			connectModal?.classList.add("hidden");

			// Determine connection type
			const connectionType = connectionTypeRest?.checked
				? ConnectionType.REST_PROXY
				: ConnectionType.DIRECT_BLE;

			// Get REST URL if needed
			const restUrl = restServerUrl?.value || "http://localhost:8765";

			// Determine filter value and device type
			let nameFilter = "";
			// The type persisted now; it may have changed since the page loaded
			let deviceType =
				localStorage.getItem(STORAGE_KEYS.DEVICE_TYPE) || DEVICE_TYPES.SKELLY;

			if (connectFilterDefault?.checked) {
				// Default name filter — device type comes directly from the dropdown
				const selectedOption =
					connectDefaultDevice?.value || DEVICE_TYPES.SKELLY;
				// "<type>" or "<type>:<index into the profile's bleNames>"
				const [type, index = "0"] = selectedOption.split(":");
				const profile =
					DEVICE_PROFILES[type] ?? DEVICE_PROFILES[DEVICE_TYPES.SKELLY];
				deviceType = DEVICE_PROFILES[type] ? type : DEVICE_TYPES.SKELLY;
				nameFilter = profile.bleNames[Number(index)] ?? profile.bleNames[0];
			}
			// All devices: nameFilter stays '', deviceType stays last persisted

			// Persist preferences
			localStorage.setItem(STORAGE_KEYS.CONNECTION_TYPE, connectionType);
			localStorage.setItem(STORAGE_KEYS.DEVICE_TYPE, deviceType);
			if (connectionType === ConnectionType.REST_PROXY) {
				localStorage.setItem(STORAGE_KEYS.REST_URL, restUrl);
			}

			// Apply device profile immediately so the UI is correct before connection completes
			this.state.setDeviceType(deviceType);
			this.applyDeviceProfile(deviceType);

			// For REST proxy, show device selection modal
			if (connectionType === ConnectionType.REST_PROXY) {
				await this.showDeviceSelectionModal(restUrl, nameFilter);
			} else {
				await this.performConnection({ connectionType, restUrl, nameFilter });
			}
		});
	}

	/**
	 * Show device selection modal for REST proxy
	 */
	async showDeviceSelectionModal(restUrl, nameFilter) {
		const deviceSelectModal = $("#deviceSelectModal");
		const deviceList = $("#deviceList");
		const deviceSelectStatus = $("#deviceSelectStatus");
		const deviceSelectCancel = $("#deviceSelectCancel");
		const deviceSelectRescan = $("#deviceSelectRescan");

		if (!deviceSelectModal || !deviceList) return;

		// Show modal
		deviceSelectModal.classList.remove("hidden");

		// Scan function
		const scanForDevices = async () => {
			try {
				deviceList.innerHTML = "";
				deviceSelectStatus.textContent = "Scanning for devices...";

				// Use connection.restProxy to scan
				const devices = await this.connection.restProxy.scanDevices(
					restUrl,
					nameFilter,
					10,
				);

				if (devices.length === 0) {
					deviceSelectStatus.textContent = "No devices found";
					deviceList.innerHTML =
						'<p style="padding: 20px; text-align: center; color: #6b7280;">No devices discovered. Try rescanning or check if devices are powered on.</p>';
					return;
				}

				deviceSelectStatus.textContent = `Found ${devices.length} device${devices.length > 1 ? "s" : ""}:`;

				// Create device list
				devices.forEach((device) => {
					const deviceItem = document.createElement("div");
					deviceItem.style.cssText =
						"padding: 12px; margin: 8px 0; background: #1f2937; border: 1px solid #374151; border-radius: 8px; cursor: pointer; transition: all 0.2s;";
					deviceItem.innerHTML = `
            <div style="font-weight: 500;">${escapeHtml(device.name || "Unknown Device")}</div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">${escapeHtml(device.address)}</div>
            <div style="font-size: 11px; color: #6b7280;">Signal: ${device.rssi} dBm</div>
          `;

					deviceItem.addEventListener("mouseenter", () => {
						deviceItem.style.background = "#374151";
						deviceItem.style.borderColor = "#3b82f6";
					});

					deviceItem.addEventListener("mouseleave", () => {
						deviceItem.style.background = "#1f2937";
						deviceItem.style.borderColor = "#374151";
					});

					deviceItem.addEventListener("click", async () => {
						deviceSelectModal.classList.add("hidden");
						await this.performConnection({
							connectionType: ConnectionType.REST_PROXY,
							restUrl,
							deviceAddress: device.address,
						});
					});

					deviceList.appendChild(deviceItem);
				});
			} catch (error) {
				console.error("Device scan error:", error);
				deviceSelectStatus.textContent = "Scan failed";
				deviceList.innerHTML = `<p style="padding: 20px; text-align: center; color: #ef4444;">${escapeHtml(error.message)}</p>`;
			}
		};

		// Cancel button
		const cancelHandler = () => {
			deviceSelectModal.classList.add("hidden");
		};

		// Rescan button
		const rescanHandler = () => {
			scanForDevices();
		};

		// Add event listeners
		deviceSelectCancel.removeEventListener("click", cancelHandler);
		deviceSelectCancel.addEventListener("click", cancelHandler);
		deviceSelectRescan.removeEventListener("click", rescanHandler);
		deviceSelectRescan.addEventListener("click", rescanHandler);

		// Escape key to close
		const escapeHandler = (e) => {
			if (
				e.key === "Escape" &&
				!deviceSelectModal.classList.contains("hidden")
			) {
				deviceSelectModal.classList.add("hidden");
			}
		};
		document.removeEventListener("keydown", escapeHandler);
		document.addEventListener("keydown", escapeHandler);

		// Start initial scan
		await scanForDevices();
	}

	/**
	 * Initialize advanced menu
	 */
	initializeAdvancedMenu() {
		const advMenu = $("#advMenu");
		const advRaw = $("#advRaw");
		const advFEDC = $("#advFEDC");
		const advFileDetails = $("#advFileDetails");

		// Load saved state
		advRaw.checked = localStorage.getItem(STORAGE_KEYS.ADV_RAW) === "1";
		advFEDC.checked = localStorage.getItem(STORAGE_KEYS.ADV_FEDC) === "1";
		advFileDetails.checked =
			localStorage.getItem(STORAGE_KEYS.SHOW_FILE_DETAILS) === "1";

		// Toggle menu
		$("#btnAdvanced")?.addEventListener("click", (e) => {
			e.stopPropagation();
			advMenu?.classList.toggle("hidden");
		});

		// Close menu on outside click
		document.addEventListener("click", (e) => {
			if (!e.target.closest(".menuwrap")) {
				advMenu?.classList.add("hidden");
			}
		});

		// Save state on change
		[advRaw, advFEDC, advFileDetails].forEach((el) => {
			el?.addEventListener("change", () => {
				localStorage.setItem(STORAGE_KEYS.ADV_RAW, advRaw.checked ? "1" : "0");
				localStorage.setItem(
					STORAGE_KEYS.ADV_FEDC,
					advFEDC.checked ? "1" : "0",
				);
				localStorage.setItem(
					STORAGE_KEYS.SHOW_FILE_DETAILS,
					advFileDetails.checked ? "1" : "0",
				);
				this.applyAdvancedVisibility();
			});
		});

		this.applyAdvancedVisibility();
	}

	/**
	 * Apply advanced feature visibility
	 */
	applyAdvancedVisibility() {
		const advRaw = $("#advRaw");
		const advFileDetails = $("#advFileDetails");

		$("#advRawBlock")?.classList.toggle("hidden", !advRaw?.checked);

		// Toggle detail columns visibility
		const showDetails = advFileDetails?.checked;
		document.querySelectorAll(".detail-column").forEach((col) => {
			col.style.display = showDetails ? "" : "none";
		});
	}

	/**
	 * Initialize log filter menu
	 */
	initializeLogFilter() {
		const logFilterMenu = $("#logFilterMenu");
		const logFilterNormal = $("#logFilterNormal");
		const logFilterWarning = $("#logFilterWarning");
		const logFilterTx = $("#logFilterTx");
		const logFilterRx = $("#logFilterRx");

		// Load saved state (default to all checked)
		logFilterNormal.checked =
			localStorage.getItem(STORAGE_KEYS.LOG_FILTER_NORMAL) !== "0";
		logFilterWarning.checked =
			localStorage.getItem(STORAGE_KEYS.LOG_FILTER_WARNING) !== "0";
		logFilterTx.checked =
			localStorage.getItem(STORAGE_KEYS.LOG_FILTER_TX) !== "0";
		logFilterRx.checked =
			localStorage.getItem(STORAGE_KEYS.LOG_FILTER_RX) !== "0";

		// Toggle menu
		$("#btnLogFilter")?.addEventListener("click", (e) => {
			e.stopPropagation();
			logFilterMenu?.classList.toggle("hidden");
		});

		// Close menu on outside click
		document.addEventListener("click", (e) => {
			if (!e.target.closest(".menuwrap") || e.target.closest("#advMenu")) {
				logFilterMenu?.classList.add("hidden");
			}
		});

		// Save state and apply filter on change
		[logFilterNormal, logFilterWarning, logFilterTx, logFilterRx].forEach(
			(el) => {
				el?.addEventListener("change", () => {
					localStorage.setItem(
						STORAGE_KEYS.LOG_FILTER_NORMAL,
						logFilterNormal.checked ? "1" : "0",
					);
					localStorage.setItem(
						STORAGE_KEYS.LOG_FILTER_WARNING,
						logFilterWarning.checked ? "1" : "0",
					);
					localStorage.setItem(
						STORAGE_KEYS.LOG_FILTER_TX,
						logFilterTx.checked ? "1" : "0",
					);
					localStorage.setItem(
						STORAGE_KEYS.LOG_FILTER_RX,
						logFilterRx.checked ? "1" : "0",
					);
					this.applyLogFilter();
				});
			},
		);

		this.applyLogFilter();
	}

	/**
	 * Apply log filter visibility
	 */
	applyLogFilter() {
		const logFilterNormal = $("#logFilterNormal");
		const logFilterWarning = $("#logFilterWarning");
		const logFilterTx = $("#logFilterTx");
		const logFilterRx = $("#logFilterRx");

		const logEl = $("#log");
		if (!logEl) return;

		// Apply filter to all log lines
		logEl.querySelectorAll(".line").forEach((line) => {
			const classes = line.classList;
			let visible = true;

			if (classes.contains("warn") && !logFilterWarning?.checked) {
				visible = false;
			} else if (classes.contains("tx") && !logFilterTx?.checked) {
				visible = false;
			} else if (classes.contains("rx") && !logFilterRx?.checked) {
				visible = false;
			} else if (
				!classes.contains("warn") &&
				!classes.contains("tx") &&
				!classes.contains("rx") &&
				!logFilterNormal?.checked
			) {
				visible = false;
			}

			line.style.display = visible ? "" : "none";
		});
	}

	/**
	 * Initialize query buttons
	 */
	initializeQueryButtons() {
		document.querySelectorAll("[data-q]").forEach((btn) => {
			btn.addEventListener("click", async () => {
				if (!this.connection.isConnected()) {
					this.logger.log("Not connected", LOG_CLASSES.WARNING);
					return;
				}
				const tag = btn.getAttribute("data-q");
				await this.connection.send(buildCommand(tag, "", 8));
			});
		});

		// Get All button - executes all query commands in sequence
		$("#btnGetAll")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			this.logger.log("Executing all queries...", LOG_CLASSES.INFO);
			const queries = [
				COMMANDS.QUERY_PARAMS,
				COMMANDS.QUERY_LIVE,
				COMMANDS.QUERY_VOLUME,
				COMMANDS.QUERY_BT_NAME,
				COMMANDS.QUERY_VERSION,
				COMMANDS.QUERY_CAPACITY,
				COMMANDS.QUERY_ORDER,
			];

			for (const tag of queries) {
				await this.connection.send(buildCommand(tag, "", 8));
				// Small delay between queries to avoid overwhelming the device
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			this.logger.log("All queries completed", LOG_CLASSES.SUCCESS);
		});

		// Raw command send button
		$("#btnSendRaw")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}
			const tag = $("#tag")?.value || COMMANDS.QUERY_PARAMS;
			const payload = $("#payload")?.value || "";
			await this.connection.send(buildCommand(tag, payload, 8));
			this.logger.log(
				`Sent raw command: ${tag} with payload: ${payload || "(empty)"}`,
			);
		});

		// Set Device Name button
		$("#btnSetDeviceName")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const deviceNameInput = $("#deviceNameInput");
			const deviceName = deviceNameInput?.value || "";

			// Validate device name: must not be empty and max 22 chars
			if (!deviceName || deviceName.trim().length === 0) {
				this.logger.log("Device name cannot be empty", LOG_CLASSES.WARNING);
				return;
			}

			if (deviceName.length > 22) {
				this.logger.log(
					"Device name cannot exceed 22 characters",
					LOG_CLASSES.WARNING,
				);
				return;
			}

			const pin = this.state.device.pin || "0000";
			await this.setPinAndName(pin, deviceName);
		});

		// Set PIN button
		$("#btnSetPin")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const pinInput = $("#pinInput");
			const pin = pinInput?.value || "";

			// Validate PIN: must be exactly 4 digits
			if (!/^\d{4}$/.test(pin)) {
				this.logger.log("PIN must be exactly 4 digits", LOG_CLASSES.WARNING);
				return;
			}

			const deviceNameInput = $("#deviceNameInput");
			const deviceName = deviceNameInput?.value || "";

			// Use current device name if available, otherwise use entered name or default to btName
			const btName = deviceName || this.state.device.btName || "";
			if (!btName) {
				this.logger.log(
					"Device name not available. Enter a device name first.",
					LOG_CLASSES.WARNING,
				);
				return;
			}

			await this.setPinAndName(pin, btName);
		});

		// PIN input validation - only allow digits
		const pinInput = $("#pinInput");
		if (pinInput) {
			pinInput.addEventListener("input", (e) => {
				// Remove non-digit characters
				e.target.value = e.target.value.replace(/[^0-9]/g, "");
			});
		}

		// Device name input validation - enforce max length
		const deviceNameInput = $("#deviceNameInput");
		if (deviceNameInput) {
			deviceNameInput.addEventListener("input", (e) => {
				// Enforce max length of 22 characters
				if (e.target.value.length > 22) {
					e.target.value = e.target.value.substring(0, 22);
				}
			});
		}
	}

	/**
	 * Set device PIN and Bluetooth name
	 * @param {string} pin - 4-digit PIN
	 * @param {string} btName - Bluetooth name (should end with "(Live)" suffix)
	 */
	async setPinAndName(pin, btName) {
		// Ensure BT name ends with "(Live)"
		if (!btName.endsWith("(Live)")) {
			btName += "(Live)";
		}

		// Build the AAFB command payload
		// Format: <4 bytes PIN in ASCII> <8 bytes wifi password in ASCII> <1 byte name length> <BT name in ASCII with "(Live)">

		// Convert PIN to ASCII bytes and then to hex
		const pinBytes = new TextEncoder().encode(pin);
		const pinHex = bytesToHex(pinBytes);

		// Hardcoded wifi password "01234567" as ASCII bytes
		const wifiBytes = new TextEncoder().encode("01234567");
		const wifiHex = bytesToHex(wifiBytes);

		const nameLengthHex = btName.length
			.toString(16)
			.padStart(2, "0")
			.toUpperCase();

		// BT name as ASCII bytes
		const nameBytes = new TextEncoder().encode(btName);
		const nameHex = bytesToHex(nameBytes);

		const payload = pinHex + wifiHex + nameLengthHex + nameHex;

		await this.connection.send(
			buildCommand(COMMANDS.SET_PIN_AND_NAME, payload, 8),
		);
		this.logger.log(`Set PIN to ${pin} with BT name "${btName}"`);

		// Query device params to get the updated name and PIN back from the device
		await this.connection.send(buildCommand(COMMANDS.QUERY_BT_NAME, "", 8));
		await this.connection.send(buildCommand(COMMANDS.QUERY_PARAMS, "", 8));
	}

	/**
	 * Initialize media controls
	 */
	initializeMediaControls() {
		// Volume control - send command immediately on change
		const volRange = $("#volRange");
		const volNum = $("#vol");

		const sendVolumeCommand = async (value) => {
			if (!this.connection.isConnected()) {
				return;
			}
			const v = Math.max(0, Math.min(100, parseInt(value, 10)));
			await this.connection.send(
				buildCommand(
					COMMANDS.SET_VOLUME,
					v.toString(16).padStart(2, "0").toUpperCase(),
					8,
				),
			);
			this.logger.log(`Set volume to ${v}`);
		};

		if (volRange && volNum) {
			volRange.addEventListener("input", (e) => {
				volNum.value = e.target.value;
				sendVolumeCommand(e.target.value);
			});
			volNum.addEventListener("input", (e) => {
				const clamped = clamp(e.target.value, 0, 100);
				volRange.value = clamped;
				sendVolumeCommand(clamped);
			});
		}

		// Live Mode button
		$("#btnBT")?.addEventListener("click", () =>
			this.sendMediaCommand(COMMANDS.ENABLE_CLASSIC_BT, "01"),
		);
	}

	/**
	 * A live light channel as its controls show it, in device units for F1.
	 * @param {number} channel - 0 or 1
	 */
	readLiveLight(channel) {
		const value = (field, max) =>
			Math.round(clamp($(`#light${channel}${field}`)?.value, 0, max));
		return {
			effectMode: parseInt($(`#light${channel}EffectMode`)?.value || "1", 10),
			brightness: value("Brightness", 255),
			r: value("R", 255),
			g: value("G", 255),
			b: value("B", 255),
			colorCycle: this[`light${channel}ColorCycleEnabled`] ? 1 : 0,
			effectSpeed: uiSpeedToDevice(value("EffectSpeed", MAX_UI_EFFECT_SPEED)),
		};
	}

	/** Color and color cycle of the live light controls, channels 0 and 1 */
	readLiveColors() {
		return [0, 1].map((ch) => {
			const value = (field) =>
				Math.round(clamp($(`#light${ch}${field}`)?.value, 0, 255));
			return {
				r: value("R"),
				g: value("G"),
				b: value("B"),
				colorCycle: this[`light${ch}ColorCycleEnabled`] ? 1 : 0,
			};
		});
	}

	/** Show colors (from readLiveColors or sceneLightColor) in the live controls */
	showLiveColors(colors) {
		colors.forEach((color, ch) => {
			if (!color) return;
			if ($(`#light${ch}R`)) $(`#light${ch}R`).value = color.r;
			if ($(`#light${ch}G`)) $(`#light${ch}G`).value = color.g;
			if ($(`#light${ch}B`)) $(`#light${ch}B`).value = color.b;
			const hex = [color.r, color.g, color.b]
				.map((c) => c.toString(16).padStart(2, "0"))
				.join("");
			if ($(`#light${ch}ColorPick`))
				$(`#light${ch}ColorPick`).value = `#${hex}`;
			this[`light${ch}ColorCycleEnabled`] = color.colorCycle === 1;
			$(`#btnLight${ch}ColorCycle`)?.classList.toggle(
				"selected",
				color.colorCycle === 1,
			);
		});
	}

	/**
	 * Going from `from` to scene `to`: a preset shows (and F1 sends) its own
	 * colors, as in the phone app; the custom colors are kept here and come
	 * back with Custom.
	 */
	showSceneColors(from, to) {
		if (isScenePreset(to)) {
			if (!isScenePreset(from) || !this.liveCustomColors) {
				this.liveCustomColors = this.readLiveColors();
			}
			this.showLiveColors([0, 1].map((ch) => sceneLightColor(to, ch)));
		} else if (this.liveCustomColors) {
			this.showLiveColors(this.liveCustomColors);
			this.liveCustomColors = null;
		}
	}

	/**
	 * A preset the device reported (BBE1): keep what the controls show as
	 * the custom colors (unless already kept) and show the scene's colors.
	 * Runs again once the firmware version is known, since BBE1 comes first.
	 */
	showReportedSceneColors() {
		const scene = this.state.live.scene;
		if (
			isScenePreset(scene) &&
			supportsLightScenes(this.state.deviceType, this.state.device?.version)
		) {
			if (!this.liveCustomColors) this.liveCustomColors = this.readLiveColors();
			this.showLiveColors([0, 1].map((ch) => sceneLightColor(scene, ch)));
		} else if (Number.isInteger(scene)) {
			this.liveCustomColors = null; // Custom: the controls show its colors
		}
	}

	/**
	 * Send every live light channel and the scene in one F1 (cluster 0).
	 * @param {number} scene - LIGHT_SCENES value
	 */
	async sendLiveLights(scene) {
		const profile =
			DEVICE_PROFILES[this.state.deviceType] ||
			DEVICE_PROFILES[DEVICE_TYPES.SKELLY];
		const lights = [];
		for (let ch = 0; ch < Math.min(profile.lights.length || 1, 2); ch++) {
			lights.push(this.readLiveLight(ch));
		}
		await this.connection.send(buildSetAllLightsCommand(lights, 0, scene));
		this.logger.log(
			`Set all lights (F1) scene=${scene}: ${lights
				.map(
					(l, ch) =>
						`ch${ch} mode=${l.effectMode} brightness=${l.brightness} speed=${l.effectSpeed}`,
				)
				.join(", ")}`,
		);
	}

	/**
	 * While a scene preset is on, a live brightness, effect or speed change
	 * goes out as F1 with that scene, so the scene stays on. (Whether the
	 * per-channel commands would end the scene is untested.)
	 * @returns {boolean} true when it sent F1 (the caller sends nothing else)
	 */
	sendLiveLightsInScene() {
		const scene = this.state.live.scene;
		if (
			!isScenePreset(scene) ||
			!supportsLightScenes(this.state.deviceType, this.state.device?.version)
		) {
			return false;
		}
		this.sendLiveLights(scene).catch((error) =>
			this.logger.log(
				`Set all lights failed: ${error.message}`,
				LOG_CLASSES.WARNING,
			),
		);
		return true;
	}

	/**
	 * Show the live scene picker on scene firmware once the device reported
	 * its scene (BBE1), and gray out color and color cycle while a scene
	 * preset plays its own colors.
	 */
	updateScenePicker() {
		const scene = this.state.live.scene;
		const shown =
			Number.isInteger(scene) &&
			supportsLightScenes(this.state.deviceType, this.state.device?.version);
		const preset = shown && isScenePreset(scene);
		$("#liveSceneRow")?.classList.toggle("hidden", !shown);
		$("#liveSceneHint")?.classList.toggle("hidden", !preset);
		const picker = $("#liveScene");
		if (picker && shown) {
			// A scene this page doesn't know (newer firmware) still shows as a number
			if (![...picker.options].some((o) => o.value === String(scene))) {
				picker.add(new Option(`Scene ${scene}`, String(scene)));
			}
			picker.value = String(scene);
		}
		for (const ch of [0, 1]) {
			for (const id of [
				`light${ch}ColorPick`,
				`light${ch}R`,
				`light${ch}G`,
				`light${ch}B`,
				`btnLight${ch}ColorCycle`,
			]) {
				const el = $(`#${id}`);
				if (!el) continue;
				el.disabled = preset;
				el.title = preset
					? "The light scene plays its own colors"
					: id.startsWith("btn")
						? "Cycle all colors"
						: "";
			}
		}
	}

	/** Returns the display label for the primary (light0) zone of the active profile. */
	get light0Label() {
		const profile =
			DEVICE_PROFILES[this.state.deviceType] ||
			DEVICE_PROFILES[DEVICE_TYPES.SKELLY];
		return profile.lights[0]?.label ?? "Light";
	}

	/**
	 * Send media command
	 */
	async sendMediaCommand(tag, payload) {
		if (!this.connection.isConnected()) {
			this.logger.log("Not connected", LOG_CLASSES.WARNING);
			return;
		}
		await this.connection.send(buildCommand(tag, payload, 8));
	}

	/**
	 * Initialize live controls
	 */
	initializeLiveControls() {
		this.selectedEye = 1; // Default eye selection
		this.buildLiveEyeGrid();

		// Track color cycle state for each light
		this.light1ColorCycleEnabled = false;
		this.light0ColorCycleEnabled = false;
		// Custom colors kept while a scene preset shows its own (showSceneColors)
		this.liveCustomColors = null;

		// Light 1 - Brightness control (immediate)
		const light1BriRange = $("#light1BrightnessRange");
		const light1BriNum = $("#light1Brightness");

		const sendLight1Brightness = async (value) => {
			if (!this.connection.isConnected()) return;
			if (this.sendLiveLightsInScene()) return;
			const ch = "01"; // Light 1 is channel 1
			const brightness = parseInt(value, 10);
			const brightnessHex = brightness
				.toString(16)
				.padStart(2, "0")
				.toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(COMMANDS.SET_BRIGHTNESS, ch + brightnessHex + cluster, 8),
			);
			this.logger.log(`Set Light 1 brightness to ${brightness}`);
		};

		if (light1BriRange && light1BriNum) {
			light1BriRange.addEventListener("input", (e) => {
				light1BriNum.value = e.target.value;
				sendLight1Brightness(e.target.value);
			});
			light1BriNum.addEventListener("input", (e) => {
				const clamped = clamp(e.target.value, 0, 255);
				light1BriRange.value = clamped;
				sendLight1Brightness(clamped);
			});
		}

		// Light 0 - Brightness control (immediate)
		const light0BriRange = $("#light0BrightnessRange");
		const light0BriNum = $("#light0Brightness");

		const sendLight0Brightness = async (value) => {
			if (!this.connection.isConnected()) return;
			if (this.sendLiveLightsInScene()) return;
			const ch = "00"; // Light 0 is channel 0
			const brightness = parseInt(value, 10);
			const brightnessHex = brightness
				.toString(16)
				.padStart(2, "0")
				.toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(COMMANDS.SET_BRIGHTNESS, ch + brightnessHex + cluster, 8),
			);
			this.logger.log(`Set ${this.light0Label} brightness to ${brightness}`);
		};

		if (light0BriRange && light0BriNum) {
			light0BriRange.addEventListener("input", (e) => {
				light0BriNum.value = e.target.value;
				sendLight0Brightness(e.target.value);
			});
			light0BriNum.addEventListener("input", (e) => {
				const clamped = clamp(e.target.value, 0, 255);
				light0BriRange.value = clamped;
				sendLight0Brightness(clamped);
			});
		}

		// Light 1 - Color/RGB control (immediate)
		const light1ColorPick = $("#light1ColorPick");
		const light1RInput = $("#light1R");
		const light1GInput = $("#light1G");
		const light1BInput = $("#light1B");

		const sendLight1Color = async (disableCycle = false) => {
			if (!this.connection.isConnected()) return;

			// If user is setting a new color (not from cycle button), disable cycle
			if (disableCycle && this.light1ColorCycleEnabled) {
				this.light1ColorCycleEnabled = false;
				const btnLight1ColorCycle = $("#btnLight1ColorCycle");
				if (btnLight1ColorCycle) {
					btnLight1ColorCycle.classList.remove("selected");
				}
			}

			const ch = "01"; // Light 1 is channel 1
			const r = parseInt(light1RInput?.value || "255", 10);
			const g = parseInt(light1GInput?.value || "0", 10);
			const b = parseInt(light1BInput?.value || "0", 10);
			const cycle = this.light1ColorCycleEnabled ? "01" : "00";
			const rHex = r.toString(16).padStart(2, "0").toUpperCase();
			const gHex = g.toString(16).padStart(2, "0").toUpperCase();
			const bHex = b.toString(16).padStart(2, "0").toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(
					COMMANDS.SET_RGB,
					`${ch + rHex + gHex + bHex + cycle + cluster}00`,
					9,
				),
			);
			this.logger.log(
				`Set Light 1 color to RGB(${r}, ${g}, ${b}) with cycle ${this.light1ColorCycleEnabled ? "ON" : "OFF"}`,
			);
		};

		// Sync color picker with RGB inputs and send immediately
		if (light1ColorPick && light1RInput && light1GInput && light1BInput) {
			light1ColorPick.addEventListener("input", (e) => {
				const hex = e.target.value;
				light1RInput.value = parseInt(hex.substring(1, 3), 16);
				light1GInput.value = parseInt(hex.substring(3, 5), 16);
				light1BInput.value = parseInt(hex.substring(5, 7), 16);
				sendLight1Color(true); // Disable cycle when user picks a color
			});

			[light1RInput, light1GInput, light1BInput].forEach((inp) => {
				inp?.addEventListener("input", () => {
					const r = clamp(light1RInput.value, 0, 255);
					const g = clamp(light1GInput.value, 0, 255);
					const b = clamp(light1BInput.value, 0, 255);
					light1ColorPick.value = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
					sendLight1Color(true); // Disable cycle when user changes RGB values
				});
			});
		}

		// Light 0 - Color/RGB control (immediate)
		const light0ColorPick = $("#light0ColorPick");
		const light0RInput = $("#light0R");
		const light0GInput = $("#light0G");
		const light0BInput = $("#light0B");

		const sendLight0Color = async (disableCycle = false) => {
			if (!this.connection.isConnected()) return;

			// If user is setting a new color (not from cycle button), disable cycle
			if (disableCycle && this.light0ColorCycleEnabled) {
				this.light0ColorCycleEnabled = false;
				const btnLight0ColorCycle = $("#btnLight0ColorCycle");
				if (btnLight0ColorCycle) {
					btnLight0ColorCycle.classList.remove("selected");
				}
			}

			const ch = "00"; // Light 0 is channel 0
			const r = parseInt(light0RInput?.value || "255", 10);
			const g = parseInt(light0GInput?.value || "0", 10);
			const b = parseInt(light0BInput?.value || "0", 10);
			const cycle = this.light0ColorCycleEnabled ? "01" : "00";
			const rHex = r.toString(16).padStart(2, "0").toUpperCase();
			const gHex = g.toString(16).padStart(2, "0").toUpperCase();
			const bHex = b.toString(16).padStart(2, "0").toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(
					COMMANDS.SET_RGB,
					`${ch + rHex + gHex + bHex + cycle + cluster}00`,
					9,
				),
			);
			this.logger.log(
				`Set ${this.light0Label} color to RGB(${r}, ${g}, ${b}) with cycle ${this.light0ColorCycleEnabled ? "ON" : "OFF"}`,
			);
		};

		// Sync color picker with RGB inputs and send immediately
		if (light0ColorPick && light0RInput && light0GInput && light0BInput) {
			light0ColorPick.addEventListener("input", (e) => {
				const hex = e.target.value;
				light0RInput.value = parseInt(hex.substring(1, 3), 16);
				light0GInput.value = parseInt(hex.substring(3, 5), 16);
				light0BInput.value = parseInt(hex.substring(5, 7), 16);
				sendLight0Color(true); // Disable cycle when user picks a color
			});

			[light0RInput, light0GInput, light0BInput].forEach((inp) => {
				inp?.addEventListener("input", () => {
					const r = clamp(light0RInput.value, 0, 255);
					const g = clamp(light0GInput.value, 0, 255);
					const b = clamp(light0BInput.value, 0, 255);
					light0ColorPick.value = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
					sendLight0Color(true); // Disable cycle when user changes RGB values
				});
			});
		}

		// Light 1 - Effect mode (immediate)
		const light1EffectMode = $("#light1EffectMode");
		const light1EffectSpeedBlock = $("#light1EffectSpeedBlock");

		if (light1EffectMode && light1EffectSpeedBlock) {
			light1EffectMode.addEventListener("change", async () => {
				const v = parseInt(light1EffectMode.value, 10);
				light1EffectSpeedBlock.classList.toggle("hidden", v === 1); // hide for Static

				if (!this.connection.isConnected()) return;
				if (this.sendLiveLightsInScene()) return;
				const ch = "01"; // Light 1 is channel 1
				const modeHex = v.toString(16).padStart(2, "0").toUpperCase();
				const cluster = "00000000";
				await this.connection.send(
					buildCommand(COMMANDS.SET_MODE, `${ch + modeHex + cluster}00`, 8),
				);
				this.logger.log(
					`Set Light 1 mode to ${v} (1=Static, 2=Strobe, 3=Pulsing)`,
				);
			});
		}

		// Light 0 - Effect mode (immediate)
		const light0EffectMode = $("#light0EffectMode");
		const light0EffectSpeedBlock = $("#light0EffectSpeedBlock");

		if (light0EffectMode && light0EffectSpeedBlock) {
			light0EffectMode.addEventListener("change", async () => {
				const v = parseInt(light0EffectMode.value, 10);
				light0EffectSpeedBlock.classList.toggle("hidden", v === 1); // hide for Static

				if (!this.connection.isConnected()) return;
				if (this.sendLiveLightsInScene()) return;
				const ch = "00"; // Light 0 is channel 0
				const modeHex = v.toString(16).padStart(2, "0").toUpperCase();
				const cluster = "00000000";
				await this.connection.send(
					buildCommand(COMMANDS.SET_MODE, `${ch + modeHex + cluster}00`, 8),
				);
				this.logger.log(
					`Set ${this.light0Label} mode to ${v} (1=Static, 2=Strobe, 3=Pulsing)`,
				);
			});
		}

		// Light 1 - Effect speed control (immediate)
		const light1EffectSpeedRange = $("#light1EffectSpeedRange");
		const light1EffectSpeedNum = $("#light1EffectSpeed");

		const sendLight1Speed = async (value) => {
			if (!this.connection.isConnected()) return;
			if (this.sendLiveLightsInScene()) return;
			const ch = "01"; // Light 1 is channel 1
			const uiSpeed = parseInt(value, 10);
			const deviceSpeed = uiSpeedToDevice(uiSpeed);
			const speedHex = deviceSpeed.toString(16).padStart(2, "0").toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(COMMANDS.SET_SPEED, ch + speedHex + cluster, 8),
			);
			this.logger.log(
				`Set Light 1 speed to ${uiSpeed} (device: ${deviceSpeed})`,
			);
		};

		if (light1EffectSpeedRange && light1EffectSpeedNum) {
			light1EffectSpeedRange.addEventListener("input", (e) => {
				light1EffectSpeedNum.value = e.target.value;
				sendLight1Speed(e.target.value);
			});
			light1EffectSpeedNum.addEventListener("input", (e) => {
				const clamped = clamp(e.target.value, 0, MAX_UI_EFFECT_SPEED);
				light1EffectSpeedRange.value = clamped;
				sendLight1Speed(clamped);
			});
		}

		// Light 0 - Effect speed control (immediate)
		const light0EffectSpeedRange = $("#light0EffectSpeedRange");
		const light0EffectSpeedNum = $("#light0EffectSpeed");

		const sendLight0Speed = async (value) => {
			if (!this.connection.isConnected()) return;
			if (this.sendLiveLightsInScene()) return;
			const ch = "00"; // Light 0 is channel 0
			const uiSpeed = parseInt(value, 10);
			const deviceSpeed = uiSpeedToDevice(uiSpeed);
			const speedHex = deviceSpeed.toString(16).padStart(2, "0").toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(COMMANDS.SET_SPEED, ch + speedHex + cluster, 8),
			);
			this.logger.log(
				`Set ${this.light0Label} speed to ${uiSpeed} (device: ${deviceSpeed})`,
			);
		};

		if (light0EffectSpeedRange && light0EffectSpeedNum) {
			light0EffectSpeedRange.addEventListener("input", (e) => {
				light0EffectSpeedNum.value = e.target.value;
				sendLight0Speed(e.target.value);
			});
			light0EffectSpeedNum.addEventListener("input", (e) => {
				const clamped = clamp(e.target.value, 0, MAX_UI_EFFECT_SPEED);
				light0EffectSpeedRange.value = clamped;
				sendLight0Speed(clamped);
			});
		}

		// Movement controls — handled by bindMovementGrid (called from applyDeviceProfile)

		// Light 1 - Color cycle button (toggles cycle state)
		const btnLight1ColorCycle = $("#btnLight1ColorCycle");
		if (btnLight1ColorCycle) {
			btnLight1ColorCycle.addEventListener("click", async () => {
				if (!this.connection.isConnected()) {
					this.logger.log("Not connected", LOG_CLASSES.WARNING);
					return;
				}
				this.light1ColorCycleEnabled = !this.light1ColorCycleEnabled;
				btnLight1ColorCycle.classList.toggle(
					"selected",
					this.light1ColorCycleEnabled,
				);
				await sendLight1Color();
			});
		}

		// Light 0 - Color cycle button (toggles cycle state)
		const btnLight0ColorCycle = $("#btnLight0ColorCycle");
		if (btnLight0ColorCycle) {
			btnLight0ColorCycle.addEventListener("click", async () => {
				if (!this.connection.isConnected()) {
					this.logger.log("Not connected", LOG_CLASSES.WARNING);
					return;
				}
				this.light0ColorCycleEnabled = !this.light0ColorCycleEnabled;
				btnLight0ColorCycle.classList.toggle(
					"selected",
					this.light0ColorCycleEnabled,
				);
				await sendLight0Color();
			});
		}

		// Light scene picker (scene firmware only, see updateScenePicker)
		$("#liveScene")?.addEventListener("change", async (e) => {
			const scene = parseInt(e.target.value, 10);
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				this.updateScenePicker();
				return;
			}
			const shownColors = this.readLiveColors();
			const customColors = this.liveCustomColors;
			const previousScene = this.state.live.scene;
			this.showSceneColors(previousScene, scene);
			// Set before sending so a device update meanwhile sees the new scene.
			// No notify: that would reset the light controls to the last report.
			this.state.live.scene = scene;
			this.updateScenePicker();
			try {
				await this.sendLiveLights(scene);
			} catch (error) {
				this.logger.log(
					`Set light scene failed: ${error.message}`,
					LOG_CLASSES.WARNING,
				);
				this.state.live.scene = previousScene;
				this.showLiveColors(shownColors);
				this.liveCustomColors = customColors;
				this.updateScenePicker();
			}
		});

		// Live eye grid selection - send command immediately
		const apEyeGrid = $("#apEyeGrid");
		if (apEyeGrid) {
			apEyeGrid.addEventListener("click", async (e) => {
				const cell = e.target.closest(".eye-opt");
				if (!cell) return;

				this.selectedEye = parseInt(cell.dataset.eye, 10);
				apEyeGrid.querySelectorAll(".eye-opt").forEach((el) => {
					el.classList.remove("selected");
				});
				cell.classList.add("selected");

				// Send command immediately if connected
				if (!this.connection.isConnected()) {
					this.logger.log("Not connected", LOG_CLASSES.WARNING);
					return;
				}

				const eyeHex = this.selectedEye
					.toString(16)
					.padStart(2, "0")
					.toUpperCase();
				const clusterHex = "00000000"; // Always cluster 0 for live mode

				// Build payload: eye + 00 + cluster + 00 (no name)
				const payload = `${eyeHex}00${clusterHex}00`;

				await this.connection.send(buildCommand(COMMANDS.SET_EYE, payload, 8));
				this.logger.log(`Set eye to ${this.selectedEye} (live mode)`);
			});
		}
	}

	/**
	 * Initialize file controls
	 */
	initializeFileControls() {
		this.initializeFileListControls();
		this.initializeFileTableHandlers();
		this.initializeFileDragAndDrop();
	}

	/**
	 * Initialize file list refresh and filter controls
	 */
	initializeFileListControls() {
		$("#btnRefreshFiles")?.addEventListener("click", () => {
			this.fileManager.startFetchFiles();
		});

		$("#filesFilter")?.addEventListener("input", () => {
			this.updateFilesTable();
		});

		$("#btnAddFile")?.addEventListener("click", () => {
			this.transferModal.open("add");
		});
	}

	/**
	 * Initialize file table button and checkbox handlers
	 */
	initializeFileTableHandlers() {
		// Files table button handler (Play and Edit)
		$("#filesTable")?.addEventListener("click", (e) => {
			const btn = e.target.closest("button[data-action]");
			if (!btn) return;

			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const serial = parseInt(btn.dataset.serial, 10);
			const item = this.state.files.items.get(serial);
			if (!item) return;

			if (btn.dataset.action === "play" || btn.dataset.action === "stop") {
				this.handlePlayFile(serial);
			} else if (btn.dataset.action === "edit") {
				this.handleEditFile(item);
			}
		});

		// Files table checkbox handler (Enable/Disable)
		$("#filesTable")?.addEventListener("change", async (e) => {
			const checkbox = e.target.closest(".file-enabled-checkbox");
			if (!checkbox) return;

			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				// Revert checkbox state
				checkbox.checked = !checkbox.checked;
				return;
			}

			await this.handleFileEnableToggle();
		});
	}

	/**
	 * Initialize drag and drop handlers for file reordering
	 */
	initializeFileDragAndDrop() {
		let draggedRow = null;

		const tbody = $("#filesTable tbody");
		if (!tbody) return;

		// Desktop drag and drop
		tbody.addEventListener("dragstart", (e) => {
			const row = e.target.closest("tr.draggable-row");
			if (!row) return;

			draggedRow = row;
			row.style.opacity = "0.4";
			e.dataTransfer.effectAllowed = "move";
		});

		tbody.addEventListener("dragend", (e) => {
			const row = e.target.closest("tr.draggable-row");
			if (row) {
				row.style.opacity = "1";
			}
			draggedRow = null;
		});

		tbody.addEventListener("dragover", (e) => {
			e.preventDefault();
			const row = e.target.closest("tr.draggable-row");
			if (!row || !draggedRow || row === draggedRow) return;

			e.dataTransfer.dropEffect = "move";

			// Visual feedback - add border to indicate drop position
			const rows = Array.from(tbody.querySelectorAll("tr.draggable-row"));
			const draggedIndex = rows.indexOf(draggedRow);
			const targetIndex = rows.indexOf(row);

			if (draggedIndex < targetIndex) {
				row.style.borderBottom = "2px solid #4CAF50";
				row.style.borderTop = "";
			} else {
				row.style.borderTop = "2px solid #4CAF50";
				row.style.borderBottom = "";
			}
		});

		tbody.addEventListener("dragleave", (e) => {
			const row = e.target.closest("tr.draggable-row");
			if (row) {
				row.style.borderTop = "";
				row.style.borderBottom = "";
			}
		});

		tbody.addEventListener("drop", async (e) => {
			e.preventDefault();
			const targetRow = e.target.closest("tr.draggable-row");
			if (!targetRow || !draggedRow || targetRow === draggedRow) return;

			// Clear visual feedback
			targetRow.style.borderTop = "";
			targetRow.style.borderBottom = "";

			await this.handleFileDrop(draggedRow, targetRow);
		});

		// Mobile touch events
		tbody.addEventListener(
			"touchstart",
			(e) => {
				const dragHandle = e.target.closest(".drag-handle");
				if (!dragHandle) return;

				const row = e.target.closest("tr.draggable-row");
				if (!row) return;

				draggedRow = row;

				// Create visual feedback
				row.style.opacity = "0.6";
				row.style.backgroundColor = "rgba(34, 211, 238, 0.1)";

				// Prevent scrolling while dragging
				e.preventDefault();
			},
			{ passive: false },
		);

		tbody.addEventListener(
			"touchmove",
			(e) => {
				if (!draggedRow) return;

				e.preventDefault();

				// Get all draggable rows
				const rows = Array.from(tbody.querySelectorAll("tr.draggable-row"));
				const draggedIndex = rows.indexOf(draggedRow);

				// Clear previous visual feedback
				rows.forEach((r) => {
					r.style.borderTop = "";
					r.style.borderBottom = "";
				});

				// Find the row under the touch point
				const elementAtPoint = document.elementFromPoint(
					e.touches[0].clientX,
					e.touches[0].clientY,
				);
				const targetRow = elementAtPoint?.closest("tr.draggable-row");

				if (targetRow && targetRow !== draggedRow) {
					const targetIndex = rows.indexOf(targetRow);

					// Show visual feedback
					if (draggedIndex < targetIndex) {
						targetRow.style.borderBottom = "2px solid #4CAF50";
					} else {
						targetRow.style.borderTop = "2px solid #4CAF50";
					}
				}
			},
			{ passive: false },
		);

		tbody.addEventListener("touchend", async (e) => {
			if (!draggedRow) return;

			// Clear visual feedback
			draggedRow.style.opacity = "1";
			draggedRow.style.backgroundColor = "";

			// Find the row at the drop position
			const elementAtPoint = document.elementFromPoint(
				e.changedTouches[0].clientX,
				e.changedTouches[0].clientY,
			);
			const targetRow = elementAtPoint?.closest("tr.draggable-row");

			// Clear all borders
			const rows = Array.from(tbody.querySelectorAll("tr.draggable-row"));
			rows.forEach((r) => {
				r.style.borderTop = "";
				r.style.borderBottom = "";
			});

			if (targetRow && targetRow !== draggedRow) {
				await this.handleFileDrop(draggedRow, targetRow);
			}

			draggedRow = null;
		});

		tbody.addEventListener("touchcancel", (_e) => {
			if (!draggedRow) return;

			// Clear visual feedback
			draggedRow.style.opacity = "1";
			draggedRow.style.backgroundColor = "";

			// Clear all borders
			const rows = Array.from(tbody.querySelectorAll("tr.draggable-row"));
			rows.forEach((r) => {
				r.style.borderTop = "";
				r.style.borderBottom = "";
			});

			draggedRow = null;
		});
	}

	/**
	 * Handle play file button click
	 */
	async handlePlayFile(serial) {
		const serialHex = serial.toString(16).padStart(4, "0").toUpperCase();

		// Check if this file is currently playing
		const isPlaying =
			this.playState.playing && this.playState.serial === serial;

		// Send '01' to play, '00' to stop
		const playPauseByte = isPlaying ? "00" : "01";
		await this.connection.send(
			buildCommand(COMMANDS.PLAY_PAUSE, serialHex + playPauseByte, 8),
		);

		if (isPlaying) {
			this.logger.log(`Stopping file #${serial}`);
		} else {
			this.logger.log(`Playing file #${serial}`);
		}
	}

	/**
	 * Handle edit file button click
	 */
	handleEditFile(item) {
		this.editModal.open(item);
	}

	/**
	 * Handle file drop for reordering
	 * @param {HTMLElement} draggedRow - The row being dragged
	 * @param {HTMLElement} targetRow - The row being dropped onto
	 */
	async handleFileDrop(draggedRow, targetRow) {
		if (!this.connection.isConnected()) {
			this.logger.log("Not connected", LOG_CLASSES.WARNING);
			return;
		}

		const tbody = draggedRow.parentElement;
		const rows = Array.from(tbody.querySelectorAll("tr.draggable-row"));
		const draggedIndex = rows.indexOf(draggedRow);
		const targetIndex = rows.indexOf(targetRow);

		if (draggedIndex === targetIndex) return;

		// Reorder rows in DOM
		if (draggedIndex < targetIndex) {
			targetRow.parentNode.insertBefore(draggedRow, targetRow.nextSibling);
		} else {
			targetRow.parentNode.insertBefore(draggedRow, targetRow);
		}

		// Collect new order from DOM
		const enabledSerials = Array.from(
			tbody.querySelectorAll("tr.draggable-row"),
		).map((row) => parseInt(row.dataset.serial, 10));

		// Update state and device
		const ordersAsString = JSON.stringify(enabledSerials);
		this.state.updateDevice({ order: ordersAsString });
		this.state.notify("files"); // This will re-render the table with new numbers

		this.logger.log(
			`Reordered files: ${enabledSerials.length} files`,
			LOG_CLASSES.INFO,
		);
		await this.fileManager.updateFileOrder(enabledSerials);
	}

	/**
	 * Handle file enable/disable toggle
	 * Collects all checked files in display order and updates device
	 */
	async handleFileEnableToggle() {
		// Collect all checked checkboxes in DOM order (which reflects sort order)
		const checkboxes = Array.from(
			document.querySelectorAll(".file-enabled-checkbox"),
		);
		const enabledSerials = checkboxes
			.filter((cb) => cb.checked)
			.map((cb) => parseInt(cb.dataset.serial, 10));

		if (enabledSerials.length === 0) {
			this.logger.log("At least one file must be enabled", LOG_CLASSES.WARNING);
			// Find first checkbox and re-check it
			if (checkboxes.length > 0) {
				checkboxes[0].checked = true;
			}
			return;
		}

		// Immediately update order in state to trigger UI resort
		const ordersAsString = JSON.stringify(enabledSerials);
		this.state.updateDevice({ order: ordersAsString });
		this.state.notify("files");

		this.logger.log(
			`Updating file order: ${enabledSerials.length} files enabled`,
			LOG_CLASSES.INFO,
		);
		await this.fileManager.updateFileOrder(enabledSerials);
	}

	/**
	 * Handle play/pause message from device
	 */
	handlePlayPauseMessage(serial, playing, duration) {
		if (playing) {
			// Start playing
			this.playState.serial = serial;
			this.playState.playing = true;
			this.playState.duration = duration;
			this.playState.startTime = Date.now();

			// Start countdown timer
			this.startPlayTimer(serial);
		} else {
			// Stop playing
			this.stopPlayTimer();
			this.playState.serial = null;
			this.playState.playing = false;
			this.playState.duration = 0;
			this.playState.startTime = null;
		}

		// Update the file table to reflect play state
		this.updateFilesTable();
	}

	/**
	 * Start countdown timer for playing file
	 */
	startPlayTimer(serial) {
		// Clear any existing timer
		this.stopPlayTimer();

		// Update timer every second
		this.playState.timerInterval = setInterval(() => {
			const elapsed = Math.floor(
				(Date.now() - this.playState.startTime) / 1000,
			);
			const remaining = Math.max(0, this.playState.duration - elapsed);

			// Update the timer display
			this.updatePlayTimer(serial, remaining);

			// Stop timer when done
			if (remaining <= 0) {
				this.stopPlayTimer();
			}
		}, 1000);

		// Initial update
		this.updatePlayTimer(serial, this.playState.duration);
	}

	/**
	 * Stop countdown timer
	 */
	stopPlayTimer() {
		if (this.playState.timerInterval) {
			clearInterval(this.playState.timerInterval);
			this.playState.timerInterval = null;
		}
	}

	/**
	 * Update play timer display for a specific file
	 */
	updatePlayTimer(serial, seconds) {
		const btn = document.querySelector(
			`button[data-action="stop"][data-serial="${serial}"]`,
		);
		if (btn) {
			const mins = Math.floor(seconds / 60);
			const secs = seconds % 60;
			const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
			btn.textContent = `⏹ Stop (${timeStr})`;
		}
	}

	/**
	 * Save log contents to file
	 */
	saveLog() {
		const logEl = $("#log");
		if (!logEl) return;

		// Get all log lines and filter out hidden ones
		const lines = logEl.querySelectorAll(".line");
		const logContent = Array.from(lines)
			.filter((line) => line.style.display !== "none")
			.map((line) => line.textContent)
			.join("\n");

		if (!logContent.trim()) {
			this.logger.log("Log is empty - nothing to save", LOG_CLASSES.WARNING);
			return;
		}

		// Create filename with timestamp
		const now = new Date();
		const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
		const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-"); // HH-MM-SS
		const filename = `UltraSkelly-${dateStr}-${timeStr}.log`;

		// Create blob and download
		const blob = new Blob([logContent], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);

		this.logger.log(`Log saved to ${filename}`, LOG_CLASSES.INFO);
	}

	/**
	 * Handle connect button - show connection modal
	 */
	async handleConnect() {
		const connectModal = $("#connectModal");
		connectModal?.classList.remove("hidden");
	}

	/**
	 * Perform actual connection with filter
	 */
	async performConnection(options) {
		try {
			const connectionOptions = {
				type: options.connectionType || ConnectionType.DIRECT_BLE,
				nameFilter: options.nameFilter || options.deviceAddress || "",
				restUrl: options.restUrl || "",
			};

			await this.connection.connect(connectionOptions);

			// Auto-detect device type from BLE name and apply matching profile
			const connectedName = this.state.device.name || "";
			const detectedType = this.detectDeviceTypeFromName(connectedName);
			if (detectedType && detectedType !== this.state.deviceType) {
				this.logger.log(
					`Auto-detected device type: ${DEVICE_PROFILES[detectedType].uiName} (from "${connectedName}")`,
					LOG_CLASSES.WARNING,
				);
				localStorage.setItem(STORAGE_KEYS.DEVICE_TYPE, detectedType);
				this.state.setDeviceType(detectedType);
				this.applyDeviceProfile(detectedType);
			}

			// Query device state in sequence: live mode, params, volume, BT name, version
			await this.connection.send(buildCommand(COMMANDS.QUERY_LIVE, "", 8));
			setTimeout(
				() => this.connection.send(buildCommand(COMMANDS.QUERY_PARAMS, "", 8)),
				50,
			);
			setTimeout(
				() => this.connection.send(buildCommand(COMMANDS.QUERY_VOLUME, "", 8)),
				100,
			);
			setTimeout(
				() => this.connection.send(buildCommand(COMMANDS.QUERY_BT_NAME, "", 8)),
				150,
			);
			setTimeout(
				() => this.connection.send(buildCommand(COMMANDS.QUERY_VERSION, "", 8)),
				200,
			);

			// Start file list fetch - this will query capacity and order after files are received
			setTimeout(() => {
				this.fileManager.startFetchFiles();
			}, 250);
		} catch (error) {
			console.error("Connection error:", error);
			this.logger.log(
				`Connection failed: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
		}
	}

	/**
	 * Detect device type from a BLE device name by matching against the profiles' bleNames.
	 * Returns the matching DEVICE_TYPES key, or null if no profile matches.
	 * @param {string} deviceName
	 * @returns {string|null}
	 */
	detectDeviceTypeFromName(deviceName) {
		if (!deviceName) return null;
		const lower = deviceName.toLowerCase();
		// The first profile with a name the device's name contains
		for (const [type, profile] of Object.entries(DEVICE_PROFILES)) {
			if (profile.bleNames.some((name) => lower.includes(name.toLowerCase()))) {
				return type;
			}
		}
		return null;
	}

	/**
	 * Handle disconnect button
	 */
	async handleDisconnect() {
		await this.connection.disconnect();
	}

	/**
	 * Build live eye grid
	 */
	buildLiveEyeGrid() {
		const grid = $("#apEyeGrid");
		if (!grid) return;

		grid.innerHTML = "";

		// Create eye options for images 1..eyeIconCount of the active profile
		const eyeCount = DEVICE_PROFILES[this.state.deviceType]?.eyeIconCount || 0;
		for (let imgIdx = 1; imgIdx <= eyeCount; imgIdx++) {
			const eyeNum = imgIdx;
			const div = document.createElement("div");
			div.className = `eye-opt${eyeNum === this.selectedEye ? " selected" : ""}`;
			div.dataset.eye = String(eyeNum);
			div.title = `Eye ${eyeNum}`;

			// Create image element
			const img = document.createElement("img");
			img.className = "eye-thumb";
			img.src = getEyeIconPath(this.state.deviceType, imgIdx);
			img.alt = `eye ${eyeNum}`;

			div.appendChild(img);
			grid.appendChild(div);
		}
	}

	/**
	 * Update device UI
	 */
	updateDeviceUI(device) {
		// The firmware version decides whether scenes exist
		if (!device.connected) {
			this.liveCustomColors = null;
			this.shownPin = null;
			this.shownBtName = null;
		} else {
			this.showReportedSceneColors();
		}
		this.updateScenePicker();

		// Update status
		const statusSpan = $("#status span");
		if (statusSpan) {
			if (device.connected) {
				// Get connection info directly from connection manager
				const deviceInfo = this.connection.getDeviceInfo();

				// Show REST URL if connected via REST proxy
				if (
					deviceInfo &&
					deviceInfo.connectionType === ConnectionType.REST_PROXY &&
					deviceInfo.restUrl
				) {
					statusSpan.textContent = `Connected (via ${deviceInfo.restUrl})`;
				} else {
					statusSpan.textContent = "Connected";
				}
			} else {
				statusSpan.textContent = "Disconnected";
			}
		}

		document.body.classList.toggle("disconnected", !device.connected);

		const btnDisconnect = $("#btnDisconnect");
		if (btnDisconnect) {
			btnDisconnect.disabled = !device.connected;
		}

		const btnConnect = $("#btnConnect");
		if (btnConnect) {
			btnConnect.disabled = device.connected;
		}

		// Update device info
		if ($("#statName")) $("#statName").textContent = device.name || "—";
		if ($("#statVersion"))
			$("#statVersion").textContent = device.version ?? "—";
		if ($("#statShowMode"))
			$("#statShowMode").textContent = device.showMode ?? "—";
		if ($("#statChannels")) {
			$("#statChannels").textContent = device.channels.length
				? device.channels.join(", ")
				: "—";
		}
		if ($("#statBtName")) $("#statBtName").textContent = device.btName || "—";

		// Show warning if the detected firmware version hasn't been tested with this app
		if (device.version && device.version !== this._warnedFwVersion) {
			this._warnedFwVersion = device.version;
			if (!KNOWN_FIRMWARE[this.state.deviceType]?.[device.version]) {
				const el = $("#fwWarningVersion");
				if (el) el.textContent = `${device.version} (${this.state.deviceType})`;
				$("#fwWarningModal")?.classList.remove("hidden");
			}
		}
		if (device.volume != null) {
			const volRange = $("#volRange");
			const volNum = $("#vol");
			if (volRange) volRange.value = device.volume;
			if (volNum) volNum.value = device.volume;
		}

		if ($("#statCapacity")) {
			$("#statCapacity").textContent =
				device.capacity != null ? `${device.capacity} KB remaining` : "—";
		}

		if ($("#statFileCount")) {
			const reported = device.filesReported ?? "—";
			const received = device.filesReceived ?? "—";
			const mismatch =
				device.filesReported != null &&
				device.filesReceived != null &&
				device.filesReported !== device.filesReceived;

			$("#statFileCount").textContent = `${received} / ${reported}`;

			// Add warning styling if counts don't match
			if (mismatch) {
				$("#statFileCount").style.color = "var(--warn)";
				$("#statFileCount").title =
					"Received count differs from reported count";
			} else {
				$("#statFileCount").style.color = "";
				$("#statFileCount").title = "";
			}
		}

		if ($("#statOrder")) {
			$("#statOrder").textContent = device.order || "—";
		}

		if ($("#statPin")) {
			$("#statPin").textContent = device.pin || "—";
		}

		// Fill the PIN and name inputs only when the device reports a new
		// value, so other device updates don't overwrite what is being typed
		if ($("#pinInput") && device.pin && device.pin !== this.shownPin) {
			$("#pinInput").value = device.pin;
			this.shownPin = device.pin;
		}

		// Device name without the "(Live)" suffix
		if (
			$("#deviceNameInput") &&
			device.btName &&
			device.btName !== this.shownBtName
		) {
			const displayName = device.btName.replace(/\s*\(Live\)\s*$/i, "");
			$("#deviceNameInput").value = displayName;
			this.shownBtName = device.btName;
		}
	}

	/**
	 * Update live status UI
	 */
	updateLiveUI(live) {
		// Update movement icons based on action bitfield
		if (live.action != null) {
			const actionBits = parseInt(live.action, 10);
			const liveMove = $("#liveMove");

			if (liveMove && !Number.isNaN(actionBits)) {
				liveMove.querySelectorAll(".iconToggle").forEach((btn) => {
					btn.classList.remove("selected");
				});

				if (actionBits === 255) {
					liveMove
						.querySelector('[data-part="all"]')
						?.classList.add("selected");
				} else {
					liveMove
						.querySelectorAll('[data-part]:not([data-part="all"])')
						.forEach((btn) => {
							const bit = parseInt(btn.dataset.bit || "0", 10);
							if (bit && actionBits & bit) btn.classList.add("selected");
						});
				}
			}
		}

		// Update eye icon selection
		if (live.eye != null) {
			this.selectedEye = live.eye;
			const apEyeGrid = $("#apEyeGrid");
			if (apEyeGrid) {
				// Clear all selections
				apEyeGrid.querySelectorAll(".eye-opt").forEach((el) => {
					el.classList.remove("selected");
				});
				// Select the current eye
				const eyeOpt = apEyeGrid.querySelector(`[data-eye="${live.eye}"]`);
				if (eyeOpt) eyeOpt.classList.add("selected");
			}
		}

		// Update light settings from live.lights array
		if (live.lights && Array.isArray(live.lights)) {
			// Light 1 (index 1)
			if (live.lights[1]) {
				const light1 = live.lights[1];

				// Brightness
				if ($("#light1Brightness"))
					$("#light1Brightness").value = light1.brightness;
				if ($("#light1BrightnessRange"))
					$("#light1BrightnessRange").value = light1.brightness;

				// Color (RGB)
				if ($("#light1R")) $("#light1R").value = light1.r;
				if ($("#light1G")) $("#light1G").value = light1.g;
				if ($("#light1B")) $("#light1B").value = light1.b;
				const light1Hex = `#${light1.r.toString(16).padStart(2, "0")}${light1.g.toString(16).padStart(2, "0")}${light1.b.toString(16).padStart(2, "0")}`;
				if ($("#light1ColorPick")) $("#light1ColorPick").value = light1Hex;

				// Color cycle state
				this.light1ColorCycleEnabled = light1.colorCycle === 1;
				const light1CycleBtn = $("#btnLight1ColorCycle");
				if (light1CycleBtn) {
					if (this.light1ColorCycleEnabled) {
						light1CycleBtn.classList.add("selected");
					} else {
						light1CycleBtn.classList.remove("selected");
					}
				}

				// Effect mode
				if ($("#light1EffectMode"))
					$("#light1EffectMode").value = light1.effectMode;

				// Effect speed (show/hide speed block based on mode)
				const light1EffectSpeedBlock = $("#light1EffectSpeedBlock");
				if (light1EffectSpeedBlock) {
					light1EffectSpeedBlock.classList.toggle(
						"hidden",
						light1.effectMode === 1,
					);
				}
				const light1UISpeed = deviceSpeedToUI(light1.effectSpeed);
				if ($("#light1EffectSpeed"))
					$("#light1EffectSpeed").value = light1UISpeed;
				if ($("#light1EffectSpeedRange"))
					$("#light1EffectSpeedRange").value = light1UISpeed;
			}

			// Light 0 (index 0)
			if (live.lights[0]) {
				const light0 = live.lights[0];

				// Brightness
				if ($("#light0Brightness"))
					$("#light0Brightness").value = light0.brightness;
				if ($("#light0BrightnessRange"))
					$("#light0BrightnessRange").value = light0.brightness;

				// Color (RGB)
				if ($("#light0R")) $("#light0R").value = light0.r;
				if ($("#light0G")) $("#light0G").value = light0.g;
				if ($("#light0B")) $("#light0B").value = light0.b;
				const light0Hex = `#${light0.r.toString(16).padStart(2, "0")}${light0.g.toString(16).padStart(2, "0")}${light0.b.toString(16).padStart(2, "0")}`;
				if ($("#light0ColorPick")) $("#light0ColorPick").value = light0Hex;

				// Color cycle state
				this.light0ColorCycleEnabled = light0.colorCycle === 1;
				const light0CycleBtn = $("#btnLight0ColorCycle");
				if (light0CycleBtn) {
					if (this.light0ColorCycleEnabled) {
						light0CycleBtn.classList.add("selected");
					} else {
						light0CycleBtn.classList.remove("selected");
					}
				}

				// Effect mode
				if ($("#light0EffectMode"))
					$("#light0EffectMode").value = light0.effectMode;

				// Effect speed (show/hide speed block based on mode)
				const light0EffectSpeedBlock = $("#light0EffectSpeedBlock");
				if (light0EffectSpeedBlock) {
					light0EffectSpeedBlock.classList.toggle(
						"hidden",
						light0.effectMode === 1,
					);
				}
				const light0UISpeed = deviceSpeedToUI(light0.effectSpeed);
				if ($("#light0EffectSpeed"))
					$("#light0EffectSpeed").value = light0UISpeed;
				if ($("#light0EffectSpeedRange"))
					$("#light0EffectSpeedRange").value = light0UISpeed;
			}
		}

		this.showReportedSceneColors();
		this.updateScenePicker();
	}

	/**
	 * Update files table
	 */
	updateFilesTable() {
		const tbody = $("#filesTable tbody");
		if (!tbody) return;

		// Disable table during active fetch
		const table = $("#filesTable");
		const tableWrap = $("#filesTableWrap");
		const spinnerWrap = $("#filesSpinnerWrap");
		const isRefreshing = this.state.files.activeFetch;
		const hasItems = this.state.files.items.size > 0;

		// Show centered spinner only when fetching with no items yet
		if (spinnerWrap)
			spinnerWrap.classList.toggle("hidden", !(isRefreshing && !hasItems));
		if (tableWrap)
			tableWrap.classList.toggle("hidden", isRefreshing && !hasItems);

		// Fade table while re-fetching over existing items
		if (table) {
			table.style.opacity = isRefreshing && hasItems ? "0.5" : "1";
			table.style.pointerEvents = isRefreshing ? "none" : "auto";
		}

		tbody.innerHTML = "";

		// Nothing to render while initial fetch is in progress
		if (isRefreshing && !hasItems) return;

		const query = ($("#filesFilter")?.value || "").toLowerCase().trim();

		// Get file order from device state
		let fileOrder = [];
		try {
			if (this.state.device.order) {
				fileOrder = JSON.parse(this.state.device.order);
			}
		} catch (_e) {
			// If parsing fails, use empty array
		}

		// Sort files: enabled (in order) first by order position, disabled (not in order) last by serial
		const files = Array.from(this.state.files.items.values())
			.filter(
				(file) => !query || (file.name || "").toLowerCase().includes(query),
			)
			.sort((a, b) => {
				const indexA = fileOrder.indexOf(a.serial);
				const indexB = fileOrder.indexOf(b.serial);
				const inOrderA = indexA !== -1;
				const inOrderB = indexB !== -1;

				// Both enabled: sort by order position
				if (inOrderA && inOrderB) return indexA - indexB;
				// Only A enabled: A comes first
				if (inOrderA) return -1;
				// Only B enabled: B comes first
				if (inOrderB) return 1;
				// Both disabled: sort by serial
				return a.serial - b.serial;
			});

		let rowIndex = 1;
		for (const file of files) {
			const tr = document.createElement("tr");
			const eyeImgIdx = file.eye || 0;
			const eyeImgPath = getEyeIconPath(this.state.deviceType, eyeImgIdx);

			// Generate Light 1 color indicator (lights[1])
			let light1ColorHtml = "";
			if (file.lights?.[1]) {
				const light1 = file.lights[1];
				if (light1.colorCycle) {
					light1ColorHtml =
						'<img src="images/icon_light_cycle_no.png" alt="Cycle" title="Color cycle enabled" style="width:24px;height:24px" />';
				} else {
					const rgb = `rgb(${light1.r}, ${light1.g}, ${light1.b})`;
					light1ColorHtml = `<div style="width:24px;height:24px;border-radius:50%;background-color:${rgb};border:1px solid #444" title="RGB(${light1.r},${light1.g},${light1.b})"></div>`;
				}
			}

			// Generate Light 0 color indicator (lights[0])
			let light0ColorHtml = "";
			if (file.lights?.[0]) {
				const light0 = file.lights[0];
				if (light0.colorCycle) {
					light0ColorHtml =
						'<img src="images/icon_light_cycle_no.png" alt="Cycle" title="Color cycle enabled" style="width:24px;height:24px" />';
				} else {
					const rgb = `rgb(${light0.r}, ${light0.g}, ${light0.b})`;
					light0ColorHtml = `<div style="width:24px;height:24px;border-radius:50%;background-color:${rgb};border:1px solid #444" title="RGB(${light0.r},${light0.g},${light0.b})"></div>`;
				}
			}

			// Generate movement icons based on action bitfield using current profile
			let movementIcons = "";
			const actionBits = file.action || 0;
			const profile =
				DEVICE_PROFILES[this.state.deviceType] ||
				DEVICE_PROFILES[DEVICE_TYPES.SKELLY];
			if (actionBits === 255) {
				const allMove = profile.movements.find((m) => m.part === "all");
				if (allMove) {
					movementIcons = `<img class="eye-thumb" src="${allMove.icon}" alt="All" title="All movements" />`;
				}
			} else {
				profile.movements
					.filter((m) => m.part !== "all")
					.forEach((m) => {
						if (actionBits & m.bit) {
							movementIcons += `<img class="eye-thumb" src="${m.icon}" alt="${m.label}" title="${m.label}" />`;
						}
					});
			}

			// Determine if this file is currently playing
			const isPlaying =
				this.playState.playing && this.playState.serial === file.serial;
			const playButtonHtml = isPlaying
				? `<button class="btn sm" data-action="stop" data-serial="${file.serial}">⏹ Stop</button>`
				: `<button class="btn sm" data-action="play" data-serial="${file.serial}">▶ Play</button>`;

			// Check if file is in the order array (enabled)
			const isEnabled = fileOrder.indexOf(file.serial) !== -1;

			// Make row draggable if enabled
			if (isEnabled) {
				tr.draggable = true;
				tr.dataset.serial = file.serial;
				tr.classList.add("draggable-row");
			}

			const dragHandle = isEnabled
				? '<span class="drag-handle" style="cursor:move;user-select:none;font-size:18px;color:#888;">≡</span>'
				: "";

			tr.innerHTML = `
        <td style="text-align:center;padding:4px 8px;">${dragHandle}</td>
        <td>${rowIndex}</td>
        <td style="text-align:center"><input type="checkbox" class="file-enabled-checkbox" data-serial="${file.serial}" ${isEnabled ? "checked" : ""} /></td>
        <td>${escapeHtml(file.name || "")}</td>
        <td class="col-light1">${light1ColorHtml}</td>
        <td>${light0ColorHtml}</td>
        <td>${movementIcons}</td>
        <td class="col-eye">${eyeImgIdx ? `${eyeImgPath ? `<img class="eye-thumb" src="${eyeImgPath}" alt="eye ${eyeImgIdx}" />` : ""}${eyeImgIdx}` : "—"}</td>
        <td class="detail-column">${file.serial}</td>
        <td class="detail-column">${file.db}</td>
        <td class="detail-column">${file.cluster}</td>
        <td>
          ${playButtonHtml}
          <button class="btn sm" data-action="edit" data-serial="${file.serial}">✏️ Edit</button>
        </td>
      `;
			tbody.appendChild(tr);
			rowIndex++;
		}

		const summary = $("#filesSummary");
		const lastRefreshEl = $("#filesLastRefresh");

		if (summary) {
			const got = files.length;
			const expected = this.state.files.expected;
			summary.textContent = `Received ${got}${expected ? ` / ${expected}` : ""}`;
		}

		if (lastRefreshEl) {
			const lastRefresh = this.state.files.lastRefresh;
			if (lastRefresh) {
				const timeStr = lastRefresh.toLocaleTimeString();
				lastRefreshEl.textContent = `Last refresh: ${timeStr}`;
			} else {
				lastRefreshEl.textContent = "";
			}
		}

		// Apply detail column visibility based on advanced settings
		const advFileDetails = $("#advFileDetails");
		const showDetails = advFileDetails?.checked;
		document.querySelectorAll(".detail-column").forEach((col) => {
			col.style.display = showDetails ? "" : "none";
		});
	}
}

// Initialize application when DOM is ready
// Note: ES6 modules are deferred by default, so DOM is already loaded
function initializeApp() {
	// Check if critical elements exist
	const btnConnect = document.querySelector("#btnConnect");

	if (!btnConnect) {
		console.error("Critical UI elements missing! Cannot initialize.");
		return;
	}

	window.skellyApp = new SkellyApp();
}

// ES6 modules are deferred, so DOM is usually ready
// But check to be safe
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeApp);
} else {
	// DOM already loaded
	initializeApp();
}

})();
