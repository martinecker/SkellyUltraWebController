/**
 * DOM helpers shared by the UI modules
 */

import { LOG_CLASSES } from "./constants.js";

/** The first element matching a CSS selector, or null */
export const $ = (selector) => document.querySelector(selector);

/**
 * Run what a UI control does when it talks to the device. A failure (a
 * write that didn't go out, no reply) is logged as "<action> failed: …"
 * instead of ending up as an unhandled rejection in the console.
 * @param {(message: string, className?: string) => void} log
 * @param {string} action - What the control does, e.g. "Set volume"
 * @param {() => Promise<*>} fn
 * @returns {Promise<boolean>} true if fn finished, false if it failed
 */
export async function trySend(log, action, fn) {
	try {
		await fn();
		return true;
	} catch (error) {
		log(`${action} failed: ${error.message}`, LOG_CLASSES.WARNING);
		return false;
	}
}
