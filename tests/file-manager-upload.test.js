// Uploads (FileManager.sendFile). Run with `npm test`.

import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { COMMANDS } from "../js/constants.js";
import { FileManager } from "../js/file-manager.js";
import { bytesToHex, intToHex } from "../js/protocol.js";
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

// A device that answers commands from a table (tag -> reply hex). Commands
// without an entry get no reply; sends of a tag in failTags throw.
function scriptedDevice(replies, { failTags = [] } = {}) {
	const handlers = new Set();
	const notify = (hex) => {
		for (const handler of [...handlers]) handler(hex);
	};
	return {
		sent: [],
		isConnected: () => true,
		getMtuSize: () => null,
		pause() {},
		onNotification(handler) {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},
		async send(bytes) {
			const tag = bytesToHex(bytes).slice(0, 4);
			if (failTags.includes(tag)) {
				throw new Error("GATT operation failed");
			}
			this.sent.push(tag);
			const reply = replies[tag];
			if (reply) setImmediate(() => notify(reply));
		},
		waitForResponse(prefix, timeoutMs) {
			return new Promise((resolve, reject) => {
				const stop = () => {
					handlers.delete(handler);
					clearTimeout(timer);
				};
				const handler = (hex) => {
					if (!hex.startsWith(prefix)) return;
					stop();
					resolve(hex);
				};
				const timer = setTimeout(() => {
					stop();
					reject(new Error(`Timeout waiting for ${prefix}`));
				}, timeoutMs);
				handlers.add(handler);
			});
		},
	};
}

// Replies of a device that takes a small upload without trouble
const UPLOAD_OK = {
	[COMMANDS.QUERY_CAPACITY]: `BBD2${intToHex(100000, 4)}`,
	[COMMANDS.START_SEND_DATA]: "BBC00000000000",
	[COMMANDS.END_SEND_DATA]: "BBC200",
	[COMMANDS.CONFIRM_FILE]: "BBC300",
};

function setup(replies, options) {
	const state = new StateManager();
	state.setConnected(true);
	const connection = scriptedDevice(replies, options);
	const logs = [];
	const fileManager = new FileManager(connection, state, (message) =>
		logs.push(message),
	);
	return { state, connection, fileManager, logs };
}

// Run an upload to its end with mocked time
async function upload(state, fileManager, name, stepMs = 100) {
	mock.timers.enable({ apis: ["setTimeout", "Date"] });
	try {
		const result = fileManager.sendFile(Uint8Array.of(1, 2, 3), name);
		result.catch(() => {});
		await settle();
		while (state.transfer.inProgress) {
			mock.timers.tick(stepMs);
			await settle();
		}
		return await result;
	} finally {
		mock.timers.reset();
	}
}

test("an overwrite whose settings can't be restored still succeeds", async () => {
	const { state, connection, fileManager, logs } = setup(UPLOAD_OK, {
		failTags: [COMMANDS.SET_MOVEMENT_ACTION],
	});
	state.setFile(1, { serial: 1, cluster: 1000, name: "a.mp3", action: 255 });

	await upload(state, fileManager, "a.mp3");

	assert.ok(logs.some((m) => m.includes("Failed to restore")));
	assert.ok(connection.sent.includes(COMMANDS.CONFIRM_FILE));
	assert.ok(!connection.sent.includes(COMMANDS.CANCEL_SEND), "no C4");
});

test("no answer to C2 closes the upload with C4", async () => {
	const replies = { ...UPLOAD_OK };
	delete replies[COMMANDS.END_SEND_DATA];
	const { state, connection, fileManager } = setup(replies);

	await assert.rejects(
		upload(state, fileManager, "a.mp3", 1000),
		/Timeout waiting for transfer end/,
	);
	const c4 = connection.sent.filter((tag) => tag === COMMANDS.CANCEL_SEND);
	assert.equal(c4.length, 1);
	assert.equal(connection.sent.at(-1), COMMANDS.CANCEL_SEND);
});

test("a failed C3 closes the upload with C4", async () => {
	const replies = { ...UPLOAD_OK, [COMMANDS.CONFIRM_FILE]: "BBC301" };
	const { state, connection, fileManager } = setup(replies);

	await assert.rejects(
		upload(state, fileManager, "a.mp3"),
		/Device failed to confirm transfer/,
	);
	assert.equal(connection.sent.at(-1), COMMANDS.CANCEL_SEND);
});

test("a refused C0 sends no C4", async () => {
	const replies = { ...UPLOAD_OK, [COMMANDS.START_SEND_DATA]: "BBC001" };
	const { state, connection, fileManager } = setup(replies);

	await assert.rejects(
		upload(state, fileManager, "a.mp3"),
		/Device rejected transfer start/,
	);
	assert.ok(!connection.sent.includes(COMMANDS.CANCEL_SEND));
});

test("the play order is read from the device before a new upload", async () => {
	const { state, fileManager } = setup({
		[COMMANDS.QUERY_FILE_ORDER]: "BBD1020002000100",
	});
	state.setFile(1, { serial: 1, name: "a.mp3" });
	state.setFile(2, { serial: 2, name: "b.mp3" });
	state.updateDevice({ order: [1, 2] }); // stale

	assert.deepEqual(await fileManager.readOrderedFileNames(), [
		"b.mp3",
		"a.mp3",
	]);
	assert.deepEqual(state.device.order, [2, 1]);
});

test("without an answer the last play order read is used", async () => {
	const { state, fileManager, logs } = setup({});
	state.setFile(1, { serial: 1, name: "a.mp3" });
	state.setFile(2, { serial: 2, name: "b.mp3" });
	state.updateDevice({ order: [2, 1] });

	mock.timers.enable({ apis: ["setTimeout"] });
	try {
		const names = fileManager.readOrderedFileNames();
		await settle();
		mock.timers.tick(5000);
		assert.deepEqual(await names, ["b.mp3", "a.mp3"]);
	} finally {
		mock.timers.reset();
	}
	assert.ok(logs.some((m) => m.includes("No play order from the device")));
});
