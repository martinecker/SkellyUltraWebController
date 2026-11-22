/**
 * State Manager
 * Centralized application state with observer pattern for reactive updates
 */

import { DEVICE_TYPES } from "./constants.js";

/**
 * Application State Manager
 * Manages device status, file list, and transfer state with change notifications
 */
export class StateManager {
	constructor() {
		// Device state
		this.device = {
			name: "",
			liveName: "", // Classic BT (live mode) name
			connected: false,
			showMode: null,
			version: null,
			channels: [],
			volume: null,
			capacityKb: null, // Free space in KB
			fileCount: null, // Count reported by device in capacity query
			filesReceived: null, // Count of files actually received in file list
			order: null, // Play order: enabled file serials, first to last
			pinCode: null, // Device PIN
		};

		// Active device type (drives UI profile)
		this.deviceType = DEVICE_TYPES.SKELLY;

		// Live status (action, eye icon, lights, LIGHT_SCENES value or null without scenes)
		this.live = {
			action: null,
			eyeIcon: null,
			lights: [],
			scene: null,
		};

		// File list state
		this.files = {
			expected: null,
			items: new Map(), // serial -> file object
			activeFetch: false, // When true, UI is disabled waiting for complete list
			fetchTimer: null,
			orderRequested: false, // D2/D1 sent for this refresh (the list was complete)
			lastRefresh: null, // Timestamp of last successful refresh
		};

		// Transfer state
		this.transfer = {
			inProgress: false,
			cancel: false,
		};

		// Observers: key -> Set of callbacks
		this.observers = new Map();
	}

	/**
	 * Subscribe to state changes
	 * @param {string} key - State key to watch (e.g., 'device', 'files', 'transfer')
	 * @param {Function} callback - Callback function to invoke on changes
	 * @returns {Function} - Unsubscribe function
	 */
	subscribe(key, callback) {
		if (!this.observers.has(key)) {
			this.observers.set(key, new Set());
		}
		this.observers.get(key).add(callback);

		// Return unsubscribe function
		return () => {
			const observers = this.observers.get(key);
			if (observers) {
				observers.delete(callback);
			}
		};
	}

	/**
	 * Wait until check() returns something truthy, checking now and after
	 * each change to the file list (including files arriving mid-refresh)
	 * @param {Function} check - Returns a truthy value once the wait is over
	 * @param {number} timeoutMs
	 * @returns {Promise<*>} check()'s truthy value, or null on timeout
	 */
	waitForFiles(check, timeoutMs) {
		return new Promise((resolve) => {
			const now = check();
			if (now) {
				resolve(now);
				return;
			}
			const finish = (value) => {
				clearTimeout(timer);
				stopFiles();
				stopArrived();
				resolve(value);
			};
			const recheck = () => {
				const value = check();
				if (value) finish(value);
			};
			const stopFiles = this.subscribe("files", recheck);
			const stopArrived = this.subscribe("fileArrived", recheck);
			const timer = setTimeout(() => finish(null), timeoutMs);
		});
	}

	/**
	 * Notify observers of state changes
	 * @param {string} key - State key that changed
	 */
	notify(key) {
		const observers = this.observers.get(key);
		if (observers) {
			observers.forEach((callback) => {
				try {
					callback(this[key]);
				} catch (error) {
					console.error(`Error in observer for ${key}:`, error);
				}
			});
		}
	}

	/**
	 * Set the active device type and notify observers
	 * @param {string} type - DEVICE_TYPES value
	 */
	setDeviceType(type) {
		this.deviceType = type;
		this.notify("deviceType");
	}

	// === Device State Methods ===

	/**
	 * Update device state
	 * @param {Object} updates - Partial device state updates
	 */
	updateDevice(updates) {
		Object.assign(this.device, updates);
		this.notify("device");
	}

	/**
	 * Set connection status
	 * @param {boolean} connected - Connection status
	 */
	setConnected(connected) {
		this.device.connected = connected;
		this.notify("device");
	}

	/**
	 * Update live status
	 * @param {Object} updates - Partial live status updates
	 */
	updateLive(updates) {
		Object.assign(this.live, updates);
		this.notify("live");
	}

	// === File State Methods ===

	/**
	 * Reset file list state and clear old items
	 */
	resetFiles() {
		this.files.expected = null;
		this.files.items.clear(); // Clear old items immediately at start of refresh
		this.files.activeFetch = false;
		this.files.orderRequested = false;
		if (this.files.fetchTimer) {
			clearTimeout(this.files.fetchTimer);
			this.files.fetchTimer = null;
		}
		this.notify("files");
	}

	/**
	 * Add or update a file in the list
	 * @param {number} serial - File serial number
	 * @param {Object} fileData - File data object
	 */
	setFile(serial, fileData) {
		this.files.items.set(serial, fileData);
		// The file table hears of files only when the refresh is done (the
		// order arrived); waitForFiles() sees each file as it arrives
		this.notify(this.files.activeFetch ? "fileArrived" : "files");
	}

	/**
	 * Get file by serial number
	 * @param {number} serial - File serial number
	 * @returns {Object|undefined} - File data or undefined
	 */
	getFile(serial) {
		return this.files.items.get(serial);
	}

	/**
	 * Check if a filename exists on device
	 * @param {string} name - Filename to check
	 * @returns {Object|null} - File object if found, null otherwise
	 */
	hasFileName(name) {
		if (!name) return null;
		const needle = name.trim().toLowerCase();
		for (const file of this.files.items.values()) {
			if ((file.name || "").trim().toLowerCase() === needle) {
				return file;
			}
		}
		return null;
	}

	/**
	 * Update file list metadata
	 * @param {Object} updates - Updates to files metadata
	 */
	updateFilesMetadata(updates) {
		Object.assign(this.files, updates);
		this.notify("files");
	}

	/**
	 * Check if file list is complete
	 * @returns {boolean}
	 */
	isFileListComplete() {
		return (
			this.files.expected !== null &&
			this.files.items.size >= this.files.expected
		);
	}

	// === Transfer State Methods ===

	/**
	 * Start a transfer
	 */
	startTransfer() {
		this.transfer.inProgress = true;
		this.transfer.cancel = false;
		this.notify("transfer");
	}

	/**
	 * Cancel transfer
	 */
	cancelTransfer() {
		this.transfer.cancel = true;
		this.notify("transfer");
	}

	/**
	 * End transfer
	 */
	endTransfer() {
		this.transfer.inProgress = false;
		this.transfer.cancel = false;
		this.notify("transfer");
	}
}
