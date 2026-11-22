// Counting the device's loss reports (BBC1) during an upload. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { TRANSFER_CONFIG } from "../js/constants.js";
import { LossTracker } from "../js/file-manager.js";

const WINDOW = TRANSFER_CONFIG.REPEAT_WINDOW_MS;

test("lost = 0 is no loss", () => {
	const losses = new LossTracker();
	assert.equal(losses.note(0, 5, 0), false);
	assert.equal(losses.count, 0);
	assert.equal(losses.pending, null);
});

test("a repeat of the latest report within the window counts once", () => {
	const losses = new LossTracker();
	assert.equal(losses.note(1, 5, 1000), true);
	assert.equal(losses.note(1, 5, 1000 + WINDOW - 1), false);
	assert.equal(losses.count, 1);
	assert.equal(losses.pending, 5);
});

test("the same index after the window, or another index, counts again", () => {
	const losses = new LossTracker();
	losses.note(1, 5, 1000);
	assert.equal(losses.note(1, 5, 1000 + WINDOW), true);
	assert.equal(losses.note(1, 9, 1000 + WINDOW), true);
	assert.equal(losses.count, 3);
	assert.equal(losses.pending, 9);
});
