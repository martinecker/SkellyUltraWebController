// File info (BBD0) in both firmware layouts and live status (BBE1) with and
// without the scene byte. Run with `npm test` (node:test).

import assert from "node:assert/strict";
import { test } from "node:test";
import { crc8, intToHex, utf16leHex } from "../js/protocol.js";
import { ProtocolParser } from "../js/protocol-parser.js";
import { StateManager } from "../js/state-manager.js";

const LIGHT = "03C8102030010A"; // pulsing, 200, rgb 10/20/30, cycle on, speed 10
const LIGHT_OBJECT = {
	effectMode: 3,
	brightness: 200,
	r: 0x10,
	g: 0x20,
	b: 0x30,
	colorCycle: 1,
	effectSpeed: 10,
};

const withCrc = (body) =>
	body + crc8(Uint8Array.from(Buffer.from(body, "hex")));

function setup() {
	const state = new StateManager();
	const fileManager = { finalizeFilesIfDone() {} };
	const parser = new ProtocolParser(state, fileManager, () => {});
	return { state, parser };
}

// BBD0 up to the eye icon: serial 2, cluster 1002, total 3, action 0x06
const fileInfoHead = `BBD0${intToHex(2, 2)}${intToHex(1002, 4)}${intToHex(3, 2)}000006${LIGHT.repeat(6)}05`;

test("BBD0 with the scene byte (marker at byte 58)", () => {
	const { state, parser } = setup();
	parser.parse(withCrc(`${fileInfoHead}02075C55${utf16leHex("song.mp3")}`));
	const file = state.getFile(2);
	assert.equal(file.cluster, 1002);
	assert.equal(file.totalFiles, 3);
	assert.equal(file.action, 6);
	assert.equal(file.lights.length, 6);
	assert.deepEqual(file.lights[5], LIGHT_OBJECT);
	assert.equal(file.eyeIcon, 5);
	assert.equal(file.scene, 2);
	assert.equal(file.dbPos, 7);
	assert.equal(file.name, "song.mp3");
});

test("BBD0 without the scene byte (v66, marker at byte 57)", () => {
	const { state, parser } = setup();
	parser.parse(withCrc(`${fileInfoHead}075C55${utf16leHex("old.mp3")}`));
	const file = state.getFile(2);
	assert.equal(file.eyeIcon, 5);
	assert.equal(file.scene, null);
	assert.equal(file.dbPos, 7);
	assert.equal(file.name, "old.mp3");
});

test("BBE1 with the scene byte", () => {
	const { state, parser } = setup();
	parser.parse(withCrc(`BBE106${LIGHT.repeat(6)}0401`));
	assert.equal(state.live.action, 6);
	assert.equal(state.live.eyeIcon, 4);
	assert.equal(state.live.scene, 1);
	assert.deepEqual(state.live.lights[0], LIGHT_OBJECT);
});

test("BBE1 without the scene byte", () => {
	const { state, parser } = setup();
	parser.parse(withCrc(`BBE106${LIGHT.repeat(6)}04`));
	assert.equal(state.live.eyeIcon, 4);
	assert.equal(state.live.scene, null);
	assert.equal(state.live.lights.length, 6);
});
