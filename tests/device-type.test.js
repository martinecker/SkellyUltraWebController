// Device type from the BLE name, matched like the HA integration. Run with `npm test`.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import {
	CAPABILITIES,
	DEVICE_PROFILES,
	DEVICE_TYPES,
	deviceTypeFromName,
	displayedLights,
	getEyeIconPath,
	hasCapability,
	isTestedFirmware,
	knownDeviceType,
	movementIconPath,
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

test("every profile lists its tested firmware", () => {
	for (const [type, profile] of Object.entries(DEVICE_PROFILES)) {
		assert.ok(Array.isArray(profile.testedFirmware), type);
	}
});

test("tested firmware, as the device state holds it or as a number", () => {
	assert.equal(isTestedFirmware(DEVICE_TYPES.SKELLY, "v66"), true);
	assert.equal(isTestedFirmware(DEVICE_TYPES.SKELLY, "v68"), true);
	assert.equal(isTestedFirmware(DEVICE_TYPES.SKELLY, 68), true);
	assert.equal(isTestedFirmware(DEVICE_TYPES.SKELLY, "v69"), false);
	assert.equal(isTestedFirmware(DEVICE_TYPES.SKELLY_12FT, "v14"), true);
	assert.equal(isTestedFirmware(DEVICE_TYPES.LILY, "v24"), true);
	assert.equal(isTestedFirmware(DEVICE_TYPES.SANTA, "v1"), false);
	assert.equal(isTestedFirmware(DEVICE_TYPES.SKELLY, null), false);
	assert.equal(isTestedFirmware("unknown", "v68"), false);
});

test("lights are shown highest channel first", () => {
	assert.deepEqual(displayedLights(DEVICE_PROFILES[DEVICE_TYPES.SKELLY]), [
		{ label: "Head Light", channel: 1 },
		{ label: "Torso Light", channel: 0 },
	]);
	assert.deepEqual(displayedLights(DEVICE_PROFILES[DEVICE_TYPES.LILY]), [
		{ label: "Lantern", channel: 0 },
	]);
});

test("capabilities start at the profile's firmware version", () => {
	const { SKELLY, SKELLY_12FT, SANTA } = DEVICE_TYPES;
	const scenes = CAPABILITIES.LIGHT_SCENES;
	assert.equal(hasCapability(SKELLY, "v66", scenes), false);
	assert.equal(hasCapability(SKELLY, "v68", scenes), true);
	assert.equal(hasCapability(SKELLY, 70, scenes), true); // newer, untested
	assert.equal(hasCapability(SKELLY_12FT, "v14", CAPABILITIES.JAW_DATA), true);
	assert.equal(hasCapability(SKELLY_12FT, "v13", CAPABILITIES.JAW_DATA), false);
	// Santa: any known version
	assert.equal(hasCapability(SANTA, "v1", CAPABILITIES.SET_ALL_LIGHTS), true);
});

test("no capability without a firmware version or for unknown names", () => {
	assert.equal(
		hasCapability(DEVICE_TYPES.SANTA, null, CAPABILITIES.LIGHT_SCENES),
		false,
	);
	assert.equal(hasCapability("nope", "v68", CAPABILITIES.LIGHT_SCENES), false);
	assert.equal(hasCapability(DEVICE_TYPES.SKELLY, "v68", "nope"), false);
});

test("every profile's eye and movement images exist", () => {
	for (const [type, profile] of Object.entries(DEVICE_PROFILES)) {
		for (const { part } of profile.movements) {
			const path = movementIconPath(profile, part);
			assert.ok(existsSync(path), `${type}: ${path}`);
		}
		for (let eye = 1; eye <= (profile.eyeIconCount ?? 0); eye++) {
			const path = getEyeIconPath(type, eye);
			assert.ok(existsSync(path), `${type}: ${path}`);
		}
	}
	assert.equal(getEyeIconPath(DEVICE_TYPES.LILY, 1), null);
});

test("a saved device type that isn't known falls back to Ultra Skelly", () => {
	assert.equal(knownDeviceType(DEVICE_TYPES.LILY), DEVICE_TYPES.LILY);
	assert.equal(knownDeviceType(null), DEVICE_TYPES.SKELLY);
	assert.equal(knownDeviceType("ultra_skelly"), DEVICE_TYPES.SKELLY);
	assert.equal(knownDeviceType("toString"), DEVICE_TYPES.SKELLY);
});
