/**
 * Device Settings Commands
 * Convenience wrappers for the per-file light/movement/eye setting commands
 * (AAF2/F3/F4/F6/F9/CA), which all share the same cluster+filename addressing
 * scheme. Centralizes payload construction so callers (Apply All in the edit
 * modal, and the post-overwrite settings restore in the file manager) don't
 * each reimplement it.
 */

import {
	CAPABILITIES,
	COMMANDS,
	hasCapability,
	LIGHT_SCENE_COLORS,
	LIGHT_SCENES,
} from "./constants.js";
import {
	buildCommand,
	buildFilenamePayload,
	intToHex,
	sleep,
} from "./protocol.js";

function hex2(n) {
	return (n || 0).toString(16).padStart(2, "0").toUpperCase();
}

function targetPayload(cluster, fileName, dataHex) {
	const clusterHex = cluster.toString(16).padStart(8, "0").toUpperCase();
	const { fullPayload: filenamePart } = buildFilenamePayload(fileName, {
		withLength: true,
	});
	return dataHex + clusterHex + filenamePart;
}

/**
 * Send movement animation (CA).
 * @param {number} actionBits - Bitfield (0x01 head, 0x02 arm, 0x04 torso, 0xFF all)
 */
export function sendSetMovement(connection, cluster, fileName, actionBits) {
	return connection.send(
		buildCommand(
			COMMANDS.SET_MOVEMENT,
			targetPayload(cluster, fileName, `${hex2(actionBits)}00`),
			8,
		),
	);
}

/**
 * Send eye icon (F9). Only meaningful on devices with an eye image (e.g.
 * Skelly, not Lily) — callers should gate on DEVICE_PROFILES[...].hasEyeImage.
 */
export function sendSetEye(connection, cluster, fileName, eyeIcon) {
	return connection.send(
		buildCommand(
			COMMANDS.SET_EYE,
			targetPayload(cluster, fileName, `${hex2(eyeIcon)}00`),
			8,
		),
	);
}

/** Send light brightness (F3) for a channel (0-5, or 0xFF for all). */
export function sendSetLightBrightness(
	connection,
	cluster,
	fileName,
	channel,
	brightness,
) {
	return connection.send(
		buildCommand(
			COMMANDS.SET_BRIGHTNESS,
			targetPayload(
				cluster,
				fileName,
				`${intToHex(channel, 1)}${hex2(brightness)}`,
			),
			8,
		),
	);
}

/** Send light effect mode (F2) for a channel (1=static, 2=strobe, 3=pulsing). */
export function sendSetLightMode(
	connection,
	cluster,
	fileName,
	channel,
	effectMode,
) {
	return connection.send(
		buildCommand(
			COMMANDS.SET_MODE,
			targetPayload(
				cluster,
				fileName,
				`${intToHex(channel, 1)}${hex2(effectMode)}`,
			),
			8,
		),
	);
}

/**
 * Send light effect speed (F6) for a channel. Expects a device-scale value
 * (use uiSpeedToDevice() first if converting from the UI slider scale).
 */
export function sendSetLightSpeed(
	connection,
	cluster,
	fileName,
	channel,
	effectSpeed,
) {
	return connection.send(
		buildCommand(
			COMMANDS.SET_SPEED,
			targetPayload(
				cluster,
				fileName,
				`${intToHex(channel, 1)}${hex2(effectSpeed)}`,
			),
			8,
		),
	);
}

/** Send light RGB color + color-cycle flag (F4) for a channel. */
export function sendSetLightRgb(
	connection,
	cluster,
	fileName,
	channel,
	r,
	g,
	b,
	colorCycle,
) {
	const cycleHex = colorCycle ? "01" : "00";
	return connection.send(
		buildCommand(
			COMMANDS.SET_RGB,
			targetPayload(
				cluster,
				fileName,
				`${intToHex(channel, 1)}${hex2(r)}${hex2(g)}${hex2(b)}${cycleHex}`,
			),
			8,
		),
	);
}

// F1 always carries this many light channels
const ALL_LIGHT_CHANNELS = 6;

function byteHex(value, what) {
	if (!Number.isInteger(value) || value < 0 || value > 255) {
		throw new RangeError(`${what} must be 0-255, got ${value}`);
	}
	return value.toString(16).padStart(2, "0").toUpperCase();
}

/**
 * Build F1: every light channel and the light scene in one command.
 *
 * Only for firmware with the setAllLights capability (see
 * hasCapability): older firmware (the v66 Ultra) doesn't know F1.
 * applyFileSettings uses it when given a scene (see currentLightScene).
 *
 * @param {Array<Object>} lights - Channels from 0 on (1-6), each
 *   {effectMode, brightness, r, g, b, colorCycle, effectSpeed} in device
 *   units. F1 always carries 6; the missing ones repeat the given channels
 *   in turn, as the phone app fills them.
 * @param {number} [cluster] - 0 for the live lights, else that file's.
 *   Unlike F2-F6 there is no file name; the app sends audio mode 0 with
 *   cluster 0 and 1 with a file's cluster, and so does this.
 * @param {number} [scene] - LIGHT_SCENES value
 * @returns {Uint8Array} The command frame
 */
export function buildSetAllLightsCommand(
	lights,
	cluster = 0,
	scene = LIGHT_SCENES.CUSTOM,
) {
	if (!Array.isArray(lights) || lights.length < 1) {
		throw new RangeError("F1 needs at least one light channel");
	}
	if (lights.length > ALL_LIGHT_CHANNELS) {
		throw new RangeError(
			`F1 takes at most ${ALL_LIGHT_CHANNELS} light channels, got ${lights.length}`,
		);
	}
	if (!Number.isInteger(cluster) || cluster < 0 || cluster > 0xffffffff) {
		throw new RangeError(`Cluster must be 0-${0xffffffff}, got ${cluster}`);
	}
	let channelsHex = "";
	for (let channel = 0; channel < ALL_LIGHT_CHANNELS; channel++) {
		const light = lights[channel % lights.length];
		if (![1, 2, 3].includes(light.effectMode)) {
			throw new RangeError(`Light mode must be 1-3, got ${light.effectMode}`);
		}
		channelsHex +=
			byteHex(light.effectMode, "Light mode") +
			byteHex(light.brightness, "Brightness") +
			byteHex(light.r, "Red") +
			byteHex(light.g, "Green") +
			byteHex(light.b, "Blue") +
			byteHex(light.colorCycle ? 1 : 0, "Color cycle") +
			byteHex(light.effectSpeed, "Speed");
	}
	return buildCommand(
		COMMANDS.SET_ALL_LIGHTS,
		intToHex(cluster, 4) +
			(cluster === 0 ? "00" : "01") + // audio mode: live / file
			byteHex(scene, "Scene") +
			channelsHex,
		8,
	);
}

/**
 * The current light scene, to send when setting all lights at once (F1), or
 * null when the lights must go out channel by channel instead: firmware
 * without F1 (or not read yet), or a scene that isn't known. F1 always sets the scene too, so sending the one the file
 * (or the device) already has keeps a Halloween or Christmas scene on.
 *
 * @param {string} deviceType - DEVICE_PROFILES key
 * @param {string|number|null} version - Firmware ("v68") or null
 * @param {number|null|undefined} scene - Current LIGHT_SCENES value
 * @returns {number|null}
 */
export function currentLightScene(deviceType, version, scene) {
	if (!Number.isInteger(scene)) return null;
	return hasCapability(deviceType, version, CAPABILITIES.SET_ALL_LIGHTS)
		? scene
		: null;
}

/**
 * Whether the light scene picker (Custom / Halloween / Christmas) applies:
 * the firmware knows scenes and F1, which is the only command that sets one.
 *
 * @param {string} deviceType - DEVICE_PROFILES key
 * @param {string|number|null} version - Firmware ("v68") or null
 * @returns {boolean}
 */
export function supportsLightScenes(deviceType, version) {
	return (
		hasCapability(deviceType, version, CAPABILITIES.LIGHT_SCENES) &&
		hasCapability(deviceType, version, CAPABILITIES.SET_ALL_LIGHTS)
	);
}

/**
 * Whether a scene preset is on (Halloween or Christmas). The device then
 * ignores the channel colors and color cycle and plays the scene's own
 * colors; mode, brightness and speed still apply.
 *
 * @param {number|null|undefined} scene - LIGHT_SCENES value or null
 * @returns {boolean}
 */
export function isScenePreset(scene) {
	return Number.isInteger(scene) && scene !== LIGHT_SCENES.CUSTOM;
}

/**
 * The color a light channel shows (and F1 carries) in a scene preset, as
 * the phone app sends it: channel 0 the scene's first color, the others
 * the second, no color cycle.
 *
 * @param {number} scene - LIGHT_SCENES value
 * @param {number} channel - Light channel from 0
 * @returns {{r: number, g: number, b: number, colorCycle: number}|null}
 *   null for Custom or a scene without known colors
 */
export function sceneLightColor(scene, channel) {
	const colors = LIGHT_SCENE_COLORS[scene];
	if (!colors) return null;
	const hex = colors[channel === 0 ? 0 : 1];
	return {
		r: parseInt(hex.slice(0, 2), 16),
		g: parseInt(hex.slice(2, 4), 16),
		b: parseInt(hex.slice(4, 6), 16),
		colorCycle: 0,
	};
}

// All channels 0..n-1 present with a mode F1 takes; otherwise per channel.
function allChannelsComplete(lights) {
	return (
		lights.length > 0 &&
		lights.length <= ALL_LIGHT_CHANNELS &&
		lights.every((light) => light && [1, 2, 3].includes(light.effectMode))
	);
}

/**
 * Send the full set of per-file settings (movement, eye, every light
 * channel) in the order the device expects, pacing writes with `delayMs`
 * between each (write-without-response commands can be dropped if sent
 * back-to-back).
 *
 * @param {Object} connection - BLE connection manager (has .send)
 * @param {number} cluster - Device-assigned cluster for the file
 * @param {string} fileName - Filename to address
 * @param {Object} settings
 * @param {number} settings.action - Movement bitfield
 * @param {number} [settings.eye] - Eye icon (ignored unless hasEyeImage)
 * @param {Array<Object>} settings.lights - One entry per light channel, index
 *   = channel number (device supports up to 6, but most device types only
 *   use 1 or 2). Each entry: {brightness, effectMode, effectSpeed, r, g, b, colorCycle}
 * @param {Object} [options]
 * @param {boolean} [options.hasEyeImage] - Whether to send the eye command
 * @param {number} [options.delayMs] - Delay between commands
 * @param {(label: string) => void} [options.onStep] - Called after each command sends
 * @param {number|null} [options.scene] - From currentLightScene: when set, all
 *   lights go in one F1 with this scene instead of F2/F3/F4/F6 per channel
 * @returns {Promise<void>}
 */
export async function applyFileSettings(
	connection,
	cluster,
	fileName,
	settings,
	{ hasEyeImage = false, delayMs = 0, onStep, scene = null } = {},
) {
	const step = async (label, send) => {
		await send();
		onStep?.(label);
		if (delayMs) await sleep(delayMs);
	};

	await step(`Movement (CA) action=${settings.action}`, () =>
		sendSetMovement(connection, cluster, fileName, settings.action),
	);

	if (hasEyeImage) {
		await step(`Eye (F9) icon=${settings.eye}`, () =>
			sendSetEye(connection, cluster, fileName, settings.eye),
		);
	}

	// Devices can report up to 6 light channels; how many are actually used
	// depends on the device type (currently 1 for Lily, 2 for Skelly), so
	// iterate whatever the caller provides rather than assuming a fixed count.
	const lights = settings.lights || [];
	if (scene != null && allChannelsComplete(lights)) {
		// F1 has no file name: it addresses the file by cluster alone
		await step(`All lights (F1) channels=${lights.length} scene=${scene}`, () =>
			connection.send(buildSetAllLightsCommand(lights, cluster, scene)),
		);
		return;
	}
	for (let channel = 0; channel < lights.length; channel++) {
		const light = lights[channel];
		if (!light) continue;

		await step(
			`Light ${channel} Brightness (F3) brightness=${light.brightness}`,
			() =>
				sendSetLightBrightness(
					connection,
					cluster,
					fileName,
					channel,
					light.brightness,
				),
		);

		await step(
			`Light ${channel} Effect Mode (F2) mode=${light.effectMode}`,
			() =>
				sendSetLightMode(
					connection,
					cluster,
					fileName,
					channel,
					light.effectMode,
				),
		);

		if ((light.effectMode || 1) !== 1) {
			await step(
				`Light ${channel} Effect Speed (F6) speed=${light.effectSpeed}`,
				() =>
					sendSetLightSpeed(
						connection,
						cluster,
						fileName,
						channel,
						light.effectSpeed,
					),
			);
		}

		await step(
			`Light ${channel} Color (F4) rgb=${light.r},${light.g},${light.b} cycle=${light.colorCycle}`,
			() =>
				sendSetLightRgb(
					connection,
					cluster,
					fileName,
					channel,
					light.r,
					light.g,
					light.b,
					light.colorCycle,
				),
		);
	}
}
