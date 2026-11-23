/**
 * Main Application Entry Point
 * Orchestrates all modules and initializes the application
 */

import { ConnectDialog } from "./js/connect-dialog.js";
import { ConnectionManager } from "./js/connection-manager.js";
import {
	DEVICE_PROFILES,
	displayedLights,
	knownDeviceType,
	LOG_CLASSES,
	movementIconPath,
	STORAGE_KEYS,
} from "./js/constants.js";
import { DevicePanel } from "./js/device-panel.js";
import { $ } from "./js/dom.js";
import { EditModalManager } from "./js/edit-modal.js";
import { AudioConverter, FileManager } from "./js/file-manager.js";
import { FileTable } from "./js/file-table.js";
import { LiveControls } from "./js/live-controls.js";
import { hideModal, showModal } from "./js/modal-stack.js";
import { ProtocolParser } from "./js/protocol-parser.js";
import { StateManager } from "./js/state-manager.js";
import { TransferModalManager } from "./js/transfer-modal.js";

// Lines the log keeps; older ones are dropped
const MAX_LOG_LINES = 5000;

/**
 * Simple Logger
 *
 * Each line gets the class of its kind ("normal", "warn", "tx" or "rx").
 * The log filter hides kinds with classes on the log element (see
 * applyLogFilter), so adding a line costs the same however long the log is.
 */
class Logger {
	constructor(logElement, autoscrollElement) {
		this.logElement = logElement;
		this.autoscrollElement = autoscrollElement;
		this.scrollPending = false;
	}

	log(message, className = LOG_CLASSES.NORMAL) {
		if (!this.logElement) return;
		const div = document.createElement("div");
		div.className = `line ${className || "normal"}`;
		const time = new Date().toLocaleTimeString();
		div.textContent = `[${time}] ${message}`;
		this.logElement.appendChild(div);

		while (this.logElement.childElementCount > MAX_LOG_LINES) {
			this.logElement.firstElementChild.remove();
		}

		// Auto-scroll if enabled, once per frame however many lines came
		if (
			(!this.autoscrollElement || this.autoscrollElement.checked) &&
			!this.scrollPending
		) {
			this.scrollPending = true;
			requestAnimationFrame(() => {
				this.scrollPending = false;
				this.logElement.scrollTop = this.logElement.scrollHeight;
			});
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

			// Device panel (status, info, queries, PIN/name, volume)
			this.devicePanel = new DevicePanel({
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
		this.connectDialog.initialize();
		this.initializeDeviceTypeControl();
		this.initializeAdvancedMenu();
		this.initializeLogFilter();
		this.devicePanel.initialize();
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
	 * Apply the log filter: a hide-<kind> class on the log for each kind
	 * that is unchecked (the CSS hides those lines, new ones included)
	 */
	applyLogFilter() {
		const logEl = $("#log");
		if (!logEl) return;
		const filters = {
			normal: $("#logFilterNormal"),
			warn: $("#logFilterWarning"),
			tx: $("#logFilterTx"),
			rx: $("#logFilterRx"),
		};
		for (const [kind, checkbox] of Object.entries(filters)) {
			logEl.classList.toggle(
				`hide-${kind}`,
				checkbox ? !checkbox.checked : false,
			);
		}
	}

	/**
	 * Save log contents to file
	 */
	saveLog() {
		const logEl = $("#log");
		if (!logEl) return;

		// The lines the filter shows
		const lines = logEl.querySelectorAll(".line");
		const logContent = Array.from(lines)
			.filter((line) => getComputedStyle(line).display !== "none")
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
	 * Show a device state update
	 */
	updateDeviceUI(device) {
		// The firmware version decides whether scenes exist
		this.live.updateForDevice(device);
		this.devicePanel.update(device);
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
