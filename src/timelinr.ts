import type { Orientation, PlayDirection, TimelinrOptions, Variant } from './types';
import { defaults } from './types';

const initialized = new WeakSet<HTMLElement>();

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return TYPING_TAGS.has(target.tagName) || target.isContentEditable;
}

const VARIANTS = new Set<string>(['rail', 'stack', 'tabs', 'list', 'list-alternating']);

const VARIANT_ORIENTATION: Record<Variant, Orientation> = {
  rail: 'horizontal',
  stack: 'vertical',
  tabs: 'horizontal',
  list: 'vertical',
  'list-alternating': 'vertical',
};

/**
 * How the active date link is aligned when `#apply()` scrolls it into view.
 *
 * `nearest` is right for four of the five, and for two different reasons.
 * rail/stack/tabs are not scroll containers at all, so `nearest` correctly
 * does nothing once the link is on screen and never yanks the page around on
 * an autoplay tick. `list` IS a scroll container, but there the link is the
 * whole entry: it spans column 1 of a one-row-per-entry grid and stretches to
 * the row's full height, so scrolling the link into view scrolls the entry
 * into view, and `nearest` moves the minimum needed to get it there.
 *
 * `list-alternating` breaks that equivalence, which is why it needs its own
 * value. There an entry occupies TWO grid rows — `2i+1` carries the year (with
 * `min-height: 0`, so it is one line tall) and `2i+2` carries the title and
 * body — and the link is only the first of them. `nearest` therefore satisfies
 * itself by bringing that one line into view, parking it flush against the
 * bottom edge with the entire text row still clipped below: measured at 720px
 * of window, entries 3..9 landed with their top 656px down and 101-169px of
 * each entry cut off. `start` is the fix rather than a larger `scroll-margin`,
 * because it needs no guess about how tall the text is — the entry begins at
 * the link, so aligning the link to the top of the scrollport shows as much of
 * the entry as can possibly fit, whatever the content does. It is also the
 * correct reading position for a block that runs year -> title -> body.
 */
const VARIANT_SCROLL_BLOCK: Record<Variant, ScrollLogicalPosition> = {
  rail: 'nearest',
  stack: 'nearest',
  tabs: 'nearest',
  list: 'nearest',
  'list-alternating': 'start',
};

/**
 * Variants that render EVERY entry at once instead of one slide at a time.
 * The distinction is not cosmetic: it decides which ARIA model applies (see
 * the constructor), because a widget whose entries are all on screen is not a
 * carousel and its entries are not slides.
 */
const LIST_VARIANTS = new Set<Variant>(['list', 'list-alternating']);

/**
 * Variants that lay their dates out as one horizontal strip, and so the ones
 * that can run out of room. `stack` and the list variants are excluded because
 * their dates run down the block axis and grow the widget instead of
 * overflowing it; there is nothing hidden for an affordance to point at.
 */
const STRIP_VARIANTS = new Set<Variant>(['rail', 'tabs']);

/**
 * Cross-derives variant and orientation so either one alone is enough markup.
 * Explicit values always win; an unrecognised attribute is ignored rather than
 * thrown on, matching how orientation has always been read.
 *
 * `ownsVariantAttr` records whether the constructor is the one writing the
 * attribute, so `destroy()` doesn't strip a consumer's own markup. This is a
 * deliberate departure from the unconditional set/remove used for ARIA — those
 * attributes are library-only, `variant` is author-authorable.
 *
 * `previousVariantAttr` is what makes that revert exact. "Owns" only means the
 * constructor *wrote* the attribute, which happens both when it created one
 * from nothing and when it overwrote an author's — `new Timelinr(root, {
 * variant: 'list' })` on `<div data-timelinr-variant="tabs">` is the second
 * case, and so is any unrecognised authored value. Removing the attribute in
 * `destroy()` would be a full revert only in the first case; in the others it
 * silently deletes author markup. So `destroy()` puts the old value back when
 * there was one, and removes the attribute only when there wasn't.
 */
function resolveLayout(
  root: HTMLElement,
  options: TimelinrOptions,
): {
  variant: Variant;
  orientation: Orientation;
  ownsVariantAttr: boolean;
  previousVariantAttr: string | null;
} {
  const attrVariant = root.getAttribute('data-timelinr-variant');
  const explicitVariant =
    options.variant ?? (VARIANTS.has(attrVariant ?? '') ? (attrVariant as Variant) : undefined);

  const attrOrientation = root.getAttribute('data-timelinr-orientation');
  const explicitOrientation =
    options.orientation ??
    (attrOrientation === 'vertical' || attrOrientation === 'horizontal'
      ? attrOrientation
      : undefined);

  const variant = explicitVariant ?? (explicitOrientation === 'vertical' ? 'stack' : 'rail');
  const orientation = explicitOrientation ?? VARIANT_ORIENTATION[variant];

  return {
    variant,
    orientation,
    ownsVariantAttr: attrVariant !== variant,
    previousVariantAttr: attrVariant,
  };
}

interface Parts {
  dates: HTMLElement;
  issues: HTMLElement;
  prev: HTMLButtonElement | null;
  next: HTMLButtonElement | null;
  counter: HTMLElement | null;
  dots: HTMLElement | null;
}

export class Timelinr {
  readonly #root: HTMLElement;
  readonly #parts: Parts;
  readonly #dateLinks: HTMLElement[];
  readonly #items: HTMLElement[];
  readonly #status: HTMLElement;
  readonly #ownsVariantAttr: boolean;
  readonly #previousVariantAttr: string | null;
  /** True for the sliding variants, i.e. the ones the carousel ARIA model fits. */
  readonly #carousel: boolean;
  /** The issues `ul`, only when list semantics were applied to it. */
  readonly #itemsList: HTMLElement | null;
  /**
   * The box that scrolls the dates strip, or null where the dates cannot
   * overflow. Which element this is differs between the two strip variants,
   * and the CSS is what forces the difference: `rail` scrolls the WRAPPER,
   * because its `ul` has to keep a reference box the full width of the content
   * or the progress line drawn on it stops at the scrollport edge; `tabs`
   * scrolls the UL, because its wrapper is the flex row holding the scroll
   * buttons, and a button inside the scrolling box would scroll away with the
   * pills it exists to reach.
   */
  readonly #strip: HTMLElement | null;
  /** Library-created, and only for `tabs` — see the constructor. */
  #stripPrev: HTMLButtonElement | null = null;
  #stripNext: HTMLButtonElement | null = null;
  #stripObserver: ResizeObserver | null = null;
  #opts: Required<TimelinrOptions>;
  #index = 0;
  #timer: ReturnType<typeof setInterval> | undefined;
  #onDatesClick = (ev: Event) => {
    const link = (ev.target as HTMLElement).closest('a');
    if (!link) return;
    ev.preventDefault();
    const idx = this.#dateLinks.indexOf(link as HTMLElement);
    if (idx >= 0) this.goTo(idx);
  };
  // Under the list variants every entry's text is on screen, so clicking a row's
  // title or body is the obvious way to select it — the date link beside it is
  // already a link, but the text is the bigger target and reads as part of the
  // same row. Only attached for those variants: everywhere else all but one
  // slide is clipped out of view, so there would be nothing else to click.
  //
  // The index comes from #items, the array that defines index membership, not
  // from the clicked element's position among its siblings. Interactive
  // content inside a slide keeps its own behaviour: a consumer who puts a link
  // or a form field in the body meant it to be clicked, not to be a second way
  // of selecting the row.
  //
  // Focus moves to the row's date link afterwards, and that is not a nicety.
  // An `li` is not focusable, so without this a click would select a row and
  // leave document.activeElement on <body> — at which point #onKeydown's
  // "activeElement must be inside #root" guard bails and arrow keys silently
  // do nothing, i.e. selecting by mouse would switch the keyboard off. The
  // date link is the row's existing focusable representative, so focusing it
  // makes the two affordances continuous. preventScroll because #apply() has
  // already scrolled that link into view; letting focus() scroll again would
  // fight it.
  //
  // This call belongs here and only here — never inside #apply(). #apply()
  // runs on every index change, including an autoplay tick, and stealing
  // focus on a tick the user didn't ask for would rip it away from wherever
  // they actually are on the page (mid-scroll, in a form elsewhere). Moving
  // focus is only correct as the direct result of the click that caused it.
  //
  // A click that ends a text-selection drag is ignored: mousedown-drag-mouseup
  // to select a row's prose also fires a `click`, and without this guard
  // reading by selecting would re-select the row out from under you.
  // getSelection() can return null (e.g. no selection API in this context).
  #onIssuesClick = (ev: Event) => {
    const target = ev.target as HTMLElement | null;
    if (!target || isTypingTarget(target)) return;
    if (target.closest('a[href], button, [role="button"], label, summary')) return;
    if (window.getSelection()?.isCollapsed === false) return;
    const idx = this.#items.findIndex((item) => item === target || item.contains(target));
    if (idx < 0) return;
    this.goTo(idx);
    this.#dateLinks[idx]?.focus?.({ preventScroll: true });
  };
  #onPrev = () => this.prev();
  #onNext = () => this.next();
  #onStripScroll = () => this.#syncStripOverflow();
  #onStripPrev = () => this.#scrollStrip(-1);
  #onStripNext = () => this.#scrollStrip(1);
  #dotButtons: HTMLButtonElement[] = [];
  #onDotsClick = (ev: Event) => {
    const btn = (ev.target as HTMLElement).closest('button');
    if (!btn) return;
    const idx = this.#dotButtons.indexOf(btn as HTMLButtonElement);
    if (idx >= 0) this.goTo(idx);
  };
  #onKeydown = (ev: KeyboardEvent) => {
    if (isTypingTarget(ev.target)) return;
    if (!this.#root.contains(document.activeElement)) return;
    const { orientation } = this.#opts;
    const forward =
      orientation === 'horizontal'
        ? ev.key === 'ArrowRight'
        : ev.key === 'ArrowDown';
    const backward =
      orientation === 'horizontal' ? ev.key === 'ArrowLeft' : ev.key === 'ArrowUp';
    if (forward || backward) {
      ev.preventDefault();
      forward ? this.next() : this.prev();
    }
  };
  #onMouseEnter = () => this.#stopTimer();
  #onMouseLeave = () => {
    if (this.#opts.autoPlay) this.#startTimer();
  };
  constructor(root: HTMLElement, options: TimelinrOptions = {}) {
    const dates = root.querySelector<HTMLElement>('[data-timelinr-dates]');
    const issues = root.querySelector<HTMLElement>('[data-timelinr-issues]');
    if (!dates) throw new Error('Timelinr: required element [data-timelinr-dates] not found');
    if (!issues) throw new Error('Timelinr: required element [data-timelinr-issues] not found');

    this.#root = root;
    this.#parts = {
      dates,
      issues,
      prev: root.querySelector<HTMLButtonElement>('[data-timelinr-prev]'),
      next: root.querySelector<HTMLButtonElement>('[data-timelinr-next]'),
      counter: root.querySelector<HTMLElement>('[data-timelinr-counter]'),
      dots: root.querySelector<HTMLElement>('[data-timelinr-dots]'),
    };
    this.#dateLinks = Array.from(dates.querySelectorAll('a'));
    this.#items = Array.from(issues.querySelectorAll('ul > li'));

    // Per-item position, published to CSS. `list` needs it: it renders date i
    // and slide i on ONE row, but the DOM keeps them in two separate
    // index-parallel lists, and the root's --tl-index / --tl-count say nothing
    // about which row a given <li> belongs to. With --tl-i each side can place
    // itself with grid-row: calc(var(--tl-i) + 1) and the two interleave.
    // This stays inside the "JS only toggles classes and writes custom
    // properties" invariant — it is a custom property derived purely from list
    // position, carrying no authored content — and destroy() removes it again.
    this.#dateLinks.forEach((link, i) => link.style.setProperty('--tl-i', String(i)));
    this.#items.forEach((item, i) => item.style.setProperty('--tl-i', String(i)));

    const layout = resolveLayout(root, options);
    this.#ownsVariantAttr = layout.ownsVariantAttr;
    this.#previousVariantAttr = layout.previousVariantAttr;
    if (layout.ownsVariantAttr) root.setAttribute('data-timelinr-variant', layout.variant);

    // ARIA depends on the variant, because the variants are not all the same
    // KIND of widget. rail/stack/tabs show one slide at a time and the others
    // are genuinely off screen — a carousel, and aria-hidden on the inactive
    // ones is correct. The list variants show every entry at once, permanently
    // readable, so both halves of that model are wrong there: the rows are not
    // slides ("3 of 10" on a row a sighted user reads as one item of a list is
    // noise), and aria-hidden would hide nine visible rows from screen readers
    // while leaving them on screen. What those variants ARE is a list, so they
    // get list semantics instead — explicitly, because `display: contents` on
    // the wrapping `ul`/`li` (which is how the rows interleave) strips the
    // native list roles in every browser that implements it.
    //
    // The role attributes stay library-owned and unconditional, exactly as the
    // carousel ones always were: they are ARIA-only, so an unconditional
    // set/remove can never destroy consumer markup. Only `destroy()` has to
    // know about them, and it removes every one of them.
    this.#carousel = !LIST_VARIANTS.has(layout.variant);
    root.setAttribute('role', 'region');
    if (this.#carousel) {
      root.setAttribute('aria-roledescription', 'carousel');
      this.#items.forEach((item, i) => {
        item.setAttribute('role', 'group');
        item.setAttribute('aria-roledescription', 'slide');
        item.setAttribute('aria-label', `${i + 1} of ${this.#items.length}`);
      });
      this.#itemsList = null;
    } else {
      // via #items, never a querySelector of its own — the arrays are the
      // single source of truth for what the library considers an entry
      this.#itemsList = this.#items[0]?.parentElement ?? null;
      this.#itemsList?.setAttribute('role', 'list');
      this.#items.forEach((item) => item.setAttribute('role', 'listitem'));
    }

    this.#status = document.createElement('div');
    this.#status.setAttribute('aria-live', 'polite');
    this.#status.setAttribute('aria-atomic', 'true');
    this.#status.className = 'tl-visually-hidden';
    root.appendChild(this.#status);

    this.#opts = {
      orientation: layout.orientation,
      variant: layout.variant,
      startAt: options.startAt ?? defaults.startAt,
      arrowKeys: options.arrowKeys ?? defaults.arrowKeys,
      autoPlay: options.autoPlay ?? defaults.autoPlay,
      autoPlayDirection: options.autoPlayDirection ?? defaults.autoPlayDirection,
      autoPlayPause: options.autoPlayPause ?? defaults.autoPlayPause,
    };

    dates.addEventListener('click', this.#onDatesClick);
    if (!this.#carousel) issues.addEventListener('click', this.#onIssuesClick);
    this.#parts.prev?.addEventListener('click', this.#onPrev);
    this.#parts.next?.addEventListener('click', this.#onNext);
    if (this.#opts.arrowKeys) window.addEventListener('keydown', this.#onKeydown);
    root.addEventListener('mouseenter', this.#onMouseEnter);
    root.addEventListener('mouseleave', this.#onMouseLeave);
    if (this.#opts.autoPlay) this.#startTimer();

    // One dot per DATE LINK, while `count` is the number of ISSUE ITEMS. The
    // two are the same number by the index-parallel DOM contract (date i
    // selects slide i), so this is not a second, competing definition of
    // "how many entries" — it is the same one, read off whichever list
    // actually supplies the data. #dateLinks is right here specifically
    // because a dot's aria-label is copied from its date link's text; an
    // issue item has no label to give.
    if (this.#parts.dots) {
      this.#dotButtons = this.#dateLinks.map((link, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('data-timelinr-dot', '');
        button.setAttribute('aria-label', link.textContent?.trim() || String(i + 1));
        return button;
      });
      this.#parts.dots.replaceChildren(...this.#dotButtons);
      this.#parts.dots.addEventListener('click', this.#onDotsClick);
    }

    // ---------- the dates strip's overflow affordance ----------
    //
    // Both strip variants hide their scrollbar, so an overflowing strip said
    // nothing about the dates past its edge. The CSS draws the fade and the
    // buttons; all of this is the state they key off.
    //
    // The `ul` is reached through #dateLinks rather than a fresh querySelector
    // for the reason #itemsList is: the arrays are the single source of truth
    // for what the library considers an entry, and a selector of its own could
    // pick a different `ul` than the one holding the links.
    this.#strip = STRIP_VARIANTS.has(layout.variant)
      ? layout.variant === 'rail'
        ? dates
        : (this.#dateLinks[0]?.closest<HTMLElement>('ul') ?? null)
      : null;

    // Only `tabs` gets buttons, and only the library can make them: whether a
    // strip overflows is a runtime fact about width, so there is no moment at
    // which an author could sensibly have written them into the markup. rail
    // deliberately gets none — its prev/next already sit in the gutters at
    // either end of the strip, and moving the selection scrolls the active
    // date into view, so a second pair beside them would be two controls for
    // one job.
    if (this.#strip && layout.variant === 'tabs') {
      const scrollButton = (dir: 'prev' | 'next', label: string): HTMLButtonElement => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute(`data-timelinr-dates-${dir}`, '');
        // "backward"/"forward", not "left"/"right": the label is read aloud,
        // and it describes the strip's direction of travel rather than a
        // position on screen the listener cannot see
        button.setAttribute('aria-label', label);
        return button;
      };
      this.#stripPrev = scrollButton('prev', 'Scroll dates backward');
      this.#stripNext = scrollButton('next', 'Scroll dates forward');
      dates.insertBefore(this.#stripPrev, this.#strip);
      dates.appendChild(this.#stripNext);
      this.#stripPrev.addEventListener('click', this.#onStripPrev);
      this.#stripNext.addEventListener('click', this.#onStripNext);
    }

    if (this.#strip) {
      this.#strip.addEventListener('scroll', this.#onStripScroll, { passive: true });
      // Scrolling is not the only thing that changes what is hidden: the
      // viewport can be resized (the strip's own box changes) and the content
      // can reflow after a webfont loads (the strip's box does NOT change,
      // only its scrollWidth). Observing both boxes covers the pair. Guarded
      // because ResizeObserver is the one modern API here that a test
      // environment may not implement — without it the fades simply stop
      // updating on resize, which is a degradation, not a break.
      if (typeof ResizeObserver !== 'undefined') {
        this.#stripObserver = new ResizeObserver(this.#onStripScroll);
        this.#stripObserver.observe(this.#strip);
        const content = this.#dateLinks[0]?.closest<HTMLElement>('ul');
        if (content && content !== this.#strip) this.#stripObserver.observe(content);
      }
      this.#syncStripOverflow();
    }

    initialized.add(root);
    this.#apply(Math.max(0, Math.min(this.count - 1, this.#opts.startAt - 1)));
  }

  get index(): number {
    return this.#index;
  }

  get count(): number {
    return this.#items.length;
  }

  goTo(index: number): void {
    const clamped = Math.max(0, Math.min(this.count - 1, index));
    if (clamped === this.#index) return;
    this.#apply(clamped);
    this.#root.dispatchEvent(
      new CustomEvent<{ index: number }>('timelinr:change', {
        detail: { index: clamped },
        bubbles: true,
      }),
    );
  }

  next(): void {
    if (this.#index < this.count - 1) this.goTo(this.#index + 1);
  }

  prev(): void {
    if (this.#index > 0) this.goTo(this.#index - 1);
  }

  play(direction: PlayDirection = this.#opts.autoPlayDirection): void {
    this.#opts.autoPlayDirection = direction;
    this.#opts.autoPlay = true;
    this.#startTimer();
  }

  pause(): void {
    this.#opts.autoPlay = false;
    this.#stopTimer();
  }

  destroy(): void {
    this.#stopTimer();
    this.#parts.dates.removeEventListener('click', this.#onDatesClick);
    // removed unconditionally — removeEventListener for a listener that was
    // never added is a no-op, and this way destroy() can't drift out of step
    // with the constructor's variant condition
    this.#parts.issues.removeEventListener('click', this.#onIssuesClick);
    this.#parts.prev?.removeEventListener('click', this.#onPrev);
    this.#parts.next?.removeEventListener('click', this.#onNext);
    if (this.#parts.prev) this.#parts.prev.disabled = false;
    if (this.#parts.next) this.#parts.next.disabled = false;
    if (this.#parts.counter) this.#parts.counter.textContent = '';
    this.#parts.dots?.removeEventListener('click', this.#onDotsClick);
    this.#parts.dots?.replaceChildren();
    this.#dotButtons = [];
    // the strip: listener, observer, the two library-created buttons, and the
    // state classes the CSS keys off — everything this instance added to it
    this.#strip?.removeEventListener('scroll', this.#onStripScroll);
    this.#stripObserver?.disconnect();
    this.#stripObserver = null;
    this.#stripPrev?.removeEventListener('click', this.#onStripPrev);
    this.#stripNext?.removeEventListener('click', this.#onStripNext);
    this.#stripPrev?.remove();
    this.#stripNext?.remove();
    this.#stripPrev = null;
    this.#stripNext = null;
    this.#parts.dates.classList.remove('is-overflow-start', 'is-overflow-end');
    window.removeEventListener('keydown', this.#onKeydown);
    this.#root.removeEventListener('mouseenter', this.#onMouseEnter);
    this.#root.removeEventListener('mouseleave', this.#onMouseLeave);
    for (const link of this.#dateLinks) {
      link.classList.remove('is-selected');
      link.removeAttribute('aria-current');
      link.style.removeProperty('--tl-i');
    }
    for (const item of this.#items) {
      item.classList.remove('is-selected');
      item.style.removeProperty('--tl-i');
      item.removeAttribute('role');
      item.removeAttribute('aria-roledescription');
      item.removeAttribute('aria-label');
      item.removeAttribute('aria-hidden');
    }
    // role="list" on the issues `ul` is the one ARIA attribute the library
    // puts on an element that is neither the root nor an entry; it only exists
    // under the list variants, and #itemsList is null otherwise.
    this.#itemsList?.removeAttribute('role');
    this.#status.remove();
    this.#root.removeAttribute('role');
    this.#root.removeAttribute('aria-roledescription');
    this.#root.style.removeProperty('--tl-index');
    // --tl-count is written by #apply() alongside --tl-index and has to come
    // off with it. It is not cosmetic: rail's track inset and fill width are
    // both calc()s over it, so a stale value left behind by destroy() gives a
    // re-initialised root the OLD entry count's geometry until the next
    // #apply() overwrites it.
    this.#root.style.removeProperty('--tl-count');
    if (this.#ownsVariantAttr) {
      if (this.#previousVariantAttr === null) {
        this.#root.removeAttribute('data-timelinr-variant');
      } else {
        this.#root.setAttribute('data-timelinr-variant', this.#previousVariantAttr);
      }
    }
    initialized.delete(this.#root);
  }

  /**
   * Publishes what the strip is hiding, as two classes on the dates wrapper
   * and the disabled state of the scroll buttons. The wrapper carries the
   * classes in BOTH variants even though it is only the scrolling box in one,
   * so the CSS has a single place to read the state from and this has a single
   * place to write it.
   *
   * Stays inside the "JS only toggles classes and writes custom properties"
   * invariant: it reads geometry, but every pixel that moves as a result is
   * moved by CSS.
   */
  #syncStripOverflow(): void {
    const strip = this.#strip;
    if (!strip) return;
    const max = strip.scrollWidth - strip.clientWidth;
    const x = strip.scrollLeft;
    // A pixel of slack at each end. Sub-pixel layout routinely leaves
    // scrollLeft a fraction short of `max` at the far end, and an exact
    // comparison would leave the "more this way" fade painted over a strip
    // that has nothing more that way. When the strip fits, max is 0 or less
    // and both come out false, which is the untouched state.
    const start = x > 1;
    const end = x < max - 1;
    this.#parts.dates.classList.toggle('is-overflow-start', start);
    this.#parts.dates.classList.toggle('is-overflow-end', end);
    if (this.#stripPrev) this.#stripPrev.disabled = !start;
    if (this.#stripNext) this.#stripNext.disabled = !end;
  }

  /**
   * Scrolls the strip by most of a screenful, leaving some of the old edge
   * visible as an anchor rather than paging blindly.
   *
   * No `behavior` is passed, and that is deliberate: the default defers to the
   * element's computed `scroll-behavior`, which the CSS sets to `smooth` and
   * the reduced-motion block forces back to `auto`. Passing `'smooth'` here
   * would override the CSS and animate for users who asked it not to, and
   * would need a second, separate reduced-motion check in the JS to avoid it.
   */
  #scrollStrip(direction: 1 | -1): void {
    const strip = this.#strip;
    if (!strip) return;
    strip.scrollBy?.({ left: direction * strip.clientWidth * 0.8 });
  }

  /** Auto-advance step used by the autoplay timer; wraps around at the ends. */
  #step(): void {
    if (this.#opts.autoPlayDirection === 'forward') {
      this.goTo((this.#index + 1) % this.count);
    } else {
      this.goTo((this.#index - 1 + this.count) % this.count);
    }
  }

  #startTimer(): void {
    this.#stopTimer();
    this.#timer = setInterval(() => this.#step(), this.#opts.autoPlayPause);
  }

  #stopTimer(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  #apply(index: number): void {
    this.#index = index;
    this.#root.style.setProperty('--tl-index', String(index));
    this.#root.style.setProperty('--tl-count', String(this.count));
    this.#dateLinks.forEach((link, i) => {
      link.classList.toggle('is-selected', i === index);
      if (i === index) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    this.#items.forEach((item, i) => {
      const active = i === index;
      item.classList.toggle('is-selected', active);
      // Only the carousel variants hide their inactive entries: there the
      // entry really is off screen. Under `list`/`list-alternating` every row
      // stays visible and readable, so aria-hidden there would hide n-1 of n
      // on-screen rows from assistive tech while sighted users read them all.
      if (active || !this.#carousel) item.removeAttribute('aria-hidden');
      else item.setAttribute('aria-hidden', 'true');
    });
    if (this.#parts.prev) this.#parts.prev.disabled = index === 0;
    if (this.#parts.next) this.#parts.next.disabled = index === this.count - 1;
    if (this.#parts.counter) {
      this.#parts.counter.textContent = `${index + 1} / ${this.count}`;
    }
    this.#dotButtons.forEach((button, i) => {
      button.classList.toggle('is-selected', i === index);
      if (i === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    // keep the selected date in view (no-op where unsupported). The block
    // alignment is per-variant because "the link" and "the entry" are the same
    // box in some variants and not in others — see VARIANT_SCROLL_BLOCK.
    this.#dateLinks[index]?.scrollIntoView?.({
      inline: 'center',
      block: VARIANT_SCROLL_BLOCK[this.#opts.variant],
    });
    this.#status.textContent = this.#dateLinks[index]?.textContent ?? '';
  }
}

/** Initialize every `[data-timelinr]` element under `scope` that isn't initialized yet. */
export function autoInit(scope: ParentNode = document): Timelinr[] {
  const roots = scope.querySelectorAll<HTMLElement>('[data-timelinr]');
  const instances: Timelinr[] = [];
  roots.forEach((root) => {
    if (initialized.has(root)) return;
    try {
      instances.push(new Timelinr(root));
    } catch (err) {
      console.error(err);
    }
  });
  return instances;
}
