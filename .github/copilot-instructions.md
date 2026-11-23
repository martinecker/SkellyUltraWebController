# Skelly Ultra Web Controller — Copilot Instructions

## Build

```bat
build-bundle.bat        # Windows — runs bundle.py via python3
python3 bundle.py       # Cross-platform
```

The bundler concatenates all ES6 modules (in dependency order) into `app-bundled.js`, which works over `file://`. `python3 bundle.py --check` tells whether the bundle is up to date.

## Tests and lint

```sh
npm ci                  # dev tools (Biome)
npm test                # unit tests in tests/*.test.js (node:test)
npm run check           # Biome lint + format check
```

## Architecture

This is a **vanilla JS, no-framework** web app. npm is only used for dev tools and tests; the app itself has no dependencies. Two entry points:

- **`app-modular.js`** — ES6 `type="module"` entry point. Requires an HTTP server (not `file://`). This is the source of truth.
- **`app-bundled.js`** — Auto-generated single-file bundle. **Never edit directly.** Regenerate by running `bundle.py` after changing source files.

`index.html` switches between the two via the `<script>` tag at the bottom (either `type="module" src="app-modular.js"` or a plain `src="app-bundled.js"`).

### Module dependency order (as bundled)

```
js/constants.js → js/protocol.js → js/dom.js → js/modal-stack.js
→ js/device-settings.js → js/state-manager.js → js/ble-manager.js
→ js/rest-proxy.js → js/connection-manager.js → js/file-manager.js
→ js/protocol-parser.js → js/edit-modal.js → js/transfer-modal.js
→ js/elevenlabs.js → js/connect-dialog.js → js/live-controls.js
→ js/file-table.js → js/device-panel.js → app-modular.js
```

The list lives in `bundle.py`; add a new module there. The bundle puts all modules in one scope, so `bundle.py` (and `--check`) fails when two modules declare the same top-level name, even a private helper.

### UI modules

`app-modular.js` (`SkellyApp`) creates the managers and wires them together; each UI part is a class in its own module, created with the connection, state and a `log` function plus callbacks for what it needs from the app:

- `ConnectDialog` (`js/connect-dialog.js`, `app.connectDialog`) — connect dialog, REST device selection, connect sequence (type detection, first queries, file list)
- `LiveControls` (`js/live-controls.js`, `app.live`) — live movements, eye, lights and scene picker; `update(live)` shows what the device reports
- `FileTable` (`js/file-table.js`, `app.fileTable`) — files table (`render()`), play/stop, enable checkboxes, drag and drop, play countdown
- `DevicePanel` (`js/device-panel.js`, `app.devicePanel`) — status, device info, queries, raw command, PIN/name, volume, untested firmware warning
- `EditModalManager` (`js/edit-modal.js`) and `TransferModalManager` (`js/transfer-modal.js`) — the edit and add/replace file dialogs

`SkellyApp` itself keeps the device type control and `applyDeviceProfile`, the risk dialog, the Advanced menu and the log.

### Connection abstraction

`ConnectionManager` (`js/connection-manager.js`) wraps two backends behind a single interface:
- **Direct BLE** — uses the Web Bluetooth API (`js/ble-manager.js`)
- **REST Proxy** — forwards BLE via an HTTP server (`js/rest-proxy.js`)

Call `connectionManager.send(bytes)`, `onNotification(handler)`, and `waitForResponse(prefix, ms)` without knowing which backend is active. Writes go through one queue in order; `pause(ms)` queues a gap between writes (use it instead of `sleep` for pacing).

### State

`StateManager` (`js/state-manager.js`) is the single source of truth. It uses an observer pattern:
- Mutate state via its methods (e.g. `updateDevice()`, `startTransfer()`)
- Each mutation calls `this.notify(key)`, which fires all subscribed callbacks for that key
- Subscribe with `state.subscribe('device', callback)` — returns an unsubscribe function

State keys: `device`, `live`, `files`, `transfer`, `deviceType`, and `fileArrived` (one file of a refresh came in; `waitForFiles(check, timeoutMs)` waits on it).

## Device Profiles

All per-device differences are captured in `DEVICE_PROFILES` in `js/constants.js`, keyed by `DEVICE_TYPES` (`'skelly'`, `'skelly12ft'`, `'lily'`, `'santa'`). Each profile has:

- `bleNames` — BLE advertisement names (first is the default), used as scan filters; `nameMatches` — lowercase substrings for type detection (`deviceTypeFromName`)
- `displayName` — name shown in the UI
- `imageFolder` — folder under `images/` with the movement icons (`movementIconPath(profile, part)`) and eye icons (`getEyeIconPath`)
- `eyeIcons` — eye icon names in device order (eye 1 first); the list length is the icon count (`eyeIconLabel` for tooltips)
- `hasEyeImage` — whether the device has eye images (Skelly, 12ft Skelly)
- `movements` — ordered array of `{ part, label, bit }` (bit is the BLE bitfield value; `part='all'` first with `bit=255` where the device has it)
- `lights` — array of `{ label, channel }` (numeric channel); `displayedLights(profile)` gives the UI order
- `lightModes` — effect mode labels; mode value = index + 1
- `testedFirmware` — firmware versions tried with this app (others get a warning, `isTestedFirmware`)
- `capabilities` — capability → lowest firmware version that has it (`hasCapability`)

These names follow the HA integration's profile (`custom_components/skelly_ultra/const.py`), as do the `COMMANDS`/`RESPONSES` keys and the parsed field names.

### Applying a profile

Call `applyDeviceProfile(deviceType)` in `app-modular.js` whenever the device type changes (after `state.setDeviceType`). It:
1. Rebuilds the `#liveMove` and `#edMove` grids from `profile.movements` (`data-part` and `data-bit` on each button) and re-binds them (`live.bindMovementGrid('liveMove')`, `editModal.initializeMovementControls()`)
2. Rebuilds both eye grids (`live.buildEyeGrid()`, `editModal.buildEyeGrid()`) and shows/hides `#liveEyeSection` / `#editEyeSection` by `profile.hasEyeImage`
3. Builds one light group per profile light in the live panel and the edit dialog (`live.buildLights(profile)`, `editModal.buildLights(profile)`), with the profile's effect modes
4. Rebuilds the files table light columns, shows/hides the eye column, and re-renders the table
5. Updates the scene picker (scenes depend on device type and firmware)

Device type is persisted via `STORAGE_KEYS.DEVICE_TYPE`. Applied on startup and on `#deviceTypeSelect` change (post-connect override).

## Key Conventions

### BLE Protocol

All protocol work goes through `js/protocol.js` utilities:
- Commands are built with `buildCommand(tag, payloadHex, minBytes)` — appends a CRC8 checksum automatically.
- Command tags are `AA`-prefixed 4-char hex strings; response prefixes are `BB`-prefixed — all defined in `COMMANDS` and `RESPONSES` in `js/constants.js`.
- Filenames are transmitted as UTF-16 LE with the marker `5C55` (`PROTOCOL_MARKERS.FILENAME`), built via `buildFilenamePayload()`.
- Effect speed values are inverted between UI and device: use `deviceSpeedToUI()` / `uiSpeedToDevice()` from `protocol.js`.

### Constants

All magic values (UUIDs, timeouts, chunk sizes, command tags, localStorage keys) live in `js/constants.js`. Do not hardcode them elsewhere.

### UI Helpers

- `$(selector)` (`document.querySelector`) is exported from `js/dom.js`; import it, don't redefine it.
- Show and hide dialogs with `showModal(el, onEscape)` / `hideModal(el)` from `js/modal-stack.js`. One Escape listener calls `onEscape` of the top open dialog only; pass no `onEscape` for a dialog that must be answered.

### Image Assets

One folder per profile `imageFolder`, with movement icons `movement_<part>.png` and eye icons `eye_icon_<n>.png` (1-based):
- `images/skelly/` — all, head, arm, torso; `eye_icon_1.png` … `eye_icon_18.png`
- `images/skelly12ft/` — head; `eye_icon_1.png` … `eye_icon_20.png`
- `images/lily/` — all, wrist, elbow, head, eyes
- `images/santa/` — all, eyes, head, torso, arm
- `images/icon_light_cycle_no.png` — color cycle icon
