// RestProxy reply waiting. Run with `npm test`.

import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { TIMEOUTS } from "../js/constants.js";
import { RestProxy } from "../js/rest-proxy.js";
import { StateManager } from "../js/state-manager.js";

afterEach(() => mock.timers.reset());

test("waitForResponse without a timeout waits TIMEOUTS.ACK", async () => {
	mock.timers.enable({ apis: ["setTimeout"] });
	const proxy = new RestProxy(new StateManager(), () => {});
	let settled = false;
	const wait = proxy.waitForResponse("BBC0").finally(() => {
		settled = true;
	});
	wait.catch(() => {});
	mock.timers.tick(TIMEOUTS.ACK - 1);
	await Promise.resolve();
	assert.equal(settled, false);
	mock.timers.tick(1);
	await assert.rejects(wait, /Timeout waiting for BBC0/);
});
