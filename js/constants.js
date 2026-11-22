/**
 * Constants and Configuration
 * Central location for all application constants, UUIDs, and configuration values
 */

// BLE Service UUIDs
export const BLE_CONFIG = {
	SERVICE_UUID: "0000ae00-0000-1000-8000-00805f9b34fb",
	WRITE_UUID: "0000ae01-0000-1000-8000-00805f9b34fb",
	NOTIFY_UUID: "0000ae02-0000-1000-8000-00805f9b34fb",
};

// Device Types
export const DEVICE_TYPES = {
	SKELLY: "skelly",
	SKELLY_12FT: "skelly12ft",
	LILY: "lily",
	SANTA: "santa",
};

// Capabilities that depend on the firmware, keys of a profile's `capabilities`.
export const CAPABILITIES = {
	// Halloween and Christmas light scene presets (F1 scene byte, BBD0/BBE1 scene byte)
	LIGHT_SCENES: "lightScenes",
	// F1: set all light channels (and the scene) with one command
	SET_ALL_LIGHTS: "setAllLights",
	// CD: per-file jaw movement data, sent after an upload
	JAW_DATA: "jawData",
};

// Device Profiles — per-device UI configuration
// bleNames: the BLE names the device advertises, the first being the default.
// Each is offered in the connect dialog's name filter.
// nameMatches: lowercase parts of a name that identify the type (a device
// whose name contains one is that type), the same as the HA integration's
// ble_names, so e.g. "Ultra Skelly" without "v2" is a Skelly too.
// Eye images are <eyeIconFolder>/eye_icon_<1..eyeIconCount>.png
export const DEVICE_PROFILES = {
	[DEVICE_TYPES.SKELLY]: {
		// "Animated Skelly" is the older (v66) firmware's name
		bleNames: ["Ultra Skelly v2", "Animated Skelly"],
		nameMatches: ["animated skelly", "ultra skelly"],
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
		// Firmware versions tried with this app; others get a warning dialog
		testedFirmware: [66, 68],
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
		nameMatches: ["12ft skelly"],
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
		testedFirmware: [14],
		capabilities: {
			[CAPABILITIES.LIGHT_SCENES]: 14,
			[CAPABILITIES.SET_ALL_LIGHTS]: 14,
			[CAPABILITIES.JAW_DATA]: 14,
		},
	},
	[DEVICE_TYPES.LILY]: {
		bleNames: ["Lethal Lily"],
		nameMatches: ["lethal lily"],
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
		testedFirmware: [24],
		capabilities: {
			[CAPABILITIES.LIGHT_SCENES]: 24,
			[CAPABILITIES.SET_ALL_LIGHTS]: 24,
			[CAPABILITIES.JAW_DATA]: 24,
		},
	},
	[DEVICE_TYPES.SANTA]: {
		bleNames: ["Ultra Santa", "Santa Claus"],
		nameMatches: ["ultra santa", "santa claus"],
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
		// No Santa firmware has been tried yet, so every version gets the warning
		testedFirmware: [],
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
export function hasCapability(deviceType, version, capability) {
	const minVersion = DEVICE_PROFILES[deviceType]?.capabilities?.[capability];
	const number = firmwareNumber(version);
	return minVersion != null && number != null && number >= minVersion;
}

/**
 * Whether this firmware version (as for hasCapability) has been tried with
 * this device type (the profile's testedFirmware).
 */
export function isTestedFirmware(deviceType, version) {
	const number = firmwareNumber(version);
	return (
		number != null &&
		(DEVICE_PROFILES[deviceType]?.testedFirmware ?? []).includes(number)
	);
}

// Firmware version "v68" or 68 as a number, or null when unknown
function firmwareNumber(version) {
	if (version == null) return null;
	const number =
		typeof version === "number"
			? version
			: Number.parseInt(String(version).replace(/^v/i, ""), 10);
	return Number.isFinite(number) ? number : null;
}

/**
 * The device type a BLE name belongs to (a DEVICE_TYPES value), or null: the
 * first profile with one of its nameMatches in the name, ignoring case.
 * @param {string} deviceName
 * @returns {string|null}
 */
export function deviceTypeFromName(deviceName) {
	if (!deviceName) return null;
	const lower = deviceName.toLowerCase();
	for (const [type, profile] of Object.entries(DEVICE_PROFILES)) {
		if (profile.nameMatches.some((match) => lower.includes(match))) {
			return type;
		}
	}
	return null;
}

/**
 * A profile's lights in the order the UI shows them, each with its channel
 * as a number: highest channel first, so the head light stays above (and in
 * the file table, left of) the torso light.
 * @param {Object} profile - DEVICE_PROFILES entry
 * @returns {Array<{label: string, channel: number}>}
 */
export function displayedLights(profile) {
	return profile.lights
		.map((light) => ({
			label: light.label,
			channel: parseInt(light.channel, 16),
		}))
		.reverse();
}

// Image path for a 1-based eye icon index, or null if the device type has no eye image with that index.
export function getEyeIconPath(deviceType, eyeIdx) {
	const profile = DEVICE_PROFILES[deviceType];
	if (!profile?.eyeIconFolder || eyeIdx < 1 || eyeIdx > profile.eyeIconCount) {
		return null;
	}
	return `${profile.eyeIconFolder}/eye_icon_${eyeIdx}.png`;
}

// LocalStorage Keys
export const STORAGE_KEYS = {
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
export const PADDING = {
	DEFAULT: 8,
};

// File Transfer Configuration
export const TRANSFER_CONFIG = {
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
export const APPLY_ALL_COMMAND_DELAY_MS = 40;

// Timeout Values (milliseconds)
export const TIMEOUTS = {
	ACK: 5000,
	FILE_TRANSFER: 240000,
	FILE_LIST: 6000,
	FILE_ORDER: 5000, // Wait for the play order (BBD1) once the file list is complete
};

// Audio Configuration
export const AUDIO_CONFIG = {
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
export const COMMANDS = {
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
export const RESPONSES = {
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
export const LOG_CLASSES = {
	NORMAL: "",
	WARNING: "warn",
	TX: "tx",
	RX: "rx",
};

// Light scene presets, in file info (BBD0), live status (BBE1) and F1
export const LIGHT_SCENES = Object.freeze({
	CUSTOM: 0, // each light channel's own settings
	HALLOWEEN: 1,
	CHRISTMAS: 2,
});

// The colors the phone app sends with a scene preset: channel 0 the first,
// all other channels the second. The device plays its own palette anyway.
export const LIGHT_SCENE_COLORS = Object.freeze({
	[LIGHT_SCENES.HALLOWEEN]: ["FD942A", "7637FD"], // orange, purple
	[LIGHT_SCENES.CHRISTMAS]: ["960100", "036400"], // red, green
});

// File name marker in protocol
export const PROTOCOL_MARKERS = {
	FILENAME: "5C55", // UTF16LE filename marker
};
