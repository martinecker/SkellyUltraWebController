/**
 * REST Proxy Client
 * Implements BLE communication via the Skelly Ultra REST server
 */

import { LOG_CLASSES } from './constants.js';
import { bytesToHex, hexToBytes } from './protocol.js';

/**
 * REST Server Proxy for BLE Communication
 */
export class RestProxy {
  constructor(stateManager, logger) {
    this.state = stateManager;
    this.log = logger;
    
    // Connection state
    this.baseUrl = '';
    this.sessionId = null;
    this.connected = false;
    this.mtuSize = null;
    this.deviceAddress = null;
    this.deviceName = null;
    
    // Notification handling
    this.notificationHandlers = [];
    this.pollingActive = false;
    this.nextSequence = 0;
    this.pollingAbortController = null;
    this.pollingErrorCount = 0;
    this.maxPollingErrors = 3; // Give up after 3 consecutive errors
    
    // Response waiters (for waitForResponse)
    this.waiters = [];
    
    // Keepalive
    this.keepaliveInterval = null;
    
    // Bind methods
    this.pollNotifications = this.pollNotifications.bind(this);
  }

  /**
   * Check if device is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.sessionId !== null;
  }

  /**
   * Get the MTU size
   * @returns {number|null} MTU size in bytes, or null if not available
   */
  getMtuSize() {
    return this.mtuSize;
  }

  /**
   * Scan for BLE devices via REST proxy
   * @param {string} baseUrl - REST server base URL
   * @param {string} nameFilter - Optional device name filter
   * @param {number} timeout - Scan timeout in seconds
   * @returns {Promise<Array>} - Array of discovered devices
   */
  async scanDevices(baseUrl, nameFilter = '', timeout = 10) {
    try {
      this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
      
      const params = new URLSearchParams();
      if (nameFilter.trim()) {
        params.append('name_filter', nameFilter.trim());
      }
      params.append('timeout', timeout.toString());
      
      const scanUrl = `${this.baseUrl}/ble/scan_devices?${params.toString()}`;
      console.log('Scanning for devices:', scanUrl);
      this.log(`Scanning for devices via REST proxy...`, LOG_CLASSES.WARNING);
      
      let response;
      try {
        response = await fetch(scanUrl);
        console.log('Fetch completed, status:', response.status);
      } catch (fetchError) {
        console.error('Fetch failed:', fetchError);
        // Check for common network issues
        if (fetchError.message.includes('Failed to fetch') || fetchError.name === 'TypeError') {
          throw new Error(`Cannot connect to ${this.baseUrl}. Please check: 1) Server is running, 2) URL is correct, 3) Not a mixed content issue (HTTPS→HTTP blocked)`);
        }
        throw new Error(`Network error: ${fetchError.message}`);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Scan error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Scan response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Scan failed');
      }
      
      return data.devices || [];
    } catch (error) {
      console.error('Scan error:', error);
      this.log(`REST proxy scan error: ${error.message}`, LOG_CLASSES.WARNING);
      throw error;
    }
  }

  /**
   * Connect to a BLE device via REST proxy
   * @param {string} baseUrl - REST server base URL (e.g., "http://localhost:8765")
   * @param {string} deviceAddress - Device MAC address or name filter
   * @returns {Promise<void>}
   */
  async connect(baseUrl, deviceAddress = '') {
    try {
      this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
      
      // Prepare connect request
      const requestBody = {};
      if (deviceAddress.trim()) {
        // If it looks like a MAC address, use address field, otherwise use name_filter
        if (deviceAddress.match(/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i)) {
          requestBody.address = deviceAddress.trim();
        } else {
          requestBody.name_filter = deviceAddress.trim();
        }
      }
      
      this.log(`Connecting via REST proxy: ${this.baseUrl}`, LOG_CLASSES.WARNING);
      console.log('REST proxy connect request body:', requestBody);
      
      // Send connect request
      const connectUrl = `${this.baseUrl}/ble/connect`;
      console.log('Fetching:', connectUrl);
      
      let response;
      try {
        response = await fetch(connectUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        console.log('Response status:', response.status, response.statusText);
      } catch (fetchError) {
        console.error('Fetch failed:', fetchError);
        if (fetchError.message.includes('Failed to fetch') || fetchError.name === 'TypeError') {
          throw new Error(`Cannot connect to ${this.baseUrl}. Please check: 1) Server is running, 2) URL is correct, 3) Not a mixed content issue (HTTPS→HTTP blocked)`);
        }
        throw new Error(`Network error: ${fetchError.message}`);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Connect response data:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Connection failed');
      }

      // Store session info
      this.sessionId = data.session_id;
      this.deviceAddress = data.address;
      this.deviceName = data.name || 'Unknown';
      this.mtuSize = data.mtu || null;
      this.connected = true;
      this.nextSequence = 0;

      // Update state
      this.state.updateDevice({
        name: this.deviceName,
        connected: true,
      });

      this.log(`Connected via REST proxy: session=${this.sessionId}, address=${this.deviceAddress}, mtu=${this.mtuSize}`, LOG_CLASSES.WARNING);

      // Start notification polling
      this.startPolling();
      
      // Start keepalive
      this.startKeepalive();

      return true;
    } catch (error) {
      this.log(`REST proxy connect error: ${error.message}`, LOG_CLASSES.WARNING);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Disconnect from device
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      // Stop polling and keepalive first
      this.stopPolling();
      this.stopKeepalive();
      
      if (this.sessionId) {
        // Send disconnect request
        const response = await fetch(`${this.baseUrl}/ble/disconnect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: this.sessionId,
          }),
        });

        if (response.ok) {
          this.log('Disconnected from REST proxy', LOG_CLASSES.WARNING);
        }
      }
    } catch (error) {
      this.log(`REST proxy disconnect error: ${error.message}`, LOG_CLASSES.WARNING);
    } finally {
      this.cleanup();
    }
  }

  /**
   * Send command bytes to device
   * @param {Uint8Array} commandBytes - Command bytes to send
   * @returns {Promise<void>}
   */
  async send(commandBytes) {
    if (!this.isConnected()) {
      this.log('Not connected to REST proxy', LOG_CLASSES.WARNING);
      throw new Error('Device not connected');
    }

    const hex = bytesToHex(commandBytes);
    this.log(`TX ${hex}`, LOG_CLASSES.TX);

    try {
      const response = await fetch(`${this.baseUrl}/ble/send_command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: this.sessionId,
          command: hex,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Send command failed');
      }
    } catch (error) {
      this.log(`REST proxy send error: ${error.message}`, LOG_CLASSES.WARNING);
      throw error;
    }
  }

  /**
   * Register a notification handler
   * @param {Function} handler - Handler function (hex, bytes) => void
   * @returns {Function} - Unsubscribe function
   */
  onNotification(handler) {
    this.notificationHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.notificationHandlers.indexOf(handler);
      if (index >= 0) {
        this.notificationHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Clear all notification handlers
   */
  clearNotificationHandlers() {
    this.notificationHandlers = [];
  }

  /**
   * Start long-polling for notifications
   */
  startPolling() {
    if (this.pollingActive) return;
    
    this.pollingActive = true;
    this.pollingErrorCount = 0; // Reset error count
    this.pollNotifications();
  }

  /**
   * Stop notification polling
   */
  stopPolling() {
    this.pollingActive = false;
    
    if (this.pollingAbortController) {
      this.pollingAbortController.abort();
      this.pollingAbortController = null;
    }
  }

  /**
   * Long-poll for notifications
   */
  async pollNotifications() {
    console.log('REST proxy: Starting notification polling');
    while (this.pollingActive && this.isConnected()) {
      try {
        // Create abort controller for this request
        this.pollingAbortController = new AbortController();
        
        const url = `${this.baseUrl}/ble/notifications?session_id=${encodeURIComponent(this.sessionId)}&since=${this.nextSequence}&timeout=30`;
        console.log(`REST proxy: Polling notifications, sequence=${this.nextSequence}`);
        
        const response = await fetch(url, {
          signal: this.pollingAbortController.signal,
        });

        if (!response.ok) {
          // Check if session expired
          if (response.status === 400) {
            const data = await response.json();
            if (data.error && data.error.includes('session')) {
              this.log('REST proxy session expired', LOG_CLASSES.WARNING);
              this.handleDisconnect();
              return;
            }
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`REST proxy: Poll response - notifications: ${data.notifications?.length || 0}, next_sequence: ${data.next_sequence}, has_more: ${data.has_more}`);
        
        // Reset error count on successful poll
        this.pollingErrorCount = 0;
        
        // Update next sequence
        if (data.next_sequence !== undefined) {
          this.nextSequence = data.next_sequence;
        }

        // Process notifications
        if (data.notifications && data.notifications.length > 0) {
          console.log(`REST proxy: Processing ${data.notifications.length} notification(s)`);
          for (const notification of data.notifications) {
            this.handleNotification(notification);
          }
        }

        // If has_more is true, poll again immediately
        if (data.has_more) {
          continue;
        }

        // Small delay before next poll
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        // Ignore abort errors (normal when stopping polling)
        if (error.name === 'AbortError') {
          break;
        }
        
        this.pollingErrorCount++;
        this.log(`REST proxy polling error: ${error.message} (${this.pollingErrorCount}/${this.maxPollingErrors})`, LOG_CLASSES.WARNING);
        
        // Give up after too many consecutive errors
        if (this.pollingErrorCount >= this.maxPollingErrors) {
          this.log('REST proxy: Too many polling errors, treating as disconnected', LOG_CLASSES.WARNING);
          this.handleDisconnect();
          return;
        }
        
        // Back off on errors
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Handle incoming notification
   * @param {Object} notification - Notification object from REST server
   */
  handleNotification(notification) {
    try {
      const hex = notification.data.replace(/\s+/g, ''); // Remove spaces
      const bytes = hexToBytes(hex);
      
      console.log(`REST proxy: Received notification - hex: ${hex}, handlers: ${this.notificationHandlers.length}`);
      this.log(`RX ${hex}`, LOG_CLASSES.RX);

      // Handle any pending waiters first
      this.handleWaiters(hex);

      // Notify all registered handlers
      for (const handler of this.notificationHandlers) {
        try {
          console.log('REST proxy: Calling notification handler');
          handler(hex, bytes);
        } catch (error) {
          console.error('Error in notification handler:', error);
        }
      }
    } catch (error) {
      console.error('Error processing notification:', error);
    }
  }

  /**
   * Wait for a response with specific prefix
   * @param {string} prefix - Response prefix to wait for
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<string>} - Response hex string
   */
  waitForResponse(prefix, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove waiter from list
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) {
          this.waiters.splice(index, 1);
        }
        reject(new Error(`Timeout waiting for ${prefix}`));
      }, timeoutMs);

      const waiter = {
        prefix,
        resolve,
        reject,
        timer,
      };

      this.waiters.push(waiter);
    });
  }

  /**
   * Handle waiters by checking if any match the received response
   * @param {string} hex - Received hex string
   */
  handleWaiters(hex) {
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const waiter = this.waiters[i];
      if (hex.startsWith(waiter.prefix)) {
        clearTimeout(waiter.timer);
        waiter.resolve(hex);
        this.waiters.splice(i, 1);
      }
    }
  }

  /**
   * Start keepalive pings
   */
  startKeepalive() {
    this.stopKeepalive(); // Clear any existing interval
    
    // Query status endpoint every 30 seconds
    this.keepaliveInterval = setInterval(async () => {
      if (!this.isConnected()) {
        this.stopKeepalive();
        return;
      }
      
      try {
        const response = await fetch(`${this.baseUrl}/ble/sessions`);
        if (response.ok) {
          const data = await response.json();
          
          // Verify our session still exists
          const sessionExists = data.sessions?.some(s => s.session_id === this.sessionId);
          
          if (!sessionExists) {
            this.log('REST proxy session lost', LOG_CLASSES.WARNING);
            this.handleDisconnect();
          }
        }
      } catch (error) {
        this.log(`Keepalive error: ${error.message}`, LOG_CLASSES.WARNING);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop keepalive pings
   */
  stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }

  /**
   * Handle disconnect event
   */
  handleDisconnect() {
    this.log('REST proxy disconnected', LOG_CLASSES.WARNING);
    this.cleanup();
  }

  /**
   * Cleanup connection state
   */
  cleanup() {
    this.stopPolling();
    this.stopKeepalive();
    
    this.sessionId = null;
    this.connected = false;
    this.deviceAddress = null;
    this.deviceName = null;
    this.mtuSize = null;
    this.nextSequence = 0;
    
    // Update state
    this.state.setConnected(false);
    this.state.updateFilesMetadata({ activeFetch: false });
    if (this.state.files.fetchTimer) {
      clearTimeout(this.state.files.fetchTimer);
    }
  }

  /**
   * Get device info
   * @returns {Object|null} - Device info or null if not connected
   */
  getDeviceInfo() {
    if (!this.isConnected()) return null;
    
    return {
      name: this.deviceName || 'Unknown',
      id: this.deviceAddress || 'unknown',
      connected: this.connected,
      restUrl: this.baseUrl,
    };
  }
}
