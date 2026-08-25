import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { optionsFromAttributes } from '../src/options';
import { Timelinr } from '../src/timelinr';
import { TimelinrElement } from '../src/element';

function fillSlider(el: HTMLElement, count = 4): void {
  const dates = document.createElement('div');
  dates.setAttribute('data-timelinr-dates', '');
  const datesUl = document.createElement('ul');
  const issues = document.createElement('div');
  issues.setAttribute('data-timelinr-issues', '');
  const issuesUl = document.createElement('ul');
  for (let i = 1; i <= count; i++) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#date-${i}`;
    a.textContent = `${1900 + i}`;
    li.appendChild(a);
    datesUl.appendChild(li);
    const slide = document.createElement('li');
    slide.innerHTML = `<h3>${1900 + i}</h3><p>Issue ${i}</p>`;
    issuesUl.appendChild(slide);
  }
  dates.appendChild(datesUl);
  issues.appendChild(issuesUl);
  el.append(dates, issues);
}

/** Flushes the microtask queue without touching vitest's fake timers. */
const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('optionsFromAttributes', () => {
  let el: HTMLElement;
  beforeEach(() => {
    el = document.createElement('div');
  });

  it('returns an empty object when nothing is set', () => {
    expect(optionsFromAttributes(el)).toEqual({});
  });

  it('parses integers', () => {
    el.setAttribute('data-timelinr-start-at', '3');
    el.setAttribute('data-timelinr-autoplay-pause', '6000');
    expect(optionsFromAttributes(el)).toEqual({ startAt: 3, autoPlayPause: 6000 });
  });

  it('clamps startAt to >= 1 and pause to the floor', () => {
    el.setAttribute('data-timelinr-start-at', '-5');
    el.setAttribute('data-timelinr-autoplay-pause', '50');
    expect(optionsFromAttributes(el)).toEqual({ startAt: 1, autoPlayPause: 500 });
  });

  it.each([
    ['', true],
    ['true', true],
    ['TRUE', true],
    ['false', false],
    ['FALSE', false],
  ] as const)('reads boolean spelling %p on autoplay', (value, expected) => {
    el.setAttribute('data-timelinr-autoplay', value);
    expect(optionsFromAttributes(el)).toEqual({ autoPlay: expected });
  });

  it('parses backward direction but leaves forward implicit', () => {
    el.setAttribute('data-timelinr-autoplay-direction', 'backward');
    expect(optionsFromAttributes(el)).toEqual({ autoPlayDirection: 'backward' });
    el.removeAttribute('data-timelinr-autoplay-direction');
    el.setAttribute('data-timelinr-autoplay-direction', 'forward');
    expect(optionsFromAttributes(el)).toEqual({});
  });

  it('warns and falls back on garbage instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.id = 'bad';
    el.setAttribute('data-timelinr-start-at', 'six');
    el.setAttribute('data-timelinr-autoplay-pause', 'soon');
    el.setAttribute('data-timelinr-arrow-keys', 'yes please');
    el.setAttribute('data-timelinr-autoplay-direction', 'sideways');
    expect(optionsFromAttributes(el)).toEqual({});
    // Each warning names the attribute and the element.
    const all = warn.mock.calls.map((c) => c[0]).join('\n');
    for (const attr of [
      'data-timelinr-start-at',
      'data-timelinr-autoplay-pause',
      'data-timelinr-arrow-keys',
      'data-timelinr-autoplay-direction',
    ]) {
      expect(all).toContain(attr);
    }
    expect(all).toContain('#bad');
    warn.mockRestore();
  });


  it('rejects trailing garbage on numbers instead of parsing a prefix', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.setAttribute('data-timelinr-start-at', '3 of them');
    expect(optionsFromAttributes(el)).toEqual({});
    expect(warn.mock.calls[0]?.[0]).toContain('data-timelinr-start-at');
    warn.mockRestore();
  });

describe('attribute contract through the constructor', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
    fillSlider(root);
    document.body.appendChild(root);
  });

  it('startAt attribute selects the right slide', () => {
    root.setAttribute('data-timelinr-start-at', '3');
    expect(new Timelinr(root).index).toBe(2);
  });

  it('constructor options win over attributes', () => {
    root.setAttribute('data-timelinr-start-at', '3');
    expect(new Timelinr(root, { startAt: 2 }).index).toBe(1);
  });

  it('autoplay attribute starts the timer; arrowKeys attribute attaches keys', () => {
    root.setAttribute('data-timelinr-autoplay', '');
    root.setAttribute('data-timelinr-arrow-keys', 'true');
    const t = new Timelinr(root);
    vi.advanceTimersByTime(4000);
    expect(t.index).toBe(1);
    // #onKeydown bails unless focus is inside the root — see AGENTS.md.
    root.querySelector<HTMLElement>('[data-timelinr-dates] a')!.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(t.index).toBe(2);
  });
});

describe('<timelinr-slider>', () => {
  function makeSlider(attrs: Record<string, string> = {}): TimelinrElement {
    const el = document.createElement('timelinr-slider');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    fillSlider(el);
    return el;
  }

  it('initialises on connect', () => {
    const el = makeSlider();
    document.body.appendChild(el);
    expect(el.index).toBe(0);
    expect(el.count).toBe(4);
  });

  it('destroys on disconnect — an autoplaying slider leaves no running interval', () => {
    const el = makeSlider({ 'data-timelinr-autoplay': '' });
    document.body.appendChild(el);
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1);
    vi.advanceTimersByTime(4000);
    expect(el.index).toBe(1);

    el.remove();
    // The interval was cleared with the subtree: no fake timers survive, so
    // nothing can tick against a detached root.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not throw when attributes fire before connectedCallback', () => {
    // setAttribute before insertion replays the upgrade order:
    // attributeChangedCallback runs before connectedCallback.
    const el = makeSlider({ 'data-timelinr-start-at': '2' });
    document.body.appendChild(el);
    expect(el.index).toBe(1);
  });

  it('reflects attribute changes after init and keeps the position', () => {
    const el = makeSlider({ 'data-timelinr-start-at': '1' });
    document.body.appendChild(el);
    el.goTo(3);
    expect(el.index).toBe(3);

    el.setAttribute('data-timelinr-autoplay-pause', '9000');
    expect(el.index).toBe(3);
  });

  it('keeps index and playing state across a DOM move', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const el = makeSlider({ 'data-timelinr-autoplay': '' });
    host.appendChild(el);
    el.goTo(2);
    vi.advanceTimersByTime(4000); // one autoplay tick past goTo
    const before = el.index;

    document.body.appendChild(el); // move fires disconnected → connected
    expect(el.index).toBe(before);
    vi.advanceTimersByTime(4000);
    expect(el.index).toBe((before + 1) % el.count);
  });

  it('tolerates missing children: retries once in a microtask, then warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = document.createElement('timelinr-slider');
    document.body.appendChild(el);
    await flushMicrotasks();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('[data-timelinr-dates]');
    expect(el.index).toBe(0);
    warn.mockRestore();

    // Filling later does not initialise retroactively — but reconnecting does.
    fillSlider(el);
    document.body.appendChild(el);
    expect(el.index).toBe(0);
  });

  it('initialises children added within the microtask retry window', async () => {
    const el = document.createElement('timelinr-slider');
    document.body.appendChild(el);
    fillSlider(el);
    await flushMicrotasks();
    expect(el.index).toBe(0);
    expect(el.count).toBe(4);
  });

  it('a programmatic pause() survives an attribute change and a DOM move', () => {
    const el = makeSlider({ 'data-timelinr-autoplay': '' });
    document.body.appendChild(el);
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1);
    el.pause();
    expect(vi.getTimerCount()).toBe(0);

    // Either rebuild path used to resurrect the timer: the constructor
    // auto-starts whenever the markup says autoplay, ignoring that the old
    // instance was explicitly paused.
    el.setAttribute('data-timelinr-autoplay-pause', '9000');
    expect(vi.getTimerCount()).toBe(0);

    document.body.appendChild(el); // DOM move → disconnect + reconnect
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(90000);
    expect(el.index).toBe(0);
  });

  it('a second connect never stacks a second instance', () => {
    const el = makeSlider();
    document.body.appendChild(el);
    expect(el.index).toBe(0);
    // connectedCallback again while the instance lives (no intervening
    // disconnect) must bail through the shared registry, not stack another
    // Timelinr — that would double listeners and timers.
    el.connectedCallback();
    el.goTo(2);
    expect(
      el.querySelectorAll('[data-timelinr-dates] a.is-selected').length,
    ).toBe(1);
    expect(el.index).toBe(2);
  });

  it('reconnect after destroy by removal still works (fresh session)', () => {
    const el = makeSlider();
    document.body.appendChild(el);
    el.goTo(3);
    el.remove();

    // A NEW element at the same spot starts fresh, not from the removed one's state.
    const fresh = makeSlider();
    document.body.appendChild(fresh);
    expect(fresh.index).toBe(0);
  });
});
});
