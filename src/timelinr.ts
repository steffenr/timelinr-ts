import { clearInitialized, markInitialized } from './registry';
import type { Orientation, PlayDirection, TimelinrOptions, Variant } from './types';
import { defaults } from './types';
import { optionsFromAttributes } from './options';


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
 * Alignment request for #scrollDateIntoView, which applies it only to scroll
 * containers inside the component. `nearest` for all but `list-alternating`:
 * there an entry spans TWO grid rows (year above title/body) and the link is
 * only the year, so `nearest` would park that one line flush at the scrollport
 * bottom with the text clipped below; `start` aligns the whole entry without
 * guessing how tall the text is.
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
 * Root widths at or below this many pixels get the narrow layout
 * (`data-timelinr-narrow` on the root). Chosen to match the 640px
 * viewport breakpoint this state replaced — but it measures the
 * COMPONENT, so a timeline in a narrow column goes narrow even on a
 * wide screen. The stylesheet keys every former @media rule off the
 * attribute; this constant and those selectors move together.
 */
const NARROW_MAX = 640;

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

/**
 * The only DOMRect members #scrollDateIntoView reads. Declared as a Pick so
 * a hand-built union box needs no assertion to DOMRect (which also promises
 * x/y/width/height/toJSON that such a literal cannot supply).
 */
type Box = Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>;
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
  /** Watches the root's own width; see NARROW_MAX. */
  #narrowObserver: ResizeObserver | null = null;
  #opts: Required<TimelinrOptions>;
  #index = 0;
  #timer: ReturnType<typeof setInterval> | undefined;
  #onDatesClick = (ev: Event) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a');
    if (!link) return;
    ev.preventDefault();
    const idx = this.#dateLinks.indexOf(link);
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
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('button');
    if (!btn) return;
    const idx = this.#dotButtons.indexOf(btn);
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
    // Precedence by spread order: constructor options win over the
    // data-timelinr-* attributes, which win over defaults — consistent with
    // how variant/orientation have always resolved. The five scalar options
    // come through the shared parser (the same one <timelinr-slider> uses);
    // orientation/variant stay with resolveLayout() above, whose
    // cross-derivation is not expressible as a merge.
    const attrOptions = optionsFromAttributes(root);
    this.#opts = {
      orientation: layout.orientation,
      variant: layout.variant,
      startAt: options.startAt ?? attrOptions.startAt ?? defaults.startAt,
      arrowKeys: options.arrowKeys ?? attrOptions.arrowKeys ?? defaults.arrowKeys,
      autoPlay: options.autoPlay ?? attrOptions.autoPlay ?? defaults.autoPlay,
      autoPlayDirection:
        options.autoPlayDirection ?? attrOptions.autoPlayDirection ?? defaults.autoPlayDirection,
      autoPlayPause: options.autoPlayPause ?? attrOptions.autoPlayPause ?? defaults.autoPlayPause,
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

    // The narrow/wide layout switch is a fact about THIS BOX, not the
    // viewport: the same page can hold a full-width rail and the same rail
    // in a 400px card, and a @media query cannot tell them apart. The
    // observer publishes the state as one attribute the stylesheet keys the
    // former @media blocks off. CSS container queries were evaluated first
    // and rejected: an @container rule can never style its own container,
    // and both responsive blocks style the ROOT (list-alternating's grid,
    // rail's gutters, list's --tl-visible). Measurement-driven state has
    // precedent here — #syncStripOverflow works the same way. Guarded like
    // #stripObserver: without ResizeObserver the attribute never appears and
    // every variant renders its wide layout, the pre-2.1 behaviour.
    if (typeof ResizeObserver !== 'undefined') {
      this.#narrowObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? this.#root.clientWidth;
        const narrow = width <= NARROW_MAX;
        if (narrow !== this.#root.hasAttribute('data-timelinr-narrow')) {
          if (narrow) this.#root.setAttribute('data-timelinr-narrow', '');
          else this.#root.removeAttribute('data-timelinr-narrow');
        }
      });
      this.#narrowObserver.observe(this.#root);
    }

    markInitialized(root);
    this.#apply(Math.max(0, Math.min(this.count - 1, this.#opts.startAt - 1)), false);
  }

  get index(): number {
    return this.#index;
  }

  get count(): number {
    return this.#items.length;
  }

  goTo(index: number): void {
    this.#goTo(index, true);
  }

  #goTo(index: number, userInitiated: boolean): void {
    const clamped = Math.max(0, Math.min(this.count - 1, index));
    if (clamped === this.#index) {
      // Re-selecting the active entry changes no state, but a user who clicked
      // it still asked to SEE it: run the view correction, skip state/event.
      if (userInitiated) this.#scrollDateIntoView(clamped, true);
      return;
    }
    this.#apply(clamped, userInitiated);
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
    this.#narrowObserver?.disconnect();
    this.#narrowObserver = null;
    this.#root.removeAttribute('data-timelinr-narrow');
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
    clearInitialized(this.#root);
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

  /**
   * Brings the active entry into view: internal scroll containers first, each
   * aligned to its ON-SCREEN band (box ∩ viewport, inset by its computed
   * scroll-padding) — never a hidden edge, which would park the entry behind
   * a fixed header. The target is the whole entry (link ∪ item on the list
   * variants), oversized entries align head-first like native `nearest`.
   * If that still can't reveal the entry (stranded at a scroll limit), only
   * USER-initiated navigation moves the page, by the least amount that fits
   * it into the viewport band inset by the root's scroll-padding; autoplay
   * and the initial apply never touch the page. Containers run OUTERMOST
   * FIRST so each is measured and scrolled exactly once. No `behavior` is
   * passed to scrollTo() — same reason as #scrollStrip.
   */
  #scrollDateIntoView(index: number, userInitiated: boolean): void {
    const link = this.#dateLinks[index];
    if (!link) return;

    const isUserScrollable = (el: HTMLElement): boolean => {
      const cs = getComputedStyle(el);
      return /^(auto|scroll)$/.test(cs.overflowY) || /^(auto|scroll)$/.test(cs.overflowX);
    };

    // Ancestor chain, outermost → innermost (collected innermost-outward,
    // root appended, iterated in reverse). Nothing outside the root is consulted.
    const chain: HTMLElement[] = [];
    for (let el = link.parentElement; el && el !== this.#root; el = el.parentElement) {
      if (el instanceof HTMLElement) chain.push(el);
    }
    chain.push(this.#root);

    const cs = getComputedStyle(link);
    const px = (v: string): number => Number.parseFloat(v) || 0;
    const marginTop = px(cs.scrollMarginTop);
    const marginBottom = px(cs.scrollMarginBottom);
    const marginLeft = px(cs.scrollMarginLeft);
    const marginRight = px(cs.scrollMarginRight);
    const block = VARIANT_SCROLL_BLOCK[this.#opts.variant];

    // Net movement the loop applies to the link (scrolling an ancestor by N
    // moves its rect by -N) — the page correction needs the EXPECTED position.
    let shiftX = 0;
    let shiftY = 0;

    // Align the WHOLE entry: link ∪ issue item under the list variants.
    // Carousel items are transform-positioned slides; their rects say
    // nothing about visibility.
    let lRect: Box = link.getBoundingClientRect();
    if (!this.#carousel) {
      const item = this.#items[index];
      if (item) {
        const iRect = item.getBoundingClientRect();
        lRect = {
          left: Math.min(lRect.left, iRect.left),
          right: Math.max(lRect.right, iRect.right),
          top: Math.min(lRect.top, iRect.top),
          bottom: Math.max(lRect.bottom, iRect.bottom),
        };
      }
    }

    for (const c of [...chain].reverse()) {
      if (!isUserScrollable(c)) continue;
      const cRect = c.getBoundingClientRect();
      // The alignment band: the container's on-screen portion, inset by its
      // own scroll-padding.
      const ccs = getComputedStyle(c);
      const padTop = px(ccs.scrollPaddingTop);
      const padBottom = px(ccs.scrollPaddingBottom);
      const padLeft = px(ccs.scrollPaddingLeft);
      const padRight = px(ccs.scrollPaddingRight);
      const vTop = Math.max(cRect.top, 0);
      const vBottom = Math.min(cRect.bottom, window.innerHeight);
      const vLeft = Math.max(cRect.left, 0);
      const vRight = Math.min(cRect.right, window.innerWidth);
      const onScreen = vBottom > vTop && vRight > vLeft;
      let portTop = (onScreen ? vTop : cRect.top) + padTop;
      let portBottom = (onScreen ? vBottom : cRect.bottom) - padBottom;
      let portLeft = (onScreen ? vLeft : cRect.left) + padLeft;
      let portRight = (onScreen ? vRight : cRect.right) - padRight;
      // Paddings can eat a small band entirely; collapse to its midpoint
      // rather than inverting it.
      if (portBottom < portTop) portTop = portBottom = (portTop + portBottom) / 2;
      if (portRight < portLeft) portLeft = portRight = (portLeft + portRight) / 2;
      const top = lRect.top - marginTop;
      const bottom = lRect.bottom + marginBottom;
      const left = lRect.left - marginLeft;
      const right = lRect.right + marginRight;
      // `nearest`, with native's oversized rule: a target taller than the
      // band pins its START edge (bottom-flush would show only its last lines).
      const dy =
        block === 'start'
          ? top - portTop
          : bottom - top > portBottom - portTop || top < portTop
            ? top - portTop
            : bottom > portBottom
              ? bottom - portBottom
              : 0;
      const dx = (left + right) / 2 - (portLeft + portRight) / 2;

      // Clamp to the real scroll range, then round UP: browsers truncate
      // fractional positions, and rounding down re-opens a sub-pixel sliver
      // of the entry's edge.
      const nextTop = Math.ceil(Math.max(0, Math.min(c.scrollHeight - c.clientHeight, c.scrollTop + dy)));
      const nextLeft = Math.ceil(Math.max(0, Math.min(c.scrollWidth - c.clientWidth, c.scrollLeft + dx)));
      shiftY += nextTop - c.scrollTop;
      shiftX += nextLeft - c.scrollLeft;
      if (nextTop !== c.scrollTop || nextLeft !== c.scrollLeft) {
        c.scrollTo?.({ top: nextTop, left: nextLeft });
      }
    }

    // Last resort, user-initiated only: if internal scrolling couldn't fully
    // reveal the entry, move the page by the LEAST amount that fits it into
    // the viewport band inset by the root's scroll-padding (the consumer's
    // overlay declaration). Autoplay never reaches this.
    if (!userInitiated) return;
    const doc = document.scrollingElement;
    if (!doc) return;
    const rcs = getComputedStyle(this.#root);
    let bandTop = px(rcs.scrollPaddingTop);
    let bandBottom = window.innerHeight - px(rcs.scrollPaddingBottom);
    if (bandBottom < bandTop) bandTop = bandBottom = (bandTop + bandBottom) / 2;
    const top = lRect.top - shiftY - marginTop;
    const bottom = lRect.bottom - shiftY + marginBottom;
    let dy = 0;
    if (bottom - top > bandBottom - bandTop || top < bandTop) dy = top - bandTop;
    else if (bottom > bandBottom) dy = bottom - bandBottom;
    if (dy === 0) return;
    const nextTop = Math.ceil(
      Math.max(0, Math.min(doc.scrollHeight - doc.clientHeight, doc.scrollTop + dy)),
    );
    if (nextTop !== doc.scrollTop) {
      doc.scrollTo?.({ top: nextTop, left: doc.scrollLeft });
    }
  }

  /** Auto-advance step used by the autoplay timer; wraps around at the ends. */
  #step(): void {
    if (this.#opts.autoPlayDirection === 'forward') {
      this.#goTo((this.#index + 1) % this.count, false);
    } else {
      this.#goTo((this.#index - 1 + this.count) % this.count, false);
    }
  }

  /** True while the autoplay interval is actually scheduled (not hover-paused). */
  get playing(): boolean {
    return this.#timer !== undefined;
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

  #apply(index: number, userInitiated = true): void {
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
    // Keep the selected date in view. Internal containers first, never the
    // page on an autoplay tick or on load; a user-initiated navigation may
    // additionally move the page minimally — see #scrollDateIntoView.
    this.#scrollDateIntoView(index, userInitiated);
    this.#status.textContent = this.#dateLinks[index]?.textContent ?? '';
  }
}

