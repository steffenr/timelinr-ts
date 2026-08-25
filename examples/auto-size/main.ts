import { Timelinr } from '../../src';

const root = document.getElementById('timeline')!;
new Timelinr(root, { arrowKeys: true });

// --tl-list-max-height: none is set inline on the root in index.html; the
// checkbox flips between that and the default windowed max-height.
document.getElementById('auto')!.addEventListener('change', (ev) => {
  const checked = (ev.target as HTMLInputElement).checked;
  if (checked) root.style.setProperty('--tl-list-max-height', 'none');
  else root.style.removeProperty('--tl-list-max-height');
});
