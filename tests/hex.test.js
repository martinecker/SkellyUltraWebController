// Hex helpers in protocol.js. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { byteHex, chunkToHex, intToHex, utf16leHex } from "../js/protocol.js";

test("intToHex pads and keeps the low bytes", () => {
	assert.equal(intToHex(5, 1), "05");
	assert.equal(intToHex(0x1234, 2), "1234");
	assert.equal(intToHex(1234, 4), "000004D2");
	assert.equal(intToHex(undefined, 1), "00");
});

test("byteHex refuses what isn't a byte", () => {
	assert.equal(byteHex(255, "x"), "FF");
	assert.throws(() => byteHex(256, "Red"), /Red must be 0-255, got 256/);
	assert.throws(() => byteHex(-1, "Red"), RangeError);
	assert.throws(() => byteHex(1.5, "Red"), RangeError);
});

test("utf16leHex: little-endian code units, surrogate pairs included", () => {
	assert.equal(utf16leHex("Ab"), "41006200");
	assert.equal(utf16leHex("Ü"), "DC00");
	assert.equal(utf16leHex("😀"), "3DD800DE");
	assert.equal(utf16leHex(""), "");
});

test("chunkToHex stops at the end of the data", () => {
	const bytes = Uint8Array.of(1, 2, 0xab, 0xcd);
	assert.equal(chunkToHex(bytes, 1, 2), "02AB");
	assert.equal(chunkToHex(bytes, 2, 10), "ABCD");
});
