/**
 * Connection Manager
 * Abstraction layer that wraps both direct BLE and REST proxy connections
 */

import { BLEManager } from './ble-manager.js';
import { RestProxy } from './rest-proxy.js';

/**
 * Connection types
 */
export const ConnectionType = {
  DIRECT_BLE: 'direct',
  REST_PROXY: 'rest',
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
    const { type, nameFilter = '', restUrl = '' } = options;
    
    // Disconnect any existing connection
    if (this.activeConnection) {
      await this.disconnect();
    }

    if (type === ConnectionType.REST_PROXY) {
      // Connect via REST proxy
      if (!restUrl) {
        throw new Error('REST server URL is required');
      }
      
      this.activeConnection = this.restProxy;
      this.connectionType = ConnectionType.REST_PROXY;
      
      await this.restProxy.connect(restUrl, nameFilter);
      
    } else if (type === ConnectionType.DIRECT_BLE) {
      // Connect via direct BLE
      this.activeConnection = this.bleManager;
      this.connectionType = ConnectionType.DIRECT_BLE;
      
      await this.bleManager.connect(nameFilter);
      
    } else {
      throw new Error(`Unknown connection type: ${type}`);
    }

    // Register all stored notification handlers with the active connection
    console.log(`ConnectionManager: Registering ${this.notificationHandlers.length} stored handlers with active connection`);
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
   * Send command bytes to device
   * @param {Uint8Array} commandBytes - Command bytes to send
   * @returns {Promise<void>}
   */
  async send(commandBytes) {
    if (!this.activeConnection) {
      throw new Error('No active connection');
    }
    
    return this.activeConnection.send(commandBytes);
  }

  /**
   * Register a notification handler
   * @param {Function} handler - Handler function (hex, bytes) => void
   * @returns {Function} - Unsubscribe function
   */
  onNotification(handler) {
    // Store handler for registration with active connection
    this.notificationHandlers.push(handler);
    console.log(`ConnectionManager: Registered handler, total handlers: ${this.notificationHandlers.length}`);
    
    // If already connected, register with active connection immediately
    if (this.activeConnection) {
      console.log('ConnectionManager: Registering handler with active connection');
      this.activeConnection.onNotification(handler);
    }
    
    // Return unsubscribe function
    return () => {
      const index = this.notificationHandlers.indexOf(handler);
      if (index >= 0) {
        this.notificationHandlers.splice(index, 1);
      }
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
      return Promise.reject(new Error('No active connection'));
    }
    
    if (this.activeConnection.waitForResponse) {
      return this.activeConnection.waitForResponse(prefix, timeoutMs);
    }
    
    return Promise.reject(new Error('waitForResponse not supported by active connection'));
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
   * Get current connection type
   * @returns {string|null} - Connection type or null if not connected
   */
  getConnectionType() {
    return this.connectionType;
  }

  /**
   * Check if Web Bluetooth is available
   * @returns {boolean}
   */
  static isWebBluetoothAvailable() {
    return 'bluetooth' in navigator;
  }
}
