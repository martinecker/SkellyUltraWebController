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
import { applyFileSettings, currentLightScene } from "./device-settings.js";
import {
	buildCommand,
	buildFilenamePayload,
	chunkToHex,
	intToHex,
	parsePlayOrder,
	sleep,
} from "./protocol.js";

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

	/** Drop all buffered BBC2s */
	clearEnds() {
		this.ends.length = 0;
	}
}

/** The device's loss reports (BBC1 lost = 1) during one upload attempt */
export class LossTracker {
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
	async refreshFileList() {
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
			await this.connection.send(buildCommand(COMMANDS.QUERY_FILE_LIST, "", 8));
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
			await this.connection.send(
				buildCommand(COMMANDS.QUERY_FILE_ORDER, "", 8),
			);
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
			override >= TRANSFER_CONFIG.MIN_CHUNK_SIZE &&
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
	 * @returns {Promise<void>} Rejects without sending anything if another
	 *   transfer is running (the device takes one at a time). A failure after
	 *   the device accepted the upload sends C4 first. Failing to restore an
	 *   overwritten file's settings doesn't fail the upload.
	 */
	async sendFile(
		fileBytes,
		fileName,
		chunkSizeOverride = null,
		chunkDelayOverride = null,
	) {
		if (!this.connection.isConnected()) {
			this.log("Not connected — cannot send file.", LOG_CLASSES.WARNING);
			throw new Error("Device not connected");
		}
		if (this.state.transfer.inProgress) {
			this.log("A transfer is already running.", LOG_CLASSES.WARNING);
			throw new Error("A transfer is already running");
		}

		// If this upload overwrites an existing file, the device resets that
		// file's light/movement/eye settings to default. Capture them now so
		// they can be restored once the new upload lands.
		const existingFile = this.state.hasFileName(fileName);

		this.state.startTransfer();

		// Whether the device has an upload open (C0 accepted, not yet confirmed
		// or cancelled), so a failure can close it with C4
		const upload = { open: false };

		try {
			// A new file makes the device rewrite the play order, and it gets
			// that wrong (it drops the first entry and lists the last one twice).
			// Remember the order by name, so it can be put right afterwards.
			const previousOrderNames = existingFile
				? null
				: await this.readOrderedFileNames();

			const size = fileBytes.length;
			let chunkSize = this.getChunkSize(chunkSizeOverride); // Use dynamic chunk size based on MTU or override
			const chunkDelay = this.getChunkDelay(chunkDelayOverride);

			// Like the phone app: refuse a file the device has no room for.
			// Overwrites are checked too.
			await this.checkFreeSpace(size);

			// === Phases 1-3: Start (C0), Data Chunks (C1), End (C2) ===
			// If the device keeps losing chunks, start over with smaller ones
			for (let attempt = 1; ; attempt++) {
				if (
					await this.sendOnce(
						fileBytes,
						fileName,
						chunkSize,
						chunkDelay,
						upload,
					)
				) {
					break;
				}
				if (attempt >= TRANSFER_CONFIG.MAX_ATTEMPTS) {
					// Leave nothing open on the device
					upload.open = false;
					await this.connection.send(buildCommand(COMMANDS.CANCEL_SEND, "", 8));
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
				upload.open = false;
				await this.connection.send(buildCommand(COMMANDS.CANCEL_SEND, "", 8));
				await sleep(1000); // Give the device time to reset
				this.checkTransferGoing();
			}

			// === Phase 4: Confirm Transfer (C3) ===
			const { fullPayload: c3Payload } = buildFilenamePayload(fileName);
			const c3Response = await this.sendAndWait(
				buildCommand(COMMANDS.CONFIRM_FILE, c3Payload, 8),
				RESPONSES.TRANSFER_CONFIRM,
				TIMEOUTS.ACK,
			);
			const c3Failed = parseInt(c3Response.slice(4, 6), 16);
			if (c3Failed !== 0) {
				throw new Error("Device failed to confirm transfer");
			}
			upload.open = false;

			this.log("File transfer complete ✔", LOG_CLASSES.WARNING);

			// If this was an overwrite, restore the previous light/movement/eye
			// settings right away — the device resets them to default on upload.
			// The upload itself is done, so a failure here only gets logged.
			if (existingFile) {
				try {
					await this.restoreFileSettings(
						existingFile.cluster,
						fileName,
						existingFile,
					);
				} catch (error) {
					this.log(
						`Failed to restore the file's settings: ${error.message}`,
						LOG_CLASSES.WARNING,
					);
				}
			}

			// Refresh file list
			this.refreshFileList();

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
			// Close the upload on the device, unless Cancel already did
			if (upload.open && !this.state.transfer.cancel) {
				await this.connection
					.send(buildCommand(COMMANDS.CANCEL_SEND, "", 8))
					.catch(() => {});
			}
			throw error;
		} finally {
			this.state.endTransfer();
		}
	}

	/**
	 * Ask the device for its play order (D1) and return the enabled file names
	 * in that order. The cached order can be stale (another app or Skelly
	 * session may have changed it), so it is only used if the device doesn't
	 * answer.
	 * @returns {Promise<string[]|null>} null if no play order is known
	 */
	async readOrderedFileNames() {
		try {
			const reply = await this.sendAndWait(
				buildCommand(COMMANDS.QUERY_FILE_ORDER, "", 8),
				RESPONSES.FILE_ORDER,
				TIMEOUTS.ORDER_QUERY,
			);
			this.state.updateDevice({ order: parsePlayOrder(reply) });
		} catch (error) {
			this.log(
				`No play order from the device (${error.message}); using the last one read.`,
				LOG_CLASSES.WARNING,
			);
		}
		return this.orderedFileNames();
	}

	/**
	 * One upload attempt: C0, the chunks (C1) and C2, resending lost chunks
	 * like the phone app (see TRANSFER_CONFIG.LOSS_WAIT_MS).
	 * @param {{open: boolean}} upload - Set to open once the device accepts C0
	 * @returns {Promise<boolean>} true once BBC2 says ok; false if the device
	 *   kept losing chunks, so the caller starts over with smaller ones
	 */
	async sendOnce(fileBytes, fileName, chunkSize, chunkDelay, upload) {
		const size = fileBytes.length;
		const maxPackets = Math.ceil(size / chunkSize);
		const { fullPayload: filenamePart } = buildFilenamePayload(fileName);
		const c0Payload =
			intToHex(size, 4) + intToHex(maxPackets, 2) + filenamePart;
		const c0Response = await this.sendAndWait(
			buildCommand(COMMANDS.START_SEND_DATA, c0Payload, 8),
			RESPONSES.START_TRANSFER,
			TIMEOUTS.ACK,
		);
		if (parseInt(c0Response.slice(4, 6), 16) !== 0) {
			throw new Error("Device rejected transfer start");
		}
		upload.open = true;

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
						buildCommand(COMMANDS.END_SEND_DATA, "", 8),
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
				reports.clearEnds();
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
				buildCommand(COMMANDS.SEND_DATA_CHUNK, intToHex(index, 2) + dataHex, 0),
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
				await this.connection.send(buildCommand(COMMANDS.CANCEL_SEND, "", 8));
			} catch (error) {
				this.log(`Cancel command error: ${error.message}`, LOG_CLASSES.WARNING);
			}
		}
	}

	/**
	 * Wait until ALL named files appear in the file list state, or timeout.
	 * Used after delete to confirm the refreshed list has arrived before
	 * remapping names to their new (renumbered) serials.
	 * @param {string[]} names
	 * @param {number} timeoutMs
	 * @returns {Promise<boolean>} true if all found before timeout
	 */
	async waitForFilesByName(names, timeoutMs = TIMEOUTS.FILE_LIST) {
		const found = await this.state.waitForFiles(
			() => names.every((name) => this.state.hasFileName(name)),
			timeoutMs,
		);
		return found !== null;
	}

	/**
	 * Return the names of the enabled files, in play order
	 * @returns {string[]|null} null if the play order hasn't been read yet
	 */
	orderedFileNames() {
		const order = this.state.device?.order;
		if (!order) return null;
		return order
			.map((serial) => this.state.getFile(serial)?.name)
			.filter(Boolean);
	}

	/**
	 * Wait until a file list refresh has finished, including the play order
	 * that follows the list. Call right after refreshFileList().
	 * @param {number} timeoutMs
	 * @returns {Promise<boolean>} true if the full list and order arrived
	 */
	async waitForFileListRefresh(timeoutMs = TIMEOUTS.FILE_LIST + 2000) {
		// refreshFileList() sets activeFetch before its first await, so a false
		// here means it never started (not connected)
		const ended = await this.state.waitForFiles(
			() => !this.state.files.activeFetch,
			timeoutMs,
		);
		return ended !== null && this.state.isFileListComplete();
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
		const current = this.state.device?.order ?? [];
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
			await this.setFileOrder(wanted);
		} catch (error) {
			this.log(
				`Failed to put the play order right: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
		}
	}

	/**
	 * Wait until the named file appears in the file list state, or timeout.
	 * Used after upload to obtain the device-assigned cluster for the file.
	 * @param {string} fileName
	 * @param {number} timeoutMs
	 * @returns {Promise<Object|null>} File object or null on timeout
	 */
	async waitForFileByName(fileName, timeoutMs = TIMEOUTS.FILE_LIST) {
		return this.state.waitForFiles(
			() => this.state.hasFileName(fileName),
			timeoutMs,
		);
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
				eyeIcon: savedFile.eyeIcon ?? 1,
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
			const expectedEye = expected.eyeIcon ?? 1;
			const actualEye = actual.eyeIcon ?? 1;
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
			buildCommand(COMMANDS.DELETE_FILE, payload, 8),
			RESPONSES.DELETE_FILE,
			TIMEOUTS.ACK,
		);
		return parseInt(reply.slice(4, 6), 16) === 0;
	}

	/**
	 * Update file order on device by sending C9 commands for each enabled file
	 * @param {Array<number>} enabledSerials - Array of serial numbers in desired order
	 */
	async setFileOrder(enabledSerials) {
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

			await this.connection.send(
				buildCommand(COMMANDS.SET_FILE_ORDER, payload, 8),
			);
			this.log(
				`Set order: serial=${serial} position=${fileOrder}/${enabledCount}`,
				LOG_CLASSES.INFO,
			);

			// Give the device a moment between commands
			this.connection.pause(50);
		}

		// Query the new order from device
		this.log("Querying updated file order...", LOG_CLASSES.INFO);
		await this.connection.send(buildCommand(COMMANDS.QUERY_FILE_ORDER, "", 8));
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
