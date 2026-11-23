// Uploads (FileManager.sendFile). Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { FileManager } from "../js/file-manager.js";
import { bytesToHex } from "../js/protocol.js";
import { StateManager } from "../js/state-manager.js";

// A connection whose replies don't come until failReplies() is called
function silentConnection() {
	const waits = [];
	return {
		sent: [],
		isConnected: () => true,
		getMtuSize: () => null,
		async send(bytes) {
			this.sent.push(bytesToHex(bytes).slice(0, 4));
		},
		waitForResponse(prefix) {
			return new Promise((_resolve, reject) => {
				waits.push(() => reject(new Error(`Timeout waiting for ${prefix}`)));
			});
		},
		failReplies() {
			for (const fail of waits.splice(0)) fail();
		},
	};
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("a second upload is refused while one runs", async () => {
	const state = new StateManager();
	const connection = silentConnection();
	const fileManager = new FileManager(connection, state, () => {});
	const bytes = Uint8Array.of(1, 2, 3);

	const first = fileManager.sendFile(bytes, "a.mp3");
	first.catch(() => {});
	await settle();
	assert.equal(state.transfer.inProgress, true);
	const sentBefore = connection.sent.length;

	await assert.rejects(
		fileManager.sendFile(bytes, "b.mp3"),
		/A transfer is already running/,
	);
	assert.equal(connection.sent.length, sentBefore, "nothing sent for it");
	assert.equal(state.transfer.inProgress, true, "the first keeps running");

	// The first ends (the device never answers C0)
	while (state.transfer.inProgress) {
		connection.failReplies();
		await settle();
	}
	await assert.rejects(first, /Timeout waiting for BBC0/);

	// Now another upload may start
	const third = fileManager.sendFile(bytes, "c.mp3");
	third.catch(() => {});
	await settle();
	assert.equal(state.transfer.inProgress, true);
	while (state.transfer.inProgress) {
		connection.failReplies();
		await settle();
	}
});
