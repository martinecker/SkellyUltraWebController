// Device type from the BLE name, matched like the HA integration. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	DEVICE_PROFILES,
	DEVICE_TYPES,
	deviceTypeFromName,
	KNOWN_FIRMWARE,
} from "../js/constants.js";

test("each profile's own BLE names are detected as that type", () => {
	for (const [type, profile] of Object.entries(DEVICE_PROFILES)) {
		for (const name of profile.bleNames) {
			assert.equal(deviceTypeFromName(name), type, name);
		}
	}
});

test("names that only contain the type's name part match too", () => {
	assert.equal(deviceTypeFromName("Ultra Skelly"), DEVICE_TYPES.SKELLY);
	assert.equal(deviceTypeFromName("ULTRA SKELLY v3"), DEVICE_TYPES.SKELLY);
	assert.equal(deviceTypeFromName("My 12ft Skelly"), DEVICE_TYPES.SKELLY_12FT);
	assert.equal(deviceTypeFromName("lethal lily 2"), DEVICE_TYPES.LILY);
});

test("unknown or empty names have no type", () => {
	assert.equal(deviceTypeFromName("Speaker"), null);
	assert.equal(deviceTypeFromName(""), null);
	assert.equal(deviceTypeFromName(null), null);
});

test("every device type has a KNOWN_FIRMWARE entry", () => {
	for (const type of Object.values(DEVICE_TYPES)) {
		assert.ok(KNOWN_FIRMWARE[type], type);
	}
});
