/**
 * Edit Modal Manager
 * Handles the per-file edit modal functionality
 */

import {
	APPLY_ALL_COMMAND_DELAY_MS,
	DEVICE_PROFILES,
	getEyeIconPath,
	LOG_CLASSES,
} from "./constants.js";
import {
	applyFileSettings,
	currentLightScene,
	isScenePreset,
	sceneLightColor,
	supportsLightScenes,
} from "./device-settings.js";
import {
	clamp,
	deviceSpeedToUI,
	MAX_UI_EFFECT_SPEED,
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
