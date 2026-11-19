// Speed scale conversions. Run with `npm test` (node:test).

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	deviceSpeedToUI,
	MAX_UI_EFFECT_SPEED,
	uiSpeedToDevice,
} from "../js/protocol.js";

test("the UI speed runs 0-10 like the official app", () => {
	assert.equal(MAX_UI_EFFECT_SPEED, 10);
	assert.equal(uiSpeedToDevice(0), 10); // slowest
	assert.equal(uiSpeedToDevice(10), 0); // fastest
	assert.equal(uiSpeedToDevice(7), 3);
	assert.equal(uiSpeedToDevice(254), 0); // clamped
	assert.equal(uiSpeedToDevice(-1), 10);
});

test("device speeds map back to the UI scale", () => {
	assert.equal(deviceSpeedToUI(0), 10);
	assert.equal(deviceSpeedToUI(255), 10); // also fastest
	assert.equal(deviceSpeedToUI(10), 0);
	assert.equal(deviceSpeedToUI(3), 7);
	// Slower than the app's slowest (older files): shown as the slowest
	assert.equal(deviceSpeedToUI(11), 0);
	assert.equal(deviceSpeedToUI(200), 0);
	for (let ui = 0; ui <= MAX_UI_EFFECT_SPEED; ui++) {
		assert.equal(deviceSpeedToUI(uiSpeedToDevice(ui)), ui);
	}
});
