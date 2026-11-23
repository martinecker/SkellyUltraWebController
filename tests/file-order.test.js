// Play order changes from the files table (enable, disable, drag and drop).
// They work on the whole play order, so files the filter hides keep their
// places. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { moveFile, setFileEnabled } from "../js/file-table.js";

test("enabling a file adds it at the end", () => {
	assert.deepEqual(setFileEnabled([3, 1], 2, true), [3, 1, 2]);
	assert.deepEqual(setFileEnabled([], 2, true), [2]);
});

test("enabling an enabled file moves it to the end", () => {
	assert.deepEqual(setFileEnabled([3, 1, 2], 3, true), [1, 2, 3]);
});

test("disabling a file removes only that file", () => {
	assert.deepEqual(setFileEnabled([3, 1, 2], 1, false), [3, 2]);
	assert.deepEqual(setFileEnabled([3, 2], 7, false), [3, 2]);
});

test("the last enabled file can't be disabled", () => {
	assert.equal(setFileEnabled([4], 4, false), null);
	assert.equal(setFileEnabled([], 4, false), null);
});

test("files hidden by the filter stay enabled and in place", () => {
	// The table shows only 2 and 5 (filtered); 1, 3 and 4 are enabled too
	const order = [1, 2, 3, 4, 5];
	assert.deepEqual(setFileEnabled(order, 5, false), [1, 2, 3, 4]);
	assert.deepEqual(setFileEnabled(order, 6, true), [1, 2, 3, 4, 5, 6]);
	// Dropping 5 on 2 (the row above it on screen)
	assert.deepEqual(moveFile(order, 5, 2), [1, 5, 2, 3, 4]);
});

test("a file moved down goes after the target, moved up before it", () => {
	assert.deepEqual(moveFile([1, 2, 3, 4], 1, 3), [2, 3, 1, 4]);
	assert.deepEqual(moveFile([1, 2, 3, 4], 4, 2), [1, 4, 2, 3]);
	assert.deepEqual(moveFile([1, 2, 3, 4], 3, 4), [1, 2, 4, 3]);
	assert.deepEqual(moveFile([1, 2, 3, 4], 2, 1), [2, 1, 3, 4]);
});

test("a move that changes nothing gives the same order back", () => {
	const order = [1, 2, 3];
	assert.equal(moveFile(order, 2, 2), order);
	assert.equal(moveFile(order, 9, 2), order);
	assert.equal(moveFile(order, 2, 9), order);
});

test("the order given isn't changed", () => {
	const order = [1, 2, 3];
	setFileEnabled(order, 1, false);
	moveFile(order, 1, 3);
	assert.deepEqual(order, [1, 2, 3]);
});
