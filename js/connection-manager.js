/**
 * Connection Manager
 * Abstraction layer that wraps both direct BLE and REST proxy connections
 */

import { BLEManager } from "./ble-manager.js";
import { sleep } from "./protocol.js";
import { RestProxy } from "./rest-proxy.js";

/**
 * Connection types
 */
export const ConnectionType = {
	DIRECT_BLE: "direct",
	REST_PROXY: "rest",
};

/**
 * Connection Manager - Unified interface for BLE and REST connections
 */
export class ConnectionManager {
	constructor(stateManager, logger) {
		this.state = stateManager;
		this.log = logger;

		// Create both connection implementations
		this.bleManager = new BLEManager(stateManager, logger);
		this.restProxy = new RestProxy(stateManager, logger);

		// Active connection
		this.activeConnection = null;
		this.connectionType = null;

		// Store notification handlers to register with active connection
		this.notificationHandlers = [];

		// Writes go out one at a time: Web Bluetooth rejects a write while
		// another GATT operation is in progress, and overlapping REST posts
		// can reach the device out of order. Each send waits for the one
		// before it; a failed send doesn't hold up the ones after it.
		this.writeQueue = Promise.resolve();
	}

	/**
	 * Check if device is connected
	 * @returns {boolean}
	 */
	isConnected() {
		if (!this.activeConnection) return false;
		return this.activeConnection.isConnected();
	}

	/**
	 * Get the MTU size
	 * @returns {number|null} MTU size in bytes, or null if not available
	 */
	getMtuSize() {
		if (!this.activeConnection) return null;
		return this.activeConnection.getMtuSize();
	}

	/**
	 * Connect to a device
	 * @param {Object} options - Connection options
	 * @param {string} options.type - Connection type ('direct' or 'rest')
	 * @param {string} options.nameFilter - Optional device name filter
	 * @param {string} options.restUrl - REST server URL (required if type is 'rest')
	 * @returns {Promise<void>}
	 */
	async connect(options) {
		const { type, nameFilter = "", restUrl = "" } = options;

		// Disconnect any existing connection
		if (this.activeConnection) {
			await this.disconnect();
		}

		// Writes still queued for the old connection fail on their own; the
		// new one doesn't wait for them
		this.writeQueue = Promise.resolve();

		if (type === ConnectionType.REST_PROXY) {
			if (!restUrl) {
				throw new Error("REST server URL is required");
			}
		} else if (type !== ConnectionType.DIRECT_BLE) {
			throw new Error(`Unknown connection type: ${type}`);
		}

		// Set before connecting, so state observers that run during the
		// connect already find the backend; cleared again if it fails
		this.activeConnection =
			type === ConnectionType.REST_PROXY ? this.restProxy : this.bleManager;
		this.connectionType = type;
		try {
			if (type === ConnectionType.REST_PROXY) {
				await this.restProxy.connect(restUrl, nameFilter);
			} else {
				await this.bleManager.connect(nameFilter);
			}
		} catch (error) {
			this.activeConnection = null;
			this.connectionType = null;
			throw error;
		}

		// Clear any existing handlers in the active connection to avoid duplicates
		// then register all stored notification handlers
		this.activeConnection.clearNotificationHandlers();
		for (const handler of this.notificationHandlers) {
			this.activeConnection.onNotification(handler);
		}

		return true;
	}

	/**
	 * Disconnect from device
	 * @returns {Promise<void>}
	 */
	async disconnect() {
		if (this.activeConnection) {
			await this.activeConnection.disconnect();
			this.activeConnection = null;
			this.connectionType = null;
		}
	}

	/**
	 * Send command bytes to device, after any sends still in progress
	 * (see writeQueue)
	 * @param {Uint8Array} commandBytes - Command bytes to send
	 * @returns {Promise<void>} Settles when this write has gone out or failed
	 */
	send(commandBytes) {
		const connection = this.activeConnection;
		if (!connection) {
			return Promise.reject(new Error("No active connection"));
		}

		const write = this.writeQueue.then(() => connection.send(commandBytes));
		this.writeQueue = write.catch(() => {});
		return write;
	}

	/**
	 * Hold back the next write until ms after the writes queued so far have
	 * gone out, to give the device time between commands. Doesn't wait
	 * itself; every later send (whoever makes it) waits.
	 * @param {number} ms
	 */
	pause(ms) {
		this.writeQueue = this.writeQueue.then(() => sleep(ms));
	}

	/**
	 * Register a notification handler
	 * @param {Function} handler - Handler function (hex, bytes) => void
	 * @returns {Function} - Unsubscribe function
	 */
	onNotification(handler) {
		// Store handler for registration with active connection
		this.notificationHandlers.push(handler);

		// If already connected, register with active connection immediately
		if (this.activeConnection) {
			this.activeConnection.onNotification(handler);
		}

		// Return unsubscribe function
		return () => {
			const index = this.notificationHandlers.indexOf(handler);
			if (index >= 0) {
				this.notificationHandlers.splice(index, 1);
			}
			// The active connection holds its own copy of the handler
			this.activeConnection?.offNotification?.(handler);
		};
	}

	/**
	 * Wait for a response with specific prefix
	 * @param {string} prefix - Response prefix to wait for
	 * @param {number} timeoutMs - Timeout in milliseconds
	 * @returns {Promise<string>} - Response hex string
	 */
	waitForResponse(prefix, timeoutMs) {
		if (!this.activeConnection) {
			return Promise.reject(new Error("No active connection"));
		}

		if (this.activeConnection.waitForResponse) {
			return this.activeConnection.waitForResponse(prefix, timeoutMs);
		}

		return Promise.reject(
			new Error("waitForResponse not supported by active connection"),
		);
	}

	/**
	 * Get device info
	 * @returns {Object|null} - Device info or null if not connected
	 */
	getDeviceInfo() {
		if (!this.activeConnection) return null;

		const info = this.activeConnection.getDeviceInfo();

		// Add connection type to info
		if (info) {
			info.connectionType = this.connectionType;
		}

		return info;
	}

	/**
	 * Check if Web Bluetooth is available
	 * @returns {boolean}
	 */
	static isWebBluetoothAvailable() {
		return "bluetooth" in navigator;
	}
}
