# Skelly Ultra Web Controller — Copilot Instructions

## Build

```bat
build-bundle.bat        # Windows — runs bundle.py via python3
python3 bundle.py       # Cross-platform
```

The bundler concatenates all ES6 modules (in dependency order) into `app-bundled.js`, which works over `file://`. There are no tests or linters.

## Architecture

This is a **vanilla JS, no-framework** web app. No npm, no node_modules. Two entry points:

- **`app-modular.js`** — ES6 `type="module"` entry point. Requires an HTTP server (not `file://`). This is the source of truth.
- **`app-bundled.js`** — Auto-generated single-file bundle. **Never edit directly.** Regenerate by running `bundle.py` after changing source files.

`index.html` switches between the two via the `<script>` tag at the bottom (either `type="module" src="app-modular.js"` or a plain `src="app-bundled.js"`).

### Module dependency order (as bundled)

```
js/constants.js → js/protocol.js → js/state-manager.js → js/ble-manager.js
→ js/rest-proxy.js → js/connection-manager.js → js/file-manager.js
→ js/protocol-parser.js → js/edit-modal.js → app-modular.js
```

### Connection abstraction

`ConnectionManager` (`js/connection-manager.js`) wraps two backends behind a single interface:
- **Direct BLE** — uses the Web Bluetooth API (`js/ble-manager.js`)
- **REST Proxy** — forwards BLE via an HTTP server (`js/rest-proxy.js`)

Call `connectionManager.send(bytes)`, `onNotification(handler)`, and `waitForResponse(prefix, ms)` without knowing which backend is active.

### State

`StateManager` (`js/state-manager.js`) is the single source of truth. It uses an observer pattern:
- Mutate state via its methods (e.g. `updateDevice()`, `startTransfer()`)
- Each mutation calls `this.notify(key)`, which fires all subscribed callbacks for that key
- Subscribe with `state.subscribe('device', callback)` — returns an unsubscribe function

State keys: `device`, `live`, `files`, `transfer`, `editModal`, `deviceType`.

## Device Profiles

All per-device differences are captured in `DEVICE_PROFILES` in `js/constants.js`, keyed by `DEVICE_TYPES` (`'skelly'` / `'lily'`). Each profile has:

- `defaultBleName` — BLE advertisement name used as scan filter
- `movements` — ordered array of `{ part, label, icon, bit }` (bit is the BLE bitfield value; `part='all'` always first with `bit=255`)
- `lightModes` — array of `{ value, label }` for effect mode selects
- `lights` — array of `{ id, label, channel }` defining UI light zones (Lily has only `torso`)
- `hasEyes` — `true` for Skelly, `false` for Lily

### Applying a profile

Call `applyDeviceProfile(deviceType)` in `app-modular.js` whenever the device type changes. It:
1. Rebuilds `#liveMove` and `#edMove` grids dynamically from `profile.movements` (sets `data-part` and `data-bit` on each button)
2. Re-binds live movement click handlers via `bindMovementGrid('liveMove')`
3. Calls `editModal.initializeMovementControls()` to re-bind edit modal click handlers
4. Shows/hides `#liveEyeSection` / `#editEyeSection` based on `profile.hasEyes`
5. Shows/hides `#liveHeadLightGroup` / `#editHeadLightGroup` based on whether profile has a head light zone
6. Updates torso `<h3>` labels (`#liveTorsoLightLabel`, `#editTorsoLightLabel`) to `profile.lights.find(l=>l.id==='torso')?.label`
7. Repopulates all 4 effect mode selects from `profile.lightModes`
8. Shows/hides files table head and eye columns, updates torso column header text

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

### UI Helper

A `const $ = selector => document.querySelector(selector)` helper is defined once in `app-modular.js`. The bundler deduplicates it across modules — do not redefine it in other modules.

### Image Assets

- `images/lily/` — action icons for the Lily character (`icon_action1.png` … `icon_action5.png`)
- `images/skelly/` — action icons, eye icons, and other Skelly-specific images (`icon_action1.png` … `icon_action4.png`, `eye_icon_1.png` … `eye_icon_18.png`)
