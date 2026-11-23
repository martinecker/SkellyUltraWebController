// trySend: what UI controls use to talk to the device. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { LOG_CLASSES } from "../js/constants.js";
import { trySend } from "../js/dom.js";

test("a failed send is logged as a warning, not thrown", async () => {
	const logs = [];
	const ok = await trySend(
		(message, className) => logs.push([message, className]),
		"Set volume",
		async () => {
			throw new Error("GATT operation failed");
		},
	);
	assert.equal(ok, false);
	assert.deepEqual(logs, [
		["Set volume failed: GATT operation failed", LOG_CLASSES.WARNING],
	]);
});

test("a send that goes out logs nothing extra", async () => {
	const logs = [];
	let ran = false;
	const ok = await trySend(
		(message) => logs.push(message),
		"Play",
		async () => {
			ran = true;
		},
	);
	assert.equal(ok, true);
	assert.equal(ran, true);
	assert.deepEqual(logs, []);
});
