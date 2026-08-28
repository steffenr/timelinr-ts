type CopyState = 'copied' | 'failed';

/**
 * Signals the outcome for two seconds. Text buttons swap their label; icon
 * buttons carry all three glyphs in the markup and CSS picks one per state.
 */
function flash(button: HTMLButtonElement, state: CopyState, label: string): void {
  const isIconButton = button.querySelector('svg') !== null;
  const original = button.textContent;
  if (isIconButton) button.classList.add(`is-${state}`);
  else button.textContent = label;
  button.disabled = true;
  window.setTimeout(() => {
    if (isIconButton) button.classList.remove(`is-${state}`);
    else button.textContent = original;
    button.disabled = false;
  }, 2000);
}

/** Wire every [data-copy] button to the code block named by its value. */
export function initCopyButtons(scope: ParentNode): void {
  for (const button of scope.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    const source = scope.querySelector('#' + CSS.escape(button.dataset.copy ?? ''));
    if (!(source instanceof HTMLElement)) continue;
    button.addEventListener('click', () => {
      navigator.clipboard.writeText(source.textContent ?? '').then(
        () => flash(button, 'copied', 'Copied!'),
        () => flash(button, 'failed', 'Copy failed'),
      );
    });
  }
}
