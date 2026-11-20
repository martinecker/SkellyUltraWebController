/**
 * Main Application Entry Point
 * Orchestrates all modules and initializes the application
 */

import { ConnectionManager, ConnectionType } from "./js/connection-manager.js";
import {
	COMMANDS,
	DEVICE_PROFILES,
	DEVICE_TYPES,
	getEyeIconPath,
	KNOWN_FIRMWARE,
	LOG_CLASSES,
	STORAGE_KEYS,
} from "./js/constants.js";
import {
	buildSetAllLightsCommand,
	isScenePreset,
	sceneLightColor,
	supportsLightScenes,
} from "./js/device-settings.js";
import { EditModalManager } from "./js/edit-modal.js";
import { AudioConverter, FileManager } from "./js/file-manager.js";
import {
	buildCommand,
	bytesToHex,
	clamp,
	deviceSpeedToUI,
	escapeHtml,
	MAX_UI_EFFECT_SPEED,
	uiSpeedToDevice,
} from "./js/protocol.js";
import { ProtocolParser } from "./js/protocol-parser.js";
import { StateManager } from "./js/state-manager.js";
import { TransferModalManager } from "./js/transfer-modal.js";

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
		const div = document.createElement("div");
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
	const progText = $("#progText");
	const progPct = $("#progPct");
	const progBar = $("#progBar");
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
			// Initialize logger
			this.logger = new Logger($("#log"), $("#chkAutoscroll"));
			this.logger.setFilterCallback(() => this.applyLogFilter());

			// Initialize state manager
			this.state = new StateManager();

			// Initialize play state tracking
			this.playState = {
				serial: null,
				playing: false,
				duration: 0,
				startTime: null,
				timerInterval: null,
			};

			// Initialize connection manager (wraps both BLE and REST proxy)
			this.connection = new ConnectionManager(
				this.state,
				this.logger.log.bind(this.logger),
			);

			// Initialize file manager with progress callback
			this.fileManager = new FileManager(
				this.connection,
				this.state,
				this.logger.log.bind(this.logger),
				(current, total) => setProgress(current, total),
			);

			// Initialize audio converter
			this.audioConverter = new AudioConverter(
				this.logger.log.bind(this.logger),
			);

			// Initialize edit modal manager (before parser so we can pass callback)
			this.editModal = new EditModalManager(
				this.connection,
				this.state,
				this.fileManager,
				this.logger.log.bind(this.logger),
			);
			// Initialize transfer modal manager
			this.transferModal = new TransferModalManager(
				this.connection,
				this.state,
				this.fileManager,
				this.audioConverter,
				this.logger.log.bind(this.logger),
			);
			this.transferModal.setReplaceSuccessHandler(() => this.editModal.close());
			this.editModal.setReplaceFileHandler((filename) => {
				this.transferModal.open("replace", filename);
			});

			// Initialize protocol parser with callbacks
			this.parser = new ProtocolParser(
				this.state,
				this.fileManager,
				this.logger.log.bind(this.logger),
				this.handlePlayPauseMessage.bind(this),
			);

			// Register protocol parser with connection manager
			this.connection.onNotification((hex, bytes) => {
				this.parser.parse(hex, bytes);
			});

			// Subscribe to state changes
			this.subscribeToStateChanges();

			// Initialize UI
			this.initializeUI();

			// Set initial UI state
			this.updateDeviceUI(this.state.device);
			this.updateFilesTable();
			this.transferModal.updateButtons(this.state.transfer);

			this.logger.log("Application initialized", LOG_CLASSES.WARNING);
		} catch (error) {
			console.error("Failed to initialize application:", error);
			console.error("Error stack:", error.stack);
			alert("Failed to initialize application. Check console for details.");
			throw error;
		}
	}

	/**
	 * Subscribe to state changes
	 */
	subscribeToStateChanges() {
		// Device state changes
		this.state.subscribe("device", (device) => {
			this.updateDeviceUI(device);
		});

		// Live status changes
		this.state.subscribe("live", (live) => {
			this.updateLiveUI(live);
		});

		// File list changes
		this.state.subscribe("files", () => {
			this.updateFilesTable();
		});
	}

	/**
	 * Initialize UI and event handlers
	 */
	initializeUI() {
		// Initial disconnected state
		document.body.classList.add("disconnected");

		// Connection controls
		const btnConnect = $("#btnConnect");
		const btnDisconnect = $("#btnDisconnect");

		if (btnConnect) {
			btnConnect.addEventListener("click", () => {
				this.handleConnect();
			});
		} else {
			console.error("Connect button not found!");
		}

		if (btnDisconnect) {
			btnDisconnect.addEventListener("click", () => this.handleDisconnect());
		} else {
			console.error("Disconnect button not found!");
		}

		// Log controls
		const btnClearLog = $("#btnClearLog");
		if (btnClearLog) {
			btnClearLog.addEventListener("click", () => {
				const logEl = $("#log");
				if (logEl) logEl.innerHTML = "";
			});
		}

		const btnSaveLog = $("#btnSaveLog");
		if (btnSaveLog) {
			btnSaveLog.addEventListener("click", () => {
				this.saveLog();
			});
		}

		this.initializeWarningModal();
		this.initializeFirmwareWarningModal();
		this.initializeConnectionModal();
		this.initializeDeviceTypeControl();
		this.initializeAdvancedMenu();
		this.initializeLogFilter();
		this.initializeQueryButtons();
		this.initializeMediaControls();
		this.initializeFileControls();
		this.initializeLiveControls();

		// Check for Web Bluetooth support
		if (!ConnectionManager.isWebBluetoothAvailable()) {
			console.error("Web Bluetooth not supported");
			this.logger.log(
				"Web Bluetooth not supported. For direct BLE, use Chrome/Edge. For other browsers, use the REST Server Proxy: https://github.com/martinecker/SkellyUltra/tree/main/custom_components/skelly_ultra/skelly_ultra_srv",
				LOG_CLASSES.WARNING,
			);
			// Don't show blocking alert - REST proxy is available as alternative
		} else {
			// Check for secure context (HTTPS or localhost)
			if (!window.isSecureContext) {
				console.error(
					"Not in secure context - Web Bluetooth requires HTTPS or localhost",
				);
				this.logger.log(
					"Web Bluetooth requires HTTPS or localhost for direct BLE. Use HTTPS or the REST Server Proxy.",
					LOG_CLASSES.WARNING,
				);
			}
		}

		// Apply persisted device profile on startup
		const startupDeviceType =
			localStorage.getItem(STORAGE_KEYS.DEVICE_TYPE) || DEVICE_TYPES.SKELLY;
		this.state.setDeviceType(startupDeviceType);
		this.applyDeviceProfile(startupDeviceType);
	}

	/**
	 * Initialize device type dropdown (post-connect override)
	 */
	initializeDeviceTypeControl() {
		const deviceTypeSelect = $("#deviceTypeSelect");
		if (!deviceTypeSelect) return;

		// Sync with persisted value
		const saved =
			localStorage.getItem(STORAGE_KEYS.DEVICE_TYPE) || DEVICE_TYPES.SKELLY;
		deviceTypeSelect.value = saved;

		deviceTypeSelect.addEventListener("change", () => {
			const newType = deviceTypeSelect.value;
			const oldType = this.state.deviceType;
			if (newType === oldType) return;

			const apply = () => {
				localStorage.setItem(STORAGE_KEYS.DEVICE_TYPE, newType);
				this.state.setDeviceType(newType);
				this.applyDeviceProfile(newType);
			};

			const modal = $("#deviceTypeChangeModal");
			if (!modal) {
				apply();
				return;
			}

			const newName = DEVICE_PROFILES[newType]?.uiName ?? newType;
			const oldName = DEVICE_PROFILES[oldType]?.uiName ?? oldType;
			const msg = $("#deviceTypeChangeMsgDetail");
			if (msg) {
				msg.textContent = `You are switching from "${oldName}" to "${newName}".`;
			}

			modal.classList.remove("hidden");

			const onConfirm = () => {
				modal.classList.add("hidden");
				cleanup();
				apply();
			};
			const onCancel = () => {
				modal.classList.add("hidden");
				cleanup();
				// Revert select back to the current type
				deviceTypeSelect.value = oldType;
			};
			const cleanup = () => {
				$("#deviceTypeChangeConfirm")?.removeEventListener("click", onConfirm);
				$("#deviceTypeChangeCancel")?.removeEventListener("click", onCancel);
			};

			$("#deviceTypeChangeConfirm")?.addEventListener("click", onConfirm);
			$("#deviceTypeChangeCancel")?.addEventListener("click", onCancel);
		});
	}

	/**
	 * Apply a device profile — rebuilds the movement grids and reconfigures all
	 * profile-driven UI elements (lights, eye section, file table columns, etc.)
	 * @param {string} deviceType - one of DEVICE_TYPES
	 */
	applyDeviceProfile(deviceType) {
		const profile = DEVICE_PROFILES[deviceType];
		if (!profile) return;

		// Sync the post-connect dropdown
		const deviceTypeSelect = $("#deviceTypeSelect");
		if (deviceTypeSelect) deviceTypeSelect.value = deviceType;

		// Rebuild movement grids
		for (const gridId of ["liveMove", "edMove"]) {
			const grid = $(`#${gridId}`);
			if (!grid) continue;
			grid.innerHTML = "";
			profile.movements.forEach(({ part, label, icon, bit }) => {
				const btn = document.createElement("button");
				btn.className = "iconToggle";
				btn.dataset.part = part;
				btn.dataset.bit = String(bit);
				btn.title = label;
				const img = document.createElement("img");
				img.src = icon;
				img.alt = label;
				img.style.width = "36px";
				img.style.height = "36px";
				btn.appendChild(img);
				grid.appendChild(btn);
			});
		}
		// Re-bind live movement grid handlers
		this.bindMovementGrid("liveMove");
		// Re-bind edit modal movement handlers
		this.editModal?.initializeMovementControls();

		// Rebuild eye grids (icon count and images vary per profile)
		this.buildLiveEyeGrid();
		this.editModal?.buildEyeGrid();

		// Show/hide eye sections
		const hasEyeImage = profile.hasEyeImage;
		for (const id of ["liveEyeSection", "editEyeSection"]) {
			const el = $(`#${id}`);
			if (el) el.style.display = hasEyeImage ? "" : "none";
		}

		// Show/hide Light 1 group
		const hasLight1 = profile.lights.length > 1;
		for (const id of ["liveLight1Group", "editLight1Group"]) {
			const el = $(`#${id}`);
			if (el) el.style.display = hasLight1 ? "" : "none";
		}

		// Update Light 0 label
		const light0 = profile.lights[0];
		const light0Label = light0 ? light0.label : "Light";
		for (const id of ["liveLight0Label", "editLight0Label"]) {
			const el = $(`#${id}`);
			if (el) el.textContent = light0Label;
		}

		// Repopulate effect mode selects
		const modeSelects = [
			"light1EffectMode",
			"light0EffectMode",
			"edLight1EffectMode",
			"edLight0EffectMode",
		];
		for (const selectId of modeSelects) {
			const sel = $(`#${selectId}`);
			if (!sel) continue;
			const current = sel.value;
			sel.innerHTML = "";
			profile.lightModes.forEach(({ value, label }) => {
				const opt = document.createElement("option");
				opt.value = String(value);
				opt.textContent = label;
				sel.appendChild(opt);
			});
			// Try to restore previously selected value; fall back to first option
			sel.value = current;
			if (!sel.value) sel.value = String(profile.lightModes[0].value);
		}

		// Update files table column visibility and labels
		const light1 = profile.lights[1];
		const light1Label = light1 ? light1.label : "Light 1";
		const filesLight1Col = $("#filesLight1Col");
		if (filesLight1Col) {
			filesLight1Col.style.display = hasLight1 ? "" : "none";
			filesLight1Col.textContent = light1Label;
		}

		const filesEyeCol = $("#filesEyeCol");
		if (filesEyeCol) filesEyeCol.style.display = hasEyeImage ? "" : "none";

		const filesLight0Col = $("#filesLight0Col");
		if (filesLight0Col) filesLight0Col.textContent = light0Label;

		// Keep body cell classes in sync — add/remove display style via dynamic <style>
		let dynStyle = document.getElementById("_profileColStyle");
		if (!dynStyle) {
			dynStyle = document.createElement("style");
			dynStyle.id = "_profileColStyle";
			document.head.appendChild(dynStyle);
		}
		const rules = [];
		if (!hasLight1) rules.push("td.col-light1 { display: none; }");
		if (!hasEyeImage) rules.push("td.col-eye { display: none; }");
		dynStyle.textContent = rules.join("\n");

		// Scenes depend on the device type too
		this.updateScenePicker();
	}

	/**
	 * Bind click handlers for a live movement grid.
	 * Buttons must already be in the DOM with data-part and data-bit attributes.
	 * @param {string} gridId
	 */
	bindMovementGrid(gridId) {
		const grid = document.getElementById(gridId);
		if (!grid) return;

		const allBtn = grid.querySelector('[data-part="all"]');
		const partBtns = Array.from(
			grid.querySelectorAll('[data-part]:not([data-part="all"])'),
		);

		const sendMovementCommand = async () => {
			if (!this.connection.isConnected()) return;
			if (allBtn?.classList.contains("selected")) {
				await this.connection.send(
					buildCommand(COMMANDS.SET_MOVEMENT, "FF00000000", 8),
				);
				this.logger.log("Applied movement: all");
			} else {
				let bitfield = 0;
				partBtns.forEach((btn) => {
					if (btn.classList.contains("selected")) {
						bitfield |= parseInt(btn.dataset.bit || "0", 10);
					}
				});
				if (bitfield > 0) {
					const bitfieldHex = bitfield
						.toString(16)
						.padStart(2, "0")
						.toUpperCase();
					await this.connection.send(
						buildCommand(COMMANDS.SET_MOVEMENT, `${bitfieldHex}00000000`, 8),
					);
					const parts = partBtns
						.filter((b) => b.classList.contains("selected"))
						.map((b) => b.dataset.part);
					this.logger.log(`Applied movement: ${parts.join(", ")}`);
				} else {
					await this.connection.send(
						buildCommand(COMMANDS.SET_MOVEMENT, "0000000000", 8),
					);
					this.logger.log("Disabled movement");
				}
			}
		};

		allBtn?.addEventListener("click", () => {
			allBtn.classList.toggle("selected");
			if (allBtn.classList.contains("selected")) {
				partBtns.forEach((btn) => {
					btn.classList.remove("selected");
				});
			}
			sendMovementCommand();
		});

		partBtns.forEach((btn) => {
			btn.addEventListener("click", () => {
				btn.classList.toggle("selected");
				allBtn?.classList.remove("selected");
				sendMovementCommand();
			});
		});
	}

	/**
	 * Initialize warning modal
	 */
	initializeWarningModal() {
		const riskModal = $("#riskModal");
		const showRisk = () => riskModal?.classList.remove("hidden");
		const hideRisk = () => riskModal?.classList.add("hidden");

		window.addEventListener("load", () => {
			if (!localStorage.getItem(STORAGE_KEYS.RISK_ACK)) {
				showRisk();
			}
		});

		$("#riskAccept")?.addEventListener("click", () => {
			localStorage.setItem(STORAGE_KEYS.RISK_ACK, "1");
			hideRisk();
		});

		$("#riskCancel")?.addEventListener("click", () => {
			window.location.href = "about:blank";
		});
	}

	initializeFirmwareWarningModal() {
		$("#fwWarningOk")?.addEventListener("click", () => {
			$("#fwWarningModal")?.classList.add("hidden");
		});
	}

	/**
	 * Initialize connection modal
	 */
	initializeConnectionModal() {
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
		const savedDeviceType =
			localStorage.getItem(STORAGE_KEYS.DEVICE_TYPE) || DEVICE_TYPES.SKELLY;

		// One name filter option per profile BLE name: "<type>" for the
		// default name, "<type>:<index>" for the others
		if (connectDefaultDevice) {
			connectDefaultDevice.replaceChildren(
				...Object.entries(DEVICE_PROFILES).flatMap(([type, profile]) =>
					profile.bleNames.map((name, index) => {
						const option = document.createElement("option");
						option.value = index === 0 ? type : `${type}:${index}`;
						option.textContent =
							name === profile.uiName ? name : `${name} (${profile.uiName})`;
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
		const closeModal = () => {
			connectModal?.classList.add("hidden");
		};

		// Cancel button
		$("#connectCancel")?.addEventListener("click", closeModal);

		// Escape key to close modal
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && !connectModal?.classList.contains("hidden")) {
				closeModal();
			}
		});

		// Connect button
		$("#connectOk")?.addEventListener("click", async () => {
			connectModal?.classList.add("hidden");

			// Determine connection type
			const connectionType = connectionTypeRest?.checked
				? ConnectionType.REST_PROXY
				: ConnectionType.DIRECT_BLE;

			// Get REST URL if needed
			const restUrl = restServerUrl?.value || "http://localhost:8765";

			// Determine filter value and device type
			let nameFilter = "";
			// The type persisted now; it may have changed since the page loaded
			let deviceType =
				localStorage.getItem(STORAGE_KEYS.DEVICE_TYPE) || DEVICE_TYPES.SKELLY;

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
			this.state.setDeviceType(deviceType);
			this.applyDeviceProfile(deviceType);

			// For REST proxy, show device selection modal
			if (connectionType === ConnectionType.REST_PROXY) {
				await this.showDeviceSelectionModal(restUrl, nameFilter);
			} else {
				await this.performConnection({ connectionType, restUrl, nameFilter });
			}
		});
	}

	/**
	 * Show device selection modal for REST proxy
	 */
	async showDeviceSelectionModal(restUrl, nameFilter) {
		const deviceSelectModal = $("#deviceSelectModal");
		const deviceList = $("#deviceList");
		const deviceSelectStatus = $("#deviceSelectStatus");
		const deviceSelectCancel = $("#deviceSelectCancel");
		const deviceSelectRescan = $("#deviceSelectRescan");

		if (!deviceSelectModal || !deviceList) return;

		// Show modal
		deviceSelectModal.classList.remove("hidden");

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
						deviceSelectModal.classList.add("hidden");
						await this.performConnection({
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
		const cancelHandler = () => {
			deviceSelectModal.classList.add("hidden");
		};

		// Rescan button
		const rescanHandler = () => {
			scanForDevices();
		};

		// Add event listeners
		deviceSelectCancel.removeEventListener("click", cancelHandler);
		deviceSelectCancel.addEventListener("click", cancelHandler);
		deviceSelectRescan.removeEventListener("click", rescanHandler);
		deviceSelectRescan.addEventListener("click", rescanHandler);

		// Escape key to close
		const escapeHandler = (e) => {
			if (
				e.key === "Escape" &&
				!deviceSelectModal.classList.contains("hidden")
			) {
				deviceSelectModal.classList.add("hidden");
			}
		};
		document.removeEventListener("keydown", escapeHandler);
		document.addEventListener("keydown", escapeHandler);

		// Start initial scan
		await scanForDevices();
	}

	/**
	 * Initialize advanced menu
	 */
	initializeAdvancedMenu() {
		const advMenu = $("#advMenu");
		const advRaw = $("#advRaw");
		const advFEDC = $("#advFEDC");
		const advFileDetails = $("#advFileDetails");

		// Load saved state
		advRaw.checked = localStorage.getItem(STORAGE_KEYS.ADV_RAW) === "1";
		advFEDC.checked = localStorage.getItem(STORAGE_KEYS.ADV_FEDC) === "1";
		advFileDetails.checked =
			localStorage.getItem(STORAGE_KEYS.SHOW_FILE_DETAILS) === "1";

		// Toggle menu
		$("#btnAdvanced")?.addEventListener("click", (e) => {
			e.stopPropagation();
			advMenu?.classList.toggle("hidden");
		});

		// Close menu on outside click
		document.addEventListener("click", (e) => {
			if (!e.target.closest(".menuwrap")) {
				advMenu?.classList.add("hidden");
			}
		});

		// Save state on change
		[advRaw, advFEDC, advFileDetails].forEach((el) => {
			el?.addEventListener("change", () => {
				localStorage.setItem(STORAGE_KEYS.ADV_RAW, advRaw.checked ? "1" : "0");
				localStorage.setItem(
					STORAGE_KEYS.ADV_FEDC,
					advFEDC.checked ? "1" : "0",
				);
				localStorage.setItem(
					STORAGE_KEYS.SHOW_FILE_DETAILS,
					advFileDetails.checked ? "1" : "0",
				);
				this.applyAdvancedVisibility();
			});
		});

		this.applyAdvancedVisibility();
	}

	/**
	 * Apply advanced feature visibility
	 */
	applyAdvancedVisibility() {
		const advRaw = $("#advRaw");
		const advFileDetails = $("#advFileDetails");

		$("#advRawBlock")?.classList.toggle("hidden", !advRaw?.checked);

		// Toggle detail columns visibility
		const showDetails = advFileDetails?.checked;
		document.querySelectorAll(".detail-column").forEach((col) => {
			col.style.display = showDetails ? "" : "none";
		});
	}

	/**
	 * Initialize log filter menu
	 */
	initializeLogFilter() {
		const logFilterMenu = $("#logFilterMenu");
		const logFilterNormal = $("#logFilterNormal");
		const logFilterWarning = $("#logFilterWarning");
		const logFilterTx = $("#logFilterTx");
		const logFilterRx = $("#logFilterRx");

		// Load saved state (default to all checked)
		logFilterNormal.checked =
			localStorage.getItem(STORAGE_KEYS.LOG_FILTER_NORMAL) !== "0";
		logFilterWarning.checked =
			localStorage.getItem(STORAGE_KEYS.LOG_FILTER_WARNING) !== "0";
		logFilterTx.checked =
			localStorage.getItem(STORAGE_KEYS.LOG_FILTER_TX) !== "0";
		logFilterRx.checked =
			localStorage.getItem(STORAGE_KEYS.LOG_FILTER_RX) !== "0";

		// Toggle menu
		$("#btnLogFilter")?.addEventListener("click", (e) => {
			e.stopPropagation();
			logFilterMenu?.classList.toggle("hidden");
		});

		// Close menu on outside click
		document.addEventListener("click", (e) => {
			if (!e.target.closest(".menuwrap") || e.target.closest("#advMenu")) {
				logFilterMenu?.classList.add("hidden");
			}
		});

		// Save state and apply filter on change
		[logFilterNormal, logFilterWarning, logFilterTx, logFilterRx].forEach(
			(el) => {
				el?.addEventListener("change", () => {
					localStorage.setItem(
						STORAGE_KEYS.LOG_FILTER_NORMAL,
						logFilterNormal.checked ? "1" : "0",
					);
					localStorage.setItem(
						STORAGE_KEYS.LOG_FILTER_WARNING,
						logFilterWarning.checked ? "1" : "0",
					);
					localStorage.setItem(
						STORAGE_KEYS.LOG_FILTER_TX,
						logFilterTx.checked ? "1" : "0",
					);
					localStorage.setItem(
						STORAGE_KEYS.LOG_FILTER_RX,
						logFilterRx.checked ? "1" : "0",
					);
					this.applyLogFilter();
				});
			},
		);

		this.applyLogFilter();
	}

	/**
	 * Apply log filter visibility
	 */
	applyLogFilter() {
		const logFilterNormal = $("#logFilterNormal");
		const logFilterWarning = $("#logFilterWarning");
		const logFilterTx = $("#logFilterTx");
		const logFilterRx = $("#logFilterRx");

		const logEl = $("#log");
		if (!logEl) return;

		// Apply filter to all log lines
		logEl.querySelectorAll(".line").forEach((line) => {
			const classes = line.classList;
			let visible = true;

			if (classes.contains("warn") && !logFilterWarning?.checked) {
				visible = false;
			} else if (classes.contains("tx") && !logFilterTx?.checked) {
				visible = false;
			} else if (classes.contains("rx") && !logFilterRx?.checked) {
				visible = false;
			} else if (
				!classes.contains("warn") &&
				!classes.contains("tx") &&
				!classes.contains("rx") &&
				!logFilterNormal?.checked
			) {
				visible = false;
			}

			line.style.display = visible ? "" : "none";
		});
	}

	/**
	 * Initialize query buttons
	 */
	initializeQueryButtons() {
		document.querySelectorAll("[data-q]").forEach((btn) => {
			btn.addEventListener("click", async () => {
				if (!this.connection.isConnected()) {
					this.logger.log("Not connected", LOG_CLASSES.WARNING);
					return;
				}
				const tag = btn.getAttribute("data-q");
				await this.connection.send(buildCommand(tag, "", 8));
			});
		});

		// Get All button - executes all query commands in sequence
		$("#btnGetAll")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			this.logger.log("Executing all queries...", LOG_CLASSES.INFO);
			const queries = [
				COMMANDS.QUERY_PARAMS,
				COMMANDS.QUERY_LIVE,
				COMMANDS.QUERY_VOLUME,
				COMMANDS.QUERY_BT_NAME,
				COMMANDS.QUERY_VERSION,
				COMMANDS.QUERY_CAPACITY,
				COMMANDS.QUERY_ORDER,
			];

			for (const tag of queries) {
				await this.connection.send(buildCommand(tag, "", 8));
				// Small delay between queries to avoid overwhelming the device
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			this.logger.log("All queries completed", LOG_CLASSES.SUCCESS);
		});

		// Raw command send button
		$("#btnSendRaw")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}
			const tag = $("#tag")?.value || COMMANDS.QUERY_PARAMS;
			const payload = $("#payload")?.value || "";
			await this.connection.send(buildCommand(tag, payload, 8));
			this.logger.log(
				`Sent raw command: ${tag} with payload: ${payload || "(empty)"}`,
			);
		});

		// Set Device Name button
		$("#btnSetDeviceName")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const deviceNameInput = $("#deviceNameInput");
			const deviceName = deviceNameInput?.value || "";

			// Validate device name: must not be empty and max 22 chars
			if (!deviceName || deviceName.trim().length === 0) {
				this.logger.log("Device name cannot be empty", LOG_CLASSES.WARNING);
				return;
			}

			if (deviceName.length > 22) {
				this.logger.log(
					"Device name cannot exceed 22 characters",
					LOG_CLASSES.WARNING,
				);
				return;
			}

			const pin = this.state.device.pin || "0000";
			await this.setPinAndName(pin, deviceName);
		});

		// Set PIN button
		$("#btnSetPin")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const pinInput = $("#pinInput");
			const pin = pinInput?.value || "";

			// Validate PIN: must be exactly 4 digits
			if (!/^\d{4}$/.test(pin)) {
				this.logger.log("PIN must be exactly 4 digits", LOG_CLASSES.WARNING);
				return;
			}

			const deviceNameInput = $("#deviceNameInput");
			const deviceName = deviceNameInput?.value || "";

			// Use current device name if available, otherwise use entered name or default to btName
			const btName = deviceName || this.state.device.btName || "";
			if (!btName) {
				this.logger.log(
					"Device name not available. Enter a device name first.",
					LOG_CLASSES.WARNING,
				);
				return;
			}

			await this.setPinAndName(pin, btName);
		});

		// PIN input validation - only allow digits
		const pinInput = $("#pinInput");
		if (pinInput) {
			pinInput.addEventListener("input", (e) => {
				// Remove non-digit characters
				e.target.value = e.target.value.replace(/[^0-9]/g, "");
			});
		}

		// Device name input validation - enforce max length
		const deviceNameInput = $("#deviceNameInput");
		if (deviceNameInput) {
			deviceNameInput.addEventListener("input", (e) => {
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
		if (!btName.endsWith("(Live)")) {
			btName += "(Live)";
		}

		// Build the AAFB command payload
		// Format: <4 bytes PIN in ASCII> <8 bytes wifi password in ASCII> <1 byte name length> <BT name in ASCII with "(Live)">

		// Convert PIN to ASCII bytes and then to hex
		const pinBytes = new TextEncoder().encode(pin);
		const pinHex = bytesToHex(pinBytes);

		// Hardcoded wifi password "01234567" as ASCII bytes
		const wifiBytes = new TextEncoder().encode("01234567");
		const wifiHex = bytesToHex(wifiBytes);

		const nameLengthHex = btName.length
			.toString(16)
			.padStart(2, "0")
			.toUpperCase();

		// BT name as ASCII bytes
		const nameBytes = new TextEncoder().encode(btName);
		const nameHex = bytesToHex(nameBytes);

		const payload = pinHex + wifiHex + nameLengthHex + nameHex;

		await this.connection.send(
			buildCommand(COMMANDS.SET_PIN_AND_NAME, payload, 8),
		);
		this.logger.log(`Set PIN to ${pin} with BT name "${btName}"`);

		// Query device params to get the updated name and PIN back from the device
		await this.connection.send(buildCommand(COMMANDS.QUERY_BT_NAME, "", 8));
		await this.connection.send(buildCommand(COMMANDS.QUERY_PARAMS, "", 8));
	}

	/**
	 * Initialize media controls
	 */
	initializeMediaControls() {
		// Volume control - send command immediately on change
		const volRange = $("#volRange");
		const volNum = $("#vol");

		const sendVolumeCommand = async (value) => {
			if (!this.connection.isConnected()) {
				return;
			}
			const v = Math.max(0, Math.min(100, parseInt(value, 10)));
			await this.connection.send(
				buildCommand(
					COMMANDS.SET_VOLUME,
					v.toString(16).padStart(2, "0").toUpperCase(),
					8,
				),
			);
			this.logger.log(`Set volume to ${v}`);
		};

		if (volRange && volNum) {
			volRange.addEventListener("input", (e) => {
				volNum.value = e.target.value;
				sendVolumeCommand(e.target.value);
			});
			volNum.addEventListener("input", (e) => {
				const clamped = clamp(e.target.value, 0, 100);
				volRange.value = clamped;
				sendVolumeCommand(clamped);
			});
		}

		// Live Mode button
		$("#btnBT")?.addEventListener("click", () =>
			this.sendMediaCommand(COMMANDS.ENABLE_CLASSIC_BT, "01"),
		);
	}

	/**
	 * A live light channel as its controls show it, in device units for F1.
	 * @param {number} channel - 0 or 1
	 */
	readLiveLight(channel) {
		const value = (field, max) =>
			Math.round(clamp($(`#light${channel}${field}`)?.value, 0, max));
		return {
			effectMode: parseInt($(`#light${channel}EffectMode`)?.value || "1", 10),
			brightness: value("Brightness", 255),
			r: value("R", 255),
			g: value("G", 255),
			b: value("B", 255),
			colorCycle: this[`light${channel}ColorCycleEnabled`] ? 1 : 0,
			effectSpeed: uiSpeedToDevice(value("EffectSpeed", MAX_UI_EFFECT_SPEED)),
		};
	}

	/** Color and color cycle of the live light controls, channels 0 and 1 */
	readLiveColors() {
		return [0, 1].map((ch) => {
			const value = (field) =>
				Math.round(clamp($(`#light${ch}${field}`)?.value, 0, 255));
			return {
				r: value("R"),
				g: value("G"),
				b: value("B"),
				colorCycle: this[`light${ch}ColorCycleEnabled`] ? 1 : 0,
			};
		});
	}

	/** Show colors (from readLiveColors or sceneLightColor) in the live controls */
	showLiveColors(colors) {
		colors.forEach((color, ch) => {
			if (!color) return;
			if ($(`#light${ch}R`)) $(`#light${ch}R`).value = color.r;
			if ($(`#light${ch}G`)) $(`#light${ch}G`).value = color.g;
			if ($(`#light${ch}B`)) $(`#light${ch}B`).value = color.b;
			const hex = [color.r, color.g, color.b]
				.map((c) => c.toString(16).padStart(2, "0"))
				.join("");
			if ($(`#light${ch}ColorPick`))
				$(`#light${ch}ColorPick`).value = `#${hex}`;
			this[`light${ch}ColorCycleEnabled`] = color.colorCycle === 1;
			$(`#btnLight${ch}ColorCycle`)?.classList.toggle(
				"selected",
				color.colorCycle === 1,
			);
		});
	}

	/**
	 * Going from `from` to scene `to`: a preset shows (and F1 sends) its own
	 * colors, as in the phone app; the custom colors are kept here and come
	 * back with Custom.
	 */
	showSceneColors(from, to) {
		if (isScenePreset(to)) {
			if (!isScenePreset(from) || !this.liveCustomColors) {
				this.liveCustomColors = this.readLiveColors();
			}
			this.showLiveColors([0, 1].map((ch) => sceneLightColor(to, ch)));
		} else if (this.liveCustomColors) {
			this.showLiveColors(this.liveCustomColors);
			this.liveCustomColors = null;
		}
	}

	/**
	 * A preset the device reported (BBE1): keep what the controls show as
	 * the custom colors (unless already kept) and show the scene's colors.
	 * Runs again once the firmware version is known, since BBE1 comes first.
	 */
	showReportedSceneColors() {
		const scene = this.state.live.scene;
		if (
			isScenePreset(scene) &&
			supportsLightScenes(this.state.deviceType, this.state.device?.version)
		) {
			if (!this.liveCustomColors) this.liveCustomColors = this.readLiveColors();
			this.showLiveColors([0, 1].map((ch) => sceneLightColor(scene, ch)));
		} else if (Number.isInteger(scene)) {
			this.liveCustomColors = null; // Custom: the controls show its colors
		}
	}

	/**
	 * Send every live light channel and the scene in one F1 (cluster 0).
	 * @param {number} scene - LIGHT_SCENES value
	 */
	async sendLiveLights(scene) {
		const profile =
			DEVICE_PROFILES[this.state.deviceType] ||
			DEVICE_PROFILES[DEVICE_TYPES.SKELLY];
		const lights = [];
		for (let ch = 0; ch < Math.min(profile.lights.length || 1, 2); ch++) {
			lights.push(this.readLiveLight(ch));
		}
		await this.connection.send(buildSetAllLightsCommand(lights, 0, scene));
		this.logger.log(
			`Set all lights (F1) scene=${scene}: ${lights
				.map(
					(l, ch) =>
						`ch${ch} mode=${l.effectMode} brightness=${l.brightness} speed=${l.effectSpeed}`,
				)
				.join(", ")}`,
		);
	}

	/**
	 * While a scene preset is on, a live brightness, effect or speed change
	 * goes out as F1 with that scene, so the scene stays on. (Whether the
	 * per-channel commands would end the scene is untested.)
	 * @returns {boolean} true when it sent F1 (the caller sends nothing else)
	 */
	sendLiveLightsInScene() {
		const scene = this.state.live.scene;
		if (
			!isScenePreset(scene) ||
			!supportsLightScenes(this.state.deviceType, this.state.device?.version)
		) {
			return false;
		}
		this.sendLiveLights(scene).catch((error) =>
			this.logger.log(
				`Set all lights failed: ${error.message}`,
				LOG_CLASSES.WARNING,
			),
		);
		return true;
	}

	/**
	 * Show the live scene picker on scene firmware once the device reported
	 * its scene (BBE1), and gray out color and color cycle while a scene
	 * preset plays its own colors.
	 */
	updateScenePicker() {
		const scene = this.state.live.scene;
		const shown =
			Number.isInteger(scene) &&
			supportsLightScenes(this.state.deviceType, this.state.device?.version);
		const preset = shown && isScenePreset(scene);
		$("#liveSceneRow")?.classList.toggle("hidden", !shown);
		$("#liveSceneHint")?.classList.toggle("hidden", !preset);
		const picker = $("#liveScene");
		if (picker && shown) {
			// A scene this page doesn't know (newer firmware) still shows as a number
			if (![...picker.options].some((o) => o.value === String(scene))) {
				picker.add(new Option(`Scene ${scene}`, String(scene)));
			}
			picker.value = String(scene);
		}
		for (const ch of [0, 1]) {
			for (const id of [
				`light${ch}ColorPick`,
				`light${ch}R`,
				`light${ch}G`,
				`light${ch}B`,
				`btnLight${ch}ColorCycle`,
			]) {
				const el = $(`#${id}`);
				if (!el) continue;
				el.disabled = preset;
				el.title = preset
					? "The light scene plays its own colors"
					: id.startsWith("btn")
						? "Cycle all colors"
						: "";
			}
		}
	}

	/** Returns the display label for the primary (light0) zone of the active profile. */
	get light0Label() {
		const profile =
			DEVICE_PROFILES[this.state.deviceType] ||
			DEVICE_PROFILES[DEVICE_TYPES.SKELLY];
		return profile.lights[0]?.label ?? "Light";
	}

	/**
	 * Send media command
	 */
	async sendMediaCommand(tag, payload) {
		if (!this.connection.isConnected()) {
			this.logger.log("Not connected", LOG_CLASSES.WARNING);
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
		this.light1ColorCycleEnabled = false;
		this.light0ColorCycleEnabled = false;
		// Custom colors kept while a scene preset shows its own (showSceneColors)
		this.liveCustomColors = null;

		// Light 1 - Brightness control (immediate)
		const light1BriRange = $("#light1BrightnessRange");
		const light1BriNum = $("#light1Brightness");

		const sendLight1Brightness = async (value) => {
			if (!this.connection.isConnected()) return;
			if (this.sendLiveLightsInScene()) return;
			const ch = "01"; // Light 1 is channel 1
			const brightness = parseInt(value, 10);
			const brightnessHex = brightness
				.toString(16)
				.padStart(2, "0")
				.toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(COMMANDS.SET_BRIGHTNESS, ch + brightnessHex + cluster, 8),
			);
			this.logger.log(`Set Light 1 brightness to ${brightness}`);
		};

		if (light1BriRange && light1BriNum) {
			light1BriRange.addEventListener("input", (e) => {
				light1BriNum.value = e.target.value;
				sendLight1Brightness(e.target.value);
			});
			light1BriNum.addEventListener("input", (e) => {
				const clamped = clamp(e.target.value, 0, 255);
				light1BriRange.value = clamped;
				sendLight1Brightness(clamped);
			});
		}

		// Light 0 - Brightness control (immediate)
		const light0BriRange = $("#light0BrightnessRange");
		const light0BriNum = $("#light0Brightness");

		const sendLight0Brightness = async (value) => {
			if (!this.connection.isConnected()) return;
			if (this.sendLiveLightsInScene()) return;
			const ch = "00"; // Light 0 is channel 0
			const brightness = parseInt(value, 10);
			const brightnessHex = brightness
				.toString(16)
				.padStart(2, "0")
				.toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(COMMANDS.SET_BRIGHTNESS, ch + brightnessHex + cluster, 8),
			);
			this.logger.log(`Set ${this.light0Label} brightness to ${brightness}`);
		};

		if (light0BriRange && light0BriNum) {
			light0BriRange.addEventListener("input", (e) => {
				light0BriNum.value = e.target.value;
				sendLight0Brightness(e.target.value);
			});
			light0BriNum.addEventListener("input", (e) => {
				const clamped = clamp(e.target.value, 0, 255);
				light0BriRange.value = clamped;
				sendLight0Brightness(clamped);
			});
		}

		// Light 1 - Color/RGB control (immediate)
		const light1ColorPick = $("#light1ColorPick");
		const light1RInput = $("#light1R");
		const light1GInput = $("#light1G");
		const light1BInput = $("#light1B");

		const sendLight1Color = async (disableCycle = false) => {
			if (!this.connection.isConnected()) return;

			// If user is setting a new color (not from cycle button), disable cycle
			if (disableCycle && this.light1ColorCycleEnabled) {
				this.light1ColorCycleEnabled = false;
				const btnLight1ColorCycle = $("#btnLight1ColorCycle");
				if (btnLight1ColorCycle) {
					btnLight1ColorCycle.classList.remove("selected");
				}
			}

			const ch = "01"; // Light 1 is channel 1
			const r = parseInt(light1RInput?.value || "255", 10);
			const g = parseInt(light1GInput?.value || "0", 10);
			const b = parseInt(light1BInput?.value || "0", 10);
			const cycle = this.light1ColorCycleEnabled ? "01" : "00";
			const rHex = r.toString(16).padStart(2, "0").toUpperCase();
			const gHex = g.toString(16).padStart(2, "0").toUpperCase();
			const bHex = b.toString(16).padStart(2, "0").toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(
					COMMANDS.SET_RGB,
					`${ch + rHex + gHex + bHex + cycle + cluster}00`,
					9,
				),
			);
			this.logger.log(
				`Set Light 1 color to RGB(${r}, ${g}, ${b}) with cycle ${this.light1ColorCycleEnabled ? "ON" : "OFF"}`,
			);
		};

		// Sync color picker with RGB inputs and send immediately
		if (light1ColorPick && light1RInput && light1GInput && light1BInput) {
			light1ColorPick.addEventListener("input", (e) => {
				const hex = e.target.value;
				light1RInput.value = parseInt(hex.substring(1, 3), 16);
				light1GInput.value = parseInt(hex.substring(3, 5), 16);
				light1BInput.value = parseInt(hex.substring(5, 7), 16);
				sendLight1Color(true); // Disable cycle when user picks a color
			});

			[light1RInput, light1GInput, light1BInput].forEach((inp) => {
				inp?.addEventListener("input", () => {
					const r = clamp(light1RInput.value, 0, 255);
					const g = clamp(light1GInput.value, 0, 255);
					const b = clamp(light1BInput.value, 0, 255);
					light1ColorPick.value = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
					sendLight1Color(true); // Disable cycle when user changes RGB values
				});
			});
		}

		// Light 0 - Color/RGB control (immediate)
		const light0ColorPick = $("#light0ColorPick");
		const light0RInput = $("#light0R");
		const light0GInput = $("#light0G");
		const light0BInput = $("#light0B");

		const sendLight0Color = async (disableCycle = false) => {
			if (!this.connection.isConnected()) return;

			// If user is setting a new color (not from cycle button), disable cycle
			if (disableCycle && this.light0ColorCycleEnabled) {
				this.light0ColorCycleEnabled = false;
				const btnLight0ColorCycle = $("#btnLight0ColorCycle");
				if (btnLight0ColorCycle) {
					btnLight0ColorCycle.classList.remove("selected");
				}
			}

			const ch = "00"; // Light 0 is channel 0
			const r = parseInt(light0RInput?.value || "255", 10);
			const g = parseInt(light0GInput?.value || "0", 10);
			const b = parseInt(light0BInput?.value || "0", 10);
			const cycle = this.light0ColorCycleEnabled ? "01" : "00";
			const rHex = r.toString(16).padStart(2, "0").toUpperCase();
			const gHex = g.toString(16).padStart(2, "0").toUpperCase();
			const bHex = b.toString(16).padStart(2, "0").toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(
					COMMANDS.SET_RGB,
					`${ch + rHex + gHex + bHex + cycle + cluster}00`,
					9,
				),
			);
			this.logger.log(
				`Set ${this.light0Label} color to RGB(${r}, ${g}, ${b}) with cycle ${this.light0ColorCycleEnabled ? "ON" : "OFF"}`,
			);
		};

		// Sync color picker with RGB inputs and send immediately
		if (light0ColorPick && light0RInput && light0GInput && light0BInput) {
			light0ColorPick.addEventListener("input", (e) => {
				const hex = e.target.value;
				light0RInput.value = parseInt(hex.substring(1, 3), 16);
				light0GInput.value = parseInt(hex.substring(3, 5), 16);
				light0BInput.value = parseInt(hex.substring(5, 7), 16);
				sendLight0Color(true); // Disable cycle when user picks a color
			});

			[light0RInput, light0GInput, light0BInput].forEach((inp) => {
				inp?.addEventListener("input", () => {
					const r = clamp(light0RInput.value, 0, 255);
					const g = clamp(light0GInput.value, 0, 255);
					const b = clamp(light0BInput.value, 0, 255);
					light0ColorPick.value = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
					sendLight0Color(true); // Disable cycle when user changes RGB values
				});
			});
		}

		// Light 1 - Effect mode (immediate)
		const light1EffectMode = $("#light1EffectMode");
		const light1EffectSpeedBlock = $("#light1EffectSpeedBlock");

		if (light1EffectMode && light1EffectSpeedBlock) {
			light1EffectMode.addEventListener("change", async () => {
				const v = parseInt(light1EffectMode.value, 10);
				light1EffectSpeedBlock.classList.toggle("hidden", v === 1); // hide for Static

				if (!this.connection.isConnected()) return;
				if (this.sendLiveLightsInScene()) return;
				const ch = "01"; // Light 1 is channel 1
				const modeHex = v.toString(16).padStart(2, "0").toUpperCase();
				const cluster = "00000000";
				await this.connection.send(
					buildCommand(COMMANDS.SET_MODE, `${ch + modeHex + cluster}00`, 8),
				);
				this.logger.log(
					`Set Light 1 mode to ${v} (1=Static, 2=Strobe, 3=Pulsing)`,
				);
			});
		}

		// Light 0 - Effect mode (immediate)
		const light0EffectMode = $("#light0EffectMode");
		const light0EffectSpeedBlock = $("#light0EffectSpeedBlock");

		if (light0EffectMode && light0EffectSpeedBlock) {
			light0EffectMode.addEventListener("change", async () => {
				const v = parseInt(light0EffectMode.value, 10);
				light0EffectSpeedBlock.classList.toggle("hidden", v === 1); // hide for Static

				if (!this.connection.isConnected()) return;
				if (this.sendLiveLightsInScene()) return;
				const ch = "00"; // Light 0 is channel 0
				const modeHex = v.toString(16).padStart(2, "0").toUpperCase();
				const cluster = "00000000";
				await this.connection.send(
					buildCommand(COMMANDS.SET_MODE, `${ch + modeHex + cluster}00`, 8),
				);
				this.logger.log(
					`Set ${this.light0Label} mode to ${v} (1=Static, 2=Strobe, 3=Pulsing)`,
				);
			});
		}

		// Light 1 - Effect speed control (immediate)
		const light1EffectSpeedRange = $("#light1EffectSpeedRange");
		const light1EffectSpeedNum = $("#light1EffectSpeed");

		const sendLight1Speed = async (value) => {
			if (!this.connection.isConnected()) return;
			if (this.sendLiveLightsInScene()) return;
			const ch = "01"; // Light 1 is channel 1
			const uiSpeed = parseInt(value, 10);
			const deviceSpeed = uiSpeedToDevice(uiSpeed);
			const speedHex = deviceSpeed.toString(16).padStart(2, "0").toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(COMMANDS.SET_SPEED, ch + speedHex + cluster, 8),
			);
			this.logger.log(
				`Set Light 1 speed to ${uiSpeed} (device: ${deviceSpeed})`,
			);
		};

		if (light1EffectSpeedRange && light1EffectSpeedNum) {
			light1EffectSpeedRange.addEventListener("input", (e) => {
				light1EffectSpeedNum.value = e.target.value;
				sendLight1Speed(e.target.value);
			});
			light1EffectSpeedNum.addEventListener("input", (e) => {
				const clamped = clamp(e.target.value, 0, MAX_UI_EFFECT_SPEED);
				light1EffectSpeedRange.value = clamped;
				sendLight1Speed(clamped);
			});
		}

		// Light 0 - Effect speed control (immediate)
		const light0EffectSpeedRange = $("#light0EffectSpeedRange");
		const light0EffectSpeedNum = $("#light0EffectSpeed");

		const sendLight0Speed = async (value) => {
			if (!this.connection.isConnected()) return;
			if (this.sendLiveLightsInScene()) return;
			const ch = "00"; // Light 0 is channel 0
			const uiSpeed = parseInt(value, 10);
			const deviceSpeed = uiSpeedToDevice(uiSpeed);
			const speedHex = deviceSpeed.toString(16).padStart(2, "0").toUpperCase();
			const cluster = "00000000";
			await this.connection.send(
				buildCommand(COMMANDS.SET_SPEED, ch + speedHex + cluster, 8),
			);
			this.logger.log(
				`Set ${this.light0Label} speed to ${uiSpeed} (device: ${deviceSpeed})`,
			);
		};

		if (light0EffectSpeedRange && light0EffectSpeedNum) {
			light0EffectSpeedRange.addEventListener("input", (e) => {
				light0EffectSpeedNum.value = e.target.value;
				sendLight0Speed(e.target.value);
			});
			light0EffectSpeedNum.addEventListener("input", (e) => {
				const clamped = clamp(e.target.value, 0, MAX_UI_EFFECT_SPEED);
				light0EffectSpeedRange.value = clamped;
				sendLight0Speed(clamped);
			});
		}

		// Movement controls — handled by bindMovementGrid (called from applyDeviceProfile)

		// Light 1 - Color cycle button (toggles cycle state)
		const btnLight1ColorCycle = $("#btnLight1ColorCycle");
		if (btnLight1ColorCycle) {
			btnLight1ColorCycle.addEventListener("click", async () => {
				if (!this.connection.isConnected()) {
					this.logger.log("Not connected", LOG_CLASSES.WARNING);
					return;
				}
				this.light1ColorCycleEnabled = !this.light1ColorCycleEnabled;
				btnLight1ColorCycle.classList.toggle(
					"selected",
					this.light1ColorCycleEnabled,
				);
				await sendLight1Color();
			});
		}

		// Light 0 - Color cycle button (toggles cycle state)
		const btnLight0ColorCycle = $("#btnLight0ColorCycle");
		if (btnLight0ColorCycle) {
			btnLight0ColorCycle.addEventListener("click", async () => {
				if (!this.connection.isConnected()) {
					this.logger.log("Not connected", LOG_CLASSES.WARNING);
					return;
				}
				this.light0ColorCycleEnabled = !this.light0ColorCycleEnabled;
				btnLight0ColorCycle.classList.toggle(
					"selected",
					this.light0ColorCycleEnabled,
				);
				await sendLight0Color();
			});
		}

		// Light scene picker (scene firmware only, see updateScenePicker)
		$("#liveScene")?.addEventListener("change", async (e) => {
			const scene = parseInt(e.target.value, 10);
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				this.updateScenePicker();
				return;
			}
			const shownColors = this.readLiveColors();
			const customColors = this.liveCustomColors;
			const previousScene = this.state.live.scene;
			this.showSceneColors(previousScene, scene);
			// Set before sending so a device update meanwhile sees the new scene.
			// No notify: that would reset the light controls to the last report.
			this.state.live.scene = scene;
			this.updateScenePicker();
			try {
				await this.sendLiveLights(scene);
			} catch (error) {
				this.logger.log(
					`Set light scene failed: ${error.message}`,
					LOG_CLASSES.WARNING,
				);
				this.state.live.scene = previousScene;
				this.showLiveColors(shownColors);
				this.liveCustomColors = customColors;
				this.updateScenePicker();
			}
		});

		// Live eye grid selection - send command immediately
		const apEyeGrid = $("#apEyeGrid");
		if (apEyeGrid) {
			apEyeGrid.addEventListener("click", async (e) => {
				const cell = e.target.closest(".eye-opt");
				if (!cell) return;

				this.selectedEye = parseInt(cell.dataset.eye, 10);
				apEyeGrid.querySelectorAll(".eye-opt").forEach((el) => {
					el.classList.remove("selected");
				});
				cell.classList.add("selected");

				// Send command immediately if connected
				if (!this.connection.isConnected()) {
					this.logger.log("Not connected", LOG_CLASSES.WARNING);
					return;
				}

				const eyeHex = this.selectedEye
					.toString(16)
					.padStart(2, "0")
					.toUpperCase();
				const clusterHex = "00000000"; // Always cluster 0 for live mode

				// Build payload: eye + 00 + cluster + 00 (no name)
				const payload = `${eyeHex}00${clusterHex}00`;

				await this.connection.send(buildCommand(COMMANDS.SET_EYE, payload, 8));
				this.logger.log(`Set eye to ${this.selectedEye} (live mode)`);
			});
		}
	}

	/**
	 * Initialize file controls
	 */
	initializeFileControls() {
		this.initializeFileListControls();
		this.initializeFileTableHandlers();
		this.initializeFileDragAndDrop();
	}

	/**
	 * Initialize file list refresh and filter controls
	 */
	initializeFileListControls() {
		$("#btnRefreshFiles")?.addEventListener("click", () => {
			this.fileManager.startFetchFiles();
		});

		$("#filesFilter")?.addEventListener("input", () => {
			this.updateFilesTable();
		});

		$("#btnAddFile")?.addEventListener("click", () => {
			this.transferModal.open("add");
		});
	}

	/**
	 * Initialize file table button and checkbox handlers
	 */
	initializeFileTableHandlers() {
		// Files table button handler (Play and Edit)
		$("#filesTable")?.addEventListener("click", (e) => {
			const btn = e.target.closest("button[data-action]");
			if (!btn) return;

			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const serial = parseInt(btn.dataset.serial, 10);
			const item = this.state.files.items.get(serial);
			if (!item) return;

			if (btn.dataset.action === "play" || btn.dataset.action === "stop") {
				this.handlePlayFile(serial);
			} else if (btn.dataset.action === "edit") {
				this.handleEditFile(item);
			}
		});

		// Files table checkbox handler (Enable/Disable)
		$("#filesTable")?.addEventListener("change", async (e) => {
			const checkbox = e.target.closest(".file-enabled-checkbox");
			if (!checkbox) return;

			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
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

		const tbody = $("#filesTable tbody");
		if (!tbody) return;

		// Desktop drag and drop
		tbody.addEventListener("dragstart", (e) => {
			const row = e.target.closest("tr.draggable-row");
			if (!row) return;

			draggedRow = row;
			row.style.opacity = "0.4";
			e.dataTransfer.effectAllowed = "move";
		});

		tbody.addEventListener("dragend", (e) => {
			const row = e.target.closest("tr.draggable-row");
			if (row) {
				row.style.opacity = "1";
			}
			draggedRow = null;
		});

		tbody.addEventListener("dragover", (e) => {
			e.preventDefault();
			const row = e.target.closest("tr.draggable-row");
			if (!row || !draggedRow || row === draggedRow) return;

			e.dataTransfer.dropEffect = "move";

			// Visual feedback - add border to indicate drop position
			const rows = Array.from(tbody.querySelectorAll("tr.draggable-row"));
			const draggedIndex = rows.indexOf(draggedRow);
			const targetIndex = rows.indexOf(row);

			if (draggedIndex < targetIndex) {
				row.style.borderBottom = "2px solid #4CAF50";
				row.style.borderTop = "";
			} else {
				row.style.borderTop = "2px solid #4CAF50";
				row.style.borderBottom = "";
			}
		});

		tbody.addEventListener("dragleave", (e) => {
			const row = e.target.closest("tr.draggable-row");
			if (row) {
				row.style.borderTop = "";
				row.style.borderBottom = "";
			}
		});

		tbody.addEventListener("drop", async (e) => {
			e.preventDefault();
			const targetRow = e.target.closest("tr.draggable-row");
			if (!targetRow || !draggedRow || targetRow === draggedRow) return;

			// Clear visual feedback
			targetRow.style.borderTop = "";
			targetRow.style.borderBottom = "";

			await this.handleFileDrop(draggedRow, targetRow);
		});

		// Mobile touch events
		tbody.addEventListener(
			"touchstart",
			(e) => {
				const dragHandle = e.target.closest(".drag-handle");
				if (!dragHandle) return;

				const row = e.target.closest("tr.draggable-row");
				if (!row) return;

				draggedRow = row;

				// Create visual feedback
				row.style.opacity = "0.6";
				row.style.backgroundColor = "rgba(34, 211, 238, 0.1)";

				// Prevent scrolling while dragging
				e.preventDefault();
			},
			{ passive: false },
		);

		tbody.addEventListener(
			"touchmove",
			(e) => {
				if (!draggedRow) return;

				e.preventDefault();

				// Get all draggable rows
				const rows = Array.from(tbody.querySelectorAll("tr.draggable-row"));
				const draggedIndex = rows.indexOf(draggedRow);

				// Clear previous visual feedback
				rows.forEach((r) => {
					r.style.borderTop = "";
					r.style.borderBottom = "";
				});

				// Find the row under the touch point
				const elementAtPoint = document.elementFromPoint(
					e.touches[0].clientX,
					e.touches[0].clientY,
				);
				const targetRow = elementAtPoint?.closest("tr.draggable-row");

				if (targetRow && targetRow !== draggedRow) {
					const targetIndex = rows.indexOf(targetRow);

					// Show visual feedback
					if (draggedIndex < targetIndex) {
						targetRow.style.borderBottom = "2px solid #4CAF50";
					} else {
						targetRow.style.borderTop = "2px solid #4CAF50";
					}
				}
			},
			{ passive: false },
		);

		tbody.addEventListener("touchend", async (e) => {
			if (!draggedRow) return;

			// Clear visual feedback
			draggedRow.style.opacity = "1";
			draggedRow.style.backgroundColor = "";

			// Find the row at the drop position
			const elementAtPoint = document.elementFromPoint(
				e.changedTouches[0].clientX,
				e.changedTouches[0].clientY,
			);
			const targetRow = elementAtPoint?.closest("tr.draggable-row");

			// Clear all borders
			const rows = Array.from(tbody.querySelectorAll("tr.draggable-row"));
			rows.forEach((r) => {
				r.style.borderTop = "";
				r.style.borderBottom = "";
			});

			if (targetRow && targetRow !== draggedRow) {
				await this.handleFileDrop(draggedRow, targetRow);
			}

			draggedRow = null;
		});

		tbody.addEventListener("touchcancel", (_e) => {
			if (!draggedRow) return;

			// Clear visual feedback
			draggedRow.style.opacity = "1";
			draggedRow.style.backgroundColor = "";

			// Clear all borders
			const rows = Array.from(tbody.querySelectorAll("tr.draggable-row"));
			rows.forEach((r) => {
				r.style.borderTop = "";
				r.style.borderBottom = "";
			});

			draggedRow = null;
		});
	}

	/**
	 * Handle play file button click
	 */
	async handlePlayFile(serial) {
		const serialHex = serial.toString(16).padStart(4, "0").toUpperCase();

		// Check if this file is currently playing
		const isPlaying =
			this.playState.playing && this.playState.serial === serial;

		// Send '01' to play, '00' to stop
		const playPauseByte = isPlaying ? "00" : "01";
		await this.connection.send(
			buildCommand(COMMANDS.PLAY_PAUSE, serialHex + playPauseByte, 8),
		);

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
			this.logger.log("Not connected", LOG_CLASSES.WARNING);
			return;
		}

		const tbody = draggedRow.parentElement;
		const rows = Array.from(tbody.querySelectorAll("tr.draggable-row"));
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
		const enabledSerials = Array.from(
			tbody.querySelectorAll("tr.draggable-row"),
		).map((row) => parseInt(row.dataset.serial, 10));

		// Update state and device
		const ordersAsString = JSON.stringify(enabledSerials);
		this.state.updateDevice({ order: ordersAsString });
		this.state.notify("files"); // This will re-render the table with new numbers

		this.logger.log(
			`Reordered files: ${enabledSerials.length} files`,
			LOG_CLASSES.INFO,
		);
		await this.fileManager.updateFileOrder(enabledSerials);
	}

	/**
	 * Handle file enable/disable toggle
	 * Collects all checked files in display order and updates device
	 */
	async handleFileEnableToggle() {
		// Collect all checked checkboxes in DOM order (which reflects sort order)
		const checkboxes = Array.from(
			document.querySelectorAll(".file-enabled-checkbox"),
		);
		const enabledSerials = checkboxes
			.filter((cb) => cb.checked)
			.map((cb) => parseInt(cb.dataset.serial, 10));

		if (enabledSerials.length === 0) {
			this.logger.log("At least one file must be enabled", LOG_CLASSES.WARNING);
			// Find first checkbox and re-check it
			if (checkboxes.length > 0) {
				checkboxes[0].checked = true;
			}
			return;
		}

		// Immediately update order in state to trigger UI resort
		const ordersAsString = JSON.stringify(enabledSerials);
		this.state.updateDevice({ order: ordersAsString });
		this.state.notify("files");

		this.logger.log(
			`Updating file order: ${enabledSerials.length} files enabled`,
			LOG_CLASSES.INFO,
		);
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
			const elapsed = Math.floor(
				(Date.now() - this.playState.startTime) / 1000,
			);
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
		const btn = document.querySelector(
			`button[data-action="stop"][data-serial="${serial}"]`,
		);
		if (btn) {
			const mins = Math.floor(seconds / 60);
			const secs = seconds % 60;
			const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
			btn.textContent = `⏹ Stop (${timeStr})`;
		}
	}

	/**
	 * Save log contents to file
	 */
	saveLog() {
		const logEl = $("#log");
		if (!logEl) return;

		// Get all log lines and filter out hidden ones
		const lines = logEl.querySelectorAll(".line");
		const logContent = Array.from(lines)
			.filter((line) => line.style.display !== "none")
			.map((line) => line.textContent)
			.join("\n");

		if (!logContent.trim()) {
			this.logger.log("Log is empty - nothing to save", LOG_CLASSES.WARNING);
			return;
		}

		// Create filename with timestamp
		const now = new Date();
		const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
		const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-"); // HH-MM-SS
		const filename = `UltraSkelly-${dateStr}-${timeStr}.log`;

		// Create blob and download
		const blob = new Blob([logContent], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
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
		const connectModal = $("#connectModal");
		connectModal?.classList.remove("hidden");
	}

	/**
	 * Perform actual connection with filter
	 */
	async performConnection(options) {
		try {
			const connectionOptions = {
				type: options.connectionType || ConnectionType.DIRECT_BLE,
				nameFilter: options.nameFilter || options.deviceAddress || "",
				restUrl: options.restUrl || "",
			};

			await this.connection.connect(connectionOptions);

			// Auto-detect device type from BLE name and apply matching profile
			const connectedName = this.state.device.name || "";
			const detectedType = this.detectDeviceTypeFromName(connectedName);
			if (detectedType && detectedType !== this.state.deviceType) {
				this.logger.log(
					`Auto-detected device type: ${DEVICE_PROFILES[detectedType].uiName} (from "${connectedName}")`,
					LOG_CLASSES.WARNING,
				);
				localStorage.setItem(STORAGE_KEYS.DEVICE_TYPE, detectedType);
				this.state.setDeviceType(detectedType);
				this.applyDeviceProfile(detectedType);
			}

			// Query device state in sequence: live mode, params, volume, BT name, version
			await this.connection.send(buildCommand(COMMANDS.QUERY_LIVE, "", 8));
			setTimeout(
				() => this.connection.send(buildCommand(COMMANDS.QUERY_PARAMS, "", 8)),
				50,
			);
			setTimeout(
				() => this.connection.send(buildCommand(COMMANDS.QUERY_VOLUME, "", 8)),
				100,
			);
			setTimeout(
				() => this.connection.send(buildCommand(COMMANDS.QUERY_BT_NAME, "", 8)),
				150,
			);
			setTimeout(
				() => this.connection.send(buildCommand(COMMANDS.QUERY_VERSION, "", 8)),
				200,
			);

			// Start file list fetch - this will query capacity and order after files are received
			setTimeout(() => {
				this.fileManager.startFetchFiles();
			}, 250);
		} catch (error) {
			console.error("Connection error:", error);
			this.logger.log(
				`Connection failed: ${error.message}`,
				LOG_CLASSES.WARNING,
			);
		}
	}

	/**
	 * Detect device type from a BLE device name by matching against the profiles' bleNames.
	 * Returns the matching DEVICE_TYPES key, or null if no profile matches.
	 * @param {string} deviceName
	 * @returns {string|null}
	 */
	detectDeviceTypeFromName(deviceName) {
		if (!deviceName) return null;
		const lower = deviceName.toLowerCase();
		// The first profile with a name the device's name contains
		for (const [type, profile] of Object.entries(DEVICE_PROFILES)) {
			if (profile.bleNames.some((name) => lower.includes(name.toLowerCase()))) {
				return type;
			}
		}
		return null;
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
		const grid = $("#apEyeGrid");
		if (!grid) return;

		grid.innerHTML = "";

		// Create eye options for images 1..eyeIconCount of the active profile
		const eyeCount = DEVICE_PROFILES[this.state.deviceType]?.eyeIconCount || 0;
		for (let imgIdx = 1; imgIdx <= eyeCount; imgIdx++) {
			const eyeNum = imgIdx;
			const div = document.createElement("div");
			div.className = `eye-opt${eyeNum === this.selectedEye ? " selected" : ""}`;
			div.dataset.eye = String(eyeNum);
			div.title = `Eye ${eyeNum}`;

			// Create image element
			const img = document.createElement("img");
			img.className = "eye-thumb";
			img.src = getEyeIconPath(this.state.deviceType, imgIdx);
			img.alt = `eye ${eyeNum}`;

			div.appendChild(img);
			grid.appendChild(div);
		}
	}

	/**
	 * Update device UI
	 */
	updateDeviceUI(device) {
		// The firmware version decides whether scenes exist
		if (!device.connected) {
			this.liveCustomColors = null;
			this.shownPin = null;
			this.shownBtName = null;
		} else {
			this.showReportedSceneColors();
		}
		this.updateScenePicker();

		// Update status
		const statusSpan = $("#status span");
		if (statusSpan) {
			if (device.connected) {
				// Get connection info directly from connection manager
				const deviceInfo = this.connection.getDeviceInfo();

				// Show REST URL if connected via REST proxy
				if (
					deviceInfo &&
					deviceInfo.connectionType === ConnectionType.REST_PROXY &&
					deviceInfo.restUrl
				) {
					statusSpan.textContent = `Connected (via ${deviceInfo.restUrl})`;
				} else {
					statusSpan.textContent = "Connected";
				}
			} else {
				statusSpan.textContent = "Disconnected";
			}
		}

		document.body.classList.toggle("disconnected", !device.connected);

		const btnDisconnect = $("#btnDisconnect");
		if (btnDisconnect) {
			btnDisconnect.disabled = !device.connected;
		}

		const btnConnect = $("#btnConnect");
		if (btnConnect) {
			btnConnect.disabled = device.connected;
		}

		// Update device info
		if ($("#statName")) $("#statName").textContent = device.name || "—";
		if ($("#statVersion"))
			$("#statVersion").textContent = device.version ?? "—";
		if ($("#statShowMode"))
			$("#statShowMode").textContent = device.showMode ?? "—";
		if ($("#statChannels")) {
			$("#statChannels").textContent = device.channels.length
				? device.channels.join(", ")
				: "—";
		}
		if ($("#statBtName")) $("#statBtName").textContent = device.btName || "—";

		// Show warning if the detected firmware version hasn't been tested with this app
		if (device.version && device.version !== this._warnedFwVersion) {
			this._warnedFwVersion = device.version;
			if (!KNOWN_FIRMWARE[this.state.deviceType]?.[device.version]) {
				const el = $("#fwWarningVersion");
				if (el) el.textContent = `${device.version} (${this.state.deviceType})`;
				$("#fwWarningModal")?.classList.remove("hidden");
			}
		}
		if (device.volume != null) {
			const volRange = $("#volRange");
			const volNum = $("#vol");
			if (volRange) volRange.value = device.volume;
			if (volNum) volNum.value = device.volume;
		}

		if ($("#statCapacity")) {
			$("#statCapacity").textContent =
				device.capacity != null ? `${device.capacity} KB remaining` : "—";
		}

		if ($("#statFileCount")) {
			const reported = device.filesReported ?? "—";
			const received = device.filesReceived ?? "—";
			const mismatch =
				device.filesReported != null &&
				device.filesReceived != null &&
				device.filesReported !== device.filesReceived;

			$("#statFileCount").textContent = `${received} / ${reported}`;

			// Add warning styling if counts don't match
			if (mismatch) {
				$("#statFileCount").style.color = "var(--warn)";
				$("#statFileCount").title =
					"Received count differs from reported count";
			} else {
				$("#statFileCount").style.color = "";
				$("#statFileCount").title = "";
			}
		}

		if ($("#statOrder")) {
			$("#statOrder").textContent = device.order || "—";
		}

		if ($("#statPin")) {
			$("#statPin").textContent = device.pin || "—";
		}

		// Fill the PIN and name inputs only when the device reports a new
		// value, so other device updates don't overwrite what is being typed
		if ($("#pinInput") && device.pin && device.pin !== this.shownPin) {
			$("#pinInput").value = device.pin;
			this.shownPin = device.pin;
		}

		// Device name without the "(Live)" suffix
		if (
			$("#deviceNameInput") &&
			device.btName &&
			device.btName !== this.shownBtName
		) {
			const displayName = device.btName.replace(/\s*\(Live\)\s*$/i, "");
			$("#deviceNameInput").value = displayName;
			this.shownBtName = device.btName;
		}
	}

	/**
	 * Update live status UI
	 */
	updateLiveUI(live) {
		// Update movement icons based on action bitfield
		if (live.action != null) {
			const actionBits = parseInt(live.action, 10);
			const liveMove = $("#liveMove");

			if (liveMove && !Number.isNaN(actionBits)) {
				liveMove.querySelectorAll(".iconToggle").forEach((btn) => {
					btn.classList.remove("selected");
				});

				if (actionBits === 255) {
					liveMove
						.querySelector('[data-part="all"]')
						?.classList.add("selected");
				} else {
					liveMove
						.querySelectorAll('[data-part]:not([data-part="all"])')
						.forEach((btn) => {
							const bit = parseInt(btn.dataset.bit || "0", 10);
							if (bit && actionBits & bit) btn.classList.add("selected");
						});
				}
			}
		}

		// Update eye icon selection
		if (live.eye != null) {
			this.selectedEye = live.eye;
			const apEyeGrid = $("#apEyeGrid");
			if (apEyeGrid) {
				// Clear all selections
				apEyeGrid.querySelectorAll(".eye-opt").forEach((el) => {
					el.classList.remove("selected");
				});
				// Select the current eye
				const eyeOpt = apEyeGrid.querySelector(`[data-eye="${live.eye}"]`);
				if (eyeOpt) eyeOpt.classList.add("selected");
			}
		}

		// Update light settings from live.lights array
		if (live.lights && Array.isArray(live.lights)) {
			// Light 1 (index 1)
			if (live.lights[1]) {
				const light1 = live.lights[1];

				// Brightness
				if ($("#light1Brightness"))
					$("#light1Brightness").value = light1.brightness;
				if ($("#light1BrightnessRange"))
					$("#light1BrightnessRange").value = light1.brightness;

				// Color (RGB)
				if ($("#light1R")) $("#light1R").value = light1.r;
				if ($("#light1G")) $("#light1G").value = light1.g;
				if ($("#light1B")) $("#light1B").value = light1.b;
				const light1Hex = `#${light1.r.toString(16).padStart(2, "0")}${light1.g.toString(16).padStart(2, "0")}${light1.b.toString(16).padStart(2, "0")}`;
				if ($("#light1ColorPick")) $("#light1ColorPick").value = light1Hex;

				// Color cycle state
				this.light1ColorCycleEnabled = light1.colorCycle === 1;
				const light1CycleBtn = $("#btnLight1ColorCycle");
				if (light1CycleBtn) {
					if (this.light1ColorCycleEnabled) {
						light1CycleBtn.classList.add("selected");
					} else {
						light1CycleBtn.classList.remove("selected");
					}
				}

				// Effect mode
				if ($("#light1EffectMode"))
					$("#light1EffectMode").value = light1.effectMode;

				// Effect speed (show/hide speed block based on mode)
				const light1EffectSpeedBlock = $("#light1EffectSpeedBlock");
				if (light1EffectSpeedBlock) {
					light1EffectSpeedBlock.classList.toggle(
						"hidden",
						light1.effectMode === 1,
					);
				}
				const light1UISpeed = deviceSpeedToUI(light1.effectSpeed);
				if ($("#light1EffectSpeed"))
					$("#light1EffectSpeed").value = light1UISpeed;
				if ($("#light1EffectSpeedRange"))
					$("#light1EffectSpeedRange").value = light1UISpeed;
			}

			// Light 0 (index 0)
			if (live.lights[0]) {
				const light0 = live.lights[0];

				// Brightness
				if ($("#light0Brightness"))
					$("#light0Brightness").value = light0.brightness;
				if ($("#light0BrightnessRange"))
					$("#light0BrightnessRange").value = light0.brightness;

				// Color (RGB)
				if ($("#light0R")) $("#light0R").value = light0.r;
				if ($("#light0G")) $("#light0G").value = light0.g;
				if ($("#light0B")) $("#light0B").value = light0.b;
				const light0Hex = `#${light0.r.toString(16).padStart(2, "0")}${light0.g.toString(16).padStart(2, "0")}${light0.b.toString(16).padStart(2, "0")}`;
				if ($("#light0ColorPick")) $("#light0ColorPick").value = light0Hex;

				// Color cycle state
				this.light0ColorCycleEnabled = light0.colorCycle === 1;
				const light0CycleBtn = $("#btnLight0ColorCycle");
				if (light0CycleBtn) {
					if (this.light0ColorCycleEnabled) {
						light0CycleBtn.classList.add("selected");
					} else {
						light0CycleBtn.classList.remove("selected");
					}
				}

				// Effect mode
				if ($("#light0EffectMode"))
					$("#light0EffectMode").value = light0.effectMode;

				// Effect speed (show/hide speed block based on mode)
				const light0EffectSpeedBlock = $("#light0EffectSpeedBlock");
				if (light0EffectSpeedBlock) {
					light0EffectSpeedBlock.classList.toggle(
						"hidden",
						light0.effectMode === 1,
					);
				}
				const light0UISpeed = deviceSpeedToUI(light0.effectSpeed);
				if ($("#light0EffectSpeed"))
					$("#light0EffectSpeed").value = light0UISpeed;
				if ($("#light0EffectSpeedRange"))
					$("#light0EffectSpeedRange").value = light0UISpeed;
			}
		}

		this.showReportedSceneColors();
		this.updateScenePicker();
	}

	/**
	 * Update files table
	 */
	updateFilesTable() {
		const tbody = $("#filesTable tbody");
		if (!tbody) return;

		// Disable table during active fetch
		const table = $("#filesTable");
		const tableWrap = $("#filesTableWrap");
		const spinnerWrap = $("#filesSpinnerWrap");
		const isRefreshing = this.state.files.activeFetch;
		const hasItems = this.state.files.items.size > 0;

		// Show centered spinner only when fetching with no items yet
		if (spinnerWrap)
			spinnerWrap.classList.toggle("hidden", !(isRefreshing && !hasItems));
		if (tableWrap)
			tableWrap.classList.toggle("hidden", isRefreshing && !hasItems);

		// Fade table while re-fetching over existing items
		if (table) {
			table.style.opacity = isRefreshing && hasItems ? "0.5" : "1";
			table.style.pointerEvents = isRefreshing ? "none" : "auto";
		}

		tbody.innerHTML = "";

		// Nothing to render while initial fetch is in progress
		if (isRefreshing && !hasItems) return;

		const query = ($("#filesFilter")?.value || "").toLowerCase().trim();

		// Get file order from device state
		let fileOrder = [];
		try {
			if (this.state.device.order) {
				fileOrder = JSON.parse(this.state.device.order);
			}
		} catch (_e) {
			// If parsing fails, use empty array
		}

		// Sort files: enabled (in order) first by order position, disabled (not in order) last by serial
		const files = Array.from(this.state.files.items.values())
			.filter(
				(file) => !query || (file.name || "").toLowerCase().includes(query),
			)
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

		let rowIndex = 1;
		for (const file of files) {
			const tr = document.createElement("tr");
			const eyeImgIdx = file.eye || 0;
			const eyeImgPath = getEyeIconPath(this.state.deviceType, eyeImgIdx);

			// Generate Light 1 color indicator (lights[1])
			let light1ColorHtml = "";
			if (file.lights?.[1]) {
				const light1 = file.lights[1];
				if (light1.colorCycle) {
					light1ColorHtml =
						'<img src="images/icon_light_cycle_no.png" alt="Cycle" title="Color cycle enabled" style="width:24px;height:24px" />';
				} else {
					const rgb = `rgb(${light1.r}, ${light1.g}, ${light1.b})`;
					light1ColorHtml = `<div style="width:24px;height:24px;border-radius:50%;background-color:${rgb};border:1px solid #444" title="RGB(${light1.r},${light1.g},${light1.b})"></div>`;
				}
			}

			// Generate Light 0 color indicator (lights[0])
			let light0ColorHtml = "";
			if (file.lights?.[0]) {
				const light0 = file.lights[0];
				if (light0.colorCycle) {
					light0ColorHtml =
						'<img src="images/icon_light_cycle_no.png" alt="Cycle" title="Color cycle enabled" style="width:24px;height:24px" />';
				} else {
					const rgb = `rgb(${light0.r}, ${light0.g}, ${light0.b})`;
					light0ColorHtml = `<div style="width:24px;height:24px;border-radius:50%;background-color:${rgb};border:1px solid #444" title="RGB(${light0.r},${light0.g},${light0.b})"></div>`;
				}
			}

			// Generate movement icons based on action bitfield using current profile
			let movementIcons = "";
			const actionBits = file.action || 0;
			const profile =
				DEVICE_PROFILES[this.state.deviceType] ||
				DEVICE_PROFILES[DEVICE_TYPES.SKELLY];
			if (actionBits === 255) {
				const allMove = profile.movements.find((m) => m.part === "all");
				if (allMove) {
					movementIcons = `<img class="eye-thumb" src="${allMove.icon}" alt="All" title="All movements" />`;
				}
			} else {
				profile.movements
					.filter((m) => m.part !== "all")
					.forEach((m) => {
						if (actionBits & m.bit) {
							movementIcons += `<img class="eye-thumb" src="${m.icon}" alt="${m.label}" title="${m.label}" />`;
						}
					});
			}

			// Determine if this file is currently playing
			const isPlaying =
				this.playState.playing && this.playState.serial === file.serial;
			const playButtonHtml = isPlaying
				? `<button class="btn sm" data-action="stop" data-serial="${file.serial}">⏹ Stop</button>`
				: `<button class="btn sm" data-action="play" data-serial="${file.serial}">▶ Play</button>`;

			// Check if file is in the order array (enabled)
			const isEnabled = fileOrder.indexOf(file.serial) !== -1;

			// Make row draggable if enabled
			if (isEnabled) {
				tr.draggable = true;
				tr.dataset.serial = file.serial;
				tr.classList.add("draggable-row");
			}

			const dragHandle = isEnabled
				? '<span class="drag-handle" style="cursor:move;user-select:none;font-size:18px;color:#888;">≡</span>'
				: "";

			tr.innerHTML = `
        <td style="text-align:center;padding:4px 8px;">${dragHandle}</td>
        <td>${rowIndex}</td>
        <td style="text-align:center"><input type="checkbox" class="file-enabled-checkbox" data-serial="${file.serial}" ${isEnabled ? "checked" : ""} /></td>
        <td>${escapeHtml(file.name || "")}</td>
        <td class="col-light1">${light1ColorHtml}</td>
        <td>${light0ColorHtml}</td>
        <td>${movementIcons}</td>
        <td class="col-eye">${eyeImgIdx ? `${eyeImgPath ? `<img class="eye-thumb" src="${eyeImgPath}" alt="eye ${eyeImgIdx}" />` : ""}${eyeImgIdx}` : "—"}</td>
        <td class="detail-column">${file.serial}</td>
        <td class="detail-column">${file.db}</td>
        <td class="detail-column">${file.cluster}</td>
        <td>
          ${playButtonHtml}
          <button class="btn sm" data-action="edit" data-serial="${file.serial}">✏️ Edit</button>
        </td>
      `;
			tbody.appendChild(tr);
			rowIndex++;
		}

		const summary = $("#filesSummary");
		const lastRefreshEl = $("#filesLastRefresh");

		if (summary) {
			const got = files.length;
			const expected = this.state.files.expected;
			summary.textContent = `Received ${got}${expected ? ` / ${expected}` : ""}`;
		}

		if (lastRefreshEl) {
			const lastRefresh = this.state.files.lastRefresh;
			if (lastRefresh) {
				const timeStr = lastRefresh.toLocaleTimeString();
				lastRefreshEl.textContent = `Last refresh: ${timeStr}`;
			} else {
				lastRefreshEl.textContent = "";
			}
		}

		// Apply detail column visibility based on advanced settings
		const advFileDetails = $("#advFileDetails");
		const showDetails = advFileDetails?.checked;
		document.querySelectorAll(".detail-column").forEach((col) => {
			col.style.display = showDetails ? "" : "none";
		});
	}
}

// Initialize application when DOM is ready
// Note: ES6 modules are deferred by default, so DOM is already loaded
function initializeApp() {
	// Check if critical elements exist
	const btnConnect = document.querySelector("#btnConnect");

	if (!btnConnect) {
		console.error("Critical UI elements missing! Cannot initialize.");
		return;
	}

	window.skellyApp = new SkellyApp();
}

// ES6 modules are deferred, so DOM is usually ready
// But check to be safe
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeApp);
} else {
	// DOM already loaded
	initializeApp();
}
