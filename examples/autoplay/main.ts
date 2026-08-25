import '../../src/element';

const slider = document.querySelector('timelinr-slider')!;

document.getElementById('theme')!.addEventListener('change', (ev) => {
  const value = (ev.target as HTMLSelectElement).value;
  if (value) slider.setAttribute('data-timelinr-theme', value);
  else slider.removeAttribute('data-timelinr-theme');
});
