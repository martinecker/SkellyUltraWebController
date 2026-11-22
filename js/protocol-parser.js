/**
 * Protocol Parser
 * Parses incoming BLE notifications and updates application state
 */

import { LOG_CLASSES, PROTOCOL_MARKERS, RESPONSES } from "./constants.js";
import { decodeUtf16le, getAsciiFromHex, hexToBytes } from "./protocol.js";

/**
 * Parse the light block of BBE1 and BBD0: 6 channels of 7 bytes (mode,
 * brightness, r, g, b, color cycle, speed). A cut-off channel is skipped.
 * @param {string} lightHex - 84 hex chars
 * @returns {Object[]} One light object per complete channel
 */
export function parseLights(lightHex) {
	const lights = [];
	for (let i = 0; i < 6; i++) {
		const ch = lightHex.slice(i * 14, (i + 1) * 14);
		if (ch.length < 14) continue;
		const byte = (at) => parseInt(ch.slice(at * 2, at * 2 + 2), 16);
		lights.push({
			effectMode: byte(0),
			brightness: byte(1),
			r: byte(2),
			g: byte(3),
			b: byte(4),
			colorCycle: byte(5),
			effectSpeed: byte(6),
		});
	}
	return lights;
}

/**
 * Protocol Response Parser
 */
export class ProtocolParser {
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
		if (hex.startsWith(RESPONSES.KEEP_ALIVE)) {
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
		if (hex.startsWith(RESPONSES.LIVE_MODE)) {
			this.parseLiveStatus(hex);
			return;
		}

		// Volume (BBE5)
		if (hex.startsWith(RESPONSES.VOLUME)) {
			this.parseVolume(hex);
			return;
		}

		// BT name (BBE6)
		if (hex.startsWith(RESPONSES.LIVE_NAME)) {
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
		if (hex.startsWith(RESPONSES.FILE_ORDER)) {
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
		if (hex.startsWith(RESPONSES.START_TRANSFER)) {
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

		if (hex.startsWith(RESPONSES.TRANSFER_CONFIRM)) {
			this.parseConfirmTransferAck(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.TRANSFER_CANCEL)) {
			this.parseCancelAck(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.RESUME_WRITE)) {
			this.parseResumeAck(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.PLAYBACK)) {
			this.parsePlayAck(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.DELETE_FILE)) {
			this.parseDeleteAck(hex);
			return;
		}

		if (hex.startsWith(RESPONSES.FORMAT)) {
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
			pinCode: pin,
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
		const lights = parseLights(hex.slice(6, 90));

		const eyeIcon = parseInt(hex.slice(90, 92), 16);
		// Scene firmware adds the live LIGHT_SCENES value after the eye icon; null: no scenes.
		const scene = hex.length > 94 ? parseInt(hex.slice(92, 94), 16) : null;

		this.state.updateLive({
			action,
			eyeIcon,
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
		this.state.updateDevice({ liveName: btName });
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
			capacityKb: capacityKB,
			fileCount: count,
		});

		this.log(
			`Capacity ${capacityKB}KB remaining, fileCount=${count}, mode=${mode}`,
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

		this.state.updateDevice({ order: orders });
		this.log(`File Order by Serial: ${JSON.stringify(orders)}`);

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

		const lights = parseLights(hex.slice(26, 110));

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
			totalFiles: total,
			action,
			lights,
			eyeIcon,
			dbPos,
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
