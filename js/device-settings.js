/**
 * Device Settings Commands
 * Convenience wrappers for the per-file light/movement/eye setting commands
 * (AAF2/F3/F4/F6/F9/CA), which all share the same cluster+filename addressing
 * scheme. Centralizes payload construction so callers (Apply All in the edit
 * modal, and the post-overwrite settings restore in the file manager) don't
 * each reimplement it.
 */

import { COMMANDS } from "./constants.js";
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

/** Send light brightness (F3) for a channel (0 or 1). */
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

/**
 * Send the full set of per-file settings (movement, eye, both light
 * channels) in the order the device expects, pacing writes with `delayMs`
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
 * @returns {Promise<void>}
 */
export async function applyFileSettings(
	connection,
	cluster,
	fileName,
	settings,
	{ hasEyeImage = false, delayMs = 0, onStep } = {},
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
