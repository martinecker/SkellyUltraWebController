// Modal stack (Escape goes to the top dialog). Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	handleModalKey,
	hideModal,
	showModal,
	topModal,
} from "../js/modal-stack.js";

// A stand-in for a .modal element: only its "hidden" class matters
function fakeModal() {
	const classes = new Set(["hidden"]);
	return {
		classList: {
			add: (c) => classes.add(c),
			remove: (c) => classes.delete(c),
			contains: (c) => classes.has(c),
		},
	};
}

function pressEscape() {
	const e = { key: "Escape", defaultPrevented: false };
	e.preventDefault = () => {
		e.defaultPrevented = true;
	};
	handleModalKey(e);
	return e;
}

test("Escape goes to the top dialog only", () => {
	const calls = [];
	const edit = fakeModal();
	const transfer = fakeModal();
	showModal(edit, () => calls.push("edit"));
	showModal(transfer, () => calls.push("transfer"));
	assert.equal(topModal(), transfer);

	assert.equal(pressEscape().defaultPrevented, true);
	assert.deepEqual(calls, ["transfer"]);

	hideModal(transfer);
	assert.equal(transfer.classList.contains("hidden"), true);
	pressEscape();
	assert.deepEqual(calls, ["transfer", "edit"]);
	hideModal(edit);
	assert.equal(topModal(), null);
});

test("a dialog without an Escape action keeps Escape from the ones below", () => {
	const calls = [];
	const connect = fakeModal();
	const risk = fakeModal();
	showModal(connect, () => calls.push("connect"));
	showModal(risk);
	pressEscape();
	assert.deepEqual(calls, []);
	hideModal(risk);
	hideModal(connect);
});

test("a dialog hidden by other code leaves the stack", () => {
	const calls = [];
	const below = fakeModal();
	const top = fakeModal();
	showModal(below, () => calls.push("below"));
	showModal(top, () => calls.push("top"));
	top.classList.add("hidden");
	pressEscape();
	assert.deepEqual(calls, ["below"]);
	hideModal(below);
});

test("showing an open dialog again moves it to the top", () => {
	const calls = [];
	const a = fakeModal();
	const b = fakeModal();
	showModal(a, () => calls.push("a"));
	showModal(b, () => calls.push("b"));
	showModal(a, () => calls.push("a again"));
	pressEscape();
	assert.deepEqual(calls, ["a again"]);
	hideModal(a);
	hideModal(b);
});

test("other keys and an empty stack do nothing", () => {
	const e = pressEscape();
	assert.equal(e.defaultPrevented, false);
	const a = fakeModal();
	let called = false;
	showModal(a, () => {
		called = true;
	});
	handleModalKey({ key: "Enter", preventDefault: () => assert.fail() });
	assert.equal(called, false);
	hideModal(a);
});
