/**
 * File Manager
 * Handles file transfers, audio conversion, and file list management
 */

import {
	APPLY_ALL_COMMAND_DELAY_MS,
	AUDIO_CONFIG,
	COMMANDS,
	DEVICE_PROFILES,
	LOG_CLASSES,
	RESPONSES,
	TIMEOUTS,
	TRANSFER_CONFIG,
} from "./constants.js";
import { applyFileSettings } from "./device-settings.js";
import {
	buildCommand,
	buildFilenamePayload,
	chunkToHex,
	intToHex,
	sleep,
} from "./protocol.js";

/**
 * File Transfer and Management
 */
export class FileManager {
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

		// Send query command for files
		await this.connection.send(buildCommand(COMMANDS.QUERY_FILES, "", 8));

		// Set timeout for no response, or an incomplete list (e.g. device-reported
		// count doesn't match the entries it actually sends) — either way, stop
		// waiting so the UI doesn't spin forever.
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
	}

	/**
	 * Check if file list is complete and trigger follow-up queries
	 */
	async finalizeFilesIfDone() {
		if (!this.state.files.activeFetch || !this.state.files.expected) {
			return;
		}

		if (this.state.isFileListComplete()) {
			// Keep activeFetch true - will be cleared when order arrives
			this.state.updateFilesMetadata({ lastRefresh: new Date() });
			if (this.state.files.fetchTimer) {
				clearTimeout(this.state.files.fetchTimer);
			}

			// Update the received file count
			const filesReceived = this.state.files.items.size;
			this.state.updateDevice({ filesReceived });

			this.log("File list complete ✔", LOG_CLASSES.WARNING);

			// Send follow-up queries - order response will trigger UI update
			if (this.connection.isConnected()) {
				await this.connection.send(
					buildCommand(COMMANDS.QUERY_CAPACITY, "", 8),
				);
				await this.connection.send(buildCommand(COMMANDS.QUERY_ORDER, "", 8));
			} else {
				this.log(
					"Not connected - cannot send follow-up queries",
					LOG_CLASSES.WARNING,
				);
				this.state.updateFilesMetadata({ activeFetch: false });
			}
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
			// Calculate safe chunk size (MTU minus ATT overhead)
			const safeSize = mtu - TRANSFER_CONFIG.ATT_OVERHEAD;
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
	 * Upload file to device
	 * @param {Uint8Array} fileBytes - File data
	 * @param {string} fileName - Target filename
	 * @param {number|null} chunkSizeOverride - Optional chunk size override
	 * @returns {Promise<void>}
	 */
	async uploadFile(fileBytes, fileName, chunkSizeOverride = null) {
		if (!this.connection.isConnected()) {
			this.log("Not connected — cannot send file.", LOG_CLASSES.WARNING);
			throw new Error("Device not connected");
		}

		// If this upload overwrites an existing file, the device resets that
		// file's light/movement/eye settings to default. Capture them now so
		// they can be restored once the new upload lands.
		const existingFile = this.state.hasFileName(fileName);

		this.state.startTransfer(fileName);

		try {
			// === Phase 1: Start Transfer (C0) ===
			const size = fileBytes.length;
			const chunkSize = this.getChunkSize(chunkSizeOverride); // Use dynamic chunk size based on MTU or override
			const maxPackets = Math.ceil(size / chunkSize);
			const { fullPayload: filenamePart } = buildFilenamePayload(fileName);

			const c0Payload =
				intToHex(size, 4) + intToHex(maxPackets, 2) + filenamePart;
			await this.connection.send(
				buildCommand(COMMANDS.START_TRANSFER, c0Payload, 8),
			);

			// Wait for start acknowledgment
			const c0Response = await this.connection.waitForResponse(
				RESPONSES.TRANSFER_START,
				TIMEOUTS.ACK_LONG,
			);
			if (!c0Response) {
				throw new Error("Timeout waiting for transfer start acknowledgment");
			}

			const c0Failed = parseInt(c0Response.slice(4, 6), 16);
			const c0Written = parseInt(c0Response.slice(6, 14), 16) || 0;

			if (c0Failed !== 0) {
				throw new Error("Device rejected transfer start");
			}

			// Resume from last written position if applicable
			const startIndex = Math.floor(c0Written / chunkSize);
			if (startIndex > 0) {
				this.log(
					`Resuming at chunk ${startIndex} (written=${c0Written})`,
					LOG_CLASSES.WARNING,
				);
			}

			// === Phase 2: Send Data Chunks (C1) ===
			for (let index = startIndex; index < maxPackets; index++) {
				if (!this.connection.isConnected()) {
					throw new Error("Disconnected during transfer");
				}

				if (this.state.transfer.cancel) {
					throw new Error("Transfer cancelled");
				}

				// Handle resume request from device
				if (this.state.transfer.resumeFrom !== null) {
					index = this.state.transfer.resumeFrom;
					this.state.setResumePoint(null);
				}

				const offset = index * chunkSize;
				const dataHex = chunkToHex(fileBytes, offset, chunkSize);
				const payload = intToHex(index, 2) + dataHex;

				// Store chunk for potential resend
				this.state.storeChunk(index, payload);

				await this.connection.send(
					buildCommand(COMMANDS.CHUNK_DATA, payload, 0),
				);

				// Update progress
				if (this.onProgress) {
					this.onProgress(index + 1, maxPackets);
				}

				await sleep(TRANSFER_CONFIG.CHUNK_DELAY_MS);
			}

			// === Phase 3: End Transfer (C2) ===
			await this.connection.send(buildCommand(COMMANDS.END_TRANSFER, "", 8));

			const c2Response = await this.connection.waitForResponse(
				RESPONSES.TRANSFER_END,
				TIMEOUTS.FILE_TRANSFER,
			);

			if (!c2Response) {
				throw new Error("Timeout waiting for transfer end acknowledgment");
			}

			const c2Failed = parseInt(c2Response.slice(4, 6), 16);
			if (c2Failed !== 0) {
				// Device may request resume
				const lastIndex =
					c2Response.length >= 10 ? parseInt(c2Response.slice(6, 10), 16) : 0;
				this.state.setResumePoint(lastIndex);

				// Resend tail chunks
				let tailIndex = Math.min(
					maxPackets,
					Math.max(0, this.state.transfer.resumeFrom),
				);
				while (tailIndex < maxPackets) {
					if (this.state.transfer.cancel) {
						throw new Error("Transfer cancelled");
					}

					const payload = this.state.getChunk(tailIndex);
					if (!payload) break;

					await this.connection.send(
						buildCommand(COMMANDS.CHUNK_DATA, payload, 0),
					);
					tailIndex += 1;
					await sleep(TRANSFER_CONFIG.EDIT_CHUNK_DELAY_MS);
				}
			}

			// === Phase 4: Confirm Transfer (C3) ===
			const { fullPayload: c3Payload } = buildFilenamePayload(fileName);
			await this.connection.send(
				buildCommand(COMMANDS.CONFIRM_TRANSFER, c3Payload, 8),
			);

			const c3Response = await this.connection.waitForResponse(
				RESPONSES.CONFIRM_TRANSFER_ACK,
				TIMEOUTS.ACK,
			);
			if (!c3Response) {
				throw new Error("Timeout waiting for confirm transfer acknowledgment");
			}

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
	 * Play a file by serial number
	 * @param {number} serial - File serial number
	 * @returns {Promise<void>}
	 */
	async playFile(serial) {
		if (!this.connection.isConnected()) {
			this.log("Not connected", LOG_CLASSES.WARNING);
			return;
		}

		const payload = `${intToHex(serial, 2)}01`;
		await this.connection.send(buildCommand(COMMANDS.PLAY_PAUSE, payload, 8));
	}

	/**
	 * Delete a file
	 * @param {number} serial - File serial number
	 * @param {number} cluster - File cluster
	 * @returns {Promise<void>}
	 */
	async deleteFile(serial, cluster) {
		if (!this.connection.isConnected()) {
			this.log("Not connected", LOG_CLASSES.WARNING);
			return;
		}

		const payload = intToHex(serial, 2) + intToHex(cluster, 4);
		await this.connection.send(buildCommand(COMMANDS.DELETE, payload, 8));
		this.log(
			`Delete request (C7) serial=${serial} cluster=${cluster}`,
			LOG_CLASSES.WARNING,
		);
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
export class AudioConverter {
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
