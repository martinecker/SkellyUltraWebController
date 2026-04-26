/**
 * Edit Modal Manager
 * Handles the per-file edit modal functionality
 */

import { COMMANDS, LOG_CLASSES } from "./constants.js";
import {
	buildCommand,
	buildFilenamePayload,
	clamp,
	deviceSpeedToUI,
	uiSpeedToDevice,
} from "./protocol.js";

/**
 * Simple UI Helper
 */
const $ = (selector) => document.querySelector(selector);

/**
 * Edit Modal Manager Class
 */
export class EditModalManager {
	constructor(bleManager, stateManager, fileManager, audioConverter, logger) {
		this.connection = bleManager;
		this.state = stateManager;
		this.fileManager = fileManager;
		this.audioConverter = audioConverter;
		this.mainLogger = logger;

		// Current edit state
		this.currentFile = {
			serial: null,
			cluster: 0,
			name: "",
			eye: 1,
		};

		// Delete state
		this.deletePending = false;
		this.deleteResolve = null;

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
		this.progText = $("#edProgText");
		this.progPct = $("#edProgPct");
		this.progBar = $("#edProgBar");

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
	 * Update edit modal progress bar
	 */
	setProgress(current, total) {
		const pct = total ? Math.round((current / total) * 100) : 0;
		if (this.progText) this.progText.textContent = `${current} / ${total}`;
		if (this.progPct) this.progPct.textContent = `${pct}%`;
		if (this.progBar) this.progBar.style.width = `${pct}%`;
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
				(e) => (edLight1EffectSpeedRange.value = clamp(e.target.value, 0, 254)),
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
				(e) => (edLight0EffectSpeedRange.value = clamp(e.target.value, 0, 254)),
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

		// Note: Individual apply buttons removed - use "Apply All Settings" button instead
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

		// Create eye options for images 1-18
		for (let imgIdx = 1; imgIdx <= 18; imgIdx++) {
			const eyeNum = imgIdx;
			const div = document.createElement("div");
			div.className = "eye-opt";
			div.dataset.eye = String(eyeNum);
			div.title = `Eye ${eyeNum}`;

			// Create image element
			const img = document.createElement("img");
			img.className = "eye-thumb";
			img.src = `images/skelly/eye_icon_${imgIdx}.png`;
			img.alt = `eye ${eyeNum}`;

			div.appendChild(img);
			this.eyeGrid.appendChild(div);
		}
	}

	/**
	 * Initialize file-related controls
	 */
	initializeFileControls() {
		// Filename conflict checking
		$("#edName")?.addEventListener("input", () => {
			const name = $("#edName")?.value || "";
			this.checkFileNameConflict(name);
		});

		// File upload for replacement
		const _edUploadFile = $("#edUploadFile");
		const edUploadBtn = $("#edUploadBtn");

		if (edUploadBtn) {
			edUploadBtn.addEventListener("click", async () => {
				await this.handleFileUpload();
			});
		}

		// Convert checkbox toggle
		$("#edChkConvert")?.addEventListener("change", (e) => {
			$("#edConvertOpts")?.classList.toggle("hidden", !e.target.checked);
		});
	}

	/**
	 * Initialize action buttons
	 */
	initializeActionButtons() {
		// Close button
		$("#edClose")?.addEventListener("click", () => this.close());

		// Escape key to close modal
		document.addEventListener("keydown", (e) => {
			if (
				e.key === "Escape" &&
				this.modal &&
				!this.modal.classList.contains("hidden")
			) {
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
			const serialHex = serial.toString(16).padStart(4, "0").toUpperCase();
			const cluster = Math.max(0, parseInt($("#edCluster")?.value || "0", 10));
			const clusterHex = cluster.toString(16).padStart(8, "0").toUpperCase();

			// Disable delete button and show waiting state
			const deleteBtn = $("#edDelete");
			if (deleteBtn) {
				deleteBtn.disabled = true;
				deleteBtn.textContent = "Deleting...";
			}

			// Set up promise to wait for delete confirmation
			this.deletePending = true;
			const deletePromise = new Promise((resolve) => {
				this.deleteResolve = resolve;
			});

			// Send delete command
			await this.connection.send(
				buildCommand(COMMANDS.DELETE, serialHex + clusterHex, 8),
			);
			this.log(
				`Delete request (C7) serial=${serial} cluster=${cluster}`,
				LOG_CLASSES.WARNING,
			);

			// Wait for BBC7 response (with timeout)
			const timeoutPromise = new Promise((resolve) => {
				setTimeout(() => resolve(false), 5000); // 5 second timeout
			});

			this.log("Waiting for delete confirmation...", LOG_CLASSES.INFO);
			const success = await Promise.race([deletePromise, timeoutPromise]);

			// Reset button state
			if (deleteBtn) {
				deleteBtn.disabled = false;
				deleteBtn.textContent = "Delete";
			}

			if (success) {
				this.log(
					"Delete confirmed, refreshing file list...",
					LOG_CLASSES.WARNING,
				);
				// If the deleted file was in the play order, remove it and resubmit
				// before refreshing (files are still in local state so names are available)
				const currentOrder = JSON.parse(this.state.device?.order || "[]");
				if (currentOrder.includes(serial)) {
					const newOrder = currentOrder.filter((s) => s !== serial);
					this.log(
						`Removing serial ${serial} from play order → ${JSON.stringify(newOrder)}`,
						LOG_CLASSES.INFO,
					);
					await this.fileManager.updateFileOrder(newOrder);
				}
				// Refresh the file list
				await this.fileManager.startFetchFiles();
				this.close();
			} else {
				this.log("Delete confirmation timeout or failed", LOG_CLASSES.WARNING);
			}

			this.deletePending = false;
			this.deleteResolve = null;
		});

		// Apply All button - sends all settings to device
		$("#edApplyAll")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const cluster = Math.max(0, parseInt($("#edCluster")?.value || "0", 10));
			const clusterHex = cluster.toString(16).padStart(8, "0").toUpperCase();
			const name = ($("#edName")?.value || "").trim();

			// Helper to build payload with filename
			const buildPayload = (dataHex) => {
				const { fullPayload: filenamePart } = buildFilenamePayload(name);
				return dataHex + clusterHex + filenamePart;
			};

			this.log("Applying all settings to device...", LOG_CLASSES.INFO);

			// 1. Set Animation (CA) - Movement
			const grid = $("#edMove");
			if (grid) {
				const toggles = grid.querySelectorAll(".iconToggle.selected");

				let actionBits = 0;
				toggles.forEach((btn) => {
					if (btn.getAttribute("data-part") === "all") {
						actionBits = 255;
					} else if (actionBits !== 255) {
						actionBits |= parseInt(btn.dataset.bit || "0", 10);
					}
				});

				const actionHex = actionBits
					.toString(16)
					.padStart(2, "0")
					.toUpperCase();
				const payload = buildPayload(`${actionHex}00`);
				await this.connection.send(
					buildCommand(COMMANDS.SET_MOVEMENT, payload, 8),
				);
				this.log(`✓ Set Movement (CA) action=${actionBits}`);
			}

			// 2. Set Eye (F9)
			const eyeHex = this.currentFile.eye
				.toString(16)
				.padStart(2, "0")
				.toUpperCase();
			const eyePayload = buildPayload(`${eyeHex}00`);
			await this.connection.send(buildCommand(COMMANDS.SET_EYE, eyePayload, 8));
			this.log(`✓ Set Eye (F9) icon=${this.currentFile.eye}`);

			// 3. Set Light 1 Brightness (F3)
			const light1Brightness = clamp(
				$("#edLight1Brightness")?.value || 200,
				0,
				255,
			);
			const light1BrightnessHex = light1Brightness
				.toString(16)
				.padStart(2, "0")
				.toUpperCase();
			const light1BrightnessPayload = buildPayload(`01${light1BrightnessHex}`);
			await this.connection.send(
				buildCommand(COMMANDS.SET_BRIGHTNESS, light1BrightnessPayload, 8),
			);
			this.log(`✓ Set Light 1 Brightness (F3) brightness=${light1Brightness}`);

			// 4. Set Light 1 Effect Mode (F2)
			const light1Mode = parseInt($("#edLight1EffectMode")?.value || "1", 10);
			const light1ModeHex = light1Mode
				.toString(16)
				.padStart(2, "0")
				.toUpperCase();
			const light1ModePayload = buildPayload(`01${light1ModeHex}`);
			await this.connection.send(
				buildCommand(COMMANDS.SET_MODE, light1ModePayload, 8),
			);
			this.log(`✓ Set Light 1 Effect Mode (F2) mode=${light1Mode}`);

			// 5. Set Light 1 Effect Speed (F6) - if not Static mode
			if (light1Mode !== 1) {
				const uiSpeed = clamp($("#edLight1EffectSpeed")?.value || 0, 0, 254);
				const deviceSpeed = uiSpeedToDevice(uiSpeed);
				const light1SpeedHex = deviceSpeed
					.toString(16)
					.padStart(2, "0")
					.toUpperCase();
				const light1SpeedPayload = buildPayload(`01${light1SpeedHex}`);
				await this.connection.send(
					buildCommand(COMMANDS.SET_SPEED, light1SpeedPayload, 8),
				);
				this.log(
					`✓ Set Light 1 Effect Speed (F6) speed=${uiSpeed} (device: ${deviceSpeed})`,
				);
			}

			// 6. Set Light 0 Brightness (F3)
			const light0Brightness = clamp(
				$("#edLight0Brightness")?.value || 200,
				0,
				255,
			);
			const light0BrightnessHex = light0Brightness
				.toString(16)
				.padStart(2, "0")
				.toUpperCase();
			const light0BrightnessPayload = buildPayload(`00${light0BrightnessHex}`);
			await this.connection.send(
				buildCommand(COMMANDS.SET_BRIGHTNESS, light0BrightnessPayload, 8),
			);
			this.log(`✓ Set Light 0 Brightness (F3) brightness=${light0Brightness}`);

			// 7. Set Light 0 Effect Mode (F2)
			const light0Mode = parseInt($("#edLight0EffectMode")?.value || "1", 10);
			const light0ModeHex = light0Mode
				.toString(16)
				.padStart(2, "0")
				.toUpperCase();
			const light0ModePayload = buildPayload(`00${light0ModeHex}`);
			await this.connection.send(
				buildCommand(COMMANDS.SET_MODE, light0ModePayload, 8),
			);
			this.log(`✓ Set Light 0 Effect Mode (F2) mode=${light0Mode}`);

			// 8. Set Light 0 Effect Speed (F6) - if not Static mode
			if (light0Mode !== 1) {
				const uiSpeed = clamp($("#edLight0EffectSpeed")?.value || 0, 0, 254);
				const deviceSpeed = uiSpeedToDevice(uiSpeed);
				const light0SpeedHex = deviceSpeed
					.toString(16)
					.padStart(2, "0")
					.toUpperCase();
				const light0SpeedPayload = buildPayload(`00${light0SpeedHex}`);
				await this.connection.send(
					buildCommand(COMMANDS.SET_SPEED, light0SpeedPayload, 8),
				);
				this.log(
					`✓ Set Light 0 Effect Speed (F6) speed=${uiSpeed} (device: ${deviceSpeed})`,
				);
			}

			// 9. Set Light 1 Color (F4)
			const light1R = clamp($("#edLight1R")?.value || 255, 0, 255);
			const light1G = clamp($("#edLight1G")?.value || 0, 0, 255);
			const light1B = clamp($("#edLight1B")?.value || 0, 0, 255);
			const light1ColorCycle = $("#edLight1ColorCycle")?.classList.contains(
				"selected",
			)
				? "01"
				: "00";
			const light1RHex = light1R.toString(16).padStart(2, "0").toUpperCase();
			const light1GHex = light1G.toString(16).padStart(2, "0").toUpperCase();
			const light1BHex = light1B.toString(16).padStart(2, "0").toUpperCase();
			const light1Payload = buildPayload(
				`01${light1RHex}${light1GHex}${light1BHex}${light1ColorCycle}`,
			);
			await this.connection.send(
				buildCommand(COMMANDS.SET_RGB, light1Payload, 8),
			);
			this.log(
				`✓ Set Light 1 Color (F4) rgb=${light1R},${light1G},${light1B} cycle=${light1ColorCycle}`,
			);

			// 10. Set Light 0 Color (F4)
			const light0R = clamp($("#edLight0R")?.value || 0, 0, 255);
			const light0G = clamp($("#edLight0G")?.value || 0, 0, 255);
			const light0B = clamp($("#edLight0B")?.value || 255, 0, 255);
			const light0ColorCycle = $("#edLight0ColorCycle")?.classList.contains(
				"selected",
			)
				? "01"
				: "00";
			const light0RHex = light0R.toString(16).padStart(2, "0").toUpperCase();
			const light0GHex = light0G.toString(16).padStart(2, "0").toUpperCase();
			const light0BHex = light0B.toString(16).padStart(2, "0").toUpperCase();
			const light0Payload = buildPayload(
				`00${light0RHex}${light0GHex}${light0BHex}${light0ColorCycle}`,
			);
			await this.connection.send(
				buildCommand(COMMANDS.SET_RGB, light0Payload, 8),
			);
			this.log(
				`✓ Set Light 0 Color (F4) rgb=${light0R},${light0G},${light0B} cycle=${light0ColorCycle}`,
			);

			this.log(
				`All settings applied successfully for file "${name || "(no name)"}"`,
				LOG_CLASSES.SUCCESS,
			);

			// Refresh the file list to show updated data
			this.log("Refreshing file list from device...");
			await this.fileManager.startFetchFiles();
		});
	}

	/**
	 * Check for filename conflicts
	 */
	checkFileNameConflict(name) {
		const conflict = this.state.hasFileName(name);
		const inputEl = $("#edName");
		if (inputEl) {
			inputEl.classList.toggle("warn-border", !!conflict);
		}
		if (conflict) {
			this.log(
				`Warning: A file named "${conflict.name}" already exists on the device.`,
				LOG_CLASSES.WARNING,
			);
		}
	}

	/**
	 * Handle file upload/replacement
	 */
	async handleFileUpload() {
		if (!this.connection.isConnected()) {
			this.log("Not connected", LOG_CLASSES.WARNING);
			return;
		}

		const edUploadFile = $("#edUploadFile");
		const file = edUploadFile?.files?.[0];

		if (!file) {
			this.log("No file selected", LOG_CLASSES.WARNING);
			return;
		}

		const fileName = ($("#edName")?.value || "").trim();
		if (!fileName) {
			this.log("File name is required", LOG_CLASSES.WARNING);
			return;
		}

		// Confirm overwrite
		if (
			!confirm(
				`Replace "${fileName}" with the selected file? This cannot be undone.`,
			)
		) {
			return;
		}

		try {
			let bytes;

			// Convert if checkbox is checked
			const shouldConvert = $("#edChkConvert")?.checked;
			if (shouldConvert) {
				const kbps = parseInt($("#edMp3Kbps")?.value || "32", 10);
				this.log(`Converting to MP3 8 kHz mono (${kbps} kbps)…`);

				const result = await this.audioConverter.convertToDeviceMp3(file, kbps);
				bytes = result.u8;

				this.log(`Converted to ${(bytes.length / 1024).toFixed(1)} KB MP3`);
			} else {
				// Read file as bytes
				const arrayBuffer = await file.arrayBuffer();
				bytes = new Uint8Array(arrayBuffer);
			}

			// Temporarily override FileManager's progress callback to use edit modal's progress bar
			const originalProgressCallback = this.fileManager.onProgress;
			this.fileManager.onProgress = (current, total) =>
				this.setProgress(current, total);

			try {
				// Upload via FileManager - MUST use exact same filename as before
				this.log(
					`Uploading ${fileName} (${(bytes.length / 1024).toFixed(1)} KB)...`,
				);
				this.setProgress(0, 0); // Reset progress bar

				await this.fileManager.uploadFile(bytes, fileName);

				this.log(
					`File "${fileName}" uploaded successfully ✓`,
					LOG_CLASSES.SUCCESS,
				);
			} finally {
				// Restore original progress callback
				this.fileManager.onProgress = originalProgressCallback;
			}

			// Clear the file input
			if (edUploadFile) edUploadFile.value = "";

			// Refresh file list
			setTimeout(() => {
				this.fileManager.startFetchFiles();
			}, 500);
		} catch (error) {
			this.log(`Upload failed: ${error.message}`, LOG_CLASSES.WARNING);
		}
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
				$("#edLight1Brightness").value = light1.brightness || 200;
			if ($("#edLight1BrightnessRange"))
				$("#edLight1BrightnessRange").value = light1.brightness || 200;

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
				$("#edLight0Brightness").value = light0.brightness || 200;
			if ($("#edLight0BrightnessRange"))
				$("#edLight0BrightnessRange").value = light0.brightness || 200;

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

		// Clear the log when opening
		if (this.logElement) {
			this.logElement.innerHTML = "";
		}

		// Reset progress bar
		this.setProgress(0, 0);

		// Show modal
		this.modal?.classList.remove("hidden");
	}

	/**
	 * Handle delete confirmation from protocol parser
	 * @param {boolean} success - Whether delete was successful
	 */
	handleDeleteConfirmation(success) {
		if (this.deletePending && this.deleteResolve) {
			this.deleteResolve(success);
		}
	}

	/**
	 * Close the edit modal
	 */
	close() {
		this.modal?.classList.add("hidden");
	}
}
