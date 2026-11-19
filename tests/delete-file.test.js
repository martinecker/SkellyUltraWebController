// Deleting a file waits for the device's answer (BBC7). Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { FileManager } from "../js/file-manager.js";
import { bytesToHex } from "../js/protocol.js";

// Answers each command with `reply` (or nothing), or fails the send
function fakeConnection({ reply = null, sendError = null } = {}) {
	let waiter = null;
	return {
		sent: [],
		isConnected: () => true,
		waitForResponse(prefix) {
			return new Promise((resolve, reject) => {
				waiter = { prefix, resolve };
				if (!reply) setTimeout(() => reject(new Error("Timeout")), 5);
			});
		},
		async send(bytes) {
			if (sendError) throw new Error(sendError);
			this.sent.push(bytesToHex(bytes));
			if (reply && waiter && reply.startsWith(waiter.prefix)) {
				waiter.resolve(reply);
			}
		},
	};
}

const manager = (connection) => new FileManager(connection, {}, () => {});

test("delete sends C7 with serial and cluster and reports success", async () => {
	const connection = fakeConnection({ reply: "BBC70000" });
	assert.equal(await manager(connection).deleteFile(3, 0x1234), true);
	assert.match(connection.sent[0], /^AAC7000300001234/);
});

test("delete reports a failed BBC7", async () => {
	const connection = fakeConnection({ reply: "BBC70100" });
	assert.equal(await manager(connection).deleteFile(3, 1), false);
});

test("delete throws without an answer or when the send fails", async () => {
	await assert.rejects(manager(fakeConnection()).deleteFile(3, 1), /Timeout/);
	await assert.rejects(
		manager(fakeConnection({ sendError: "Device not connected" })).deleteFile(
			3,
			1,
		),
		/Device not connected/,
	);
});
