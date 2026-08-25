import '../../src/element';

const slider = document.querySelector('timelinr-slider')!;

// --tl-list-max-height: none is set inline on the slider in index.html; the
// checkbox flips between that and the default windowed max-height.
document.getElementById('auto')!.addEventListener('change', (ev) => {
  const checked = (ev.target as HTMLInputElement).checked;
  if (checked) slider.style.setProperty('--tl-list-max-height', 'none');
  else slider.style.removeProperty('--tl-list-max-height');
});
