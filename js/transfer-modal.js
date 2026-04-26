/**
 * Transfer Modal Manager
 * Handles the file transfer modal functionality
 */

import { LOG_CLASSES, STORAGE_KEYS } from "./constants.js";
import { ElevenLabsClient } from "./elevenlabs.js";

/**
 * Simple UI Helper
 */
const $ = (selector) => document.querySelector(selector);

/**
 * Transfer Modal Manager Class
 */
export class TransferModalManager {
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

		const slug =
			text
				.slice(0, 30)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "_")
				.replace(/^_|_$/g, "") || "tts";
		const suggestedName = `${slug}.mp3`;

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

		// Escape key closes transfer modal (higher priority than edit modal handler)
		document.addEventListener("keydown", (e) => {
			if (
				e.key === "Escape" &&
				!this.modal?.classList.contains("hidden") &&
				!this.state.transfer.inProgress
			) {
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

			// Pre-fill filename if empty
			if (!$("#fileName")?.value) {
				$("#fileName").value = file.name;
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

			const slug =
				text
					.slice(0, 30)
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "_")
					.replace(/^_|_$/g, "") || "tts";
			const rawName = `${slug}.mp3`;

			if ($("#chkConvert")?.checked) {
				const kbps = $("#chkBitrateOverride")?.checked
					? parseInt($("#mp3Kbps")?.value || "32", 10)
					: 32;
				this.log(`Converting ElevenLabs audio to 8 kHz mono (${kbps} kbps)…`);
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
					this.log(`Converting to MP3 8 kHz mono (${kbps} kbps) before send…`);
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

		try {
			await this.fileManager.uploadFile(
				fileBytes,
				finalName,
				chunkSizeOverride,
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
