// Command frames built byte for byte. Run with `npm test` (node:test).

import assert from "node:assert/strict";
import { test } from "node:test";
import { LIGHT_SCENES } from "../js/constants.js";
import { buildSetAllLightsCommand } from "../js/device-settings.js";
import { bytesToHex, crc8 } from "../js/protocol.js";

const RED = {
	effectMode: 1,
	brightness: 200,
	r: 255,
	g: 0,
	b: 0,
	colorCycle: false,
	effectSpeed: 0,
};
const BLUE = {
	effectMode: 3,
	brightness: 100,
	r: 0,
	g: 0,
	b: 255,
	colorCycle: true,
	effectSpeed: 40,
};
const RED_HEX = "01C8FF00000000";
const BLUE_HEX = "03640000FF0128";

/** The payload of an F1 frame, after checking its tag and checksum */
function unframe(frame) {
	const hex = bytesToHex(frame).toUpperCase();
	assert.equal(hex.slice(0, 4), "AAF1");
	assert.equal(crc8(frame.slice(0, -1)), hex.slice(-2));
	return hex.slice(4, -2);
}

test("F1 for the live lights: audio mode 0, scene, 6 channels", () => {
	const payload = unframe(
		buildSetAllLightsCommand([RED, BLUE, RED, BLUE, RED, BLUE]),
	);
	// cluster 0, audio mode 0, scene 0, then the channels
	assert.equal(payload, `000000000000${`${RED_HEX}${BLUE_HEX}`.repeat(3)}`);
});

test("F1 for a file comes with audio mode 1, like in the phone app", () => {
	const payload = unframe(
		buildSetAllLightsCommand(
			Array(6).fill(RED),
			0x12345678,
			LIGHT_SCENES.HALLOWEEN,
		),
	);
	assert.equal(payload.slice(0, 12), "123456780101");
	assert.equal(payload.slice(12), RED_HEX.repeat(6));
});

test("F1 fills missing channels like the app: the given ones in turn", () => {
	const cases = [
		[[RED], Array(6).fill(RED_HEX)],
		[
			[RED, BLUE],
			[RED_HEX, BLUE_HEX, RED_HEX, BLUE_HEX, RED_HEX, BLUE_HEX],
		],
		[
			[RED, BLUE, BLUE, RED],
			[RED_HEX, BLUE_HEX, BLUE_HEX, RED_HEX, RED_HEX, BLUE_HEX],
		],
	];
	for (const [given, sent] of cases) {
		const payload = unframe(buildSetAllLightsCommand(given));
		assert.equal(payload.slice(12), sent.join(""));
	}
});

test("F1 refuses bad values", () => {
	const bad = [
		[[]],
		[Array(7).fill(RED)],
		[[{ ...RED, effectMode: 0 }]],
		[[{ ...RED, brightness: 256 }]],
		[[{ ...RED, g: undefined }]],
		[[RED], -1],
		[[RED], 0, 256], // scene
	];
	for (const args of bad) {
		assert.throws(() => buildSetAllLightsCommand(...args), RangeError);
	}
});
