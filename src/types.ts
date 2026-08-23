export type Orientation = 'horizontal' | 'vertical';
export type Variant = 'rail' | 'stack' | 'tabs' | 'list' | 'list-alternating';
export type PlayDirection = 'forward' | 'backward';

export interface TimelinrOptions {
  /** Layout direction. Default: read from `data-timelinr-orientation` on the root, else `'horizontal'`. */
  orientation?: Orientation;
  /**
   * Visual variant. Default: derived from orientation — `rail` for horizontal,
   * `stack` for vertical. `list-alternating` is `list` with a centred rail and
   * entries alternating to either side of it.
   */
  variant?: Variant;
  /** 1-based index of the item shown first. Default: 1 */
  startAt?: number;
  /** Enable arrow-key navigation (left/right or up/down depending on orientation). Default: false */
  arrowKeys?: boolean;
  /** Start autoplay immediately. Default: false */
  autoPlay?: boolean;
  /** Autoplay direction, wraps around at the ends. Default: 'forward' */
  autoPlayDirection?: PlayDirection;
  /** Autoplay interval in ms. Default: 4000 */
  autoPlayPause?: number;
}

export const defaults = {
  startAt: 1,
  arrowKeys: false,
  autoPlay: false,
  autoPlayDirection: 'forward',
  autoPlayPause: 4000,
} as const satisfies Required<Omit<TimelinrOptions, 'orientation' | 'variant'>>;

/** Fired on the root element whenever the selected index changes. `event.detail.index` is the new 0-based index. */
export interface TimelinrChangeEventDetail {
  index: number;
}
