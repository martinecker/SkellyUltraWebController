/**
 * Main Application Entry Point
 * Orchestrates all modules and initializes the application
 */

import { ConnectDialog } from "./js/connect-dialog.js";
import { ConnectionManager, ConnectionType } from "./js/connection-manager.js";
import {
	COMMANDS,
	DEVICE_PROFILES,
	DEVICE_TYPES,
	displayedLights,
	eyeIconLabel,
	getEyeIconPath,
	isTestedFirmware,
	knownDeviceType,
	LOG_CLASSES,
	movementIconPath,
	STORAGE_KEYS,
} from "./js/constants.js";
import {
	buildSetAllLights,
	isScenePreset,
	sceneLightColor,
	sendSetEyeIcon,
	sendSetLightBrightness,
	sendSetLightMode,
	sendSetLightRgb,
	sendSetLightSpeed,
	sendSetMovementAction,
	supportsLightScenes,
} from "./js/device-settings.js";
import { $ } from "./js/dom.js";
import { EditModalManager } from "./js/edit-modal.js";
import { AudioConverter, FileManager } from "./js/file-manager.js";
import { hideModal, showModal } from "./js/modal-stack.js";
import {
	buildCommand,
	bytesToHex,
	clamp,
	deviceSpeedToUI,
	escapeHtml,
	intToHex,
	MAX_UI_EFFECT_SPEED,
	rgbToHex,
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
 * A file's light in the files table: its color as a dot, or the cycle icon
 * @param {Object} light - Parsed light (r, g, b, colorCycle)
 * @returns {string} HTML
 */
function lightSwatchHtml(light) {
	if (light.colorCycle) {
		return '<img src="images/icon_light_cycle_no.png" alt="Cycle" title="Color cycle enabled" style="width:24px;height:24px" />';
	}
	const { r, g, b } = light;
	return `<div style="width:24px;height:24px;border-radius:50%;background-color:rgb(${r}, ${g}, ${b});border:1px solid #444" title="RGB(${r},${g},${b})"></div>`;
}

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

			// Connect dialog and connect sequence
			this.connectDialog = new ConnectDialog({
				connection: this.connection,
				state: this.state,
				fileManager: this.fileManager,
				log: this.logger.log.bind(this.logger),
				savedDeviceType: () => this.savedDeviceType(),
				applyDeviceType: (type) => {
					this.state.setDeviceType(type);
					this.applyDeviceProfile(type);
				},
			});

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
				this.connectDialog.open();
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
		this.connectDialog.initialize();
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
		const startupDeviceType = this.savedDeviceType();
		this.state.setDeviceType(startupDeviceType);
		this.applyDeviceProfile(startupDeviceType);
	}

	/** The persisted device type; Ultra Skelly if none or not a known one */
	savedDeviceType() {
		return knownDeviceType(localStorage.getItem(STORAGE_KEYS.DEVICE_TYPE));
	}

	/**
	 * Initialize device type dropdown (post-connect override)
	 */
	initializeDeviceTypeControl() {
		const deviceTypeSelect = $("#deviceTypeSelect");
		if (!deviceTypeSelect) return;

		// Sync with persisted value
		const saved = this.savedDeviceType();
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

			const newName = DEVICE_PROFILES[newType]?.displayName ?? newType;
			const oldName = DEVICE_PROFILES[oldType]?.displayName ?? oldType;
			const msg = $("#deviceTypeChangeMsgDetail");
			if (msg) {
				msg.textContent = `You are switching from "${oldName}" to "${newName}".`;
			}

			showModal(modal, () => onCancel());

			const onConfirm = () => {
				hideModal(modal);
				cleanup();
				apply();
			};
			const onCancel = () => {
				hideModal(modal);
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
			profile.movements.forEach(({ part, label, bit }) => {
				const btn = document.createElement("button");
				btn.className = "iconToggle";
				btn.dataset.part = part;
				btn.dataset.bit = String(bit);
				btn.title = label;
				const img = document.createElement("img");
				img.src = movementIconPath(profile, part);
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

		// Live light controls, one group per light
		this.buildLiveLights(profile);

		// The edit dialog's light controls, one group per light
		this.editModal?.buildLights(profile);

		// Files table: one light column per light, eye column if any
		const movementCol = $("#filesMovementCol");
		if (movementCol) {
			for (const th of document.querySelectorAll("#filesTable th.col-light")) {
				th.remove();
			}
			for (const { label } of displayedLights(profile)) {
				const th = document.createElement("th");
				th.className = "col-light";
				th.textContent = label;
				movementCol.before(th);
			}
		}

		const filesEyeCol = $("#filesEyeCol");
		if (filesEyeCol) filesEyeCol.style.display = hasEyeImage ? "" : "none";

		// Keep body cell classes in sync — add/remove display style via dynamic <style>
		let dynStyle = document.getElementById("_profileColStyle");
		if (!dynStyle) {
			dynStyle = document.createElement("style");
			dynStyle.id = "_profileColStyle";
			document.head.appendChild(dynStyle);
		}
		dynStyle.textContent = hasEyeImage ? "" : "td.col-eye { display: none; }";
		this.updateFilesTable();

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
				await sendSetMovementAction(this.connection, 0, "", 255);
				this.logger.log("Applied movement: all");
				return;
			}
			const selected = partBtns.filter((b) => b.classList.contains("selected"));
			const bitfield = selected.reduce(
				(bits, btn) => bits | parseInt(btn.dataset.bit || "0", 10),
				0,
			);
			await sendSetMovementAction(this.connection, 0, "", bitfield);
			this.logger.log(
				bitfield > 0
					? `Applied movement: ${selected.map((b) => b.dataset.part).join(", ")}`
					: "Disabled movement",
			);
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
		// Must be answered: Escape does nothing
		const showRisk = () => showModal(riskModal);
		const hideRisk = () => hideModal(riskModal);

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
			hideModal($("#fwWarningModal"));
		});
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
				COMMANDS.QUERY_DEVICE_PARAMS,
				COMMANDS.QUERY_LIVE_MODE,
				COMMANDS.QUERY_VOLUME,
				COMMANDS.QUERY_LIVE_NAME,
				COMMANDS.QUERY_VERSION,
				COMMANDS.QUERY_CAPACITY,
				COMMANDS.QUERY_FILE_ORDER,
			];

			for (const tag of queries) {
				await this.connection.send(buildCommand(tag, "", 8));
				// Give the device a moment between queries
				this.connection.pause(100);
			}

			this.logger.log("All queries completed", LOG_CLASSES.SUCCESS);
		});

		// Raw command send button
		$("#btnSendRaw")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}
			const tag = $("#tag")?.value || COMMANDS.QUERY_DEVICE_PARAMS;
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

			const pin = this.state.device.pinCode || "0000";
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
			const btName = deviceName || this.state.device.liveName || "";
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

		const nameLengthHex = intToHex(btName.length, 1);

		// BT name as ASCII bytes
		const nameBytes = new TextEncoder().encode(btName);
		const nameHex = bytesToHex(nameBytes);

		const payload = pinHex + wifiHex + nameLengthHex + nameHex;

		await this.connection.send(
			buildCommand(COMMANDS.SET_PIN_AND_NAME, payload, 8),
		);
		this.logger.log(`Set PIN to ${pin} with BT name "${btName}"`);

		// Query device params to get the updated name and PIN back from the device
		await this.connection.send(buildCommand(COMMANDS.QUERY_LIVE_NAME, "", 8));
		await this.connection.send(
			buildCommand(COMMANDS.QUERY_DEVICE_PARAMS, "", 8),
		);
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
				buildCommand(COMMANDS.SET_VOLUME, intToHex(v, 1), 8),
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

	/** The active device profile */
	get profile() {
		return (
			DEVICE_PROFILES[this.state.deviceType] ||
			DEVICE_PROFILES[DEVICE_TYPES.SKELLY]
		);
	}

	/** Light channel numbers of the active profile */
	get liveChannels() {
		return this.profile.lights.map((light) => light.channel);
	}

	/**
	 * Build the live light controls, one group per light of the profile
	 * (head light above torso light, as before), and bind them.
	 * @param {Object} profile - DEVICE_PROFILES entry
	 */
	buildLiveLights(profile) {
		const container = $("#liveLights");
		if (!container) return;
		this.liveColorCycle = {};
		const modeOptions = profile.lightModes
			.map(
				(label, i) => `<option value="${i + 1}">${escapeHtml(label)}</option>`,
			)
			.join("");
		const lights = displayedLights(profile).map(({ label, channel }) => ({
			label,
			ch: channel,
		}));
		container.innerHTML = lights
			.map(
				({ label, ch }) => `
        <div class="light-group">
          <h3>${escapeHtml(label)}</h3>
          <div class="compact-row">
            <label>Brightness</label>
            <input id="light${ch}BrightnessRange" type="range" min="0" max="255" value="200" />
            <input id="light${ch}Brightness" type="number" min="0" max="255" value="200" />
          </div>
          <div class="compact-row">
            <label>Color</label>
            <input id="light${ch}ColorPick" type="color" value="#ff0000" />
            <input id="light${ch}R" type="number" min="0" max="255" value="255" />
            <input id="light${ch}G" type="number" min="0" max="255" value="0" />
            <input id="light${ch}B" type="number" min="0" max="255" value="0" />
          </div>
          <div style="display:flex; align-items:center; gap:6px; margin-top:8px;">
            <button type="button" class="iconToggle" id="btnLight${ch}ColorCycle" title="Cycle all colors" style="padding:4px;">
              <img src="images/icon_light_cycle_no.png" alt="Cycle colors" style="width:28px;height:28px" />
            </button>
            <span class="small muted">Cycle</span>
          </div>
          <div class="compact-row">
            <label>Effect</label>
            <select id="light${ch}EffectMode" aria-label="${escapeHtml(label)} effect mode">${modeOptions}</select>
          </div>
          <div id="light${ch}EffectSpeedBlock" class="compact-row hidden">
            <label>Speed</label>
            <input id="light${ch}EffectSpeedRange" type="range" min="0" max="10" value="0" />
            <input id="light${ch}EffectSpeed" type="number" min="0" max="10" value="0" />
          </div>
        </div>`,
			)
			.join("");
		for (const { label, ch } of lights) this.bindLiveLight(ch, label);
		// Show what the device last reported, if anything
		for (const { ch } of lights) {
			const reported = this.state.live.lights?.[ch];
			if (reported) this.showLiveLight(ch, reported);
		}
	}

	/**
	 * Bind one live light group's controls: each change goes to the device
	 * at once (cluster 0, no file name = live).
	 * @param {number} channel - Light channel
	 * @param {string} label - Light name for the log
	 */
	bindLiveLight(channel, label) {
		const el = (field) => $(`#light${channel}${field}`);
		const canSend = () =>
			this.connection.isConnected() && !this.sendLiveLightsInScene();

		const sendBrightness = async (brightness) => {
			if (!canSend()) return;
			await sendSetLightBrightness(this.connection, 0, "", channel, brightness);
			this.logger.log(`Set ${label} brightness to ${brightness}`);
		};
		const sendSpeed = async (uiSpeed) => {
			if (!canSend()) return;
			const deviceSpeed = uiSpeedToDevice(uiSpeed);
			await sendSetLightSpeed(this.connection, 0, "", channel, deviceSpeed);
			this.logger.log(
				`Set ${label} speed to ${uiSpeed} (device: ${deviceSpeed})`,
			);
		};
		// A color the user sets turns color cycle off; the cycle button doesn't
		const sendColor = async (stopCycle) => {
			if (!this.connection.isConnected()) return;
			if (stopCycle) this.setLiveColorCycle(channel, false);
			const { r, g, b, colorCycle } = this.readLiveColor(channel);
			await sendSetLightRgb(
				this.connection,
				0,
				"",
				channel,
				r,
				g,
				b,
				colorCycle,
			);
			this.logger.log(
				`Set ${label} color to RGB(${r}, ${g}, ${b}) with cycle ${colorCycle ? "ON" : "OFF"}`,
			);
		};

		this.bindRangeAndNumber(
			el("BrightnessRange"),
			el("Brightness"),
			255,
			sendBrightness,
		);
		this.bindRangeAndNumber(
			el("EffectSpeedRange"),
			el("EffectSpeed"),
			MAX_UI_EFFECT_SPEED,
			sendSpeed,
		);

		el("ColorPick")?.addEventListener("input", (e) => {
			const hex = e.target.value;
			el("R").value = parseInt(hex.substring(1, 3), 16);
			el("G").value = parseInt(hex.substring(3, 5), 16);
			el("B").value = parseInt(hex.substring(5, 7), 16);
			sendColor(true);
		});
		for (const field of ["R", "G", "B"]) {
			el(field)?.addEventListener("input", () => {
				const { r, g, b } = this.readLiveColor(channel);
				el("ColorPick").value = rgbToHex(r, g, b);
				sendColor(true);
			});
		}

		el("EffectMode")?.addEventListener("change", async () => {
			const mode = parseInt(el("EffectMode").value, 10);
			el("EffectSpeedBlock")?.classList.toggle("hidden", mode === 1); // Static
			if (!canSend()) return;
			await sendSetLightMode(this.connection, 0, "", channel, mode);
			const modeLabel = this.profile.lightModes[mode - 1];
			this.logger.log(`Set ${label} mode to ${mode} (${modeLabel ?? "?"})`);
		});

		$(`#btnLight${channel}ColorCycle`)?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.logger.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}
			this.setLiveColorCycle(channel, !this.liveColorCycle[channel]);
			await sendColor(false);
		});
	}

	/**
	 * A slider and its number box: each follows the other, and every change
	 * is sent (the number box clamped to 0..max).
	 */
	bindRangeAndNumber(range, number, max, send) {
		if (!range || !number) return;
		range.addEventListener("input", (e) => {
			number.value = e.target.value;
			send(parseInt(e.target.value, 10));
		});
		number.addEventListener("input", (e) => {
			const clamped = clamp(e.target.value, 0, max);
			range.value = clamped;
			send(clamped);
		});
	}

	/** Set a live light's color cycle flag and its button */
	setLiveColorCycle(channel, on) {
		this.liveColorCycle[channel] = on;
		$(`#btnLight${channel}ColorCycle`)?.classList.toggle("selected", on);
	}

	/** A live light's color and color cycle as its controls show them */
	readLiveColor(channel) {
		const value = (field) =>
			Math.round(clamp($(`#light${channel}${field}`)?.value, 0, 255));
		return {
			r: value("R"),
			g: value("G"),
			b: value("B"),
			colorCycle: this.liveColorCycle[channel] ? 1 : 0,
		};
	}

	/**
	 * A live light channel as its controls show it, in device units for F1.
	 * @param {number} channel - Light channel
	 */
	readLiveLight(channel) {
		const value = (field, max) =>
			Math.round(clamp($(`#light${channel}${field}`)?.value, 0, max));
		return {
			effectMode: parseInt($(`#light${channel}EffectMode`)?.value || "1", 10),
			brightness: value("Brightness", 255),
			...this.readLiveColor(channel),
			effectSpeed: uiSpeedToDevice(value("EffectSpeed", MAX_UI_EFFECT_SPEED)),
		};
	}

	/** Color and color cycle of the live lights, indexed by channel */
	readLiveColors() {
		const colors = [];
		for (const ch of this.liveChannels) colors[ch] = this.readLiveColor(ch);
		return colors;
	}

	/** Show colors (from readLiveColors or sceneLightColor) in the live controls */
	showLiveColors(colors) {
		colors.forEach((color, ch) => {
			if (!color) return;
			if ($(`#light${ch}R`)) $(`#light${ch}R`).value = color.r;
			if ($(`#light${ch}G`)) $(`#light${ch}G`).value = color.g;
			if ($(`#light${ch}B`)) $(`#light${ch}B`).value = color.b;
			if ($(`#light${ch}ColorPick`))
				$(`#light${ch}ColorPick`).value = rgbToHex(color.r, color.g, color.b);
			this.setLiveColorCycle(ch, color.colorCycle === 1);
		});
	}

	/**
	 * Show a live light the device reported (BBE1) in its controls.
	 * @param {number} channel - Light channel
	 * @param {Object} light - Parsed light (device units)
	 */
	showLiveLight(channel, light) {
		const set = (field, value) => {
			const input = $(`#light${channel}${field}`);
			if (input) input.value = value;
		};
		set("Brightness", light.brightness);
		set("BrightnessRange", light.brightness);
		const colors = [];
		colors[channel] = light;
		this.showLiveColors(colors);
		set("EffectMode", light.effectMode);
		$(`#light${channel}EffectSpeedBlock`)?.classList.toggle(
			"hidden",
			light.effectMode === 1,
		);
		const uiSpeed = deviceSpeedToUI(light.effectSpeed);
		set("EffectSpeed", uiSpeed);
		set("EffectSpeedRange", uiSpeed);
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
			this.showLiveColors(this.sceneColors(to));
		} else if (this.liveCustomColors) {
			this.showLiveColors(this.liveCustomColors);
			this.liveCustomColors = null;
		}
	}

	/** A scene preset's colors for the live lights, indexed by channel */
	sceneColors(scene) {
		const colors = [];
		for (const ch of this.liveChannels) colors[ch] = sceneLightColor(scene, ch);
		return colors;
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
			this.showLiveColors(this.sceneColors(scene));
		} else if (Number.isInteger(scene)) {
			this.liveCustomColors = null; // Custom: the controls show its colors
		}
	}

	/**
	 * Send every live light channel and the scene in one F1 (cluster 0).
	 * @param {number} scene - LIGHT_SCENES value
	 */
	async sendLiveLights(scene) {
		// F1 takes the lights in channel order from 0
		const lights = this.liveChannels.map((ch) => this.readLiveLight(ch));
		await this.connection.send(buildSetAllLights(lights, 0, scene));
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
		for (const ch of this.liveChannels) {
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

		// Light controls are built per profile light (buildLiveLights, from
		// applyDeviceProfile); color cycle state per channel
		this.liveColorCycle = this.liveColorCycle ?? {};
		// Custom colors kept while a scene preset shows its own (showSceneColors)
		this.liveCustomColors = null;

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

				await sendSetEyeIcon(this.connection, 0, "", this.selectedEye);
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
			this.fileManager.refreshFileList();
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
		const serialHex = intToHex(serial, 2);

		// Check if this file is currently playing
		const isPlaying =
			this.playState.playing && this.playState.serial === serial;

		// Send '01' to play, '00' to stop
		const playPauseByte = isPlaying ? "00" : "01";
		await this.connection.send(
			buildCommand(COMMANDS.PLAY_STOP_FILE, serialHex + playPauseByte, 8),
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
		this.state.updateDevice({ order: enabledSerials });
		this.state.notify("files"); // This will re-render the table with new numbers

		this.logger.log(
			`Reordered files: ${enabledSerials.length} files`,
			LOG_CLASSES.INFO,
		);
		await this.fileManager.setFileOrder(enabledSerials);
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
		this.state.updateDevice({ order: enabledSerials });
		this.state.notify("files");

		this.logger.log(
			`Updating file order: ${enabledSerials.length} files enabled`,
			LOG_CLASSES.INFO,
		);
		await this.fileManager.setFileOrder(enabledSerials);
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

		// Create eye options for the active profile's eye icons
		const eyeCount =
			DEVICE_PROFILES[this.state.deviceType]?.eyeIcons.length ?? 0;
		for (let imgIdx = 1; imgIdx <= eyeCount; imgIdx++) {
			const eyeNum = imgIdx;
			const div = document.createElement("div");
			div.className = `eye-opt${eyeNum === this.selectedEye ? " selected" : ""}`;
			div.dataset.eye = String(eyeNum);
			div.title = eyeIconLabel(this.state.deviceType, eyeNum);

			// Create image element
			const img = document.createElement("img");
			img.className = "eye-thumb";
			img.src = getEyeIconPath(this.state.deviceType, imgIdx);
			img.alt = div.title;

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
			this.shownLiveName = null;
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
		if ($("#statBtName")) $("#statBtName").textContent = device.liveName || "—";

		// Show warning if the detected firmware version hasn't been tested with this app
		if (device.version && device.version !== this._warnedFwVersion) {
			this._warnedFwVersion = device.version;
			if (!isTestedFirmware(this.state.deviceType, device.version)) {
				const el = $("#fwWarningVersion");
				if (el) el.textContent = `${device.version} (${this.state.deviceType})`;
				const modal = $("#fwWarningModal");
				showModal(modal, () => hideModal(modal));
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
				device.capacityKb != null ? `${device.capacityKb} KB remaining` : "—";
		}

		if ($("#statFileCount")) {
			const reported = device.fileCount ?? "—";
			const received = device.filesReceived ?? "—";
			const mismatch =
				device.fileCount != null &&
				device.filesReceived != null &&
				device.fileCount !== device.filesReceived;

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
			$("#statOrder").textContent = device.order
				? JSON.stringify(device.order)
				: "—";
		}

		if ($("#statPin")) {
			$("#statPin").textContent = device.pinCode || "—";
		}

		// Fill the PIN and name inputs only when the device reports a new
		// value, so other device updates don't overwrite what is being typed
		if ($("#pinInput") && device.pinCode && device.pinCode !== this.shownPin) {
			$("#pinInput").value = device.pinCode;
			this.shownPin = device.pinCode;
		}

		// Device name without the "(Live)" suffix
		if (
			$("#deviceNameInput") &&
			device.liveName &&
			device.liveName !== this.shownLiveName
		) {
			const displayName = device.liveName.replace(/\s*\(Live\)\s*$/i, "");
			$("#deviceNameInput").value = displayName;
			this.shownLiveName = device.liveName;
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
		if (live.eyeIcon != null) {
			this.selectedEye = live.eyeIcon;
			const apEyeGrid = $("#apEyeGrid");
			if (apEyeGrid) {
				// Clear all selections
				apEyeGrid.querySelectorAll(".eye-opt").forEach((el) => {
					el.classList.remove("selected");
				});
				// Select the current eye
				const eyeOpt = apEyeGrid.querySelector(`[data-eye="${live.eyeIcon}"]`);
				if (eyeOpt) eyeOpt.classList.add("selected");
			}
		}

		// Light settings, for the profile's lights
		if (Array.isArray(live.lights)) {
			for (const ch of this.liveChannels) {
				if (live.lights[ch]) this.showLiveLight(ch, live.lights[ch]);
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

		// Play order from device state (serials, first to last)
		const fileOrder = this.state.device.order ?? [];

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
			const eyeImgIdx = file.eyeIcon || 0;
			const eyeImgPath = getEyeIconPath(this.state.deviceType, eyeImgIdx);
			const eyeLabel = escapeHtml(
				eyeIconLabel(this.state.deviceType, eyeImgIdx),
			);

			// One color dot (or the cycle icon) per light, as in the header
			const lightCellsHtml = displayedLights(this.profile)
				.map(({ channel }) => {
					const light = file.lights?.[channel];
					return `<td>${light ? lightSwatchHtml(light) : ""}</td>`;
				})
				.join("");

			// Generate movement icons based on action bitfield using current profile
			let movementIcons = "";
			const actionBits = file.action || 0;
			const profile = this.profile;
			if (actionBits === 255) {
				const allMove = profile.movements.find((m) => m.part === "all");
				if (allMove) {
					movementIcons = `<img class="eye-thumb" src="${movementIconPath(profile, "all")}" alt="All" title="All movements" />`;
				}
			} else {
				profile.movements
					.filter((m) => m.part !== "all")
					.forEach((m) => {
						if (actionBits & m.bit) {
							movementIcons += `<img class="eye-thumb" src="${movementIconPath(profile, m.part)}" alt="${m.label}" title="${m.label}" />`;
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
        ${lightCellsHtml}
        <td>${movementIcons}</td>
        <td class="col-eye">${eyeImgIdx ? `${eyeImgPath ? `<img class="eye-thumb" src="${eyeImgPath}" alt="${eyeLabel}" title="${eyeLabel}" />` : ""}${eyeImgIdx}` : "—"}</td>
        <td class="detail-column">${file.serial}</td>
        <td class="detail-column">${file.dbPos}</td>
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
