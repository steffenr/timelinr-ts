import { Timelinr, autoInit } from '../../src';

const root = document.getElementById('timeline')!;
new Timelinr(root, {
  autoPlay: true,
  autoPlayPause: 2000,
  autoPlayDirection: 'forward',
});

document.getElementById('theme')!.addEventListener('change', (ev) => {
  const value = (ev.target as HTMLSelectElement).value;
  if (value) root.setAttribute('data-timelinr-theme', value);
  else root.removeAttribute('data-timelinr-theme');
});

// autoInit() is the zero-config alternative:
void autoInit();
