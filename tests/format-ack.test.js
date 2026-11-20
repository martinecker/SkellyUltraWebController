// Format reply (BBC8): result byte 0 means done. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ProtocolParser } from "../js/protocol-parser.js";
import { StateManager } from "../js/state-manager.js";

function parseLog(hex) {
	const logs = [];
	const parser = new ProtocolParser(new StateManager(), null, (line) =>
		logs.push(line),
	);
	parser.parse(hex);
	return logs;
}

test("BBC8 result 0 is logged as done", () => {
	assert.match(parseLog("BBC80000")[0], /^Format done/);
});

test("BBC8 result 1 is logged as failed", () => {
	assert.match(parseLog("BBC80100")[0], /^Format failed \(result=1\)/);
});
