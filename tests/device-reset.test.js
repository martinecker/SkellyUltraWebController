// Nothing a device reported outlives its connection. Run with `npm test`.

import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { BLEManager } from "../js/ble-manager.js";
import { ConnectionManager } from "../js/connection-manager.js";
import { DEVICE_TYPES, TIMEOUTS } from "../js/constants.js";
import { FileManager } from "../js/file-manager.js";
import { RestProxy } from "../js/rest-proxy.js";
import { StateManager } from "../js/state-manager.js";

afterEach(() => mock.timers.reset());

// State as after talking to a device for a while
function knownDevice() {
	const state = new StateManager();
	state.setDeviceType(DEVICE_TYPES.SKELLY_12FT);
	state.updateDevice({
		name: "Old Skelly",
		liveName: "Old Skelly(Live)",
		connected: true,
		version: 66,
		volume: 80,
		order: [2, 1],
		pinCode: "1234",
	});
	state.updateLive({ action: 255, eyeIcon: 3, scene: 1 });
	state.setFile(1, { serial: 1, name: "a.mp3" });
	state.setFile(2, { serial: 2, name: "b.mp3" });
	state.updateFilesMetadata({ expected: 2, lastRefresh: 1 });
	return state;
}

function assertForgotten(state) {
	assert.equal(state.device.version, null);
	assert.equal(state.device.order, null);
	assert.equal(state.device.name, "");
	assert.equal(state.device.liveName, "");
	assert.equal(state.device.pinCode, null);
	assert.equal(state.device.volume, null);
	assert.equal(state.live.action, null);
	assert.equal(state.live.scene, null);
	assert.equal(state.files.items.size, 0);
	assert.equal(state.files.expected, null);
	assert.equal(state.hasFileName("a.mp3"), null);
	// The user's device type pick stays
	assert.equal(state.deviceType, DEVICE_TYPES.SKELLY_12FT);
}

test("a dropped BLE connection forgets the device", () => {
	const state = knownDevice();
	const ble = new BLEManager(state, () => {});
	ble.handleDisconnect(); // gattserverdisconnected
	assert.equal(state.device.connected, false);
	assertForgotten(state);
});

test("a REST proxy disconnect forgets the device", () => {
	const state = knownDevice();
	const proxy = new RestProxy(state, () => {});
	proxy.cleanup();
	assert.equal(state.device.connected, false);
	assertForgotten(state);
});

test("a new connect starts without the last device's state", async () => {
	const state = knownDevice();
	const cm = new ConnectionManager(state, () => {});
	let versionWhileConnecting;
	cm.bleManager = {
		async connect() {
			versionWhileConnecting = state.device.version;
			state.updateDevice({ name: "New Skelly", connected: true });
		},
		isConnected: () => true,
		clearNotificationHandlers() {},
		onNotification() {},
	};
	await cm.connect({ type: "direct" });
	assert.equal(versionWhileConnecting, null);
	assert.equal(state.device.name, "New Skelly");
	assert.equal(state.files.items.size, 0);
	assert.equal(state.device.order, null);
});

test("a file list refresh doesn't time out after a disconnect", async () => {
	mock.timers.enable({ apis: ["setTimeout"] });
	const state = knownDevice();
	const logs = [];
	const connection = { isConnected: () => true, async send() {} };
	const fileManager = new FileManager(connection, state, (line) =>
		logs.push(line),
	);
	const ble = new BLEManager(state, () => {});

	await fileManager.refreshFileList();
	assert.equal(state.files.activeFetch, true);
	ble.handleDisconnect();
	assert.equal(state.files.activeFetch, false);
	assert.equal(state.files.fetchTimer, null);

	mock.timers.tick(TIMEOUTS.FILE_LIST);
	assert.deepEqual(logs, [], "no timeout message");
});
