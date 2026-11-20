// BLEManager notifications and disconnect. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { BLEManager } from "../js/ble-manager.js";
import { StateManager } from "../js/state-manager.js";

function bleManager() {
	const logs = [];
	const ble = new BLEManager(new StateManager(), (line) => logs.push(line));
	return { ble, logs };
}

test("a notification is read from its DataView's own bytes only", () => {
	const { ble } = bleManager();
	const received = [];
	ble.onNotification((hex) => received.push(hex));
	// The DataView covers bytes 2..4 of a bigger buffer
	const buffer = Uint8Array.of(0x11, 0x22, 0xbb, 0xc6, 0x01, 0x33).buffer;
	ble.handleNotification({ target: { value: new DataView(buffer, 2, 3) } });
	assert.deepEqual(received, ["BBC601"]);
});

test("disconnect cleans up once, not again from the GATT event", async () => {
	const { ble, logs } = bleManager();
	const listeners = new Set();
	const device = {
		gatt: {
			connected: true,
			disconnect() {
				this.connected = false;
				// Chrome fires gattserverdisconnected for a disconnect we asked for
				for (const listener of listeners) listener();
			},
		},
		addEventListener: (_type, listener) => listeners.add(listener),
		removeEventListener: (_type, listener) => listeners.delete(listener),
	};
	ble.device = device;
	device.addEventListener("gattserverdisconnected", ble.handleDisconnect);
	await ble.disconnect();
	assert.equal(logs.filter((line) => line === "Disconnected").length, 1);
});
