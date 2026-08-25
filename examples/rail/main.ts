import '../../src/element';

const slider = document.querySelector('timelinr-slider')!;
slider.addEventListener('timelinr:change', () => {
  document.title = `timelinr — rail (${slider.index + 1}/${slider.count})`;
});
