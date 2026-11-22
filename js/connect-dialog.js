/**
 * Connect dialog: connection type, name filter, REST device selection, and
 * the connect sequence (device type detection, initial queries, file list)
 */

import { ConnectionManager, ConnectionType } from "./connection-manager.js";
import {
	COMMANDS,
	DEVICE_PROFILES,
	DEVICE_TYPES,
	deviceTypeFromName,
	LOG_CLASSES,
	STORAGE_KEYS,
} from "./constants.js";
import { $ } from "./dom.js";
import { hideModal, showModal } from "./modal-stack.js";
import { buildCommand, escapeHtml } from "./protocol.js";

export class ConnectDialog {
	/**
	 * @param {Object} options
	 * @param {ConnectionManager} options.connection
	 * @param {StateManager} options.state
	 * @param {FileManager} options.fileManager
	 * @param {Function} options.log - log(message, className)
	 * @param {Function} options.savedDeviceType - The persisted device type
	 * @param {Function} options.applyDeviceType - Make a device type current
	 *   (state + UI)
	 */
	constructor({
		connection,
		state,
		fileManager,
		log,
		savedDeviceType,
		applyDeviceType,
	}) {
		this.connection = connection;
		this.state = state;
		this.fileManager = fileManager;
		this.log = log;
		this.savedDeviceType = savedDeviceType;
		this.applyDeviceType = applyDeviceType;
	}

	/**
	 * Wire the connect dialog (call once)
	 */
	initialize() {
		const connectModal = $("#connectModal");
		const connectFilterDefault = $("#connectFilterDefault");
		const connectDefaultDevice = $("#connectDefaultDevice");
		const connectAllDevices = $("#connectAllDevices");
		const connectionTypeDirect = $("#connectionTypeDirect");
		const connectionTypeRest = $("#connectionTypeRest");
		const restUrlContainer = $("#restUrlContainer");
		const restServerUrl = $("#restServerUrl");
		const webBluetoothWarning = $("#webBluetoothWarning");
		const connectionTypeDirectLabel = $("#connectionTypeDirectLabel");

		// Check Web Bluetooth availability
		const isWebBluetoothAvailable = ConnectionManager.isWebBluetoothAvailable();

		// Load saved preferences
		const savedConnectionType =
			localStorage.getItem(STORAGE_KEYS.CONNECTION_TYPE) || "direct";
		const savedRestUrl =
			localStorage.getItem(STORAGE_KEYS.REST_URL) || "http://localhost:8765";
		const savedDeviceType = this.savedDeviceType();

		// One name filter option per profile BLE name: "<type>" for the
		// default name, "<type>:<index>" for the others
		if (connectDefaultDevice) {
			connectDefaultDevice.replaceChildren(
				...Object.entries(DEVICE_PROFILES).flatMap(([type, profile]) =>
					profile.bleNames.map((name, index) => {
						const option = document.createElement("option");
						option.value = index === 0 ? type : `${type}:${index}`;
						option.textContent =
							name === profile.displayName
								? name
								: `${name} (${profile.displayName})`;
						return option;
					}),
				),
			);
			// Restore saved device type in dropdown
			connectDefaultDevice.value = savedDeviceType;
		}

		// Handle Web Bluetooth unavailability
		if (!isWebBluetoothAvailable) {
			if (webBluetoothWarning) webBluetoothWarning.style.display = "block";
			if (connectionTypeDirect) connectionTypeDirect.disabled = true;
			if (connectionTypeDirectLabel) {
				connectionTypeDirectLabel.style.opacity = "0.5";
				connectionTypeDirectLabel.style.cursor = "not-allowed";
			}
			if (connectionTypeRest) connectionTypeRest.checked = true;
		} else {
			if (savedConnectionType === "rest" && connectionTypeRest) {
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
				restUrlContainer.style.display = connectionTypeRest?.checked
					? "block"
					: "none";
			}
		};

		connectionTypeDirect?.addEventListener("change", updateConnectionTypeUI);
		connectionTypeRest?.addEventListener("change", updateConnectionTypeUI);

		// Enable/disable device dropdown based on radio selection
		const updateFilterState = () => {
			const isDefault = connectFilterDefault?.checked;
			if (connectDefaultDevice) connectDefaultDevice.disabled = !isDefault;
		};

		connectFilterDefault?.addEventListener("change", updateFilterState);
		connectAllDevices?.addEventListener("change", updateFilterState);

		// Initialize state
		updateConnectionTypeUI();
		updateFilterState();

		// Close modal function
		const closeModal = () => hideModal(connectModal);

		// Cancel button
		$("#connectCancel")?.addEventListener("click", closeModal);

		// Connect button
		$("#connectOk")?.addEventListener("click", async () => {
			hideModal(connectModal);

			// Determine connection type
			const connectionType = connectionTypeRest?.checked
				? ConnectionType.REST_PROXY
				: ConnectionType.DIRECT_BLE;

			// Get REST URL if needed
			const restUrl = restServerUrl?.value || "http://localhost:8765";

			// Determine filter value and device type
			let nameFilter = "";
			// The type persisted now; it may have changed since the page loaded
			let deviceType = this.savedDeviceType();

			if (connectFilterDefault?.checked) {
				// Default name filter — device type comes directly from the dropdown
				const selectedOption =
					connectDefaultDevice?.value || DEVICE_TYPES.SKELLY;
				// "<type>" or "<type>:<index into the profile's bleNames>"
				const [type, index = "0"] = selectedOption.split(":");
				const profile =
					DEVICE_PROFILES[type] ?? DEVICE_PROFILES[DEVICE_TYPES.SKELLY];
				deviceType = DEVICE_PROFILES[type] ? type : DEVICE_TYPES.SKELLY;
				nameFilter = profile.bleNames[Number(index)] ?? profile.bleNames[0];
			}
			// All devices: nameFilter stays '', deviceType stays last persisted

			// Persist preferences
			localStorage.setItem(STORAGE_KEYS.CONNECTION_TYPE, connectionType);
			localStorage.setItem(STORAGE_KEYS.DEVICE_TYPE, deviceType);
			if (connectionType === ConnectionType.REST_PROXY) {
				localStorage.setItem(STORAGE_KEYS.REST_URL, restUrl);
			}

			// Apply device profile immediately so the UI is correct before connection completes
			this.applyDeviceType(deviceType);

			// For REST proxy, show device selection modal
			if (connectionType === ConnectionType.REST_PROXY) {
				await this.showDeviceSelection(restUrl, nameFilter);
			} else {
				await this.connect({ connectionType, restUrl, nameFilter });
			}
		});
	}

	/**
	 * Show the device selection dialog for the REST proxy and scan
	 */
	async showDeviceSelection(restUrl, nameFilter) {
		const deviceSelectModal = $("#deviceSelectModal");
		const deviceList = $("#deviceList");
		const deviceSelectStatus = $("#deviceSelectStatus");
		const deviceSelectCancel = $("#deviceSelectCancel");
		const deviceSelectRescan = $("#deviceSelectRescan");

		if (!deviceSelectModal || !deviceList) return;

		// Show modal (Escape closes it)
		showModal(deviceSelectModal, () => hideModal(deviceSelectModal));

		// Scan function
		const scanForDevices = async () => {
			try {
				deviceList.innerHTML = "";
				deviceSelectStatus.textContent = "Scanning for devices...";

				// Use connection.restProxy to scan
				const devices = await this.connection.restProxy.scanDevices(
					restUrl,
					nameFilter,
					10,
				);

				if (devices.length === 0) {
					deviceSelectStatus.textContent = "No devices found";
					deviceList.innerHTML =
						'<p style="padding: 20px; text-align: center; color: #6b7280;">No devices discovered. Try rescanning or check if devices are powered on.</p>';
					return;
				}

				deviceSelectStatus.textContent = `Found ${devices.length} device${devices.length > 1 ? "s" : ""}:`;

				// Create device list
				devices.forEach((device) => {
					const deviceItem = document.createElement("div");
					deviceItem.style.cssText =
						"padding: 12px; margin: 8px 0; background: #1f2937; border: 1px solid #374151; border-radius: 8px; cursor: pointer; transition: all 0.2s;";
					deviceItem.innerHTML = `
            <div style="font-weight: 500;">${escapeHtml(device.name || "Unknown Device")}</div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">${escapeHtml(device.address)}</div>
            <div style="font-size: 11px; color: #6b7280;">Signal: ${device.rssi} dBm</div>
          `;

					deviceItem.addEventListener("mouseenter", () => {
						deviceItem.style.background = "#374151";
						deviceItem.style.borderColor = "#3b82f6";
					});

					deviceItem.addEventListener("mouseleave", () => {
						deviceItem.style.background = "#1f2937";
						deviceItem.style.borderColor = "#374151";
					});

					deviceItem.addEventListener("click", async () => {
						hideModal(deviceSelectModal);
						await this.connect({
							connectionType: ConnectionType.REST_PROXY,
							restUrl,
							deviceAddress: device.address,
						});
					});

					deviceList.appendChild(deviceItem);
				});
			} catch (error) {
				console.error("Device scan error:", error);
				deviceSelectStatus.textContent = "Scan failed";
				deviceList.innerHTML = `<p style="padding: 20px; text-align: center; color: #ef4444;">${escapeHtml(error.message)}</p>`;
			}
		};

		// Cancel button
		const cancelHandler = () => hideModal(deviceSelectModal);

		// Rescan button
		const rescanHandler = () => {
			scanForDevices();
		};

		// Handlers for this opening (onclick replaces the previous opening's;
		// addEventListener added one more per opening)
		deviceSelectCancel.onclick = cancelHandler;
		deviceSelectRescan.onclick = rescanHandler;

		// Start initial scan
		await scanForDevices();
	}

	/**
	 * Show the connect dialog
	 */
	open() {
		const connectModal = $("#connectModal");
		showModal(connectModal, () => hideModal(connectModal));
	}

	/**
	 * Connect, detect the device type from its name, then query its state
	 */
	async connect(options) {
		try {
			const connectionOptions = {
				type: options.connectionType || ConnectionType.DIRECT_BLE,
				nameFilter: options.nameFilter || options.deviceAddress || "",
				restUrl: options.restUrl || "",
			};

			await this.connection.connect(connectionOptions);

			// Auto-detect device type from BLE name and apply matching profile
			const connectedName = this.state.device.name || "";
			const detectedType = deviceTypeFromName(connectedName);
			if (detectedType && detectedType !== this.state.deviceType) {
				this.log(
					`Auto-detected device type: ${DEVICE_PROFILES[detectedType].displayName} (from "${connectedName}")`,
					LOG_CLASSES.WARNING,
				);
				localStorage.setItem(STORAGE_KEYS.DEVICE_TYPE, detectedType);
				this.applyDeviceType(detectedType);
			}

			// Query device state in sequence, 50 ms apart: live mode, params,
			// volume, BT name, version
			for (const tag of [
				COMMANDS.QUERY_LIVE_MODE,
				COMMANDS.QUERY_DEVICE_PARAMS,
				COMMANDS.QUERY_VOLUME,
				COMMANDS.QUERY_LIVE_NAME,
				COMMANDS.QUERY_VERSION,
			]) {
				await this.connection.send(buildCommand(tag, "", 8));
				this.connection.pause(50);
			}

			// Start the file list fetch; it queries capacity and order once the
			// files are in
			this.fileManager.refreshFileList();
		} catch (error) {
			console.error("Connection error:", error);
			this.log(`Connection failed: ${error.message}`, LOG_CLASSES.WARNING);
		}
	}
}
