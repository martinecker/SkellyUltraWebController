/**
 * Files table: rendering, play/stop, enable checkboxes, drag and drop
 * reordering (desktop and touch) and the play countdown
 */

import {
	COMMANDS,
	DEVICE_PROFILES,
	DEVICE_TYPES,
	displayedLights,
	eyeIconLabel,
	getEyeIconPath,
	LOG_CLASSES,
	movementIconPath,
} from "./constants.js";
import { $ } from "./dom.js";
import { buildCommand, escapeHtml, intToHex } from "./protocol.js";

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
 * The play order with a file enabled (added at the end) or disabled
 * (removed), leaving the other files where they are
 * @param {number[]} order - Enabled file serials, first to last
 * @param {number} serial - The file to change
 * @param {boolean} enabled - Whether it is to play
 * @returns {number[]|null} The new order; null if no file would be left
 *   enabled (the device needs at least one)
 */
export function setFileEnabled(order, serial, enabled) {
	const others = order.filter((s) => s !== serial);
	const changed = enabled ? [...others, serial] : others;
	return changed.length > 0 ? changed : null;
}

/**
 * The play order with one file moved onto another's place: after it when
 * moved down, before it when moved up (as a row dropped on another row)
 * @param {number[]} order - Enabled file serials, first to last
 * @param {number} serial - The file moved
 * @param {number} targetSerial - The file it was dropped on
 * @returns {number[]} The new order (unchanged if either isn't in it)
 */
export function moveFile(order, serial, targetSerial) {
	const from = order.indexOf(serial);
	const to = order.indexOf(targetSerial);
	if (from < 0 || to < 0 || from === to) return order;
	const moved = order.filter((s) => s !== serial);
	const at = moved.indexOf(targetSerial) + (from < to ? 1 : 0);
	moved.splice(at, 0, serial);
	return moved;
}

/**
 * The Stop button's text with the time left, e.g. "⏹ Stop (1:05)"
 * @param {number} seconds - Seconds left
 */
function stopButtonLabel(seconds) {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `⏹ Stop (${mins}:${secs.toString().padStart(2, "0")})`;
}

export class FileTable {
	/**
	 * @param {Object} options
	 * @param {ConnectionManager} options.connection
	 * @param {StateManager} options.state
	 * @param {FileManager} options.fileManager
	 * @param {Function} options.log - log(message, className)
	 * @param {Function} options.openEdit - Open the edit dialog for a file
	 * @param {Function} options.openAdd - Open the add file dialog
	 */
	constructor({ connection, state, fileManager, log, openEdit, openAdd }) {
		this.connection = connection;
		this.state = state;
		this.fileManager = fileManager;
		this.log = log;
		this.openEdit = openEdit;
		this.openAdd = openAdd;
		// The file the device reports playing, for the Stop button countdown
		this.playState = {
			serial: null,
			playing: false,
			duration: 0,
			startTime: null,
			timerInterval: null,
		};
	}

	/**
	 * Wire the file list buttons, table and drag and drop (call once)
	 */
	initialize() {
		this.initializeListControls();
		this.initializeTableHandlers();
		this.initializeDragAndDrop();
	}

	/**
	 * Initialize file list refresh and filter controls
	 */
	initializeListControls() {
		$("#btnRefreshFiles")?.addEventListener("click", () => {
			this.fileManager.refreshFileList();
		});

		$("#filesFilter")?.addEventListener("input", () => {
			this.render();
		});

		$("#btnAddFile")?.addEventListener("click", () => {
			this.openAdd();
		});
	}

	/**
	 * Initialize file table button and checkbox handlers
	 */
	initializeTableHandlers() {
		// Files table button handler (Play and Edit)
		$("#filesTable")?.addEventListener("click", (e) => {
			const btn = e.target.closest("button[data-action]");
			if (!btn) return;

			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				return;
			}

			const serial = parseInt(btn.dataset.serial, 10);
			const item = this.state.files.items.get(serial);
			if (!item) return;

			if (btn.dataset.action === "play" || btn.dataset.action === "stop") {
				this.playFile(serial);
			} else if (btn.dataset.action === "edit") {
				this.openEdit(item);
			}
		});

		// Files table checkbox handler (Enable/Disable)
		$("#filesTable")?.addEventListener("change", async (e) => {
			const checkbox = e.target.closest(".file-enabled-checkbox");
			if (!checkbox) return;

			if (!this.connection.isConnected()) {
				this.log("Not connected", LOG_CLASSES.WARNING);
				// Revert checkbox state
				checkbox.checked = !checkbox.checked;
				return;
			}

			await this.saveEnabledFile(
				parseInt(checkbox.dataset.serial, 10),
				checkbox,
			);
		});
	}

	/**
	 * Initialize drag and drop handlers for file reordering
	 */
	initializeDragAndDrop() {
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

			await this.moveRow(draggedRow, targetRow);
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
				await this.moveRow(draggedRow, targetRow);
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
	 * Play a file, or stop it if it is playing
	 */
	async playFile(serial) {
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
			this.log(`Stopping file #${serial}`);
		} else {
			this.log(`Playing file #${serial}`);
		}
	}

	/**
	 * Handle file drop for reordering
	 * @param {HTMLElement} draggedRow - The row being dragged
	 * @param {HTMLElement} targetRow - The row being dropped onto
	 */
	async moveRow(draggedRow, targetRow) {
		if (!this.connection.isConnected()) {
			this.log("Not connected", LOG_CLASSES.WARNING);
			return;
		}

		// From the whole play order, not the rows shown: the filter may hide
		// enabled files, and they keep their places
		const order = this.state.device.order ?? [];
		const enabledSerials = moveFile(
			order,
			parseInt(draggedRow.dataset.serial, 10),
			parseInt(targetRow.dataset.serial, 10),
		);
		if (enabledSerials === order) return;

		// Update state and device
		this.state.updateDevice({ order: enabledSerials });
		this.state.notify("files"); // This will re-render the table with new numbers

		this.log(
			`Reordered files: ${enabledSerials.length} files`,
			LOG_CLASSES.INFO,
		);
		await this.fileManager.setFileOrder(enabledSerials);
	}

	/**
	 * Enable or disable one file: an enabled file goes to the end of the
	 * play order, a disabled one leaves it; the others stay as they are
	 * (also the ones the filter hides)
	 * @param {number} serial - The file
	 * @param {HTMLInputElement} checkbox - Its checkbox (checked = enable)
	 */
	async saveEnabledFile(serial, checkbox) {
		const enabledSerials = setFileEnabled(
			this.state.device.order ?? [],
			serial,
			checkbox.checked,
		);

		if (!enabledSerials) {
			this.log("At least one file must be enabled", LOG_CLASSES.WARNING);
			checkbox.checked = true;
			return;
		}

		// Immediately update order in state to trigger UI resort
		this.state.updateDevice({ order: enabledSerials });
		this.state.notify("files");

		this.log(
			`Updating file order: ${enabledSerials.length} files enabled`,
			LOG_CLASSES.INFO,
		);
		await this.fileManager.setFileOrder(enabledSerials);
	}

	/**
	 * The device started or stopped playing a file (parser callback)
	 */
	playStateChanged(serial, playing, duration) {
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
		this.render();
	}

	/**
	 * Start countdown timer for playing file
	 */
	startPlayTimer(serial) {
		// Clear any existing timer
		this.stopPlayTimer();

		// Update timer every second
		this.playState.timerInterval = setInterval(() => {
			const remaining = this.remainingSeconds();

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

	/** Seconds left of the playing file, from its reported duration */
	remainingSeconds() {
		const elapsed = Math.floor((Date.now() - this.playState.startTime) / 1000);
		return Math.max(0, this.playState.duration - elapsed);
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
		if (btn) btn.textContent = stopButtonLabel(seconds);
	}

	/** The active device profile */
	get profile() {
		return (
			DEVICE_PROFILES[this.state.deviceType] ||
			DEVICE_PROFILES[DEVICE_TYPES.SKELLY]
		);
	}

	/**
	 * Render the files table from state (filter, play order, play state)
	 */
	render() {
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

			// Determine if this file is currently playing; its Stop button shows
			// the time left (a re-render between countdown ticks keeps it)
			const isPlaying =
				this.playState.playing && this.playState.serial === file.serial;
			const playButtonHtml = isPlaying
				? `<button class="btn sm" data-action="stop" data-serial="${file.serial}">${stopButtonLabel(this.remainingSeconds())}</button>`
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
			// All files received; the filter only changes what is shown
			const got = this.state.files.items.size;
			const expected = this.state.files.expected;
			const shown = query ? ` (showing ${files.length})` : "";
			summary.textContent = `Received ${got}${expected ? ` / ${expected}` : ""}${shown}`;
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
