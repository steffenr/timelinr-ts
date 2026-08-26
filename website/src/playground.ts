import { createTimeline } from './createTimeline.js';
import { TIMELINE } from './data/timeline-content.js';

/**
 * Playground: ONE real <timelinr-slider>, driven entirely through its public
 * attribute contract. The element rebuilds in place on attribute changes and
 * carries the current index across, so no recreation code is needed here.
 */
export function initPlayground(mount: HTMLElement, controls: HTMLFormElement): void {
  const timeline = createTimeline(TIMELINE, {
    variant: 'rail',
    arrowKeys: true,
    prevNext: true,
    label: 'Playground timeline',
  });
  mount.append(timeline);

  controls.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    switch (input.name) {
      case 'variant':
        if (input.checked) {
          timeline.dataset.timelinrVariant = input.value;
          const isList = input.value === 'list' || input.value === 'list-alternating';
          timeline.querySelectorAll('[data-timelinr-dates] a').forEach((a, i) => {
            a.querySelector('svg')?.remove();
            if (isList && i < TIMELINE.length) {
              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
              svg.setAttribute('viewBox', '0 0 24 24');
              svg.setAttribute('fill', 'none');
              svg.setAttribute('stroke', 'currentColor');
              svg.setAttribute('stroke-width', '2');
              svg.setAttribute('stroke-linecap', 'round');
              svg.setAttribute('stroke-linejoin', 'round');
              svg.innerHTML = TIMELINE[i]!.icon;
              a.prepend(svg);
            }
          });
        }
        break;
      case 'theme':
        if (input.checked) {
          if (input.value === 'default') delete timeline.dataset.timelinrTheme;
          else timeline.dataset.timelinrTheme = input.value;
        }
        break;
      case 'autoplay':
        timeline.dataset.timelinrAutoplay = String(input.checked);
        break;
    }
  });
}
