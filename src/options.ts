import type { PlayDirection, TimelinrOptions } from './types';
import { defaults } from './types';

/**
 * Floor for `data-timelinr-autoplay-pause`. Attribute values frequently
 * originate in a CMS field a content editor typed into; a pathological value
 * must not be able to pin the main thread. Deliberately enforced only at the
 * markup boundary: a programmatic caller who passes `autoPlayPause: 50` made
 * a deliberate choice and gets it.
 */
const PAUSE_FLOOR = 500;

/**
 * Whole-number integers only. `Number.parseInt` would silently accept
 * `"3abc"` as 3; every other parser here warns on malformed input instead,
 * so the numeric ones match.
 */
const INT_RE = /^-?\d+$/;

/** Names an element in warnings: `<timelinr-slider#hero>` or `<timelinr-slider>`. */
function describe(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  return el.id ? `<${tag}#${el.id}>` : `<${tag}>`;
}

/**
 * Reads the scalar TimelinrOptions from an element's `data-timelinr-*`
 * attributes, so a timeline can be fully configured from markup. Handles
 * `startAt`, `arrowKeys`, `autoPlay`, `autoPlayDirection` and `autoPlayPause`;
 * `variant` and `orientation` are deliberately NOT read here — their
 * cross-derivation (either attribute alone is enough, invalid values ignored,
 * ownership-tracked write-back) is `resolveLayout()`'s job in `timelinr.ts`
 * and cannot be expressed as a plain object merge.
 *
 * Parsing rules:
 * - Booleans are presence-based with an explicit opt-out, so templating
 *   languages can emit the attribute unconditionally:
 *   bare / "" / "true" → true, "false" → false (case-insensitive),
 *   absent → key omitted.
 * - Numbers are strict base-10 integers (`/^-?\d+$/` — trailing garbage
 *   like `"3abc"` is invalid, not a leading 3); `startAt` clamps to ≥ 1
 *   (the constructor already clamps past the item count), `autoPlayPause`
 *   to ≥ ${PAUSE_FLOOR}.
 * - Anything invalid falls back to that option's default with a console.warn
 *   naming the attribute and element — never throws. These values come from
 *   CMS fields; a malformed one should degrade, not break the page.
 *
 * Precedence is decided by whoever merges the result:
 * `{ ...defaults, ...optionsFromAttributes(root), ...options }` — constructor
 * options win over attributes, consistent with how `variant` and
 * `orientation` have always behaved.
 */
export function optionsFromAttributes(root: HTMLElement): Partial<TimelinrOptions> {
  const parsed: Partial<TimelinrOptions> = {};

  // Tri-state: undefined means "attribute absent, leave the key unset so
  // the default applies"; true/false mean an explicit value.
  const bool = (attr: string): boolean | 'invalid' | undefined => {
    const value = root.getAttribute(attr);
    if (value === null) return undefined;
    // Case-insensitive: CMS fields and templating languages routinely emit
    // "True" / "FALSE".
    switch (value.toLowerCase()) {
      case '':
      case 'true':
        return true;
      case 'false':
        return false;
      default:
        return 'invalid';
    }
  };

  const arrowKeys = bool('data-timelinr-arrow-keys');
  if (arrowKeys === 'invalid') {
    console.warn(
      `Timelinr: ignoring invalid data-timelinr-arrow-keys="${root.getAttribute('data-timelinr-arrow-keys')}" on ${describe(root)}; using ${defaults.arrowKeys}`,
    );
  } else if (arrowKeys !== undefined) {
    parsed.arrowKeys = arrowKeys;
  }

  const autoPlay = bool('data-timelinr-autoplay');
  if (autoPlay === 'invalid') {
    console.warn(
      `Timelinr: ignoring invalid data-timelinr-autoplay="${root.getAttribute('data-timelinr-autoplay')}" on ${describe(root)}; using ${defaults.autoPlay}`,
    );
  } else if (autoPlay !== undefined) {
    parsed.autoPlay = autoPlay;
  }

  const startAtRaw = root.getAttribute('data-timelinr-start-at');
  if (startAtRaw !== null) {
    if (!INT_RE.test(startAtRaw)) {
      console.warn(
        `Timelinr: ignoring invalid data-timelinr-start-at="${startAtRaw}" on ${describe(root)}; using ${defaults.startAt}`,
      );
    } else {
      parsed.startAt = Math.max(1, Number.parseInt(startAtRaw, 10));
    }
  }

  const pauseRaw = root.getAttribute('data-timelinr-autoplay-pause');
  if (pauseRaw !== null) {
    if (!INT_RE.test(pauseRaw)) {
      console.warn(
        `Timelinr: ignoring invalid data-timelinr-autoplay-pause="${pauseRaw}" on ${describe(root)}; using ${defaults.autoPlayPause}`,
      );
    } else {
      parsed.autoPlayPause = Math.max(PAUSE_FLOOR, Number.parseInt(pauseRaw, 10));
    }
  }

  const directionRaw = root.getAttribute('data-timelinr-autoplay-direction');
  if (directionRaw !== null && directionRaw !== defaults.autoPlayDirection) {
    // Only 'backward' needs reading — 'forward' IS the default, so accepting
    // it here changes nothing. Any other string is a typo worth warning about.
    if (directionRaw === 'backward') {
      parsed.autoPlayDirection = 'backward' satisfies PlayDirection;
    } else {
      console.warn(
        `Timelinr: ignoring invalid data-timelinr-autoplay-direction="${directionRaw}" on ${describe(root)}; using ${defaults.autoPlayDirection}`,
      );
    }
  }

  return parsed;
}
