/**
 * True when a key event comes from a control that handles Space/Enter itself
 * (text fields, buttons, links, media), so page-level hotkeys must ignore it.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return !!target.closest(
    "input, textarea, select, button, a[href], summary, video, audio, [role=button], [role=textbox], [contenteditable=true]",
  );
}

/** Space or Enter pressed with no modifiers and not auto-repeating. */
export function isActivationKey(e: KeyboardEvent): boolean {
  if (e.key !== " " && e.key !== "Enter") return false;
  return !(e.repeat || e.altKey || e.ctrlKey || e.metaKey);
}
