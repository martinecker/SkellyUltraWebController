/**
 * Main Application Entry Point
 * Orchestrates all modules and initializes the application
 * 
 * This is a SIMPLIFIED version showing the modular architecture.
 * The full UI controller implementation would be much larger.
 */

import { ConnectionManager, ConnectionType } from './js/connection-manager.js';
import { COMMANDS, LOG_CLASSES, MOVEMENT_BITS, STORAGE_KEYS } from './js/constants.js';
import { EditModalManager } from './js/edit-modal.js';
import { AudioConverter, FileManager } from './js/file-manager.js';
import { ProtocolParser } from './js/protocol-parser.js';
import { buildCommand, bytesToHex, clamp, deviceSpeedToUI, escapeHtml, uiSpeedToDevice } from './js/protocol.js';
import { StateManager } from './js/state-manager.js';

/**
 * Simple Logger
 */
class Logger {
  constructor(logElement, autoscrollElement) {
    this.logElement = logElement;
    this.autoscrollElement = autoscrollElement;
    this.filterCallback = null;
  }

  setFilterCallback(callback) {
    this.filterCallback = callback;
  }

  log(message, className = LOG_CLASSES.NORMAL) {
    if (!this.logElement) return;
    const div = document.createElement('div');
    div.className = `line ${className}`;
    const time = new Date().toLocaleTimeString();
    div.textContent = `[${time}] ${message}`;
    this.logElement.appendChild(div);

    // Apply filter to the new line
    if (this.filterCallback) {
      this.filterCallback();
    }

    // Auto-scroll if enabled
    if (!this.autoscrollElement || this.autoscrollElement.checked) {
      this.logElement.scrollTop = this.logElement.scrollHeight;
    }
  }
}

/**
 * Simple UI Helper
 */
const $ = (selector) => document.querySelector(selector);

/**
 * Set progress display
 */
function setProgress(idx, total) {
  const pct = total ? Math.round((idx / total) * 100) : 0;
  const progText = $('#progText');
  const progPct = $('#progPct');
  const progBar = $('#progBar');
  if (progText) progText.textContent = `${idx} / ${total}`;
  if (progPct) progPct.textContent = `${pct}%`;
  if (progBar) progBar.style.width = `${pct}%`;
}

/**
 * Main Application
 */
class SkellyApp {
  constructor() {
    try {
      console.log('SkellyApp initializing...');
      
      // Initialize logger
      this.logger = new Logger($('#log'), $('#chkAutoscroll'));
      this.logger.setFilterCallback(() => this.applyLogFilter());
      console.log('Logger created');

      // Initialize state manager
      this.state = new StateManager();
      console.log('State manager created');
      
      // Initialize play state tracking
      this.playState = {
        serial: null,
        playing: false,
        duration: 0,
        startTime: null,
        timerInterval: null
      };

      // Initialize connection manager (wraps both BLE and REST proxy)
      this.connection = new ConnectionManager(this.state, this.logger.log.bind(this.logger));
      console.log('Connection manager created');

      // Initialize file manager with progress callback
      this.fileManager = new FileManager(
        this.connection, 
        this.state, 
        this.logger.log.bind(this.logger),
        (current, total) => setProgress(current, total)
      );
      console.log('File manager created');

      // Initialize audio converter
      this.audioConverter = new AudioConverter(this.logger.log.bind(this.logger));
      console.log('Audio converter created');

      // Initialize edit modal manager (before parser so we can pass callback)
      this.editModal = new EditModalManager(
        this.connection,
        this.state,
        this.fileManager,
        this.audioConverter,
        this.logger.log.bind(this.logger)
      );
      console.log('Edit modal manager created');

      // Initialize protocol parser with callbacks
      this.parser = new ProtocolParser(
        this.state, 
        this.fileManager, 
        this.logger.log.bind(this.logger),
        this.handlePlayPauseMessage.bind(this),
        this.editModal.handleDeleteConfirmation.bind(this.editModal)
      );
      console.log('Protocol parser created');

      // Register protocol parser with connection manager
      this.connection.onNotification((hex, bytes) => {
        this.parser.parse(hex, bytes);
      });
      console.log('Notification handler registered');

      // Subscribe to state changes
      this.subscribeToStateChanges();
      console.log('State subscriptions registered');

      // Initialize UI
      this.initializeUI();
      console.log('UI initialized');

      // Set initial UI state
      this.updateDeviceUI(this.state.device);
      this.updateFilesTable();
      this.updateTransferUI(this.state.transfer);
      console.log('Initial UI state set');

      console.log('Application initialized successfully');
      this.logger.log('Application initialized', LOG_CLASSES.WARNING);
    } catch (error) {
      console.error('Failed to initialize application:', error);
      console.error('Error stack:', error.stack);
      alert('Failed to initialize application. Check console for details.');
      throw error;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribeToStateChanges() {
    // Device state changes
    this.state.subscribe('device', (device) => {
      this.updateDeviceUI(device);
    });

    // Live status changes
    this.state.subscribe('live', (live) => {
      this.updateLiveUI(live);
    });

    // File list changes
    this.state.subscribe('files', () => {
      this.updateFilesTable();
    });

    // Transfer state changes
    this.state.subscribe('transfer', (transfer) => {
      this.updateTransferUI(transfer);
    });
  }

  /**
   * Initialize UI and event handlers
   */
  initializeUI() {
    console.log('Initializing UI...');
    
    // Initial disconnected state
    document.body.classList.add('disconnected');

    // Connection controls
    const btnConnect = $('#btnConnect');
    const btnDisconnect = $('#btnDisconnect');
    
    if (btnConnect) {
      console.log('Binding connect button');
      btnConnect.addEventListener('click', () => {
        console.log('Connect button clicked');
        this.handleConnect();
      });
    } else {
      console.error('Connect button not found!');
    }
    
    if (btnDisconnect) {
      btnDisconnect.addEventListener('click', () => this.handleDisconnect());
    } else {
      console.error('Disconnect button not found!');
    }

    // Log controls
    const btnClearLog = $('#btnClearLog');
    if (btnClearLog) {
      btnClearLog.addEventListener('click', () => {
        const logEl = $('#log');
        if (logEl) logEl.innerHTML = '';
      });
    }

    const btnSaveLog = $('#btnSaveLog');
    if (btnSaveLog) {
      btnSaveLog.addEventListener('click', () => {
        this.saveLog();
      });
    }

    this.initializeWarningModal();
    this.initializeConnectionModal();
    this.initializeAdvancedMenu();
    this.initializeLogFilter();
    this.initializeQueryButtons();
    this.initializeMediaControls();
    this.initializeFileControls();
    this.initializeLiveControls();

    // Check for Web Bluetooth support
    if (!ConnectionManager.isWebBluetoothAvailable()) {
      console.error('Web Bluetooth not supported');
      this.logger.log(
        'Web Bluetooth not supported. For direct BLE, use Chrome/Edge. For other browsers, use the REST Server Proxy: https://github.com/martinecker/SkellyUltra/tree/main/custom_components/skelly_ultra/skelly_ultra_srv',
        LOG_CLASSES.WARNING
      );
      // Don't show blocking alert - REST proxy is available as alternative
      console.log('REST Server Proxy can be used as an alternative');
    } else {
      console.log('Web Bluetooth API is available');
      
      // Check for secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        console.error('Not in secure context - Web Bluetooth requires HTTPS or localhost');
        this.logger.log(
          'Web Bluetooth requires HTTPS or localhost for direct BLE. Use HTTPS or the REST Server Proxy.',
          LOG_CLASSES.WARNING
        );
      } else {
        console.log('Running in secure context');
      }
    }
    
    console.log('UI initialization complete');
  }

  /**
   * Initialize warning modal
   */
  initializeWarningModal() {
    const riskModal = $('#riskModal');
    const showRisk = () => riskModal?.classList.remove('hidden');
    const hideRisk = () => riskModal?.classList.add('hidden');

    window.addEventListener('load', () => {
      if (!localStorage.getItem(STORAGE_KEYS.RISK_ACK)) {
        showRisk();
      }
    });

    $('#riskAccept')?.addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEYS.RISK_ACK, '1');
      hideRisk();
    });

    $('#riskCancel')?.addEventListener('click', () => {
      window.location.href = 'about:blank';
    });
  }

  /**
   * Initialize connection modal
   */
  initializeConnectionModal() {
    const connectModal = $('#connectModal');
    const connectNameFilter = $('#connectNameFilter');
    const connectFilterByName = $('#connectFilterByName');
    const connectAllDevices = $('#connectAllDevices');
    const connectionTypeDirect = $('#connectionTypeDirect');
    const connectionTypeRest = $('#connectionTypeRest');
    const restUrlContainer = $('#restUrlContainer');
    const restServerUrl = $('#restServerUrl');
    const webBluetoothWarning = $('#webBluetoothWarning');
    const connectionTypeDirectLabel = $('#connectionTypeDirectLabel');
    
    // Check Web Bluetooth availability
    const isWebBluetoothAvailable = ConnectionManager.isWebBluetoothAvailable();
    
    // Load saved preferences
    const savedConnectionType = localStorage.getItem(STORAGE_KEYS.CONNECTION_TYPE) || 'direct';
    const savedRestUrl = localStorage.getItem(STORAGE_KEYS.REST_URL) || 'http://localhost:8765';
    
    // Handle Web Bluetooth unavailability
    if (!isWebBluetoothAvailable) {
      // Show warning
      if (webBluetoothWarning) {
        webBluetoothWarning.style.display = 'block';
      }
      
      // Disable direct connection option
      if (connectionTypeDirect) {
        connectionTypeDirect.disabled = true;
      }
      
      // Gray out label
      if (connectionTypeDirectLabel) {
        connectionTypeDirectLabel.style.opacity = '0.5';
        connectionTypeDirectLabel.style.cursor = 'not-allowed';
      }
      
      // Force REST proxy selection
      if (connectionTypeRest) {
        connectionTypeRest.checked = true;
      }
    } else {
      // Web Bluetooth is available - use saved preferences
      if (savedConnectionType === 'rest' && connectionTypeRest) {
        connectionTypeRest.checked = true;
      } else if (connectionTypeDirect) {
        connectionTypeDirect.checked = true;
      }
    }
    
    if (restServerUrl) {
      restServerUrl.value = savedRestUrl;
    }
    
    // Show/hide REST URL input based on connection type
    const updateConnectionTypeUI = () => {
      if (restUrlContainer) {
        restUrlContainer.style.display = connectionTypeRest?.checked ? 'block' : 'none';
      }
    };
    
    connectionTypeDirect?.addEventListener('change', updateConnectionTypeUI);
    connectionTypeRest?.addEventListener('change', updateConnectionTypeUI);
    
    // Enable/disable name filter input based on radio selection
    const updateFilterState = () => {
      if (connectNameFilter) {
        connectNameFilter.disabled = !connectFilterByName?.checked;
      }
    };
    
    connectFilterByName?.addEventListener('change', updateFilterState);
    connectAllDevices?.addEventListener('change', updateFilterState);
    
    // Initialize state
    updateConnectionTypeUI();
    updateFilterState();
    
    // Close modal function
    const closeModal = () => {
      connectModal?.classList.add('hidden');
    };
    
    // Cancel button
    $('#connectCancel')?.addEventListener('click', closeModal);
    
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !connectModal?.classList.contains('hidden')) {
        closeModal();
      }
    });
    
    // Connect button
    $('#connectOk')?.addEventListener('click', async () => {
      connectModal?.classList.add('hidden');
      
      // Determine connection type
      const connectionType = connectionTypeRest?.checked ? ConnectionType.REST_PROXY : ConnectionType.DIRECT_BLE;
      
      // Get REST URL if needed
      const restUrl = restServerUrl?.value || 'http://localhost:8765';
      
      // Determine filter value
      let nameFilter = '';
      if (connectFilterByName?.checked) {
        nameFilter = connectNameFilter?.value || '';
      }
      
      // Save preferences
      localStorage.setItem(STORAGE_KEYS.CONNECTION_TYPE, connectionType);
      if (connectionType === ConnectionType.REST_PROXY) {
        localStorage.setItem(STORAGE_KEYS.REST_URL, restUrl);
      }
      
      // For REST proxy, show device selection modal
      if (connectionType === ConnectionType.REST_PROXY) {
        await this.showDeviceSelectionModal(restUrl, nameFilter);
      } else {
        // For direct BLE, use existing flow
        await this.performConnection({ connectionType, restUrl, nameFilter });
      }
    });
  }

  /**
   * Show device selection modal for REST proxy
   */
  async showDeviceSelectionModal(restUrl, nameFilter) {
    const deviceSelectModal = $('#deviceSelectModal');
    const deviceList = $('#deviceList');
    const deviceSelectStatus = $('#deviceSelectStatus');
    const deviceSelectCancel = $('#deviceSelectCancel');
    const deviceSelectRescan = $('#deviceSelectRescan');
    
    if (!deviceSelectModal || !deviceList) return;
    
    // Show modal
    deviceSelectModal.classList.remove('hidden');
    
    // Scan function
    const scanForDevices = async () => {
      try {
        deviceList.innerHTML = '';
        deviceSelectStatus.textContent = 'Scanning for devices...';
        
        // Use connection.restProxy to scan
        const devices = await this.connection.restProxy.scanDevices(restUrl, nameFilter, 10);
        
        if (devices.length === 0) {
          deviceSelectStatus.textContent = 'No devices found';
          deviceList.innerHTML = '<p style="padding: 20px; text-align: center; color: #6b7280;">No devices discovered. Try rescanning or check if devices are powered on.</p>';
          return;
        }
        
        deviceSelectStatus.textContent = `Found ${devices.length} device${devices.length > 1 ? 's' : ''}:`;
        
        // Create device list
        devices.forEach(device => {
          const deviceItem = document.createElement('div');
          deviceItem.style.cssText = 'padding: 12px; margin: 8px 0; background: #1f2937; border: 1px solid #374151; border-radius: 8px; cursor: pointer; transition: all 0.2s;';
          deviceItem.innerHTML = `
            <div style="font-weight: 500;">${escapeHtml(device.name || 'Unknown Device')}</div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">${escapeHtml(device.address)}</div>
            <div style="font-size: 11px; color: #6b7280;">Signal: ${device.rssi} dBm</div>
          `;
          
          deviceItem.addEventListener('mouseenter', () => {
            deviceItem.style.background = '#374151';
            deviceItem.style.borderColor = '#3b82f6';
          });
          
          deviceItem.addEventListener('mouseleave', () => {
            deviceItem.style.background = '#1f2937';
            deviceItem.style.borderColor = '#374151';
          });
          
          deviceItem.addEventListener('click', async () => {
            deviceSelectModal.classList.add('hidden');
            await this.performConnection({ 
              connectionType: ConnectionType.REST_PROXY, 
              restUrl, 
              deviceAddress: device.address 
            });
          });
          
          deviceList.appendChild(deviceItem);
        });
        
      } catch (error) {
        console.error('Device scan error:', error);
        deviceSelectStatus.textContent = 'Scan failed';
        deviceList.innerHTML = `<p style="padding: 20px; text-align: center; color: #ef4444;">${escapeHtml(error.message)}</p>`;
      }
    };
    
    // Cancel button
    const cancelHandler = () => {
      deviceSelectModal.classList.add('hidden');
    };
    
    // Rescan button
    const rescanHandler = () => {
      scanForDevices();
    };
    
    // Add event listeners
    deviceSelectCancel.removeEventListener('click', cancelHandler);
    deviceSelectCancel.addEventListener('click', cancelHandler);
    deviceSelectRescan.removeEventListener('click', rescanHandler);
    deviceSelectRescan.addEventListener('click', rescanHandler);
    
    // Escape key to close
    const escapeHandler = (e) => {
      if (e.key === 'Escape' && !deviceSelectModal.classList.contains('hidden')) {
        deviceSelectModal.classList.add('hidden');
      }
    };
    document.removeEventListener('keydown', escapeHandler);
    document.addEventListener('keydown', escapeHandler);
    
    // Start initial scan
    await scanForDevices();
  }

  /**
   * Initialize advanced menu
   */
  initializeAdvancedMenu() {
    const advMenu = $('#advMenu');
    const advRaw = $('#advRaw');
    const advFEDC = $('#advFEDC');
    const advFileDetails = $('#advFileDetails');

    // Load saved state
    advRaw.checked = localStorage.getItem(STORAGE_KEYS.ADV_RAW) === '1';
    advFEDC.checked = localStorage.getItem(STORAGE_KEYS.ADV_FEDC) === '1';
    advFileDetails.checked = localStorage.getItem(STORAGE_KEYS.SHOW_FILE_DETAILS) === '1';

    // Toggle menu
    $('#btnAdvanced')?.addEventListener('click', (e) => {
      e.stopPropagation();
      advMenu?.classList.toggle('hidden');
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menuwrap')) {
        advMenu?.classList.add('hidden');
      }
    });

    // Save state on change
    [advRaw, advFEDC, advFileDetails].forEach((el) => {
      el?.addEventListener('change', () => {
        localStorage.setItem(STORAGE_KEYS.ADV_RAW, advRaw.checked ? '1' : '0');
        localStorage.setItem(STORAGE_KEYS.ADV_FEDC, advFEDC.checked ? '1' : '0');
        localStorage.setItem(STORAGE_KEYS.SHOW_FILE_DETAILS, advFileDetails.checked ? '1' : '0');
        this.applyAdvancedVisibility();
      });
    });

    this.applyAdvancedVisibility();
  }

  /**
   * Apply advanced feature visibility
   */
  applyAdvancedVisibility() {
    const advRaw = $('#advRaw');
    const advFileDetails = $('#advFileDetails');
    
    $('#advRawBlock')?.classList.toggle('hidden', !advRaw?.checked);
    
    // Toggle detail columns visibility
    const showDetails = advFileDetails?.checked;
    document.querySelectorAll('.detail-column').forEach(col => {
      col.style.display = showDetails ? '' : 'none';
    });
  }

  /**
   * Initialize log filter menu
   */
  initializeLogFilter() {
    const logFilterMenu = $('#logFilterMenu');
    const logFilterNormal = $('#logFilterNormal');
    const logFilterWarning = $('#logFilterWarning');
    const logFilterTx = $('#logFilterTx');
    const logFilterRx = $('#logFilterRx');

    // Load saved state (default to all checked)
    logFilterNormal.checked = localStorage.getItem(STORAGE_KEYS.LOG_FILTER_NORMAL) !== '0';
    logFilterWarning.checked = localStorage.getItem(STORAGE_KEYS.LOG_FILTER_WARNING) !== '0';
    logFilterTx.checked = localStorage.getItem(STORAGE_KEYS.LOG_FILTER_TX) !== '0';
    logFilterRx.checked = localStorage.getItem(STORAGE_KEYS.LOG_FILTER_RX) !== '0';

    // Toggle menu
    $('#btnLogFilter')?.addEventListener('click', (e) => {
      e.stopPropagation();
      logFilterMenu?.classList.toggle('hidden');
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menuwrap') || e.target.closest('#advMenu')) {
        logFilterMenu?.classList.add('hidden');
      }
    });

    // Save state and apply filter on change
    [logFilterNormal, logFilterWarning, logFilterTx, logFilterRx].forEach((el) => {
      el?.addEventListener('change', () => {
        localStorage.setItem(STORAGE_KEYS.LOG_FILTER_NORMAL, logFilterNormal.checked ? '1' : '0');
        localStorage.setItem(STORAGE_KEYS.LOG_FILTER_WARNING, logFilterWarning.checked ? '1' : '0');
        localStorage.setItem(STORAGE_KEYS.LOG_FILTER_TX, logFilterTx.checked ? '1' : '0');
        localStorage.setItem(STORAGE_KEYS.LOG_FILTER_RX, logFilterRx.checked ? '1' : '0');
        this.applyLogFilter();
      });
    });

    this.applyLogFilter();
  }

  /**
   * Apply log filter visibility
   */
  applyLogFilter() {
    const logFilterNormal = $('#logFilterNormal');
    const logFilterWarning = $('#logFilterWarning');
    const logFilterTx = $('#logFilterTx');
    const logFilterRx = $('#logFilterRx');

    const logEl = $('#log');
    if (!logEl) return;

    // Apply filter to all log lines
    logEl.querySelectorAll('.line').forEach((line) => {
      const classes = line.classList;
      let visible = true;

      if (classes.contains('warn') && !logFilterWarning?.checked) {
        visible = false;
      } else if (classes.contains('tx') && !logFilterTx?.checked) {
        visible = false;
      } else if (classes.contains('rx') && !logFilterRx?.checked) {
        visible = false;
      } else if (!classes.contains('warn') && !classes.contains('tx') && !classes.contains('rx') && !logFilterNormal?.checked) {
        visible = false;
      }

      line.style.display = visible ? '' : 'none';
    });
  }

  /**
   * Initialize query buttons
   */
  initializeQueryButtons() {
    document.querySelectorAll('[data-q]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!this.connection.isConnected()) {
          this.logger.log('Not connected', LOG_CLASSES.WARNING);
          return;
        }
        const tag = btn.getAttribute('data-q');
        await this.connection.send(buildCommand(tag, '', 8));
      });
    });

    // Get All button - executes all query commands in sequence
    $('#btnGetAll')?.addEventListener('click', async () => {
      if (!this.connection.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      
      this.logger.log('Executing all queries...', LOG_CLASSES.INFO);
      const queries = [
        COMMANDS.QUERY_PARAMS,
        COMMANDS.QUERY_LIVE,
        COMMANDS.QUERY_VOLUME,
        COMMANDS.QUERY_BT_NAME,
        COMMANDS.QUERY_VERSION,
        COMMANDS.QUERY_CAPACITY,
        COMMANDS.QUERY_ORDER
      ];
      
      for (const tag of queries) {
        await this.connection.send(buildCommand(tag, '', 8));
        // Small delay between queries to avoid overwhelming the device
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.logger.log('All queries completed', LOG_CLASSES.SUCCESS);
    });

    // Raw command send button
    $('#btnSendRaw')?.addEventListener('click', async () => {
      if (!this.connection.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }
      const tag = $('#tag')?.value || 'E0';
      const payload = $('#payload')?.value || '';
      await this.connection.send(buildCommand(tag, payload, 8));
      this.logger.log(`Sent raw command: ${tag} with payload: ${payload || '(empty)'}`);
    });

    // Set Device Name button
    $('#btnSetDeviceName')?.addEventListener('click', async () => {
      if (!this.connection.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const deviceNameInput = $('#deviceNameInput');
      const deviceName = deviceNameInput?.value || '';

      // Validate device name: must not be empty and max 22 chars
      if (!deviceName || deviceName.trim().length === 0) {
        this.logger.log('Device name cannot be empty', LOG_CLASSES.WARNING);
        return;
      }

      if (deviceName.length > 22) {
        this.logger.log('Device name cannot exceed 22 characters', LOG_CLASSES.WARNING);
        return;
      }

      const pin = this.state.device.pin || '0000';
      await this.setPinAndName(pin, deviceName);
    });

    // Set PIN button
    $('#btnSetPin')?.addEventListener('click', async () => {
      if (!this.connection.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const pinInput = $('#pinInput');
      const pin = pinInput?.value || '';

      // Validate PIN: must be exactly 4 digits
      if (!/^\d{4}$/.test(pin)) {
        this.logger.log('PIN must be exactly 4 digits', LOG_CLASSES.WARNING);
        return;
      }

      const deviceNameInput = $('#deviceNameInput');
      const deviceName = deviceNameInput?.value || '';
      
      // Use current device name if available, otherwise use entered name or default to btName
      const btName = deviceName || this.state.device.btName || '';
      if (!btName) {
        this.logger.log('Device name not available. Enter a device name first.', LOG_CLASSES.WARNING);
        return;
      }

      await this.setPinAndName(pin, btName);
    });

    // PIN input validation - only allow digits
    const pinInput = $('#pinInput');
    if (pinInput) {
      pinInput.addEventListener('input', (e) => {
        // Remove non-digit characters
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
      });
    }

    // Device name input validation - enforce max length
    const deviceNameInput = $('#deviceNameInput');
    if (deviceNameInput) {
      deviceNameInput.addEventListener('input', (e) => {
        // Enforce max length of 22 characters
        if (e.target.value.length > 22) {
          e.target.value = e.target.value.substring(0, 22);
        }
      });
    }
  }

  /**
   * Set device PIN and Bluetooth name
   * @param {string} pin - 4-digit PIN
   * @param {string} btName - Bluetooth name (should end with "(Live)" suffix)
   */
  async setPinAndName(pin, btName) {
    // Ensure BT name ends with "(Live)"
    if (!btName.endsWith('(Live)')) {
      btName += '(Live)';
    }

    // Build the AAFB command payload
    // Format: <4 bytes PIN in ASCII> <8 bytes wifi password in ASCII> <1 byte name length> <BT name in ASCII with "(Live)">
    
    // Convert PIN to ASCII bytes and then to hex
    const pinBytes = new TextEncoder().encode(pin);
    const pinHex = bytesToHex(pinBytes);
    
    // Hardcoded wifi password "01234567" as ASCII bytes
    const wifiBytes = new TextEncoder().encode('01234567');
    const wifiHex = bytesToHex(wifiBytes);
    
    const nameLengthHex = btName.length.toString(16).padStart(2, '0').toUpperCase();
    
    // BT name as ASCII bytes
    const nameBytes = new TextEncoder().encode(btName);
    const nameHex = bytesToHex(nameBytes);
    
    const payload = pinHex + wifiHex + nameLengthHex + nameHex;
    
    await this.connection.send(buildCommand(COMMANDS.SET_PIN_AND_NAME, payload, 8));
    this.logger.log(`Set PIN to ${pin} with BT name "${btName}"`);
    
    // Query device params to get the updated name and PIN back from the device
    await this.connection.send(buildCommand(COMMANDS.QUERY_BT_NAME, '', 8));
    await this.connection.send(buildCommand(COMMANDS.QUERY_PARAMS, '', 8));
  }

  /**
   * Initialize media controls
   */
  initializeMediaControls() {
    // Volume control - send command immediately on change
    const volRange = $('#volRange');
    const volNum = $('#vol');

    const sendVolumeCommand = async (value) => {
      if (!this.connection.isConnected()) {
        return;
      }
      const v = Math.max(0, Math.min(255, parseInt(value, 10)));
      await this.connection.send(buildCommand(COMMANDS.SET_VOLUME, v.toString(16).padStart(2, '0').toUpperCase(), 8));
      this.logger.log(`Set volume to ${v}`);
    };

    if (volRange && volNum) {
      volRange.addEventListener('input', (e) => {
        volNum.value = e.target.value;
        sendVolumeCommand(e.target.value);
      });
      volNum.addEventListener('input', (e) => {
        const clamped = clamp(e.target.value, 0, 100);
        volRange.value = clamped;
        sendVolumeCommand(clamped);
      });
    }

    // Live Mode button
    $('#btnBT')?.addEventListener('click', () => this.sendMediaCommand(COMMANDS.ENABLE_CLASSIC_BT, '01'));
  }

  /**
   * Send media command
   */
  async sendMediaCommand(tag, payload) {
    if (!this.connection.isConnected()) {
      this.logger.log('Not connected', LOG_CLASSES.WARNING);
      return;
    }
    await this.connection.send(buildCommand(tag, payload, 8));
  }

  /**
   * Initialize live controls
   */
  initializeLiveControls() {
    this.selectedEye = 1; // Default eye selection
    this.buildLiveEyeGrid();

    // Track color cycle state for each light
    this.headColorCycleEnabled = false;
    this.torsoColorCycleEnabled = false;

    // Head Light - Brightness control (immediate)
    const headBriRange = $('#headBrightnessRange');
    const headBriNum = $('#headBrightness');
    
    const sendHeadBrightness = async (value) => {
      if (!this.connection.isConnected()) return;
      const ch = '01'; // Head light is channel 1
      const brightness = parseInt(value, 10);
      const brightnessHex = brightness.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.connection.send(buildCommand(COMMANDS.SET_BRIGHTNESS, ch + brightnessHex + cluster, 8));
      this.logger.log(`Set head light brightness to ${brightness}`);
    };
    
    if (headBriRange && headBriNum) {
      headBriRange.addEventListener('input', (e) => {
        headBriNum.value = e.target.value;
        sendHeadBrightness(e.target.value);
      });
      headBriNum.addEventListener('input', (e) => {
        const clamped = clamp(e.target.value, 0, 255);
        headBriRange.value = clamped;
        sendHeadBrightness(clamped);
      });
    }

    // Torso Light - Brightness control (immediate)
    const torsoBriRange = $('#torsoBrightnessRange');
    const torsoBriNum = $('#torsoBrightness');
    
    const sendTorsoBrightness = async (value) => {
      if (!this.connection.isConnected()) return;
      const ch = '00'; // Torso light is channel 0
      const brightness = parseInt(value, 10);
      const brightnessHex = brightness.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.connection.send(buildCommand(COMMANDS.SET_BRIGHTNESS, ch + brightnessHex + cluster, 8));
      this.logger.log(`Set torso light brightness to ${brightness}`);
    };
    
    if (torsoBriRange && torsoBriNum) {
      torsoBriRange.addEventListener('input', (e) => {
        torsoBriNum.value = e.target.value;
        sendTorsoBrightness(e.target.value);
      });
      torsoBriNum.addEventListener('input', (e) => {
        const clamped = clamp(e.target.value, 0, 255);
        torsoBriRange.value = clamped;
        sendTorsoBrightness(clamped);
      });
    }

    // Head Light - Color/RGB control (immediate)
    const headColorPick = $('#headColorPick');
    const headRInput = $('#headR');
    const headGInput = $('#headG');
    const headBInput = $('#headB');

    const sendHeadColor = async (disableCycle = false) => {
      if (!this.connection.isConnected()) return;
      
      // If user is setting a new color (not from cycle button), disable cycle
      if (disableCycle && this.headColorCycleEnabled) {
        this.headColorCycleEnabled = false;
        const btnHeadColorCycle = $('#btnHeadColorCycle');
        if (btnHeadColorCycle) {
          btnHeadColorCycle.classList.remove('selected');
        }
      }
      
      const ch = '01'; // Head light is channel 1
      const r = parseInt(headRInput?.value || '255', 10);
      const g = parseInt(headGInput?.value || '0', 10);
      const b = parseInt(headBInput?.value || '0', 10);
      const cycle = this.headColorCycleEnabled ? '01' : '00';
      const rHex = r.toString(16).padStart(2, '0').toUpperCase();
      const gHex = g.toString(16).padStart(2, '0').toUpperCase();
      const bHex = b.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.connection.send(buildCommand(COMMANDS.SET_RGB, ch + rHex + gHex + bHex + cycle + cluster + '00', 9));
      this.logger.log(`Set head light color to RGB(${r}, ${g}, ${b}) with cycle ${this.headColorCycleEnabled ? 'ON' : 'OFF'}`);
    };

    // Sync color picker with RGB inputs and send immediately
    if (headColorPick && headRInput && headGInput && headBInput) {
      headColorPick.addEventListener('input', (e) => {
        const hex = e.target.value;
        headRInput.value = parseInt(hex.substring(1, 3), 16);
        headGInput.value = parseInt(hex.substring(3, 5), 16);
        headBInput.value = parseInt(hex.substring(5, 7), 16);
        sendHeadColor(true); // Disable cycle when user picks a color
      });

      [headRInput, headGInput, headBInput].forEach((inp) => {
        inp?.addEventListener('input', () => {
          const r = clamp(headRInput.value, 0, 255);
          const g = clamp(headGInput.value, 0, 255);
          const b = clamp(headBInput.value, 0, 255);
          headColorPick.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          sendHeadColor(true); // Disable cycle when user changes RGB values
        });
      });
    }

    // Torso Light - Color/RGB control (immediate)
    const torsoColorPick = $('#torsoColorPick');
    const torsoRInput = $('#torsoR');
    const torsoGInput = $('#torsoG');
    const torsoBInput = $('#torsoB');

    const sendTorsoColor = async (disableCycle = false) => {
      if (!this.connection.isConnected()) return;
      
      // If user is setting a new color (not from cycle button), disable cycle
      if (disableCycle && this.torsoColorCycleEnabled) {
        this.torsoColorCycleEnabled = false;
        const btnTorsoColorCycle = $('#btnTorsoColorCycle');
        if (btnTorsoColorCycle) {
          btnTorsoColorCycle.classList.remove('selected');
        }
      }
      
      const ch = '00'; // Torso light is channel 0
      const r = parseInt(torsoRInput?.value || '255', 10);
      const g = parseInt(torsoGInput?.value || '0', 10);
      const b = parseInt(torsoBInput?.value || '0', 10);
      const cycle = this.torsoColorCycleEnabled ? '01' : '00';
      const rHex = r.toString(16).padStart(2, '0').toUpperCase();
      const gHex = g.toString(16).padStart(2, '0').toUpperCase();
      const bHex = b.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.connection.send(buildCommand(COMMANDS.SET_RGB, ch + rHex + gHex + bHex + cycle + cluster + '00', 9));
      this.logger.log(`Set torso light color to RGB(${r}, ${g}, ${b}) with cycle ${this.torsoColorCycleEnabled ? 'ON' : 'OFF'}`);
    };

    // Sync color picker with RGB inputs and send immediately
    if (torsoColorPick && torsoRInput && torsoGInput && torsoBInput) {
      torsoColorPick.addEventListener('input', (e) => {
        const hex = e.target.value;
        torsoRInput.value = parseInt(hex.substring(1, 3), 16);
        torsoGInput.value = parseInt(hex.substring(3, 5), 16);
        torsoBInput.value = parseInt(hex.substring(5, 7), 16);
        sendTorsoColor(true); // Disable cycle when user picks a color
      });

      [torsoRInput, torsoGInput, torsoBInput].forEach((inp) => {
        inp?.addEventListener('input', () => {
          const r = clamp(torsoRInput.value, 0, 255);
          const g = clamp(torsoGInput.value, 0, 255);
          const b = clamp(torsoBInput.value, 0, 255);
          torsoColorPick.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          sendTorsoColor(true); // Disable cycle when user changes RGB values
        });
      });
    }

    // Head Light - Effect mode (immediate)
    const headEffectMode = $('#headEffectMode');
    const headEffectSpeedBlock = $('#headEffectSpeedBlock');

    if (headEffectMode && headEffectSpeedBlock) {
      headEffectMode.addEventListener('change', async () => {
        const v = parseInt(headEffectMode.value, 10);
        headEffectSpeedBlock.classList.toggle('hidden', v === 1); // hide for Static
        
        if (!this.connection.isConnected()) return;
        const ch = '01'; // Head light is channel 1
        const modeHex = v.toString(16).padStart(2, '0').toUpperCase();
        const cluster = '00000000';
        await this.connection.send(buildCommand(COMMANDS.SET_MODE, ch + modeHex + cluster + '00', 9));
        this.logger.log(`Set head light mode to ${v} (1=Static, 2=Strobe, 3=Pulsing)`);
      });
    }

    // Torso Light - Effect mode (immediate)
    const torsoEffectMode = $('#torsoEffectMode');
    const torsoEffectSpeedBlock = $('#torsoEffectSpeedBlock');

    if (torsoEffectMode && torsoEffectSpeedBlock) {
      torsoEffectMode.addEventListener('change', async () => {
        const v = parseInt(torsoEffectMode.value, 10);
        torsoEffectSpeedBlock.classList.toggle('hidden', v === 1); // hide for Static
        
        if (!this.connection.isConnected()) return;
        const ch = '00'; // Torso light is channel 0
        const modeHex = v.toString(16).padStart(2, '0').toUpperCase();
        const cluster = '00000000';
        await this.connection.send(buildCommand(COMMANDS.SET_MODE, ch + modeHex + cluster + '00', 8));
        this.logger.log(`Set torso light mode to ${v} (1=Static, 2=Strobe, 3=Pulsing)`);
      });
    }

    // Head Light - Effect speed control (immediate)
    const headEffectSpeedRange = $('#headEffectSpeedRange');
    const headEffectSpeedNum = $('#headEffectSpeed');

    const sendHeadSpeed = async (value) => {
      if (!this.connection.isConnected()) return;
      const ch = '01'; // Head light is channel 1
      const uiSpeed = parseInt(value, 10);
      const deviceSpeed = uiSpeedToDevice(uiSpeed);
      const speedHex = deviceSpeed.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.connection.send(buildCommand(COMMANDS.SET_SPEED, ch + speedHex + cluster, 8));
      this.logger.log(`Set head light speed to ${uiSpeed} (device: ${deviceSpeed})`);
    };

    if (headEffectSpeedRange && headEffectSpeedNum) {
      headEffectSpeedRange.addEventListener('input', (e) => {
        headEffectSpeedNum.value = e.target.value;
        sendHeadSpeed(e.target.value);
      });
      headEffectSpeedNum.addEventListener('input', (e) => {
        const clamped = clamp(e.target.value, 0, 254);
        headEffectSpeedRange.value = clamped;
        sendHeadSpeed(clamped);
      });
    }

    // Torso Light - Effect speed control (immediate)
    const torsoEffectSpeedRange = $('#torsoEffectSpeedRange');
    const torsoEffectSpeedNum = $('#torsoEffectSpeed');

    const sendTorsoSpeed = async (value) => {
      if (!this.connection.isConnected()) return;
      const ch = '00'; // Torso light is channel 0
      const uiSpeed = parseInt(value, 10);
      const deviceSpeed = uiSpeedToDevice(uiSpeed);
      const speedHex = deviceSpeed.toString(16).padStart(2, '0').toUpperCase();
      const cluster = '00000000';
      await this.connection.send(buildCommand(COMMANDS.SET_SPEED, ch + speedHex + cluster, 8));
      this.logger.log(`Set torso light speed to ${uiSpeed} (device: ${deviceSpeed})`);
    };

    if (torsoEffectSpeedRange && torsoEffectSpeedNum) {
      torsoEffectSpeedRange.addEventListener('input', (e) => {
        torsoEffectSpeedNum.value = e.target.value;
        sendTorsoSpeed(e.target.value);
      });
      torsoEffectSpeedNum.addEventListener('input', (e) => {
        const clamped = clamp(e.target.value, 0, 254);
        torsoEffectSpeedRange.value = clamped;
        sendTorsoSpeed(clamped);
      });
    }

    // Movement controls - toggle buttons with special "all" logic
    const liveMoveGrid = $('#liveMove');
    if (liveMoveGrid) {
      const allBtn = liveMoveGrid.querySelector('[data-part="all"]');
      const partBtns = liveMoveGrid.querySelectorAll('[data-part="head"], [data-part="arm"], [data-part="torso"]');
      
      const sendMovementCommand = async () => {
        if (!this.connection.isConnected()) {
          return;
        }
        
        // Check if "all" is selected
        if (allBtn?.classList.contains('selected')) {
          // Send CAFF for all movement
          await this.connection.send(buildCommand(COMMANDS.SET_MOVEMENT, 'FF00000000', 8));
          this.logger.log('Applied movement: all');
        } else {
          // Build bitfield from head/arm/torso selections
          let bitfield = 0;
          partBtns.forEach((btn) => {
            if (btn.classList.contains('selected')) {
              const part = btn.getAttribute('data-part');
              if (part === 'head') bitfield |= 0x01;
              else if (part === 'arm') bitfield |= 0x02;
              else if (part === 'torso') bitfield |= 0x04;
            }
          });
          
          if (bitfield > 0) {
            const bitfieldHex = bitfield.toString(16).padStart(2, '0').toUpperCase();
            await this.connection.send(buildCommand(COMMANDS.SET_MOVEMENT, bitfieldHex + '00000000', 8));
            const parts = [];
            if (bitfield & 0x01) parts.push('head');
            if (bitfield & 0x02) parts.push('arm');
            if (bitfield & 0x04) parts.push('torso');
            this.logger.log(`Applied movement: ${parts.join(', ')}`);
          } else {
            // No movement selected - send CA00 to disable movement
            await this.connection.send(buildCommand(COMMANDS.SET_MOVEMENT, '0000000000', 8));
            this.logger.log('Disabled movement');
          }
        }
      };
      
      // "All" button handler
      allBtn?.addEventListener('click', () => {
        allBtn.classList.toggle('selected');
        // If "all" is now selected, uncheck the other three
        if (allBtn.classList.contains('selected')) {
          partBtns.forEach((btn) => btn.classList.remove('selected'));
        }
        sendMovementCommand();
      });
      
      // Head/Arm/Torso button handlers
      partBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          btn.classList.toggle('selected');
          // If any part button is clicked, uncheck "all"
          allBtn?.classList.remove('selected');
          sendMovementCommand();
        });
      });
    }

    // Head Light - Color cycle button (toggles cycle state)
    const btnHeadColorCycle = $('#btnHeadColorCycle');
    if (btnHeadColorCycle) {
      btnHeadColorCycle.addEventListener('click', async () => {
        if (!this.connection.isConnected()) {
          this.logger.log('Not connected', LOG_CLASSES.WARNING);
          return;
        }
        this.headColorCycleEnabled = !this.headColorCycleEnabled;
        btnHeadColorCycle.classList.toggle('selected', this.headColorCycleEnabled);
        await sendHeadColor();
      });
    }

    // Torso Light - Color cycle button (toggles cycle state)
    const btnTorsoColorCycle = $('#btnTorsoColorCycle');
    if (btnTorsoColorCycle) {
      btnTorsoColorCycle.addEventListener('click', async () => {
        if (!this.connection.isConnected()) {
          this.logger.log('Not connected', LOG_CLASSES.WARNING);
          return;
        }
        this.torsoColorCycleEnabled = !this.torsoColorCycleEnabled;
        btnTorsoColorCycle.classList.toggle('selected', this.torsoColorCycleEnabled);
        await sendTorsoColor();
      });
    }

    // Live eye grid selection - send command immediately
    const apEyeGrid = $('#apEyeGrid');
    if (apEyeGrid) {
      apEyeGrid.addEventListener('click', async (e) => {
        const cell = e.target.closest('.eye-opt');
        if (!cell) return;
        
        this.selectedEye = parseInt(cell.dataset.eye, 10);
        apEyeGrid.querySelectorAll('.eye-opt').forEach((el) => el.classList.remove('selected'));
        cell.classList.add('selected');
        
        // Send command immediately if connected
        if (!this.connection.isConnected()) {
          this.logger.log('Not connected', LOG_CLASSES.WARNING);
          return;
        }
        
        const eyeHex = this.selectedEye.toString(16).padStart(2, '0').toUpperCase();
        const clusterHex = '00000000'; // Always cluster 0 for live mode
        
        // Build payload: eye + 00 + cluster + 00 (no name)
        const payload = eyeHex + '00' + clusterHex + '00';
        
        await this.connection.send(buildCommand(COMMANDS.SET_EYE, payload, 8));
        this.logger.log(`Set eye to ${this.selectedEye} (live mode)`);
      });
    }
  }

  /**
   * Apply movement from UI
   */
  applyMovement(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const toggles = grid.querySelectorAll('.iconToggle.selected');
    const parts = Array.from(toggles).map((btn) => btn.getAttribute('data-part'));

    if (parts.length === 0) {
      this.logger.log('No movement selected', LOG_CLASSES.WARNING);
      return;
    }

    // Map parts to hex
    const partMap = { all: '00', head: '01', arm: '02', torso: '03' };
    const hexParts = parts.map((p) => partMap[p] || '00');

    // Send movement command for each part
    hexParts.forEach(async (partHex) => {
      await this.connection.send(buildCommand(COMMANDS.SET_MOVEMENT, partHex + '00000000', 8));
    });

    this.logger.log(`Applied movement: ${parts.join(', ')}`);
  }

  /**
   * Initialize file controls
   */
  initializeFileControls() {
    this.initializeFileListControls();
    this.initializeBitrateControls();
    this.initializeChunkSizeControls();
    this.initializeFileTransferControls();
    this.initializeFileTableHandlers();
    this.initializeFileDragAndDrop();
  }

  /**
   * Initialize file list refresh and filter controls
   */
  initializeFileListControls() {
    $('#btnRefreshFiles')?.addEventListener('click', () => {
      this.fileManager.startFetchFiles();
    });

    $('#filesFilter')?.addEventListener('input', () => {
      this.updateFilesTable();
    });

    $('#fileInput')?.addEventListener('change', async (e) => {
      await this.handleFileSelection(e.target.files?.[0]);
    });
  }

  /**
   * Initialize bitrate override controls
   */
  initializeBitrateControls() {
    const chkBitrateOverride = $('#chkBitrateOverride');
    const convertOpts = $('#convertOpts');
    const mp3Kbps = $('#mp3Kbps');
    
    // Load saved bitrate preferences from localStorage
    const savedBitrateOverride = localStorage.getItem(STORAGE_KEYS.BITRATE_OVERRIDE) === 'true';
    const savedBitrate = localStorage.getItem(STORAGE_KEYS.BITRATE);
    
    // Restore checkbox state and visibility
    if (chkBitrateOverride) {
      chkBitrateOverride.checked = savedBitrateOverride;
      if (savedBitrateOverride) {
        convertOpts?.classList.remove('hidden');
      }
    }
    
    // Restore bitrate selection
    if (mp3Kbps && savedBitrate) {
      mp3Kbps.value = savedBitrate;
    }
    
    // Toggle bitrate options and save preference
    chkBitrateOverride?.addEventListener('change', (e) => {
      convertOpts?.classList.toggle('hidden', !e.target.checked);
      localStorage.setItem(STORAGE_KEYS.BITRATE_OVERRIDE, e.target.checked.toString());
    });
    
    // Save bitrate selection when changed
    mp3Kbps?.addEventListener('change', (e) => {
      localStorage.setItem(STORAGE_KEYS.BITRATE, e.target.value);
    });
  }

  /**
   * Initialize chunk size override controls
   */
  initializeChunkSizeControls() {
    const chkChunkOverride = $('#chkChunkOverride');
    const chunkOverrideOpts = $('#chunkOverrideOpts');
    const chunkSizeSlider = $('#chunkSizeSlider');
    const chunkSizeValue = $('#chunkSizeValue');

    // Load saved preferences from localStorage
    const savedOverride = localStorage.getItem(STORAGE_KEYS.CHUNK_OVERRIDE) === 'true';
    const savedChunkSize = parseInt(localStorage.getItem(STORAGE_KEYS.CHUNK_SIZE), 10);

    // Initialize slider with saved or auto-determined chunk size
    if (chunkSizeSlider && chunkSizeValue) {
      const autoChunkSize = this.fileManager.getChunkSize();
      const initialSize = (savedChunkSize >= 50 && savedChunkSize <= 500) ? savedChunkSize : autoChunkSize;
      chunkSizeSlider.value = initialSize;
      chunkSizeValue.textContent = initialSize;
    }

    // Restore checkbox state and visibility
    if (chkChunkOverride) {
      chkChunkOverride.checked = savedOverride;
      if (savedOverride) {
        chunkOverrideOpts?.classList.remove('hidden');
      }
    }

    // Toggle chunk override options
    chkChunkOverride?.addEventListener('change', (e) => {
      chunkOverrideOpts?.classList.toggle('hidden', !e.target.checked);
      
      // Save preference
      localStorage.setItem(STORAGE_KEYS.CHUNK_OVERRIDE, e.target.checked.toString());
      
      // If enabling override, update slider to current auto value (if not previously saved)
      if (e.target.checked && chunkSizeSlider && chunkSizeValue && !savedChunkSize) {
        const autoChunkSize = this.fileManager.getChunkSize();
        chunkSizeSlider.value = autoChunkSize;
        chunkSizeValue.textContent = autoChunkSize;
      }
    });

    // Update chunk size display when slider changes and save to localStorage
    chunkSizeSlider?.addEventListener('input', (e) => {
      if (chunkSizeValue) {
        chunkSizeValue.textContent = e.target.value;
      }
      localStorage.setItem(STORAGE_KEYS.CHUNK_SIZE, e.target.value);
    });
  }

  /**
   * Initialize file transfer controls (send/cancel)
   */
  initializeFileTransferControls() {
    $('#btnSendFile')?.addEventListener('click', async () => {
      await this.handleFileSend();
    });

    $('#btnCancelFile')?.addEventListener('click', async () => {
      await this.fileManager.cancelTransfer();
    });
  }

  /**
   * Initialize file table button and checkbox handlers
   */
  initializeFileTableHandlers() {
    // Files table button handler (Play and Edit)
    $('#filesTable')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      
      if (!this.connection.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        return;
      }

      const serial = parseInt(btn.dataset.serial, 10);
      const item = this.state.files.items.get(serial);
      if (!item) return;

      if (btn.dataset.action === 'play' || btn.dataset.action === 'stop') {
        this.handlePlayFile(serial);
      } else if (btn.dataset.action === 'edit') {
        if (btn.disabled) return;
        this.handleEditFile(item);
      }
    });

    // Files table checkbox handler (Enable/Disable)
    $('#filesTable')?.addEventListener('change', async (e) => {
      const checkbox = e.target.closest('.file-enabled-checkbox');
      if (!checkbox) return;
      
      if (!this.connection.isConnected()) {
        this.logger.log('Not connected', LOG_CLASSES.WARNING);
        // Revert checkbox state
        checkbox.checked = !checkbox.checked;
        return;
      }

      await this.handleFileEnableToggle();
    });
  }

  /**
   * Initialize drag and drop handlers for file reordering
   */
  initializeFileDragAndDrop() {
    let draggedRow = null;

    const tbody = $('#filesTable tbody');
    if (!tbody) return;

    tbody.addEventListener('dragstart', (e) => {
      const row = e.target.closest('tr.draggable-row');
      if (!row) return;
      
      draggedRow = row;
      row.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });

    tbody.addEventListener('dragend', (e) => {
      const row = e.target.closest('tr.draggable-row');
      if (row) {
        row.style.opacity = '1';
      }
      draggedRow = null;
    });

    tbody.addEventListener('dragover', (e) => {
      e.preventDefault();
      const row = e.target.closest('tr.draggable-row');
      if (!row || !draggedRow || row === draggedRow) return;
      
      e.dataTransfer.dropEffect = 'move';
      
      // Visual feedback - add border to indicate drop position
      const rows = Array.from(tbody.querySelectorAll('tr.draggable-row'));
      const draggedIndex = rows.indexOf(draggedRow);
      const targetIndex = rows.indexOf(row);
      
      if (draggedIndex < targetIndex) {
        row.style.borderBottom = '2px solid #4CAF50';
        row.style.borderTop = '';
      } else {
        row.style.borderTop = '2px solid #4CAF50';
        row.style.borderBottom = '';
      }
    });

    tbody.addEventListener('dragleave', (e) => {
      const row = e.target.closest('tr.draggable-row');
      if (row) {
        row.style.borderTop = '';
        row.style.borderBottom = '';
      }
    });

    tbody.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetRow = e.target.closest('tr.draggable-row');
      if (!targetRow || !draggedRow || targetRow === draggedRow) return;
      
      // Clear visual feedback
      targetRow.style.borderTop = '';
      targetRow.style.borderBottom = '';
      
      await this.handleFileDrop(draggedRow, targetRow);
    });
  }

  /**
   * Handle play file button click
   */
  async handlePlayFile(serial) {
    const serialHex = serial.toString(16).padStart(4, '0').toUpperCase();
    
    // Check if this file is currently playing
    const isPlaying = this.playState.playing && this.playState.serial === serial;
    
    // Send '01' to play, '00' to stop
    const playPauseByte = isPlaying ? '00' : '01';
    await this.connection.send(buildCommand(COMMANDS.PLAY_PAUSE, serialHex + playPauseByte, 8));
    
    if (isPlaying) {
      this.logger.log(`Stopping file #${serial}`);
    } else {
      this.logger.log(`Playing file #${serial}`);
    }
  }

  /**
   * Handle edit file button click
   */
  handleEditFile(item) {
    this.editModal.open(item);
  }

  /**
   * Handle file drop for reordering
   * @param {HTMLElement} draggedRow - The row being dragged
   * @param {HTMLElement} targetRow - The row being dropped onto
   */
  async handleFileDrop(draggedRow, targetRow) {
    if (!this.connection.isConnected()) {
      this.logger.log('Not connected', LOG_CLASSES.WARNING);
      return;
    }

    const tbody = draggedRow.parentElement;
    const rows = Array.from(tbody.querySelectorAll('tr.draggable-row'));
    const draggedIndex = rows.indexOf(draggedRow);
    const targetIndex = rows.indexOf(targetRow);
    
    if (draggedIndex === targetIndex) return;

    // Reorder rows in DOM
    if (draggedIndex < targetIndex) {
      targetRow.parentNode.insertBefore(draggedRow, targetRow.nextSibling);
    } else {
      targetRow.parentNode.insertBefore(draggedRow, targetRow);
    }

    // Collect new order from DOM
    const enabledSerials = Array.from(tbody.querySelectorAll('tr.draggable-row'))
      .map(row => parseInt(row.dataset.serial, 10));

    // Update state and device
    const ordersAsString = JSON.stringify(enabledSerials);
    this.state.updateDevice({ order: ordersAsString });
    this.state.notify('files'); // This will re-render the table with new numbers

    this.logger.log(`Reordered files: ${enabledSerials.length} files`, LOG_CLASSES.INFO);
    await this.fileManager.updateFileOrder(enabledSerials);
  }

  /**
   * Handle file enable/disable toggle
   * Collects all checked files in display order and updates device
   */
  async handleFileEnableToggle() {
    // Collect all checked checkboxes in DOM order (which reflects sort order)
    const checkboxes = Array.from(document.querySelectorAll('.file-enabled-checkbox'));
    const enabledSerials = checkboxes
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.dataset.serial, 10));

    if (enabledSerials.length === 0) {
      this.logger.log('At least one file must be enabled', LOG_CLASSES.WARNING);
      // Find first checkbox and re-check it
      if (checkboxes.length > 0) {
        checkboxes[0].checked = true;
      }
      return;
    }

    // Immediately update order in state to trigger UI resort
    const ordersAsString = JSON.stringify(enabledSerials);
    this.state.updateDevice({ order: ordersAsString });
    this.state.notify('files');

    this.logger.log(`Updating file order: ${enabledSerials.length} files enabled`, LOG_CLASSES.INFO);
    await this.fileManager.updateFileOrder(enabledSerials);
  }

  /**
   * Handle play/pause message from device
   */
  handlePlayPauseMessage(serial, playing, duration) {
    if (playing) {
      // Start playing
      this.playState.serial = serial;
      this.playState.playing = true;
      this.playState.duration = duration;
      this.playState.startTime = Date.now();
      
      // Start countdown timer
      this.startPlayTimer(serial);
    } else {
      // Stop playing
      this.stopPlayTimer();
      this.playState.serial = null;
      this.playState.playing = false;
      this.playState.duration = 0;
      this.playState.startTime = null;
    }
    
    // Update the file table to reflect play state
    this.updateFilesTable();
  }

  /**
   * Start countdown timer for playing file
   */
  startPlayTimer(serial) {
    // Clear any existing timer
    this.stopPlayTimer();
    
    // Update timer every second
    this.playState.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.playState.startTime) / 1000);
      const remaining = Math.max(0, this.playState.duration - elapsed);
      
      // Update the timer display
      this.updatePlayTimer(serial, remaining);
      
      // Stop timer when done
      if (remaining <= 0) {
        this.stopPlayTimer();
      }
    }, 1000);
    
    // Initial update
    this.updatePlayTimer(serial, this.playState.duration);
  }

  /**
   * Stop countdown timer
   */
  stopPlayTimer() {
    if (this.playState.timerInterval) {
      clearInterval(this.playState.timerInterval);
      this.playState.timerInterval = null;
    }
  }

  /**
   * Update play timer display for a specific file
   */
  updatePlayTimer(serial, seconds) {
    const btn = document.querySelector(`button[data-action="stop"][data-serial="${serial}"]`);
    if (btn) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      btn.textContent = `⏹ Stop (${timeStr})`;
    }
  }

  /**
   * Handle file selection
   */
  async handleFileSelection(file) {
    if (!file) return;

    try {
      // Get duration for warning
      const duration = await this.audioConverter.getAudioDuration(file);
      // TODO: Show warning if > 30 seconds

      // Read file
      const buffer = await file.arrayBuffer();
      const originalBytes = new Uint8Array(buffer);

      let fileBytes = originalBytes;
      let fileName = file.name;

      // If convert box is already checked, convert right away
      if ($('#chkConvert')?.checked) {
        const kbps = $('#chkBitrateOverride')?.checked 
          ? parseInt($('#mp3Kbps')?.value || '32', 10)
          : 32; // Use default 32 kbps if not overriding
        this.logger.log(`Converting to MP3 8 kHz mono (${kbps} kbps)…`);
        const result = await this.audioConverter.convertToDeviceMp3(file, kbps);
        fileBytes = result.u8;
        fileName = result.name;
        this.logger.log(`Converted: ${fileName} (${fileBytes.length} bytes)`, LOG_CLASSES.WARNING);
      } else {
        this.logger.log(`Picked file: ${file.name} (${originalBytes.length} bytes)`);
      }

      // Store file data
      this.fileManager.storeFilePickerData(file, originalBytes, fileBytes, fileName);

      // Pre-fill filename if empty
      if (!$('#fileName')?.value) {
        $('#fileName').value = fileName;
      }

      // Check for name conflicts
      this.checkFileNameConflict($('#fileName')?.value || fileName);
    } catch (error) {
      this.logger.log(`File error: ${error.message}`, LOG_CLASSES.WARNING);
    }
  }

  /**
   * Handle file send
   */
  async handleFileSend() {
    if (!this.connection.isConnected()) {
      this.logger.log('Not connected', LOG_CLASSES.WARNING);
      return;
    }

    const pickerData = this.fileManager.getFilePickerData();
    if (!pickerData.file && !pickerData.fileBytes) {
      this.logger.log('Pick a file first.', LOG_CLASSES.WARNING);
      return;
    }

    let fileBytes = pickerData.fileBytes;
    let fileName = pickerData.fileName;

    // If user toggled "Convert" AFTER selecting the file, convert now
    try {
      if ($('#chkConvert')?.checked && pickerData.file) {
        const kbps = $('#chkBitrateOverride')?.checked 
          ? parseInt($('#mp3Kbps')?.value || '32', 10)
          : 32; // Use default 32 kbps if not overriding
        this.logger.log(`Converting to MP3 8 kHz mono (${kbps} kbps) before send…`);
        const result = await this.audioConverter.convertToDeviceMp3(pickerData.file, kbps);
        fileBytes = result.u8;
        // If the filename box is empty or still matches the previous base, prefer .mp3
        const typed = ($('#fileName')?.value || '').trim();
        if (!typed || typed === pickerData.fileName) {
          $('#fileName').value = result.name;
        }
        fileName = result.name;
      } else if (!$('#chkConvert')?.checked && pickerData.originalBytes) {
        // Ensure we're using the original bytes if convert is off
        fileBytes = pickerData.originalBytes;
        fileName = pickerData.file?.name || pickerData.fileName;
      }
    } catch (error) {
      this.logger.log(`Convert error: ${error.message} — sending original file`, LOG_CLASSES.WARNING);
      if (pickerData.originalBytes) {
        fileBytes = pickerData.originalBytes;
        fileName = pickerData.file?.name || pickerData.fileName;
      }
    }

    // Filename to send (auto .mp3 if converting)
    let finalName = ($('#fileName')?.value || fileName || 'skelly.bin').trim();
    if ($('#chkConvert')?.checked && !/\.mp3$/i.test(finalName)) {
      finalName = finalName.replace(/\.\w+$/, '') + '.mp3';
      $('#fileName').value = finalName;
    }
    if (!finalName) {
      this.logger.log('Provide a device filename.', LOG_CLASSES.WARNING);
      return;
    }

    // Check for filename conflict
    const conflict = this.checkFileNameConflict(finalName);
    if (conflict) {
      // Show overwrite confirmation modal
      const confirmed = await this.showOverwriteConfirmation(conflict.name);
      if (!confirmed) {
        this.logger.log('Upload cancelled by user', LOG_CLASSES.INFO);
        return;
      }
    }

    // Check if chunk size override is enabled
    let chunkSizeOverride = null;
    const chkChunkOverride = $('#chkChunkOverride');
    const chunkSizeSlider = $('#chunkSizeSlider');
    if (chkChunkOverride?.checked && chunkSizeSlider) {
      chunkSizeOverride = parseInt(chunkSizeSlider.value, 10);
    }

    try {
      await this.fileManager.uploadFile(fileBytes, finalName, chunkSizeOverride);
    } catch (error) {
      this.logger.log(`Upload error: ${error.message}`, LOG_CLASSES.WARNING);
    }
  }

  /**
   * Show overwrite confirmation modal
   * @param {string} fileName - Name of the existing file
   * @returns {Promise<boolean>} - True if user confirms, false if cancelled
   */
  async showOverwriteConfirmation(fileName) {
    return new Promise((resolve) => {
      const modal = $('#overwriteModal');
      const message = $('#overwriteMessage');
      const confirmBtn = $('#overwriteConfirm');
      const cancelBtn = $('#overwriteCancel');

      if (!modal || !message || !confirmBtn || !cancelBtn) {
        resolve(false);
        return;
      }

      // Update message with filename
      message.textContent = `A file named "${fileName}" already exists on the device.`;

      // Show modal
      modal.classList.remove('hidden');

      // Handle confirm
      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };

      // Handle cancel
      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      // Handle escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          handleCancel();
        }
      };

      // Cleanup function
      const cleanup = () => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        document.removeEventListener('keydown', handleEscape);
      };

      // Add event listeners
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      document.addEventListener('keydown', handleEscape);
    });
  }

  /**
   * Check for filename conflicts
   * @param {string} name - Filename to check
   * @returns {Object|null} - Conflict object if found, null otherwise
   */
  checkFileNameConflict(name) {
    const conflict = this.state.hasFileName(name);
    const inputEl = $('#fileName');
    if (inputEl) {
      inputEl.classList.toggle('warn-border', !!conflict);
    }
    return conflict;
  }

  /**
   * Save log contents to file
   */
  saveLog() {
    const logEl = $('#log');
    if (!logEl) return;

    // Get all log lines and filter out hidden ones
    const lines = logEl.querySelectorAll('.line');
    const logContent = Array.from(lines)
      .filter(line => line.style.display !== 'none')
      .map(line => line.textContent)
      .join('\n');

    if (!logContent.trim()) {
      this.logger.log('Log is empty - nothing to save', LOG_CLASSES.WARNING);
      return;
    }

    // Create filename with timestamp
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
    const filename = `UltraSkelly-${dateStr}-${timeStr}.log`;

    // Create blob and download
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    this.logger.log(`Log saved to ${filename}`, LOG_CLASSES.INFO);
  }

  /**
   * Handle connect button - show connection modal
   */
  async handleConnect() {
    console.log('handleConnect called - showing modal');
    const connectModal = $('#connectModal');
    connectModal?.classList.remove('hidden');
  }

  /**
   * Perform actual connection with filter
   */
  async performConnection(options) {
    console.log('performConnection called');
    try {
      const connectionOptions = {
        type: options.connectionType || ConnectionType.DIRECT_BLE,
        nameFilter: options.nameFilter || options.deviceAddress || '',
        restUrl: options.restUrl || '',
      };
      
      console.log('Connecting with options:', connectionOptions);
      await this.connection.connect(connectionOptions);
      console.log('Connected successfully');
      
      // Query device state in sequence: live mode, params, volume, BT name
      await this.connection.send(buildCommand(COMMANDS.QUERY_LIVE, '', 8));
      setTimeout(() => this.connection.send(buildCommand(COMMANDS.QUERY_PARAMS, '', 8)), 50);
      setTimeout(() => this.connection.send(buildCommand(COMMANDS.QUERY_VOLUME, '', 8)), 100);
      setTimeout(() => this.connection.send(buildCommand(COMMANDS.QUERY_BT_NAME, '', 8)), 150);
      
      // Start file list fetch - this will query capacity and order after files are received
      setTimeout(() => {
        this.fileManager.startFetchFiles();
      }, 200);
    } catch (error) {
      console.error('Connection error:', error);
      this.logger.log(`Connection failed: ${error.message}`, LOG_CLASSES.WARNING);
    }
  }

  /**
   * Handle disconnect button
   */
  async handleDisconnect() {
    await this.connection.disconnect();
  }

  /**
   * Build live eye grid
   */
  buildLiveEyeGrid() {
    const grid = $('#apEyeGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Create eye options for images 1-18
    for (let imgIdx = 1; imgIdx <= 18; imgIdx++) {
      const eyeNum = imgIdx;
      const div = document.createElement('div');
      div.className = 'eye-opt' + (eyeNum === this.selectedEye ? ' selected' : '');
      div.dataset.eye = String(eyeNum);
      div.title = `Eye ${eyeNum}`;
      
      // Create image element
      const img = document.createElement('img');
      img.className = 'eye-thumb';
      img.src = `images/eye_icon_${imgIdx}.png`;
      img.alt = `eye ${eyeNum}`;
      
      div.appendChild(img);
      grid.appendChild(div);
    }
  }

  /**
   * UTF-16LE hex encoding helper
   */
  utf16leHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      hex += (code & 0xff).toString(16).padStart(2, '0');
      hex += ((code >> 8) & 0xff).toString(16).padStart(2, '0');
    }
    return hex.toUpperCase();
  }

  /**
   * Update device UI
   */
  updateDeviceUI(device) {
    console.log('updateDeviceUI called, connected:', device.connected);
    
    // Update status
    const statusSpan = $('#status span');
    if (statusSpan) {
      if (device.connected) {
        // Get connection info directly from connection manager
        const deviceInfo = this.connection.getDeviceInfo();
        
        // Show REST URL if connected via REST proxy
        if (deviceInfo && deviceInfo.connectionType === ConnectionType.REST_PROXY && deviceInfo.restUrl) {
          statusSpan.textContent = `Connected (via ${deviceInfo.restUrl})`;
        } else {
          statusSpan.textContent = 'Connected';
        }
      } else {
        statusSpan.textContent = 'Disconnected';
      }
    }

    document.body.classList.toggle('disconnected', !device.connected);
    
    const btnDisconnect = $('#btnDisconnect');
    if (btnDisconnect) {
      btnDisconnect.disabled = !device.connected;
    }
    
    const btnConnect = $('#btnConnect');
    if (btnConnect) {
      btnConnect.disabled = device.connected;
    }

    // Update device info
    if ($('#statName')) $('#statName').textContent = device.name || '—';
    if ($('#statShowMode')) $('#statShowMode').textContent = device.showMode ?? '—';
    if ($('#statChannels')) {
      $('#statChannels').textContent = device.channels.length ? device.channels.join(', ') : '—';
    }
    if ($('#statBtName')) $('#statBtName').textContent = device.btName || '—';
    
    // Update volume slider when device volume changes
    if (device.volume != null) {
      const volRange = $('#volRange');
      const volNum = $('#vol');
      if (volRange) volRange.value = device.volume;
      if (volNum) volNum.value = device.volume;
    }
    
    if ($('#statCapacity')) {
      $('#statCapacity').textContent =
        device.capacity != null
          ? `${device.capacity} KB remaining`
          : '—';
    }
    
    if ($('#statFileCount')) {
      const reported = device.filesReported ?? '—';
      const received = device.filesReceived ?? '—';
      const mismatch = (device.filesReported != null && device.filesReceived != null && 
                        device.filesReported !== device.filesReceived);
      
      $('#statFileCount').textContent = `${received} / ${reported}`;
      
      // Add warning styling if counts don't match
      if (mismatch) {
        $('#statFileCount').style.color = 'var(--warn)';
        $('#statFileCount').title = 'Received count differs from reported count';
      } else {
        $('#statFileCount').style.color = '';
        $('#statFileCount').title = '';
      }
    }
    
    if ($('#statOrder')) {
      $('#statOrder').textContent = device.order || '—';
    }
    
    if ($('#statPin')) {
      $('#statPin').textContent = device.pin || '—';
    }
    
    // Update PIN input field
    if ($('#pinInput') && device.pin) {
      $('#pinInput').value = device.pin;
    }
    
    // Update device name input field (remove "(Live)" suffix if present)
    if ($('#deviceNameInput') && device.btName) {
      const displayName = device.btName.replace(/\s*\(Live\)\s*$/i, '');
      $('#deviceNameInput').value = displayName;
    }
  }

  /**
   * Update live status UI
   */
  updateLiveUI(live) {
    // Update movement icons based on action bitfield
    if (live.action != null) {
      const actionBits = parseInt(live.action, 10);
      const liveMove = $('#liveMove');
      
      if (liveMove && !isNaN(actionBits)) {
        // Clear all selections first
        liveMove.querySelectorAll('.iconToggle').forEach(btn => btn.classList.remove('selected'));
        
        // Map bitfield to icon selections
        // Bit 0 (0x01) = head, Bit 1 (0x02) = arm, Bit 2 (0x04) = torso
        // If all bits set or value is 255, select "all"
        if (actionBits === 255 || actionBits === 0x07) {
          const allBtn = liveMove.querySelector('[data-part="all"]');
          if (allBtn) allBtn.classList.add('selected');
        } else {
          if (actionBits & 0x01) {
            const headBtn = liveMove.querySelector('[data-part="head"]');
            if (headBtn) headBtn.classList.add('selected');
          }
          if (actionBits & 0x02) {
            const armBtn = liveMove.querySelector('[data-part="arm"]');
            if (armBtn) armBtn.classList.add('selected');
          }
          if (actionBits & 0x04) {
            const torsoBtn = liveMove.querySelector('[data-part="torso"]');
            if (torsoBtn) torsoBtn.classList.add('selected');
          }
        }
      }
    }

    // Update eye icon selection
    if (live.eye != null) {
      this.selectedEye = live.eye;
      const apEyeGrid = $('#apEyeGrid');
      if (apEyeGrid) {
        // Clear all selections
        apEyeGrid.querySelectorAll('.eye-opt').forEach(el => el.classList.remove('selected'));
        // Select the current eye
        const eyeOpt = apEyeGrid.querySelector(`[data-eye="${live.eye}"]`);
        if (eyeOpt) eyeOpt.classList.add('selected');
      }
    }

    // Update light settings from live.lights array
    if (live.lights && Array.isArray(live.lights)) {
      // Head light (index 1)
      if (live.lights[1]) {
        const headLight = live.lights[1];
        
        // Brightness
        if ($('#headBrightness')) $('#headBrightness').value = headLight.brightness;
        if ($('#headBrightnessRange')) $('#headBrightnessRange').value = headLight.brightness;
        
        // Color (RGB)
        if ($('#headR')) $('#headR').value = headLight.r;
        if ($('#headG')) $('#headG').value = headLight.g;
        if ($('#headB')) $('#headB').value = headLight.b;
        const headHex = `#${headLight.r.toString(16).padStart(2, '0')}${headLight.g.toString(16).padStart(2, '0')}${headLight.b.toString(16).padStart(2, '0')}`;
        if ($('#headColorPick')) $('#headColorPick').value = headHex;
        
        // Color cycle state
        this.headColorCycleEnabled = (headLight.colorCycle === 1);
        const headCycleBtn = $('#btnHeadColorCycle');
        if (headCycleBtn) {
          if (this.headColorCycleEnabled) {
            headCycleBtn.classList.add('selected');
          } else {
            headCycleBtn.classList.remove('selected');
          }
        }
        
        // Effect mode
        if ($('#headEffectMode')) $('#headEffectMode').value = headLight.effectMode;
        
        // Effect speed (show/hide speed block based on mode)
        const headEffectSpeedBlock = $('#headEffectSpeedBlock');
        if (headEffectSpeedBlock) {
          headEffectSpeedBlock.classList.toggle('hidden', headLight.effectMode === 1);
        }
        const headUISpeed = deviceSpeedToUI(headLight.effectSpeed);
        if ($('#headEffectSpeed')) $('#headEffectSpeed').value = headUISpeed;
        if ($('#headEffectSpeedRange')) $('#headEffectSpeedRange').value = headUISpeed;
      }
      
      // Torso light (index 0)
      if (live.lights[0]) {
        const torsoLight = live.lights[0];
        
        // Brightness
        if ($('#torsoBrightness')) $('#torsoBrightness').value = torsoLight.brightness;
        if ($('#torsoBrightnessRange')) $('#torsoBrightnessRange').value = torsoLight.brightness;
        
        // Color (RGB)
        if ($('#torsoR')) $('#torsoR').value = torsoLight.r;
        if ($('#torsoG')) $('#torsoG').value = torsoLight.g;
        if ($('#torsoB')) $('#torsoB').value = torsoLight.b;
        const torsoHex = `#${torsoLight.r.toString(16).padStart(2, '0')}${torsoLight.g.toString(16).padStart(2, '0')}${torsoLight.b.toString(16).padStart(2, '0')}`;
        if ($('#torsoColorPick')) $('#torsoColorPick').value = torsoHex;
        
        // Color cycle state
        this.torsoColorCycleEnabled = (torsoLight.colorCycle === 1);
        const torsoCycleBtn = $('#btnTorsoColorCycle');
        if (torsoCycleBtn) {
          if (this.torsoColorCycleEnabled) {
            torsoCycleBtn.classList.add('selected');
          } else {
            torsoCycleBtn.classList.remove('selected');
          }
        }
        
        // Effect mode
        if ($('#torsoEffectMode')) $('#torsoEffectMode').value = torsoLight.effectMode;
        
        // Effect speed (show/hide speed block based on mode)
        const torsoEffectSpeedBlock = $('#torsoEffectSpeedBlock');
        if (torsoEffectSpeedBlock) {
          torsoEffectSpeedBlock.classList.toggle('hidden', torsoLight.effectMode === 1);
        }
        const torsoUISpeed = deviceSpeedToUI(torsoLight.effectSpeed);
        if ($('#torsoEffectSpeed')) $('#torsoEffectSpeed').value = torsoUISpeed;
        if ($('#torsoEffectSpeedRange')) $('#torsoEffectSpeedRange').value = torsoUISpeed;
      }
    }
  }

  /**
   * Update files table
   */
  updateFilesTable() {
    const tbody = $('#filesTable tbody');
    if (!tbody) return;

    // Disable table during active fetch
    const table = $('#filesTable');
    const isRefreshing = this.state.files.activeFetch;
    if (table) {
      if (isRefreshing) {
        table.style.opacity = '0.5';
        table.style.pointerEvents = 'none';
      } else {
        table.style.opacity = '1';
        table.style.pointerEvents = 'auto';
      }
    }

    tbody.innerHTML = '';

    // Show refreshing message if no files yet and currently fetching
    if (isRefreshing && this.state.files.items.size === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 10; // Span all columns
      td.textContent = 'Refreshing...';
      td.style.textAlign = 'center';
      td.style.fontStyle = 'italic';
      td.style.color = '#888';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const query = ($('#filesFilter')?.value || '').toLowerCase().trim();
    
    // Get file order from device state
    let fileOrder = [];
    try {
      if (this.state.device.order) {
        fileOrder = JSON.parse(this.state.device.order);
      }
    } catch (e) {
      // If parsing fails, use empty array
    }
    
    // Sort files: enabled (in order) first by order position, disabled (not in order) last by serial
    const files = Array.from(this.state.files.items.values())
      .filter((file) => !query || (file.name || '').toLowerCase().includes(query))
      .sort((a, b) => {
        const indexA = fileOrder.indexOf(a.serial);
        const indexB = fileOrder.indexOf(b.serial);
        const inOrderA = indexA !== -1;
        const inOrderB = indexB !== -1;
        
        // Both enabled: sort by order position
        if (inOrderA && inOrderB) return indexA - indexB;
        // Only A enabled: A comes first
        if (inOrderA) return -1;
        // Only B enabled: B comes first
        if (inOrderB) return 1;
        // Both disabled: sort by serial
        return a.serial - b.serial;
      });

    const canEdit = true; // Edit feature is now always enabled

    let rowIndex = 1;
    for (const file of files) {
      const tr = document.createElement('tr');
      const eyeImgIdx = file.eye;
      
      // Generate Head color indicator (lights[1])
      let headColorHtml = '';
      if (file.lights && file.lights[1]) {
        const headLight = file.lights[1];
        if (headLight.colorCycle) {
          headColorHtml = '<img src="images/icon_light_cycle_no.png" alt="Cycle" title="Color cycle enabled" style="width:24px;height:24px" />';
        } else {
          const rgb = `rgb(${headLight.r}, ${headLight.g}, ${headLight.b})`;
          headColorHtml = `<div style="width:24px;height:24px;border-radius:50%;background-color:${rgb};border:1px solid #444" title="RGB(${headLight.r},${headLight.g},${headLight.b})"></div>`;
        }
      }
      
      // Generate Torso color indicator (lights[0])
      let torsoColorHtml = '';
      if (file.lights && file.lights[0]) {
        const torsoLight = file.lights[0];
        if (torsoLight.colorCycle) {
          torsoColorHtml = '<img src="images/icon_light_cycle_no.png" alt="Cycle" title="Color cycle enabled" style="width:24px;height:24px" />';
        } else {
          const rgb = `rgb(${torsoLight.r}, ${torsoLight.g}, ${torsoLight.b})`;
          torsoColorHtml = `<div style="width:24px;height:24px;border-radius:50%;background-color:${rgb};border:1px solid #444" title="RGB(${torsoLight.r},${torsoLight.g},${torsoLight.b})"></div>`;
        }
      }
      
      // Generate movement icons based on action bitfield
      let movementIcons = '';
      const actionBits = file.action || 0;
      if (actionBits === MOVEMENT_BITS.ALL_ON || actionBits === (MOVEMENT_BITS.HEAD | MOVEMENT_BITS.ARM | MOVEMENT_BITS.TORSO)) {
        // All movements
        movementIcons = '<img class="eye-thumb" src="images/icon_action1_se.png" alt="All" title="All movements" />';
      } else {
        // Individual movements
        if (actionBits & MOVEMENT_BITS.HEAD) {
          movementIcons += '<img class="eye-thumb" src="images/icon_action2_se.png" alt="Head" title="Head movement" />';
        }
        if (actionBits & MOVEMENT_BITS.ARM) {
          movementIcons += '<img class="eye-thumb" src="images/icon_action3_se.png" alt="Arm" title="Arm movement" />';
        }
        if (actionBits & MOVEMENT_BITS.TORSO) {
          movementIcons += '<img class="eye-thumb" src="images/icon_action4_se.png" alt="Torso" title="Torso movement" />';
        }
      }
      
      // Determine if this file is currently playing
      const isPlaying = this.playState.playing && this.playState.serial === file.serial;
      const playButtonHtml = isPlaying
        ? `<button class="btn sm" data-action="stop" data-serial="${file.serial}">⏹ Stop</button>`
        : `<button class="btn sm" data-action="play" data-serial="${file.serial}">▶ Play</button>`;
      
      // Check if file is in the order array (enabled)
      const isEnabled = fileOrder.indexOf(file.serial) !== -1;
      
      // Make row draggable if enabled
      if (isEnabled) {
        tr.draggable = true;
        tr.dataset.serial = file.serial;
        tr.classList.add('draggable-row');
      }
      
      const dragHandle = isEnabled 
        ? '<span class="drag-handle" style="cursor:move;user-select:none;font-size:18px;color:#888;">≡</span>'
        : '';
      
      tr.innerHTML = `
        <td style="text-align:center;padding:4px 8px;">${dragHandle}</td>
        <td>${rowIndex}</td>
        <td style="text-align:center"><input type="checkbox" class="file-enabled-checkbox" data-serial="${file.serial}" ${isEnabled ? 'checked' : ''} /></td>
        <td>${escapeHtml(file.name || '')}</td>
        <td>${headColorHtml}</td>
        <td>${torsoColorHtml}</td>
        <td>${movementIcons}</td>
        <td><img class="eye-thumb" src="images/eye_icon_${eyeImgIdx}.png" alt="eye ${file.eye}" />${file.eye ?? ''}</td>
        <td class="detail-column">${file.serial}</td>
        <td class="detail-column">${file.db}</td>
        <td class="detail-column">${file.cluster}</td>
        <td>
          ${playButtonHtml}
          <button class="btn sm" data-action="edit" data-serial="${file.serial}"
            ${canEdit ? '' : 'disabled'}>✏️ Edit</button>
        </td>
      `;
      tbody.appendChild(tr);
      rowIndex++;
    }

    const summary = $('#filesSummary');
    const lastRefreshEl = $('#filesLastRefresh');
    
    if (summary) {
      const got = files.length;
      const expected = this.state.files.expected;
      summary.textContent = `Received ${got}${expected ? ` / ${expected}` : ''}`;
    }
    
    if (lastRefreshEl) {
      const lastRefresh = this.state.files.lastRefresh;
      if (lastRefresh) {
        const timeStr = lastRefresh.toLocaleTimeString();
        lastRefreshEl.textContent = `Last refresh: ${timeStr}`;
      } else {
        lastRefreshEl.textContent = '';
      }
    }
    
    // Apply detail column visibility based on advanced settings
    const advFileDetails = $('#advFileDetails');
    const showDetails = advFileDetails?.checked;
    document.querySelectorAll('.detail-column').forEach(col => {
      col.style.display = showDetails ? '' : 'none';
    });
  }

  /**
   * Update transfer UI
   */
  updateTransferUI(transfer) {
    const btnSend = $('#btnSendFile');
    const btnCancel = $('#btnCancelFile');

    if (btnSend) btnSend.disabled = transfer.inProgress;
    if (btnCancel) btnCancel.disabled = !transfer.inProgress;
  }
}

// Initialize application when DOM is ready
// Note: ES6 modules are deferred by default, so DOM is already loaded
function initializeApp() {
  console.log('Initializing SkellyApp...');
  console.log('DOM ready state:', document.readyState);
  
  // Check if critical elements exist
  const btnConnect = document.querySelector('#btnConnect');
  const logEl = document.querySelector('#log');
  console.log('Connect button found:', !!btnConnect);
  console.log('Log element found:', !!logEl);
  
  if (!btnConnect) {
    console.error('Critical UI elements missing! Cannot initialize.');
    return;
  }
  
  window.skellyApp = new SkellyApp();
}

// ES6 modules are deferred, so DOM is usually ready
// But check to be safe
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded
  initializeApp();
}

