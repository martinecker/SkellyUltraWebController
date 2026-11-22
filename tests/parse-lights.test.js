// The shared light block parser of BBE1 and BBD0. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLights } from "../js/protocol-parser.js";

test("parses 6 channels of mode, brightness, rgb, cycle, speed", () => {
	const lights = parseLights(`01FF102030000A${"02803040500105".repeat(5)}`);
	assert.equal(lights.length, 6);
	assert.deepEqual(lights[0], {
		effectMode: 1,
		brightness: 255,
		r: 0x10,
		g: 0x20,
		b: 0x30,
		colorCycle: 0,
		effectSpeed: 10,
	});
	assert.deepEqual(lights[5], {
		effectMode: 2,
		brightness: 128,
		r: 0x30,
		g: 0x40,
		b: 0x50,
		colorCycle: 1,
		effectSpeed: 5,
	});
});

test("skips a cut-off channel", () => {
	assert.equal(parseLights("01FF102030000A01FF").length, 1);
});
