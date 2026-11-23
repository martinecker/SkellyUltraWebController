// Command frames built byte for byte. Run with `npm test` (node:test).

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEVICE_TYPES, LIGHT_SCENES } from "../js/constants.js";
import {
	applyFileSettings,
	buildSetAllLights,
	buildSetPinAndName,
	currentLightScene,
	isScenePreset,
	sceneLightColor,
	supportsLightScenes,
} from "../js/device-settings.js";
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
	const payload = unframe(buildSetAllLights([RED, BLUE, RED, BLUE, RED, BLUE]));
	// cluster 0, audio mode 0, scene 0, then the channels
	assert.equal(payload, `000000000000${`${RED_HEX}${BLUE_HEX}`.repeat(3)}`);
});

test("F1 for a file comes with audio mode 1, like in the phone app", () => {
	const payload = unframe(
		buildSetAllLights(Array(6).fill(RED), 0x12345678, LIGHT_SCENES.HALLOWEEN),
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
		const payload = unframe(buildSetAllLights(given));
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
		assert.throws(() => buildSetAllLights(...args), RangeError);
	}
});

/** A connection that keeps every frame sent, and its tag (AAxx) */
function recorder() {
	const frames = [];
	const tags = [];
	return {
		frames,
		tags,
		send: async (frame) => {
			frames.push(frame);
			tags.push(bytesToHex(frame).toUpperCase().slice(0, 4));
		},
	};
}

const FILE_SETTINGS = { action: 255, eyeIcon: 3, lights: [RED, BLUE] };

test("file settings with an F1 scene: lights in one F1 with that scene", async () => {
	const connection = recorder();
	await applyFileSettings(connection, 7, "a.mp3", FILE_SETTINGS, {
		hasEyeImage: true,
		scene: LIGHT_SCENES.HALLOWEEN,
	});
	assert.deepEqual(connection.tags, ["AACA", "AAF9", "AAF1"]);
	const payload = unframe(connection.frames[2]);
	assert.equal(payload.slice(0, 12), "000000070101"); // cluster 7, file, Halloween
	assert.equal(payload.slice(12, 40), RED_HEX + BLUE_HEX);
});

test("file settings without an F1 scene: per channel as before", async () => {
	const connection = recorder();
	await applyFileSettings(connection, 7, "a.mp3", FILE_SETTINGS);
	assert.deepEqual(connection.tags, [
		"AACA",
		"AAF3", // channel 0 is static: no speed
		"AAF2",
		"AAF4",
		"AAF3",
		"AAF2",
		"AAF6",
		"AAF4",
	]);
});

test("file settings fall back per channel when a light can't go in F1", async () => {
	const connection = recorder();
	await applyFileSettings(
		connection,
		7,
		"a.mp3",
		{ action: 0, lights: [{ ...RED, effectMode: 0 }] },
		{ scene: LIGHT_SCENES.CUSTOM },
	);
	assert.ok(!connection.tags.includes("AAF1"));
	assert.ok(connection.tags.includes("AAF2"));
});

test("F1 only for firmware that has it, and a known scene", () => {
	const { SKELLY, SKELLY_12FT } = DEVICE_TYPES;
	assert.equal(currentLightScene(SKELLY, "v68", LIGHT_SCENES.CHRISTMAS), 2);
	assert.equal(currentLightScene(SKELLY, "v68", LIGHT_SCENES.CUSTOM), 0);
	assert.equal(currentLightScene(SKELLY, "v66", LIGHT_SCENES.CUSTOM), null);
	assert.equal(
		currentLightScene(SKELLY, null, LIGHT_SCENES.CUSTOM),
		null,
		"not read yet",
	);
	assert.equal(
		currentLightScene(SKELLY, "v68", null),
		null,
		"no scene in the file list",
	);
	assert.equal(
		currentLightScene(SKELLY_12FT, "v14", LIGHT_SCENES.HALLOWEEN),
		1,
	);
});

test("scene picker only on firmware with scenes and F1", () => {
	const { SKELLY, SKELLY_12FT, LILY, SANTA } = DEVICE_TYPES;
	assert.equal(supportsLightScenes(SKELLY, "v68"), true);
	assert.equal(supportsLightScenes(SKELLY, "v66"), false);
	assert.equal(supportsLightScenes(SKELLY, null), false);
	assert.equal(supportsLightScenes(SKELLY_12FT, "v14"), true);
	assert.equal(supportsLightScenes(LILY, "v24"), true);
	assert.equal(supportsLightScenes(SANTA, "v1"), true);
	assert.equal(supportsLightScenes("unknown", "v99"), false);
});

test("Halloween and Christmas are presets, Custom and unknown are not", () => {
	assert.equal(isScenePreset(LIGHT_SCENES.HALLOWEEN), true);
	assert.equal(isScenePreset(LIGHT_SCENES.CHRISTMAS), true);
	assert.equal(isScenePreset(LIGHT_SCENES.CUSTOM), false);
	assert.equal(isScenePreset(null), false);
	assert.equal(isScenePreset(undefined), false);
});

test("scene colors as the app sends them: channel 0 first, the rest second", () => {
	const red = { r: 0x96, g: 0x01, b: 0x00, colorCycle: 0 };
	const green = { r: 0x03, g: 0x64, b: 0x00, colorCycle: 0 };
	assert.deepEqual(sceneLightColor(LIGHT_SCENES.CHRISTMAS, 0), red);
	assert.deepEqual(sceneLightColor(LIGHT_SCENES.CHRISTMAS, 1), green);
	assert.deepEqual(sceneLightColor(LIGHT_SCENES.CHRISTMAS, 5), green);
	assert.deepEqual(sceneLightColor(LIGHT_SCENES.HALLOWEEN, 0), {
		r: 0xfd,
		g: 0x94,
		b: 0x2a,
		colorCycle: 0,
	});
	assert.equal(sceneLightColor(LIGHT_SCENES.CUSTOM, 0), null);
	assert.equal(sceneLightColor(7, 0), null);
});

// "Skelly(Live)" as ASCII hex
const SKELLY_LIVE = "536B656C6C79284C69766529";

test("the PIN and name command is ASCII with the (Live) suffix", () => {
	const { bytes, name } = buildSetPinAndName("1234", "Skelly", "abcdefgh");
	const hex = bytesToHex(bytes);
	assert.equal(name, "Skelly(Live)");
	assert.equal(
		hex.slice(0, -2),
		`AAFB31323334${"6162636465666768"}0C${SKELLY_LIVE}`,
	);
	assert.equal(hex.slice(-2), crc8(bytes.subarray(0, -1)));
});

test("a name that has the suffix already doesn't get it twice", () => {
	const { name } = buildSetPinAndName("1234", "Skelly(Live)");
	assert.equal(name, "Skelly(Live)");
});

test("without a known Wi-Fi password the default goes out", () => {
	for (const wifi of [null, "", "short", "töö long!"]) {
		const hex = bytesToHex(buildSetPinAndName("0000", "Skelly", wifi).bytes);
		// "01234567" after the PIN
		assert.equal(hex.slice(12, 28), "3031323334353637", String(wifi));
	}
});

test("names the device can't take are refused", () => {
	assert.throws(() => buildSetPinAndName("1234", "Skélly"), /ASCII/);
	assert.throws(() => buildSetPinAndName("1234", "   "), /empty/);
	assert.throws(() => buildSetPinAndName("1234", "(Live)"), /empty/);
	assert.throws(() => buildSetPinAndName("1234", "x".repeat(23)), /22/);
	// 22 characters plus the suffix is fine
	const { name } = buildSetPinAndName("1234", "x".repeat(22));
	assert.equal(name.length, 28);
});

test("a PIN that isn't 4 digits is refused", () => {
	for (const pin of ["", "123", "12345", "12a4"]) {
		assert.throws(() => buildSetPinAndName(pin, "Skelly"), /4 digits/);
	}
});
