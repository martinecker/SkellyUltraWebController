// The write queue: sends go out one at a time. Run with `npm test` (node:test).

import assert from "node:assert/strict";
import { test } from "node:test";
import { ConnectionManager } from "../js/connection-manager.js";

// A connection whose writes take a while, like Web Bluetooth's, and that
// fails if a write starts while another is still going (as Chrome does)
function slowConnection({ failOn = null } = {}) {
	return {
		busy: false,
		sent: [],
		async send(bytes) {
			if (this.busy) {
				throw new Error("GATT operation already in progress");
			}
			this.busy = true;
			await new Promise((resolve) => setTimeout(resolve, 5));
			this.busy = false;
			if (bytes[0] === failOn) {
				throw new Error(`write ${bytes[0]} failed`);
			}
			this.sent.push(bytes[0]);
		},
	};
}

function manager(connection) {
	const cm = new ConnectionManager({}, () => {});
	cm.activeConnection = connection;
	return cm;
}

test("sends started together go out one after another, in order", async () => {
	const connection = slowConnection();
	const cm = manager(connection);
	await Promise.all([1, 2, 3, 4].map((n) => cm.send(Uint8Array.of(n))));
	assert.deepEqual(connection.sent, [1, 2, 3, 4]);
});

test("a failed send rejects its caller only, the next ones still go out", async () => {
	const connection = slowConnection({ failOn: 2 });
	const cm = manager(connection);
	const results = await Promise.allSettled(
		[1, 2, 3].map((n) => cm.send(Uint8Array.of(n))),
	);
	assert.deepEqual(
		results.map((r) => r.status),
		["fulfilled", "rejected", "fulfilled"],
	);
	assert.equal(results[1].reason.message, "write 2 failed");
	assert.deepEqual(connection.sent, [1, 3]);
});

test("send without a connection rejects", async () => {
	const cm = new ConnectionManager({}, () => {});
	await assert.rejects(cm.send(Uint8Array.of(1)), /No active connection/);
});

test("a queued send goes to the connection it was made on", async () => {
	const first = slowConnection();
	const second = slowConnection();
	const cm = manager(first);
	const a = cm.send(Uint8Array.of(1));
	const b = cm.send(Uint8Array.of(2));
	cm.activeConnection = second;
	const c = cm.send(Uint8Array.of(3));
	await Promise.all([a, b, c]);
	assert.deepEqual(first.sent, [1, 2]);
	assert.deepEqual(second.sent, [3]);
});

test("a failed connect leaves no active connection", async () => {
	const cm = new ConnectionManager({}, () => {});
	cm.bleManager = {
		async connect() {
			throw new Error("GATT connect failed");
		},
	};
	await assert.rejects(cm.connect({ type: "direct" }), /GATT connect failed/);
	assert.equal(cm.activeConnection, null);
	assert.equal(cm.connectionType, null);
	assert.equal(cm.isConnected(), false);
});

test("pause holds back the next write, not the caller", async () => {
	const connection = slowConnection();
	const times = [];
	const send = connection.send.bind(connection);
	connection.send = async (bytes) => {
		await send(bytes);
		times.push(performance.now());
	};
	const cm = manager(connection);
	const started = performance.now();
	await cm.send(Uint8Array.of(1));
	cm.pause(40);
	assert.ok(performance.now() - started < 30, "pause doesn't wait itself");
	await cm.send(Uint8Array.of(2));
	assert.deepEqual(connection.sent, [1, 2]);
	assert.ok(times[1] - times[0] >= 40, `gap ${times[1] - times[0]} ms`);
});
