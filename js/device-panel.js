/**
 * Device panel: connection status, device info, queries, raw commands, PIN
 * and name, volume, classic Bluetooth, and the untested firmware warning
 */

import { ConnectionType } from "./connection-manager.js";
import { COMMANDS, isTestedFirmware, LOG_CLASSES } from "./constants.js";
import { $, trySend } from "./dom.js";
import { hideModal, showModal } from "./modal-stack.js";
import {
	buildCommand,
	bytesToHex,
	intToHex,
	parseNumberInput,
} from "./protocol.js";

export class DevicePanel {
	/**
	 * @param {Object} options
	 * @param {ConnectionManager} options.connection
	 * @param {StateManager} options.state
	 * @param {Function} options.log - log(message, className)
	 */
	constructor({ connection, state, log }) {
		this.connection = connection;
		this.state = state;
		this.log = log;
		// PIN and name last put into the inputs (see update)
		this.shownPin = null;
		this.shownLiveName = null;
		// Firmware version the untested-firmware warning was shown for
		this._warnedFwVersion = null;
	}

	/**
	 * Wire the query, raw command, PIN/name, volume and classic Bluetooth
	 * controls (call once)
	 */
	initialize() {
		this.initializeFirmwareWarningModal();
		this.initializeQueryButtons();
		this.initializeMediaControls();
	}

	/** The untested firmware warning's OK button */
	initializeFirmwareWarningModal() {
		$("#fwWarningOk")?.addEventListener("click", () => {
			hideModal($("#fwWarningModal"));
		});
	}

	/**
	 * Initialize query buttons
	 */
	initializeQueryButtons() {
		document.querySelectorAll("[data-q]").forEach((btn) => {
			btn.addEventListener("click", async () => {
				if (!this.connection.isConnected()) {
					this.log("Not connected", LOG_CLASSES.WARNING);
					return;
				}
				const tag = btn.getAttribute("data-q");
				await trySend(this.log, `Query ${tag}`, () =>
					this.connection.send(buildCommand(tag, "", 8)),
				);
			});
		});

		// Get All button - executes all query commands in sequence
		$("#btnGetAll")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			this.log("Executing all queries...", LOG_CLASSES.INFO);
			const queries = [
				COMMANDS.QUERY_DEVICE_PARAMS,
				COMMANDS.QUERY_LIVE_MODE,
				COMMANDS.QUERY_VOLUME,
				COMMANDS.QUERY_LIVE_NAME,
				COMMANDS.QUERY_VERSION,
				COMMANDS.QUERY_CAPACITY,
				COMMANDS.QUERY_FILE_ORDER,
			];

			const sent = await trySend(this.log, "Get All", async () => {
				for (const tag of queries) {
					await this.connection.send(buildCommand(tag, "", 8));
					// Give the device a moment between queries
					this.connection.pause(100);
				}
			});
			if (sent) this.log("All queries completed", LOG_CLASSES.SUCCESS);
		});

		// Raw command send button
		$("#btnSendRaw")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}
			const tag = $("#tag")?.value || COMMANDS.QUERY_DEVICE_PARAMS;
			const payload = $("#payload")?.value || "";
			await trySend(this.log, "Raw command", async () => {
				await this.connection.send(buildCommand(tag, payload, 8));
				this.log(
					`Sent raw command: ${tag} with payload: ${payload || "(empty)"}`,
				);
			});
		});

		// Set Device Name button
		$("#btnSetDeviceName")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const deviceNameInput = $("#deviceNameInput");
			const deviceName = deviceNameInput?.value || "";

			// Validate device name: must not be empty and max 22 chars
			if (!deviceName || deviceName.trim().length === 0) {
				this.log("Device name cannot be empty", LOG_CLASSES.WARNING);
				return;
			}

			if (deviceName.length > 22) {
				this.log(
					"Device name cannot exceed 22 characters",
					LOG_CLASSES.WARNING,
				);
				return;
			}

			const pin = this.state.device.pinCode || "0000";
			await trySend(this.log, "Set name", () =>
				this.setPinAndName(pin, deviceName),
			);
		});

		// Set PIN button
		$("#btnSetPin")?.addEventListener("click", async () => {
			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const pinInput = $("#pinInput");
			const pin = pinInput?.value || "";

			// Validate PIN: must be exactly 4 digits
			if (!/^\d{4}$/.test(pin)) {
				this.log("PIN must be exactly 4 digits", LOG_CLASSES.WARNING);
				return;
			}

			const deviceNameInput = $("#deviceNameInput");
			const deviceName = deviceNameInput?.value || "";

			// Use current device name if available, otherwise use entered name or default to btName
			const btName = deviceName || this.state.device.liveName || "";
			if (!btName) {
				this.log(
					"Device name not available. Enter a device name first.",
					LOG_CLASSES.WARNING,
				);
				return;
			}

			await trySend(this.log, "Set PIN", () => this.setPinAndName(pin, btName));
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
		this.log(`Set PIN to ${pin} with BT name "${btName}"`);

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

		// A drag sends many values; only the latest one still waiting goes out
		const sendVolumeCommand = async (volume) => {
			if (volume === null || !this.connection.isConnected()) {
				return;
			}
			await trySend(this.log, "Set volume", async () => {
				await this.connection.sendLatest(
					"volume",
					buildCommand(COMMANDS.SET_VOLUME, intToHex(volume, 1), 8),
				);
				this.log(`Set volume to ${volume}`);
			});
		};

		if (volRange && volNum) {
			volRange.addEventListener("input", (e) => {
				volNum.value = e.target.value;
				sendVolumeCommand(parseNumberInput(e.target.value, 0, 100));
			});
			volNum.addEventListener("input", (e) => {
				const volume = parseNumberInput(e.target.value, 0, 100);
				if (volume !== null) volRange.value = volume;
				sendVolumeCommand(volume);
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
			this.log("Not connected", LOG_CLASSES.WARNING);
			return;
		}
		await trySend(this.log, `Command ${tag}`, () =>
			this.connection.send(buildCommand(tag, payload, 8)),
		);
	}

	/**
	 * Show the device state: connection status, info, volume, PIN and name,
	 * and the untested firmware warning
	 */
	update(device) {
		if (!device.connected) {
			this.shownPin = null;
			this.shownLiveName = null;
		}

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
