/**
 * Edit Modal Manager
 * Handles the per-file edit modal functionality
 */

import {
	APPLY_ALL_COMMAND_DELAY_MS,
	DEVICE_PROFILES,
	DEVICE_TYPES,
	displayedLights,
	eyeIconLabel,
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
import { $ } from "./dom.js";
import {
	clamp,
	deviceSpeedToUI,
	escapeHtml,
	MAX_UI_EFFECT_SPEED,
	rgbToHex,
	uiSpeedToDevice,
} from "./protocol.js";

// A light's settings when the file list gave none: torso (channel 0) blue,
// the others red, as the dialog always started
const DEFAULT_LIGHT = {
	brightness: 200,
	effectMode: 1,
	effectSpeed: 0,
	r: 255,
	g: 0,
	b: 0,
	colorCycle: 0,
};
function defaultLight(channel) {
	return channel === 0
		? { ...DEFAULT_LIGHT, r: 0, b: 255 }
		: { ...DEFAULT_LIGHT };
}

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
			eyeIcon: 1,
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

		// Initialize all handlers (the light controls are built per device
		// profile, see buildLights)
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

	/** The active device profile */
	get profile() {
		return (
			DEVICE_PROFILES[this.state.deviceType] ||
			DEVICE_PROFILES[DEVICE_TYPES.SKELLY]
		);
	}

	/** Light channel numbers of the active profile */
	get channels() {
		return this.profile.lights.map((light) => light.channel);
	}

	/**
	 * Build the light controls, one group per light of the profile, and
	 * bind them. Nothing is sent until Apply All.
	 * @param {Object} profile - DEVICE_PROFILES entry
	 */
	buildLights(profile) {
		const container = $("#edLights");
		if (!container) return;
		const modeOptions = profile.lightModes
			.map(
				(label, i) => `<option value="${i + 1}">${escapeHtml(label)}</option>`,
			)
			.join("");
		const lights = displayedLights(profile);
		container.innerHTML = lights
			.map(({ label, channel: ch }) => {
				const { r, g, b } = defaultLight(ch);
				return `
      <div class="light-group" style="flex:1; margin-top:0">
        <h3>${escapeHtml(label)}</h3>
        <label>Brightness (0–255)</label>
        <div class="row">
          <input id="edLight${ch}BrightnessRange" type="range" min="0" max="255" value="200" />
          <input id="edLight${ch}Brightness" type="number" min="0" max="255" value="200" />
        </div>
        <div class="spacer"></div>
        <label>Color</label>
        <div class="row">
          <input id="edLight${ch}ColorPick" type="color" value="${rgbToHex(r, g, b)}" />
          <input id="edLight${ch}R" type="number" min="0" max="255" value="${r}" />
          <input id="edLight${ch}G" type="number" min="0" max="255" value="${g}" />
          <input id="edLight${ch}B" type="number" min="0" max="255" value="${b}" />
          <button type="button" class="iconToggle" id="edLight${ch}ColorCycle" title="Cycle all colors">
            <img src="images/icon_light_cycle_no.png" alt="Cycle colors" style="width:24px;height:24px" />
          </button>
        </div>
        <div class="spacer"></div>
        <label>Effect Mode</label>
        <select id="edLight${ch}EffectMode" aria-label="${escapeHtml(label)} effect mode">${modeOptions}</select>
        <div class="spacer"></div>
        <div id="edLight${ch}EffectSpeedBlock" class="hidden">
          <label>Effect Speed (0–10)</label>
          <div class="row">
            <input id="edLight${ch}EffectSpeedRange" type="range" min="0" max="10" value="0" />
            <input id="edLight${ch}EffectSpeed" type="number" min="0" max="10" value="0" />
          </div>
        </div>
      </div>`;
			})
			.join("");
		for (const { channel } of lights) this.bindLight(channel);
	}

	/** Keep one light group's sliders, number boxes and color fields in step */
	bindLight(channel) {
		const el = (field) => $(`#edLight${channel}${field}`);
		const pair = (range, number, max) => {
			range?.addEventListener("input", (e) => {
				if (number) number.value = e.target.value;
			});
			number?.addEventListener("input", (e) => {
				if (range) range.value = clamp(e.target.value, 0, max);
			});
		};
		pair(el("BrightnessRange"), el("Brightness"), 255);
		pair(el("EffectSpeedRange"), el("EffectSpeed"), MAX_UI_EFFECT_SPEED);

		el("EffectMode")?.addEventListener("change", (e) => {
			const mode = parseInt(e.target.value, 10);
			el("EffectSpeedBlock")?.classList.toggle("hidden", mode === 1); // Static
		});

		for (const field of ["R", "G", "B"]) {
			el(field)?.addEventListener("input", () => {
				const hex = rgbToHex(
					clamp(el("R").value, 0, 255),
					clamp(el("G").value, 0, 255),
					clamp(el("B").value, 0, 255),
				);
				if (el("ColorPick").value !== hex) el("ColorPick").value = hex;
			});
		}
		el("ColorPick")?.addEventListener("input", (e) => {
			const v = e.target.value.replace("#", "");
			if (v.length === 6) {
				el("R").value = parseInt(v.slice(0, 2), 16);
				el("G").value = parseInt(v.slice(2, 4), 16);
				el("B").value = parseInt(v.slice(4, 6), 16);
			}
		});
		el("ColorCycle")?.addEventListener("click", (e) => {
			e.currentTarget.classList.toggle("selected");
		});
	}

	/**
	 * Show a light's settings (from the file list, or the defaults) in its
	 * controls.
	 */
	showLight(channel, light) {
		const set = (field, value) => {
			const input = $(`#edLight${channel}${field}`);
			if (input) input.value = value;
		};
		set("Brightness", light.brightness ?? 200);
		set("BrightnessRange", light.brightness ?? 200);
		set("EffectMode", light.effectMode || 1);
		const uiSpeed = deviceSpeedToUI(light.effectSpeed || 0);
		set("EffectSpeed", uiSpeed);
		set("EffectSpeedRange", uiSpeed);
		$(`#edLight${channel}EffectSpeedBlock`)?.classList.toggle(
			"hidden",
			(light.effectMode || 1) === 1,
		);
		const colors = [];
		colors[channel] = light;
		this.showColors(colors);
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
		// Light scene picker: Apply All sends it with the lights (F1)
		$("#edScene")?.addEventListener("change", (e) => {
			const from = this.currentFile.scene;
			this.currentFile.scene = parseInt(e.target.value, 10);
			this.showSceneColors(from, this.currentFile.scene);
			this.updateSceneControls();
		});

		// Note: Individual apply buttons removed - use "Apply All Settings" button instead
	}

	/** Color and color cycle of the light controls, indexed by channel */
	readColors() {
		const colors = [];
		for (const ch of this.channels) {
			colors[ch] = {
				r: clamp($(`#edLight${ch}R`)?.value, 0, 255),
				g: clamp($(`#edLight${ch}G`)?.value, 0, 255),
				b: clamp($(`#edLight${ch}B`)?.value, 0, 255),
				colorCycle: $(`#edLight${ch}ColorCycle`)?.classList.contains("selected")
					? 1
					: 0,
			};
		}
		return colors;
	}

	/** Show colors (from readColors or sceneLightColor) in the light controls */
	showColors(colors) {
		colors.forEach((color, ch) => {
			if (!color) return;
			if ($(`#edLight${ch}R`)) $(`#edLight${ch}R`).value = color.r;
			if ($(`#edLight${ch}G`)) $(`#edLight${ch}G`).value = color.g;
			if ($(`#edLight${ch}B`)) $(`#edLight${ch}B`).value = color.b;
			if ($(`#edLight${ch}ColorPick`))
				$(`#edLight${ch}ColorPick`).value = rgbToHex(
					...[color.r, color.g, color.b].map(Math.round),
				);
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
			const colors = [];
			for (const ch of this.channels) colors[ch] = sceneLightColor(to, ch);
			this.showColors(colors);
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
		for (const ch of this.channels) {
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

			this.currentFile.eyeIcon = parseInt(cell.dataset.eye, 10);
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

		// Create eye options for the active profile's eye icons
		const eyeCount =
			DEVICE_PROFILES[this.state.deviceType]?.eyeIcons.length ?? 0;
		for (let imgIdx = 1; imgIdx <= eyeCount; imgIdx++) {
			const eyeNum = imgIdx;
			const div = document.createElement("div");
			div.className = "eye-opt";
			div.dataset.eye = String(eyeNum);
			div.title = eyeIconLabel(this.state.deviceType, eyeNum);

			// Create image element
			const img = document.createElement("img");
			img.className = "eye-thumb";
			img.src = getEyeIconPath(this.state.deviceType, imgIdx);
			img.alt = div.title;

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
				const currentOrder = this.state.device?.order ?? [];
				const orderedNames = currentOrder
					.filter((s) => s !== serial)
					.map((s) => this.state.getFile(s)?.name)
					.filter(Boolean);

				// Refresh file list (receives new serial assignments from device)
				this.fileManager.refreshFileList();

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
							await this.fileManager.setFileOrder(newOrder);
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

			const readLight = (ch) => {
				const prefix = `Light${ch}`;
				const defaults = defaultLight(ch);
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

			// The profile's lights, in channel order from 0 (e.g. Lily has 1,
			// Skelly has 2)
			const profile = this.profile;
			const lights = this.channels.map(readLight);

			await applyFileSettings(
				this.connection,
				cluster,
				name,
				{
					action: actionBits,
					eyeIcon: this.currentFile.eyeIcon,
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
			await this.fileManager.refreshFileList();

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
		this.currentFile.eyeIcon = file.eyeIcon || 1;
		this.currentFile.scene = file.scene ?? null;

		// Populate form fields
		if ($("#edSerial")) $("#edSerial").value = file.serial;
		if ($("#edCluster")) $("#edCluster").value = file.cluster;
		if ($("#edName")) $("#edName").value = file.name || "";

		// Lights from the file list, or the defaults
		for (const ch of this.channels) {
			this.showLight(ch, file.lights?.[ch] ?? defaultLight(ch));
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
				el.classList.toggle("selected", eyeNum === this.currentFile.eyeIcon);
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
