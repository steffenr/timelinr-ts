import { TIMELINE, type TimelineVariant } from './data/timeline-content.js';

/**
 * The playground's live configuration, as far as it is visible in markup.
 * `theme: 'default'` means "no data-timelinr-theme attribute at all".
 */
export interface SnippetState {
  variant: TimelineVariant;
  theme: string;
  autoplay: boolean;
}

/** How many entries the snippet spells out before the `…` marker. */
const SHOWN = 2;

const HEAD = `<link rel="stylesheet" href="node_modules/timelinr-ts/dist/timelinr.css" />
<script type="module" src="node_modules/timelinr-ts/dist/timelinr.element.js"></script>`;

/** The icon is only rendered — and only meaningful — in the list variants. */
const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><!-- icon path --></svg>';

/**
 * Renders the consumer markup for the timeline the playground is currently
 * showing. Content is abbreviated to the first entries so the snippet stays
 * readable; the attributes are exactly the ones the live element carries.
 */
export function buildSnippet(state: SnippetState): string {
  const attributes = [`data-timelinr-variant="${state.variant}"`];
  if (state.theme !== 'default') attributes.push(`data-timelinr-theme="${state.theme}"`);
  if (state.autoplay) attributes.push('data-timelinr-autoplay="true"');
  attributes.push('data-timelinr-arrow-keys');
  // `stack` is sized by --tl-height (default 70vh); the playground pins it,
  // so the snippet has to carry the same value to look like what is shown.
  if (state.variant === 'stack') attributes.push('style="--tl-height: 26rem"');

  const withIcons = state.variant === 'list' || state.variant === 'list-alternating';
  const entries = TIMELINE.slice(0, SHOWN);

  const dates = entries.map(
    (entry) => `      <li><a href="#${entry.year}">${withIcons ? ICON : ''}${entry.year}</a></li>`,
  );

  const issues = entries.map(
    (entry) => `      <li>
        <img src="${entry.image}" alt="${entry.alt}" />
        <h3>${entry.year} — ${entry.title}</h3>
        <p>${entry.text}</p>
      </li>`,
  );

  return `${HEAD}

<timelinr-slider
  ${attributes.join('\n  ')}>

  <div data-timelinr-dates>
    <ul>
${dates.join('\n')}
      <!-- … -->
    </ul>
  </div>

  <div data-timelinr-issues>
    <ul>
${issues.join('\n')}
      <!-- … -->
    </ul>
  </div>

  <button type="button" data-timelinr-prev
    aria-label="Previous">&#8249;</button>
  <button type="button" data-timelinr-next
    aria-label="Next">&#8250;</button>
</timelinr-slider>`;
}
