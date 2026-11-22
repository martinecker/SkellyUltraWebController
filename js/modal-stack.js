/**
 * Modal stack: the open dialogs, last opened on top.
 *
 * One document keydown listener sends Escape to the top dialog only, so a
 * dialog opened over another (overwrite over transfer, transfer over edit)
 * no longer depends on listener order or checks of the other dialogs.
 */

/** Open dialogs, bottom first: { el, onEscape } */
const openModals = [];
let listening = false;

/**
 * Show a dialog on top of the others.
 * @param {HTMLElement|null} el - The .modal element
 * @param {Function|null} onEscape - Called on Escape while this dialog is on
 *   top; null: Escape does nothing (and doesn't reach dialogs below)
 */
export function showModal(el, onEscape = null) {
	if (!el) return;
	removeEntry(el);
	openModals.push({ el, onEscape });
	el.classList.remove("hidden");
	if (!listening && typeof document !== "undefined") {
		document.addEventListener("keydown", handleModalKey);
		listening = true;
	}
}

/**
 * Hide a dialog and take it off the stack.
 * @param {HTMLElement|null} el - The .modal element
 */
export function hideModal(el) {
	if (!el) return;
	removeEntry(el);
	el.classList.add("hidden");
}

/** The top open dialog, or null */
export function topModal() {
	dropHidden();
	return openModals.at(-1)?.el ?? null;
}

/**
 * Document keydown handler: Escape goes to the top dialog.
 * @param {KeyboardEvent} e
 */
export function handleModalKey(e) {
	if (e.key !== "Escape") return;
	dropHidden();
	const top = openModals.at(-1);
	if (!top) return;
	e.preventDefault();
	top.onEscape?.();
}

function removeEntry(el) {
	const i = openModals.findIndex((m) => m.el === el);
	if (i >= 0) openModals.splice(i, 1);
}

// A dialog hidden without hideModal (e.g. by other code) leaves the stack
function dropHidden() {
	for (let i = openModals.length - 1; i >= 0; i--) {
		if (openModals[i].el.classList.contains("hidden")) openModals.splice(i, 1);
	}
}
