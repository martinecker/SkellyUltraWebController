// Capacity reply (BBD2), read like the HA integration. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ProtocolParser } from "../js/protocol-parser.js";
import { StateManager } from "../js/state-manager.js";

test("BBD2: free KB u32, file count, one mode byte", () => {
	const state = new StateManager();
	const logs = [];
	const parser = new ProtocolParser(state, null, (line) => logs.push(line));
	// 1000 KB free, 5 files, mode 1, then padding the old code read as part of the mode
	parser.parse("BBD2000003E80501FFFFFF00");
	assert.equal(state.device.capacityKb, 1000);
	assert.equal(state.device.fileCount, 5);
	assert.match(logs[0], /mode=1$/);
});
