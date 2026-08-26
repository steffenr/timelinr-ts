import type { TimelineEntry, TimelineVariant } from './data/timeline-content.js';

export interface TimelineOptions {
  variant?: TimelineVariant;
  theme?: string;
  startAt?: number;
  arrowKeys?: boolean;
  autoplay?: boolean;
  autoplayPause?: number;
  autoplayDirection?: 'forward' | 'backward';
  /** Render prev/next buttons (carousel variants). */
  prevNext?: boolean;
  /** Render the inline SVG icon inside each date link (list variants). */
  icons?: boolean;
  /** Accessible name for the region. */
  label?: string;
}

/**
 * Builds the consumer markup for one real <timelinr-slider> from the shared
 * dataset. The timeline CONTENT is application data, so generating it here is
 * ordinary app code — the helper never reproduces library behaviour; the
 * element that comes back is the library's own.
 */
export function createTimeline(data: TimelineEntry[], opts: TimelineOptions = {}): HTMLElement {
  const root = document.createElement('timelinr-slider');
  if (opts.variant) root.dataset.timelinrVariant = opts.variant;
  if (opts.theme) root.dataset.timelinrTheme = opts.theme;
  if (opts.startAt !== undefined) root.dataset.timelinrStartAt = String(opts.startAt);
  if (opts.arrowKeys) root.dataset.timelinrArrowKeys = '';
  if (opts.autoplay !== undefined) root.dataset.timelinrAutoplay = String(opts.autoplay);
  if (opts.autoplayPause !== undefined) root.dataset.timelinrAutoplayPause = String(opts.autoplayPause);
  if (opts.autoplayDirection) root.dataset.timelinrAutoplayDirection = opts.autoplayDirection;
  if (opts.label) root.setAttribute('aria-label', opts.label);

  const dates = document.createElement('div');
  dates.dataset.timelinrDates = '';
  const datesList = document.createElement('ul');
  for (const entry of data) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${entry.year}`;
    if (opts.icons) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.innerHTML = entry.icon;
      a.append(svg);
    }
    a.append(entry.year);
    li.append(a);
    datesList.append(li);
  }
  dates.append(datesList);

  const issues = document.createElement('div');
  issues.dataset.timelinrIssues = '';
  const issuesList = document.createElement('ul');
  for (const entry of data) {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.src = entry.image;
    img.alt = entry.alt;
    img.loading = 'lazy';
    const h3 = document.createElement('h3');
    h3.textContent = `${entry.year} — ${entry.title}`;
    const p = document.createElement('p');
    p.textContent = entry.text;
    li.append(img, h3, p);
    issuesList.append(li);
  }
  issues.append(issuesList);

  root.append(dates, issues);

  if (opts.prevNext) {
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.dataset.timelinrPrev = '';
    prev.setAttribute('aria-label', 'Previous');
    prev.textContent = '\u2039';
    const next = document.createElement('button');
    next.type = 'button';
    next.dataset.timelinrNext = '';
    next.setAttribute('aria-label', 'Next');
    next.textContent = '\u203A';
    root.append(prev, next);
  }

  return root;
}
