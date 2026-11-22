/**
 * Main Application Entry Point
 * Orchestrates all modules and initializes the application
 */

import { ConnectDialog } from "./js/connect-dialog.js";
import { ConnectionManager, ConnectionType } from "./js/connection-manager.js";
import {
	COMMANDS,
	DEVICE_PROFILES,
	displayedLights,
	isTestedFirmware,
	knownDeviceType,
	LOG_CLASSES,
	movementIconPath,
	STORAGE_KEYS,
} from "./js/constants.js";
import { $ } from "./js/dom.js";
import { EditModalManager } from "./js/edit-modal.js";
import { AudioConverter, FileManager } from "./js/file-manager.js";
import { FileTable } from "./js/file-table.js";
import { LiveControls } from "./js/live-controls.js";
import { hideModal, showModal } from "./js/modal-stack.js";
import { buildCommand, bytesToHex, clamp, intToHex } from "./js/protocol.js";
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

			// Files table
			this.fileTable = new FileTable({
				connection: this.connection,
				state: this.state,
				fileManager: this.fileManager,
				log: this.logger.log.bind(this.logger),
				openEdit: (item) => this.editModal.open(item),
				openAdd: () => this.transferModal.open("add"),
			});

			// Initialize protocol parser with callbacks
			this.parser = new ProtocolParser(
				this.state,
				this.fileManager,
				this.logger.log.bind(this.logger),
				(serial, playing, duration) =>
					this.fileTable.playStateChanged(serial, playing, duration),
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

			// Live mode controls
			this.live = new LiveControls({
				connection: this.connection,
				state: this.state,
				log: this.logger.log.bind(this.logger),
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
			this.fileTable.render();
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
			this.live.update(live);
		});

		// File list changes
		this.state.subscribe("files", () => {
			this.fileTable.render();
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
		this.fileTable.initialize();
		this.live.initialize();

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
		this.live.bindMovementGrid("liveMove");
		// Re-bind edit modal movement handlers
		this.editModal?.initializeMovementControls();

		// Rebuild eye grids (icon count and images vary per profile)
		this.live.buildEyeGrid();
		this.editModal?.buildEyeGrid();

		// Show/hide eye sections
		const hasEyeImage = profile.hasEyeImage;
		for (const id of ["liveEyeSection", "editEyeSection"]) {
			const el = $(`#${id}`);
			if (el) el.style.display = hasEyeImage ? "" : "none";
		}

		// Live light controls, one group per light
		this.live.buildLights(profile);

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
		this.fileTable.render();

		// Scenes depend on the device type too
		this.live.updateScenePicker();
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
	 * Update device UI
	 */
	updateDeviceUI(device) {
		if (!device.connected) {
			this.shownPin = null;
			this.shownLiveName = null;
		}
		this.live.updateForDevice(device);

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
