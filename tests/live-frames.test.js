// Live controls (cluster 0, no file name) send the same frames as the
// hand-built payloads they replaced. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { COMMANDS } from "../js/constants.js";
import {
	sendSetEyeIcon,
	sendSetLightBrightness,
	sendSetLightMode,
	sendSetLightRgb,
	sendSetLightSpeed,
	sendSetMovementAction,
} from "../js/device-settings.js";
import { buildCommand, bytesToHex, rgbToHex } from "../js/protocol.js";

function recorder() {
	const sent = [];
	return {
		sent,
		send: async (bytes) => {
			sent.push(bytesToHex(bytes).toUpperCase());
		},
	};
}

// The frames app-modular.js built by hand before
const old = (tag, payload, minBytes) =>
	bytesToHex(buildCommand(tag, payload, minBytes)).toUpperCase();

test("live light frames", async () => {
	const c = recorder();
	await sendSetLightBrightness(c, 0, "", 1, 200);
	await sendSetLightMode(c, 0, "", 0, 3);
	await sendSetLightSpeed(c, 0, "", 1, 7);
	await sendSetLightRgb(c, 0, "", 0, 255, 16, 1, 1);
	await sendSetLightRgb(c, 0, "", 1, 0, 0, 255, 0);
	assert.deepEqual(c.sent, [
		old(COMMANDS.SET_LIGHT_BRIGHTNESS, "01C800000000", 8),
		old(COMMANDS.SET_LIGHT_MODE, "00030000000000", 8),
		old(COMMANDS.SET_LIGHT_SPEED, "010700000000", 8),
		old(COMMANDS.SET_LIGHT_RGB, "00FF1001010000000000", 9),
		old(COMMANDS.SET_LIGHT_RGB, "010000FF000000000000", 9),
	]);
});

test("live movement and eye frames", async () => {
	const c = recorder();
	await sendSetMovementAction(c, 0, "", 255);
	await sendSetMovementAction(c, 0, "", 0x05);
	await sendSetMovementAction(c, 0, "", 0);
	await sendSetEyeIcon(c, 0, "", 12);
	assert.deepEqual(c.sent, [
		old(COMMANDS.SET_MOVEMENT_ACTION, "FF00000000", 8),
		old(COMMANDS.SET_MOVEMENT_ACTION, "0500000000", 8),
		old(COMMANDS.SET_MOVEMENT_ACTION, "0000000000", 8),
		old(COMMANDS.SET_EYE_ICON, "0C000000000000", 8),
	]);
});

test("rgbToHex gives a color input value", () => {
	assert.equal(rgbToHex(255, 16, 1), "#ff1001");
	assert.equal(rgbToHex(0, 0, 0), "#000000");
});
