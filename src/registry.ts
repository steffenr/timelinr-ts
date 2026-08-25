/**
 * The one initialisation guard for Timelinr construction: the class
 * constructor marks roots here, `destroy()` clears them, and
 * `<timelinr-slider>`'s connectedCallback consults the set before building.
 * It lives in its own module rather than as a private in `timelinr.ts` so
 * both files consult the same set — without it, a redundant connect (or any
 * future second construction path) would stack a second instance with
 * doubled listeners and timers on one root.
 */
const initialized = new WeakSet<HTMLElement>();

export function isInitialized(root: HTMLElement): boolean {
  return initialized.has(root);
}

export function markInitialized(root: HTMLElement): void {
  initialized.add(root);
}

export function clearInitialized(root: HTMLElement): void {
  initialized.delete(root);
}
