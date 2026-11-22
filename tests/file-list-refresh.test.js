// A file list refresh always ends, even when the device's play order (BBD1)
// or a write is lost. Run with `npm test` (node:test).

import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { COMMANDS, TIMEOUTS } from "../js/constants.js";
import { FileManager } from "../js/file-manager.js";
import { crc8, intToHex, utf16leHex } from "../js/protocol.js";
import { ProtocolParser } from "../js/protocol-parser.js";
import { StateManager } from "../js/state-manager.js";

// One file info notification (scene firmware layout: marker at byte 58)
function fileInfoHex(serial, total, name) {
	const light = "01FF0000FF0000"; // static, full brightness, blue
	const body =
		"BBD0" +
		intToHex(serial, 2) +
		intToHex(1000 + serial, 4) + // cluster
		intToHex(total, 2) +
		"0000" +
		"FF" + // movement: all
		light.repeat(6) +
		"01" + // eye icon
		"00" + // scene
		intToHex(serial, 1) + // position
		"5C55" +
		utf16leHex(name);
	return body + crc8(Uint8Array.from(Buffer.from(body, "hex")));
}

// Records the command tags sent; can fail sends of one tag
function fakeConnection({ failTag = null } = {}) {
	return {
		sent: [],
		isConnected: () => true,
		async send(bytes) {
			const tag = Buffer.from(bytes.subarray(0, 2))
				.toString("hex")
				.toUpperCase();
			if (tag === failTag) {
				throw new Error("GATT operation failed");
			}
			this.sent.push(tag);
		},
	};
}

function setup(options) {
	const state = new StateManager();
	state.setConnected(true);
	const connection = fakeConnection(options);
	const logs = [];
	const log = (message) => logs.push(message);
	const fileManager = new FileManager(connection, state, log);
	const parser = new ProtocolParser(state, fileManager, log);
	return { state, connection, fileManager, parser, logs };
}

// Lets queued promise callbacks (the awaited sends) run
const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => mock.timers.enable({ apis: ["setTimeout", "Date"] }));
afterEach(() => mock.timers.reset());

test("the play order ends the refresh", async () => {
	const { state, connection, fileManager, parser, logs } = setup();
	await fileManager.startFetchFiles();
	parser.parse(fileInfoHex(1, 2, "a.mp3"));
	parser.parse(fileInfoHex(2, 2, "b.mp3"));
	await settle();
	assert.deepEqual(connection.sent, [
		COMMANDS.QUERY_FILE_LIST,
		COMMANDS.QUERY_CAPACITY,
		COMMANDS.QUERY_FILE_ORDER,
	]);
	assert.equal(state.files.activeFetch, true);

	parser.parse("BBD1020001000200");
	assert.equal(state.files.activeFetch, false);
	assert.deepEqual(state.device.order, [1, 2]);
	assert.deepEqual(fileManager.orderedFileNames(), ["a.mp3", "b.mp3"]);

	// No late timeout warning afterwards
	mock.timers.tick(TIMEOUTS.FILE_ORDER + TIMEOUTS.FILE_LIST);
	assert.ok(!logs.some((line) => line.includes("timeout")));
});

test("without a play order the refresh ends after FILE_ORDER", async () => {
	const { state, fileManager, parser } = setup();
	await fileManager.startFetchFiles();
	parser.parse(fileInfoHex(1, 1, "a.mp3"));
	await settle();
	assert.equal(state.files.activeFetch, true);

	mock.timers.tick(TIMEOUTS.FILE_ORDER - 1);
	assert.equal(state.files.activeFetch, true);
	mock.timers.tick(1);
	assert.equal(state.files.activeFetch, false);
	assert.equal(state.files.items.size, 1);
});

test("a failed play order query ends the refresh right away", async () => {
	const { state, fileManager, parser } = setup({
		failTag: COMMANDS.QUERY_FILE_ORDER,
	});
	await fileManager.startFetchFiles();
	parser.parse(fileInfoHex(1, 1, "a.mp3"));
	await settle();
	assert.equal(state.files.activeFetch, false);
});

test("a failed file list query ends the refresh and doesn't throw", async () => {
	const { state, fileManager } = setup({ failTag: COMMANDS.QUERY_FILE_LIST });
	await fileManager.startFetchFiles();
	assert.equal(state.files.activeFetch, false);
});

test("file infos after the list is complete don't ask for the order again", async () => {
	const { connection, fileManager, parser } = setup();
	await fileManager.startFetchFiles();
	parser.parse(fileInfoHex(1, 1, "a.mp3"));
	parser.parse(fileInfoHex(1, 1, "a.mp3"));
	await settle();
	assert.equal(
		connection.sent.filter((tag) => tag === COMMANDS.QUERY_FILE_ORDER).length,
		1,
	);
});

test("waiting for a file ends as soon as its info arrives", async () => {
	const { fileManager, parser } = setup();
	await fileManager.startFetchFiles();
	const waiting = fileManager.waitForFileByName("b.mp3");
	parser.parse(fileInfoHex(1, 2, "a.mp3"));
	parser.parse(fileInfoHex(2, 2, "b.mp3"));
	const file = await waiting;
	assert.equal(file?.serial, 2);
});

test("waiting for the refresh ends with the play order", async () => {
	const { fileManager, parser } = setup();
	await fileManager.startFetchFiles();
	const waiting = fileManager.waitForFileListRefresh();
	parser.parse(fileInfoHex(1, 1, "a.mp3"));
	await settle();
	parser.parse("BBD101000100");
	assert.equal(await waiting, true);
});

test("waiting for files that never come times out", async () => {
	const { state, fileManager } = setup();
	const waiting = fileManager.waitForFilesByName(["missing.mp3"], 1000);
	mock.timers.tick(1000);
	assert.equal(await waiting, false);
	// The waiter is gone: no observers left behind
	assert.equal(state.observers.get("files")?.size ?? 0, 0);
	assert.equal(state.observers.get("fileArrived")?.size ?? 0, 0);
});
