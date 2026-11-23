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
// displayName, imageFolder, lights (label + channel number) and lightModes
// (labels for modes 1, 2, 3) are named as in the HA integration's profiles.
// Images are in images/<imageFolder>/: eye_icon_<1..eyeIcons.length>.png and
// movement_<part>.png.
export const DEVICE_PROFILES = {
	[DEVICE_TYPES.SKELLY]: {
		// "Animated Skelly" is the older (v66) firmware's name
		bleNames: ["Ultra Skelly v2", "Animated Skelly"],
		nameMatches: ["animated skelly", "ultra skelly"],
		displayName: "Ultra Skelly",
		hasEyeImage: true,
		// Eye icon names in device order (eye 1 first), as in the HA integration
		eyeIcons: [
			"Blue Eyeball",
			"Yellow Eyeball",
			"Green Eyeball",
			"Orange Eyeball",
			"Red Eyeball",
			"Gray Eyeball",
			"Yellow Dragon",
			"Red Dragon",
			"Color Spiral",
			"Fire",
			"Star",
			"Crossbones",
			"Fireworks",
			"USA Flag",
			"Heart",
			"Shamrock",
			"Snowflake",
			"Confetti",
		],
		imageFolder: "skelly",
		movements: [
			{
				part: "all",
				label: "All",
				bit: 255,
			},
			{
				part: "head",
				label: "Head",
				bit: 0x01,
			},
			{
				part: "arm",
				label: "Arm",
				bit: 0x02,
			},
			{
				part: "torso",
				label: "Torso",
				bit: 0x04,
			},
		],
		lights: [
			{ label: "Torso Light", channel: 0 },
			{ label: "Head Light", channel: 1 },
		],
		lightModes: ["Static", "Strobe", "Pulse"],
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
		displayName: "12ft Skelly",
		hasEyeImage: true,
		eyeIcons: [
			"USA Flag",
			"Heart",
			"Shamrock",
			"Snowflake",
			"Ice Blue Eyeball",
			"Peppermint",
			"Cyber Eye",
			"Blue Eyeball",
			"Yellow Eyeball",
			"Green Eyeball",
			"Orange Eyeball",
			"Red Eyeball",
			"Gray Eyeball",
			"Yellow Dragon",
			"Red Dragon",
			"Color Spiral",
			"Fire",
			"Star",
			"Crossbones",
			"Fireworks",
		],
		imageFolder: "skelly12ft",
		movements: [
			{
				part: "head",
				label: "Head",
				bit: 0x02,
			},
		],
		lights: [{ label: "Torso Light", channel: 0 }],
		lightModes: ["Static", "Strobe", "Pulse"],
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
		displayName: "Lethal Lily",
		hasEyeImage: false,
		eyeIcons: [],
		imageFolder: "lily",
		movements: [
			{
				part: "all",
				label: "All",
				bit: 255,
			},
			{
				part: "wrist",
				label: "Wrist",
				bit: 0x01,
			},
			{
				part: "elbow",
				label: "Elbow",
				bit: 0x02,
			},
			{
				part: "head",
				label: "Head",
				bit: 0x10,
			},
			{
				part: "eyes",
				label: "Eyes",
				bit: 0x20,
			},
		],
		lights: [{ label: "Lantern", channel: 0 }],
		lightModes: ["Flickering", "Pulsing", "Chasing"],
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
		displayName: "Ultra Santa",
		hasEyeImage: false,
		eyeIcons: [],
		imageFolder: "santa",
		movements: [
			{
				part: "all",
				label: "All",
				bit: 255,
			},
			{
				part: "eyes",
				label: "Eyes",
				bit: 0x01,
			},
			{
				part: "head",
				label: "Head",
				bit: 0x02,
			},
			{
				part: "torso",
				label: "Torso",
				bit: 0x04,
			},
			{
				part: "arm",
				label: "Arm",
				bit: 0x08,
			},
		],
		lights: [{ label: "Lantern", channel: 0 }],
		lightModes: ["Static", "Sparkle", "Pulsing"],
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
 * A device type read back from storage, or Ultra Skelly if it isn't one
 * (missing, stale or edited by hand), so the page always has a profile.
 * @param {string|null} value
 * @returns {string} a DEVICE_TYPES value
 */
export function knownDeviceType(value) {
	return Object.hasOwn(DEVICE_PROFILES, value ?? "")
		? value
		: DEVICE_TYPES.SKELLY;
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
		.map(({ label, channel }) => ({ label, channel }))
		.reverse();
}

// Image path for a 1-based eye icon index, or null if the device type has no eye image with that index.
export function getEyeIconPath(deviceType, eyeIdx) {
	const profile = DEVICE_PROFILES[deviceType];
	if (!profile?.eyeIcons?.[eyeIdx - 1]) {
		return null;
	}
	return `images/${profile.imageFolder}/eye_icon_${eyeIdx}.png`;
}

/**
 * Label for a 1-based eye icon index: its number and name ("7 Yellow
 * Dragon"), or "Eye 7" if the device type has no name for it
 */
export function eyeIconLabel(deviceType, eyeIdx) {
	const name = DEVICE_PROFILES[deviceType]?.eyeIcons?.[eyeIdx - 1];
	return name ? `${eyeIdx} ${name}` : `Eye ${eyeIdx}`;
}

/**
 * Image path for a movement part's icon
 * @param {Object} profile - DEVICE_PROFILES entry
 * @param {string} part - a movements[].part, e.g. "head" or "all"
 */
export function movementIconPath(profile, part) {
	return `images/${profile.imageFolder}/movement_${part}.png`;
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
	ORDER_QUERY: 2000, // Ask for the play order (D1) before an upload
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
	START_SEND_DATA: "AAC0", // size u32, chunk count u16, bare name -> BBC0
	SEND_DATA_CHUNK: "AAC1", // index u16, data (the app sends MTU - 8) -> BBC1
	END_SEND_DATA: "AAC2", // 00 -> BBC2
	CONFIRM_FILE: "AAC3", // bare name -> BBC3
	CANCEL_SEND: "AAC4", // 00 -> BBC4
	RESUME_SEND: "AAC5", // payload unknown; the app never sends it
	PLAY_STOP_FILE: "AAC6", // serial u16, 01 play / 00 stop -> BBC6
	DELETE_FILE: "AAC7", // serial u16, cluster u32 -> BBC7
	FORMAT_DEVICE: "AAC8", // 00 -> BBC8; erases every file
	SET_FILE_ORDER: "AAC9", // total, position (1-based), serial u16, name

	// Device Queries (payload 00)
	QUERY_DEVICE_PARAMS: "AAE0", // -> BBE0
	QUERY_LIVE_MODE: "AAE1", // -> BBE1
	QUERY_VOLUME: "AAE5", // -> BBE5
	QUERY_LIVE_NAME: "AAE6", // -> BBE6
	QUERY_VERSION: "AAEE", // -> BBEE
	QUERY_FILE_LIST: "AAD0", // -> one BBD0 per file
	QUERY_FILE_ORDER: "AAD1", // -> BBD1
	QUERY_CAPACITY: "AAD2", // -> BBD2

	// Various Controls
	SET_VOLUME: "AAFA", // volume (0-100)
	SET_PIN_AND_NAME: "AAFB", // PIN 4 ASCII, password 8 ASCII, len, name ASCII
	PLAY_PAUSE: "AAFC", // 01 play / 00 pause (not used here)
	ENABLE_CLASSIC_BT: "AAFD", // 01 -> BBFD; live mode audio link
	SET_MUSIC_MODE: "AAFE", // 00 device music, 01 classic BT (app no longer sends it)

	// Lighting: ch is 0-5 or FF (all); cluster 0 + empty name = live settings
	SET_ALL_LIGHTS: "AAF1", // cluster u32, audioMode, scene, 6 x 7 light bytes
	SET_LIGHT_MODE: "AAF2", // ch, mode (1 static, 2 strobe, 3 pulsing), cluster u32, name
	SET_LIGHT_BRIGHTNESS: "AAF3", // ch, brightness (0-255), cluster u32, name
	SET_LIGHT_RGB: "AAF4", // ch, R, G, B, color cycle, cluster u32, name
	SELECT_RGB_CHANNEL: "AAF5", // ch (the channel the app's picker edits)
	SET_LIGHT_SPEED: "AAF6", // ch, speed (0 fastest-254 slowest; 255 is also fastest; app uses 0-10), cluster u32, name

	// Appearance: cluster 0 + empty name = live settings
	SET_EYE_ICON: "AAF9", // icon (1-based), 00, cluster u32, name
	SET_MOVEMENT_ACTION: "AACA", // movement bits (per device), 00, cluster u32, name
	SET_JAW_DATA: "AACD", // cluster u32, byte count, bitmap (1 bit per 60 ms)

	// Wi-Fi (no known product has it)
	SET_WIFI_POWER: "AACB", // on/off
	QUERY_WIFI_MAC: "AACC", // 00 -> BBCC
};

// Response Prefixes
// Frames: BB <tag> <payload> <crc8>. Byte layouts are in PROTOCOL.md (section 7).
export const RESPONSES = {
	DEVICE_PARAMS: "BBE0", // channels, PIN, Wi-Fi password, show mode, name
	LIVE_MODE: "BBE1", // movement, 6 lights, eye icon, scene (scene firmware)
	CAPACITY: "BBD2", // free KB u32, file count, mode
	FILE_ORDER: "BBD1", // count, serials u16 in play order
	FILE_INFO: "BBD0", // one file: serial, cluster, total, settings, name
	VOLUME: "BBE5", // volume
	LIVE_NAME: "BBE6", // len, classic BT name ASCII
	VERSION: "BBEE", // firmware version, e.g. 0x44 = v68
	ENABLE_CLASSIC_BT: "BBFD", // classic BT on

	START_TRANSFER: "BBC0", // failed, written u32
	CHUNK_DROPPED: "BBC1", // lost (0 = none, 1 = resend from index), index u16
	TRANSFER_END: "BBC2", // failed, last chunk index u16
	TRANSFER_CONFIRM: "BBC3", // failed
	TRANSFER_CANCEL: "BBC4", // failed
	RESUME_WRITE: "BBC5", // written u32 (the app never uses it)
	PLAYBACK: "BBC6", // serial u16, playing, duration u16 (s); also when a file ends
	DELETE_FILE: "BBC7", // failed (0 = deleted)
	FORMAT: "BBC8", // result (0 = done)
	WIFI_MAC: "BBCC", // Wi-Fi MAC, 6 bytes

	KEEP_ALIVE: "FEDC", // FE DC <payload> EF, sent by the device on its own
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
