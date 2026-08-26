function flash(button: HTMLButtonElement, label: string): void {
  const original = button.textContent;
  button.textContent = label;
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = original;
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
        () => flash(button, 'Copied!'),
        () => flash(button, 'Copy failed'),
      );
    });
  }
}
