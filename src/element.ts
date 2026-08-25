import { Timelinr } from './timelinr';
import { optionsFromAttributes } from './options';
import { isInitialized } from './registry';
import type { PlayDirection, TimelinrOptions } from './types';

const OBSERVED = [
  'data-timelinr-variant',
  'data-timelinr-orientation',
  'data-timelinr-start-at',
  'data-timelinr-arrow-keys',
  'data-timelinr-autoplay',
  'data-timelinr-autoplay-direction',
  'data-timelinr-autoplay-pause',
] as const;

/** What a disconnect remembers so a reconnect can resume instead of resetting. */
interface Session {
  index: number;
  playing: boolean;
}

/**
 * `<timelinr-slider>` — the package's only public entry point, for hosts
 * with no bundler and no glue JavaScript: render markup, load this module
 * with a bare `<script type="module">`, done.
 *
 * The element orchestrates LIGHT-DOM markup exactly as the Timelinr class
 * expects it (the same `[data-timelinr-dates]` / `[data-timelinr-issues]`
 * contract; no shadow root — the content is host-rendered and must stay
 * reachable by ordinary host CSS). The stylesheet keys everything off the
 * `<timelinr-slider>` tag selector, so a connected element is styled
 * immediately; no separate `data-timelinr` hook is needed.
 *
 * Configuration comes from data-timelinr-* attributes, parsed by
 * optionsFromAttributes (`src/options.ts`); attribute changes after init
 * rebuild in place, keeping the current position.
 *
 * Browser-only by design: customElements is touched at module scope, so
 * importing this module in Node throws.
 */
export class TimelinrElement extends HTMLElement {
  static observedAttributes = OBSERVED;

  #instance: Timelinr | null = null;
  /** Set on disconnect, consumed on reconnect: position + live autoplay survive a DOM move. */
  #resume: Session | null = null;
  /** Per-connection retry budget for the children-not-parsed-yet case. */
  #retried = false;

  connectedCallback(): void {
    // A root that already has a live instance (an earlier connect of this
    // very element, or a redundant connect) must not be double-initialised —
    // the registry is shared with the class constructor.
    if (isInitialized(this)) return;
    this.#retried = false;
    this.#connect();
  }

  disconnectedCallback(): void {
    const instance = this.#instance;
    if (!instance) return;
    // Moving a node within the document fires disconnected → connected. A
    // naive teardown would reset the timeline to startAt and kill autoplay,
    // which reads as a bug to anyone using AJAX pagers or route swaps; cache
    // what a reconnect needs instead.
    this.#resume = { index: instance.index, playing: instance.playing };
    // Drop the reference BEFORE destroying. destroy() reverts the
    // library-written data-timelinr-variant, which fires
    // attributeChangedCallback synchronously; with #instance still set that
    // callback would tear down again and rebuild a fresh instance on the
    // now-detached node — an orphaned autoplay interval nobody can stop.
    this.#instance = null;
    instance.destroy();
  }

  attributeChangedCallback(): void {
    // Attributes present in the source markup fire during upgrade, BEFORE
    // connectedCallback — there is no instance yet, so there is nothing to
    // rebuild and connectedCallback will read them fresh anyway.
    if (!this.#instance) return;
    // Cheapest correct implementation: tear down and rebuild. Coarse for
    // autoPlayPause but exact for variant/orientation, whose ARIA model and
    // layout differ per value. The current index (and live autoplay state)
    // carries across, so editing one pause length doesn't visibly snap the
    // timeline back to its first slide.
    const instance = this.#instance;
    const index = instance.index;
    const wasPlaying = instance.playing;
    // Drop the reference before destroying, for the same reason
    // disconnectedCallback does: destroy() reverts the library-written
    // variant attribute, which fires THIS callback again synchronously.
    this.#instance = null;
    instance.destroy();
    const opts = optionsFromAttributes(this);
    opts.startAt = index + 1;
    this.#reconcile(opts, wasPlaying);
  }

  /**
   * The constructor auto-starts the timer whenever the parsed markup says
   * autoPlay — which would silently RESURRECT autoplay after an explicit
   * pause() (or suppress it for a playing slider whose autoplay attribute
   * was just removed). Reconcile the live state the old instance had with
   * what a fresh one does by default.
   */
  #reconcile(opts: TimelinrOptions, wasPlaying: boolean): void {
    const markupWantsAutoplay = !!opts.autoPlay;
    this.#instance = new Timelinr(this, opts);
    if (wasPlaying && !markupWantsAutoplay) this.#instance.play();
    else if (!wasPlaying && markupWantsAutoplay) this.#instance.pause();
  }

  get index(): number {
    return this.#instance?.index ?? 0;
  }

  get count(): number {
    return this.#instance?.count ?? 0;
  }

  goTo(index: number): void {
    this.#instance?.goTo(index);
  }

  next(): void {
    this.#instance?.next();
  }

  prev(): void {
    this.#instance?.prev();
  }

  play(direction?: PlayDirection): void {
    this.#instance?.play(direction);
  }

  pause(): void {
    this.#instance?.pause();
  }

  /**
   * During HTML parsing connectedCallback can fire before the children exist
   * (document.createElement + append-before-filling hits the same window).
   * Never throw: retry once in a microtask, then warn naming the element and
   * stay inert.
   */
  #connect(): void {
    const ready =
      this.querySelector('[data-timelinr-dates]') && this.querySelector('[data-timelinr-issues]');
    if (!ready) {
      if (!this.#retried) {
        this.#retried = true;
        queueMicrotask(() => {
          if (this.isConnected && !this.#instance) this.#connect();
        });
        return;
      }
      const label = this.id ? `<timelinr-slider#${this.id}>` : '<timelinr-slider>';
      console.warn(
        `Timelinr: ${label} is missing [data-timelinr-dates]/[data-timelinr-issues]; not initialising`,
      );
      return;
    }
    const opts = optionsFromAttributes(this);
    if (this.#resume) {
      const { index, playing } = this.#resume;
      this.#resume = null;
      opts.startAt = index + 1;
      this.#reconcile(opts, playing);
      return;
    }
    // First connect: no prior live state exists — the markup decides.
    this.#instance = new Timelinr(this, opts);
  }
}

if (!customElements.get('timelinr-slider')) {
  // Guarded: two copies of this bundle on one page (two consumers, different
  // versions) would otherwise throw NotSupportedError out of module scope and
  // break unrelated scripts.
  customElements.define('timelinr-slider', TimelinrElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'timelinr-slider': TimelinrElement;
  }
}
