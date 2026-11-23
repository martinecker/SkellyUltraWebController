/**
 * Live controls: movements, eye, lights and light scene of live mode
 * (cluster 0), and showing what the device reports (BBE1)
 */

import {
	DEVICE_PROFILES,
	DEVICE_TYPES,
	displayedLights,
	eyeIconLabel,
	getEyeIconPath,
	LOG_CLASSES,
} from "./constants.js";
import {
	buildSetAllLights,
	isScenePreset,
	sceneLightColor,
	sendSetEyeIcon,
	sendSetLightBrightness,
	sendSetLightMode,
	sendSetLightRgb,
	sendSetLightSpeed,
	sendSetMovementAction,
	supportsLightScenes,
} from "./device-settings.js";
import { $ } from "./dom.js";
import {
	clamp,
	deviceSpeedToUI,
	escapeHtml,
	MAX_UI_EFFECT_SPEED,
	parseNumberInput,
	rgbToHex,
	uiSpeedToDevice,
} from "./protocol.js";

export class LiveControls {
	/**
	 * @param {Object} options
	 * @param {ConnectionManager} options.connection
	 * @param {StateManager} options.state
	 * @param {Function} options.log - log(message, className)
	 */
	constructor({ connection, state, log }) {
		this.connection = connection;
		this.state = state;
		this.log = log;
		this.selectedEye = 1;
		// Color cycle state per channel
		this.colorCycle = {};
		// Custom colors kept while a scene preset shows its own (showSceneColors)
		this.customColors = null;
	}

	/**
	 * Wire the scene picker and eye grid (call once; lights and movements
	 * are built per profile)
	 */
	initialize() {
		this.buildEyeGrid();

		// Light scene picker (scene firmware only, see updateScenePicker)
		$("#liveScene")?.addEventListener("change", async (e) => {
			const scene = parseInt(e.target.value, 10);
			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				this.updateScenePicker();
				return;
			}
			const shownColors = this.readColors();
			const customColors = this.customColors;
			const previousScene = this.state.live.scene;
			this.showSceneColors(previousScene, scene);
			// Set before sending so a device update meanwhile sees the new scene.
			// No notify: that would reset the light controls to the last report.
			this.state.live.scene = scene;
			this.updateScenePicker();
			try {
				await this.sendLights(scene);
			} catch (error) {
				this.log(
					`Set light scene failed: ${error.message}`,
					LOG_CLASSES.WARNING,
				);
				this.state.live.scene = previousScene;
				this.showColors(shownColors);
				this.customColors = customColors;
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
					this.log("Not connected", LOG_CLASSES.WARNING);
					return;
				}

				await sendSetEyeIcon(this.connection, 0, "", this.selectedEye);
				this.log(`Set eye to ${this.selectedEye} (live mode)`);
			});
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
	 * Build the live light controls, one group per light of the profile
	 * (head light above torso light, as before), and bind them.
	 * @param {Object} profile - DEVICE_PROFILES entry
	 */
	buildLights(profile) {
		const container = $("#liveLights");
		if (!container) return;
		this.colorCycle = {};
		const modeOptions = profile.lightModes
			.map(
				(label, i) => `<option value="${i + 1}">${escapeHtml(label)}</option>`,
			)
			.join("");
		const lights = displayedLights(profile).map(({ label, channel }) => ({
			label,
			ch: channel,
		}));
		container.innerHTML = lights
			.map(
				({ label, ch }) => `
        <div class="light-group">
          <h3>${escapeHtml(label)}</h3>
          <div class="compact-row">
            <label>Brightness</label>
            <input id="light${ch}BrightnessRange" type="range" min="0" max="255" value="200" />
            <input id="light${ch}Brightness" type="number" min="0" max="255" value="200" />
          </div>
          <div class="compact-row">
            <label>Color</label>
            <input id="light${ch}ColorPick" type="color" value="#ff0000" />
            <input id="light${ch}R" type="number" min="0" max="255" value="255" />
            <input id="light${ch}G" type="number" min="0" max="255" value="0" />
            <input id="light${ch}B" type="number" min="0" max="255" value="0" />
          </div>
          <div style="display:flex; align-items:center; gap:6px; margin-top:8px;">
            <button type="button" class="iconToggle" id="btnLight${ch}ColorCycle" title="Cycle all colors" style="padding:4px;">
              <img src="images/icon_light_cycle_no.png" alt="Cycle colors" style="width:28px;height:28px" />
            </button>
            <span class="small muted">Cycle</span>
          </div>
          <div class="compact-row">
            <label>Effect</label>
            <select id="light${ch}EffectMode" aria-label="${escapeHtml(label)} effect mode">${modeOptions}</select>
          </div>
          <div id="light${ch}EffectSpeedBlock" class="compact-row hidden">
            <label>Speed</label>
            <input id="light${ch}EffectSpeedRange" type="range" min="0" max="10" value="0" />
            <input id="light${ch}EffectSpeed" type="number" min="0" max="10" value="0" />
          </div>
        </div>`,
			)
			.join("");
		for (const { label, ch } of lights) this.bindLight(ch, label);
		// Show what the device last reported, if anything
		for (const { ch } of lights) {
			const reported = this.state.live.lights?.[ch];
			if (reported) this.showLight(ch, reported);
		}
	}

	/**
	 * Bind one live light group's controls: each change goes to the device
	 * at once (cluster 0, no file name = live).
	 * @param {number} channel - Light channel
	 * @param {string} label - Light name for the log
	 */
	bindLight(channel, label) {
		const el = (field) => $(`#light${channel}${field}`);
		const canSend = () =>
			this.connection.isConnected() && !this.sendLightsInScene();

		const sendBrightness = async (brightness) => {
			if (!canSend()) return;
			await sendSetLightBrightness(
				this.latest(`brightness:${channel}`),
				0,
				"",
				channel,
				brightness,
			);
			this.log(`Set ${label} brightness to ${brightness}`);
		};
		const sendSpeed = async (uiSpeed) => {
			if (!canSend()) return;
			const deviceSpeed = uiSpeedToDevice(uiSpeed);
			await sendSetLightSpeed(
				this.latest(`speed:${channel}`),
				0,
				"",
				channel,
				deviceSpeed,
			);
			this.log(`Set ${label} speed to ${uiSpeed} (device: ${deviceSpeed})`);
		};
		// A color the user sets turns color cycle off; the cycle button doesn't
		const sendColor = async (stopCycle) => {
			if (!this.connection.isConnected()) return;
			if (stopCycle) this.setColorCycle(channel, false);
			const { r, g, b, colorCycle } = this.readColor(channel);
			await sendSetLightRgb(
				this.latest(`color:${channel}`),
				0,
				"",
				channel,
				r,
				g,
				b,
				colorCycle,
			);
			this.log(
				`Set ${label} color to RGB(${r}, ${g}, ${b}) with cycle ${colorCycle ? "ON" : "OFF"}`,
			);
		};

		this.bindRangeAndNumber(
			el("BrightnessRange"),
			el("Brightness"),
			255,
			sendBrightness,
		);
		this.bindRangeAndNumber(
			el("EffectSpeedRange"),
			el("EffectSpeed"),
			MAX_UI_EFFECT_SPEED,
			sendSpeed,
		);

		el("ColorPick")?.addEventListener("input", (e) => {
			const hex = e.target.value;
			el("R").value = parseInt(hex.substring(1, 3), 16);
			el("G").value = parseInt(hex.substring(3, 5), 16);
			el("B").value = parseInt(hex.substring(5, 7), 16);
			sendColor(true);
		});
		for (const field of ["R", "G", "B"]) {
			el(field)?.addEventListener("input", (e) => {
				// Nothing to send while the box is empty (being retyped)
				if (parseNumberInput(e.target.value, 0, 255) === null) return;
				const { r, g, b } = this.readColor(channel);
				el("ColorPick").value = rgbToHex(r, g, b);
				sendColor(true);
			});
		}

		el("EffectMode")?.addEventListener("change", async () => {
			const mode = parseInt(el("EffectMode").value, 10);
			el("EffectSpeedBlock")?.classList.toggle("hidden", mode === 1); // Static
			if (!canSend()) return;
			await sendSetLightMode(this.connection, 0, "", channel, mode);
			const modeLabel = this.profile.lightModes[mode - 1];
			this.log(`Set ${label} mode to ${mode} (${modeLabel ?? "?"})`);
		});

		$(`#btnLight${channel}ColorCycle`)?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}
			this.setColorCycle(channel, !this.colorCycle[channel]);
			await sendColor(false);
		});
	}

	/**
	 * A slider and its number box: each follows the other, and every change
	 * is sent (the number box clamped to 0..max; nothing while it's empty).
	 */
	bindRangeAndNumber(range, number, max, send) {
		if (!range || !number) return;
		range.addEventListener("input", (e) => {
			number.value = e.target.value;
			send(parseNumberInput(e.target.value, 0, max));
		});
		number.addEventListener("input", (e) => {
			// Nothing to send while the box is empty (being retyped)
			const value = parseNumberInput(e.target.value, 0, max);
			if (value === null) return;
			range.value = value;
			send(value);
		});
	}

	/**
	 * A stand-in for the connection whose sends replace a still-queued send
	 * with the same key (ConnectionManager.sendLatest), for controls that
	 * send a value many times per second while dragged
	 * @param {string} key - What the sends set, e.g. "brightness:0"
	 * @returns {{send: (bytes: Uint8Array) => Promise<void>}}
	 */
	latest(key) {
		return { send: (bytes) => this.connection.sendLatest(key, bytes) };
	}

	/** Set a live light's color cycle flag and its button */
	setColorCycle(channel, on) {
		this.colorCycle[channel] = on;
		$(`#btnLight${channel}ColorCycle`)?.classList.toggle("selected", on);
	}

	/** A live light's color and color cycle as its controls show them */
	readColor(channel) {
		const value = (field) =>
			Math.round(clamp($(`#light${channel}${field}`)?.value, 0, 255));
		return {
			r: value("R"),
			g: value("G"),
			b: value("B"),
			colorCycle: this.colorCycle[channel] ? 1 : 0,
		};
	}

	/**
	 * A live light channel as its controls show it, in device units for F1.
	 * @param {number} channel - Light channel
	 */
	readLight(channel) {
		const value = (field, max) =>
			Math.round(clamp($(`#light${channel}${field}`)?.value, 0, max));
		return {
			effectMode: parseInt($(`#light${channel}EffectMode`)?.value || "1", 10),
			brightness: value("Brightness", 255),
			...this.readColor(channel),
			effectSpeed: uiSpeedToDevice(value("EffectSpeed", MAX_UI_EFFECT_SPEED)),
		};
	}

	/** Color and color cycle of the live lights, indexed by channel */
	readColors() {
		const colors = [];
		for (const ch of this.channels) colors[ch] = this.readColor(ch);
		return colors;
	}

	/** Show colors (from readColors or sceneLightColor) in the live controls */
	showColors(colors) {
		colors.forEach((color, ch) => {
			if (!color) return;
			if ($(`#light${ch}R`)) $(`#light${ch}R`).value = color.r;
			if ($(`#light${ch}G`)) $(`#light${ch}G`).value = color.g;
			if ($(`#light${ch}B`)) $(`#light${ch}B`).value = color.b;
			if ($(`#light${ch}ColorPick`))
				$(`#light${ch}ColorPick`).value = rgbToHex(color.r, color.g, color.b);
			this.setColorCycle(ch, color.colorCycle === 1);
		});
	}

	/**
	 * Show a live light the device reported (BBE1) in its controls.
	 * @param {number} channel - Light channel
	 * @param {Object} light - Parsed light (device units)
	 */
	showLight(channel, light) {
		const set = (field, value) => {
			const input = $(`#light${channel}${field}`);
			if (input) input.value = value;
		};
		set("Brightness", light.brightness);
		set("BrightnessRange", light.brightness);
		const colors = [];
		colors[channel] = light;
		this.showColors(colors);
		set("EffectMode", light.effectMode);
		$(`#light${channel}EffectSpeedBlock`)?.classList.toggle(
			"hidden",
			light.effectMode === 1,
		);
		const uiSpeed = deviceSpeedToUI(light.effectSpeed);
		set("EffectSpeed", uiSpeed);
		set("EffectSpeedRange", uiSpeed);
	}

	/**
	 * Going from `from` to scene `to`: a preset shows (and F1 sends) its own
	 * colors, as in the phone app; the custom colors are kept here and come
	 * back with Custom.
	 */
	showSceneColors(from, to) {
		if (isScenePreset(to)) {
			if (!isScenePreset(from) || !this.customColors) {
				this.customColors = this.readColors();
			}
			this.showColors(this.sceneColors(to));
		} else if (this.customColors) {
			this.showColors(this.customColors);
			this.customColors = null;
		}
	}

	/** A scene preset's colors for the live lights, indexed by channel */
	sceneColors(scene) {
		const colors = [];
		for (const ch of this.channels) colors[ch] = sceneLightColor(scene, ch);
		return colors;
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
			if (!this.customColors) this.customColors = this.readColors();
			this.showColors(this.sceneColors(scene));
		} else if (Number.isInteger(scene)) {
			this.customColors = null; // Custom: the controls show its colors
		}
	}

	/**
	 * Send every live light channel and the scene in one F1 (cluster 0).
	 * @param {number} scene - LIGHT_SCENES value
	 */
	async sendLights(scene) {
		// F1 takes the lights in channel order from 0
		const lights = this.channels.map((ch) => this.readLight(ch));
		await this.connection.sendLatest(
			"lights",
			buildSetAllLights(lights, 0, scene),
		);
		this.log(
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
	sendLightsInScene() {
		const scene = this.state.live.scene;
		if (
			!isScenePreset(scene) ||
			!supportsLightScenes(this.state.deviceType, this.state.device?.version)
		) {
			return false;
		}
		this.sendLights(scene).catch((error) =>
			this.log(`Set all lights failed: ${error.message}`, LOG_CLASSES.WARNING),
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
		for (const ch of this.channels) {
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
				await sendSetMovementAction(this.connection, 0, "", 255);
				this.log("Applied movement: all");
				return;
			}
			const selected = partBtns.filter((b) => b.classList.contains("selected"));
			const bitfield = selected.reduce(
				(bits, btn) => bits | parseInt(btn.dataset.bit || "0", 10),
				0,
			);
			await sendSetMovementAction(this.connection, 0, "", bitfield);
			this.log(
				bitfield > 0
					? `Applied movement: ${selected.map((b) => b.dataset.part).join(", ")}`
					: "Disabled movement",
			);
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
	 * Build the live eye grid for the active profile
	 */
	buildEyeGrid() {
		const grid = $("#apEyeGrid");
		if (!grid) return;

		grid.innerHTML = "";

		// Create eye options for the active profile's eye icons
		const eyeCount =
			DEVICE_PROFILES[this.state.deviceType]?.eyeIcons.length ?? 0;
		for (let imgIdx = 1; imgIdx <= eyeCount; imgIdx++) {
			const eyeNum = imgIdx;
			const div = document.createElement("div");
			div.className = `eye-opt${eyeNum === this.selectedEye ? " selected" : ""}`;
			div.dataset.eye = String(eyeNum);
			div.title = eyeIconLabel(this.state.deviceType, eyeNum);

			// Create image element
			const img = document.createElement("img");
			img.className = "eye-thumb";
			img.src = getEyeIconPath(this.state.deviceType, imgIdx);
			img.alt = div.title;

			div.appendChild(img);
			grid.appendChild(div);
		}
	}

	/**
	 * Show the live state the device reported
	 * @param {Object} live - state.live
	 */
	update(live) {
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
		if (live.eyeIcon != null) {
			this.selectedEye = live.eyeIcon;
			const apEyeGrid = $("#apEyeGrid");
			if (apEyeGrid) {
				// Clear all selections
				apEyeGrid.querySelectorAll(".eye-opt").forEach((el) => {
					el.classList.remove("selected");
				});
				// Select the current eye
				const eyeOpt = apEyeGrid.querySelector(`[data-eye="${live.eyeIcon}"]`);
				if (eyeOpt) eyeOpt.classList.add("selected");
			}
		}

		// Light settings, for the profile's lights
		if (Array.isArray(live.lights)) {
			for (const ch of this.channels) {
				if (live.lights[ch]) this.showLight(ch, live.lights[ch]);
			}
		}

		this.showReportedSceneColors();
		this.updateScenePicker();
	}

	/**
	 * Scene colors and picker after a device update: the firmware version
	 * decides whether scenes exist
	 */
	updateForDevice(device) {
		if (!device.connected) this.customColors = null;
		else this.showReportedSceneColors();
		this.updateScenePicker();
	}
}
