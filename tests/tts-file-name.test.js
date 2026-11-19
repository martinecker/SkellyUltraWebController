// ElevenLabs file names fit the device's limit. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { TRANSFER_CONFIG } from "../js/constants.js";
import { ttsFileName } from "../js/transfer-modal.js";

test("the start of the text as a slug", () => {
	assert.equal(ttsFileName("Hello there, mortal!"), "hello_there_mortal.mp3");
});

test("long text fits the limit (30 chars plus .mp3 was one too many)", () => {
	const name = ttsFileName("Welcome to the haunted mansion, dear guests");
	assert.ok(name.length <= TRANSFER_CONFIG.MAX_FILENAME_LENGTH, name);
	assert.match(name, /^welcome_to_the_haunted_mansio\.mp3$/);
});

test("no separator left before the extension when cut", () => {
	// The cut lands right after "aaaa ... a" + "_"
	const name = ttsFileName(`${"a".repeat(29)} bbb`);
	assert.equal(name, `${"a".repeat(29)}.mp3`);
});

test("text without letters or digits falls back to tts.mp3", () => {
	assert.equal(ttsFileName("!!! ???"), "tts.mp3");
	assert.equal(ttsFileName(""), "tts.mp3");
});
