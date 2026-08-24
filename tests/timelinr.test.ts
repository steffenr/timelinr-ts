import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Timelinr, autoInit } from '../src/index';

function buildRoot(
  orientation: string | null = 'horizontal',
  count = 4,
  variant: string | null = null,
): HTMLElement {
  const root = document.createElement('div');
  root.setAttribute('data-timelinr', '');
  if (orientation !== null) root.setAttribute('data-timelinr-orientation', orientation);
  if (variant !== null) root.setAttribute('data-timelinr-variant', variant);

  const dates = document.createElement('div');
  dates.setAttribute('data-timelinr-dates', '');
  const datesUl = document.createElement('ul');
  for (let i = 1; i <= count; i++) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#date-${i}`;
    a.textContent = `${1900 + i}`;
    li.appendChild(a);
    datesUl.appendChild(li);
  }
  dates.appendChild(datesUl);

  const issues = document.createElement('div');
  issues.setAttribute('data-timelinr-issues', '');
  const issuesUl = document.createElement('ul');
  for (let i = 1; i <= count; i++) {
    const li = document.createElement('li');
    li.innerHTML = `<h3>${1900 + i}</h3><p>Issue ${i}</p>`;
    issuesUl.appendChild(li);
  }
  issues.appendChild(issuesUl);

  const prev = document.createElement('button');
  prev.setAttribute('data-timelinr-prev', '');
  const next = document.createElement('button');
  next.setAttribute('data-timelinr-next', '');

  root.append(dates, issues, prev, next);
  return root;
}

function selectedIndex(root: HTMLElement): number {
  const items = root.querySelectorAll('[data-timelinr-issues] li');
  let idx = -1;
  items.forEach((li, i) => {
    if (li.classList.contains('is-selected')) idx = i;
  });
  return idx;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Timelinr constructor', () => {
  it('selects startAt item (1-based) and sets index/count vars', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root, { startAt: 2 });

    expect(t.index).toBe(1);
    expect(root.querySelector('[data-timelinr-dates] a.is-selected')?.textContent).toBe('1902');
    expect(root.querySelector('[data-timelinr-issues] li.is-selected p')?.textContent).toBe('Issue 2');
    expect(root.style.getPropertyValue('--tl-index')).toBe('1');
    expect(root.style.getPropertyValue('--tl-count')).toBe('4');
  });

  it('throws when required parts are missing', () => {
    const root = document.createElement('div');
    root.setAttribute('data-timelinr', '');
    document.body.appendChild(root);
    expect(() => new Timelinr(root)).toThrow(/dates/i);
  });

  it('clamps a startAt beyond the item count to the last valid index', () => {
    const root = buildRoot('horizontal', 4);
    document.body.appendChild(root);
    const t = new Timelinr(root, { startAt: 10 });

    expect(t.index).toBe(3);
    expect(selectedIndex(root)).toBe(3);
  });
});

describe('navigation', () => {
  it('goTo moves selection and clamps out of range', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root);

    t.goTo(99);
    expect(t.index).toBe(3);
    t.goTo(-5);
    expect(t.index).toBe(0);
  });

  it('next/prev move by one and clamp at ends', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root);

    t.prev();
    expect(t.index).toBe(0);
    t.next();
    expect(t.index).toBe(1);
    for (let i = 0; i < 10; i++) t.next();
    expect(t.index).toBe(3);
  });

  it('next/prev buttons navigate', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    new Timelinr(root);

    (root.querySelector('[data-timelinr-next]') as HTMLButtonElement).click();
    expect(selectedIndex(root)).toBe(1);

    (root.querySelector('[data-timelinr-prev]') as HTMLButtonElement).click();
    (root.querySelector('[data-timelinr-prev]') as HTMLButtonElement).click();
    expect(selectedIndex(root)).toBe(0);
  });

  it('clicking a date navigates to that issue', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    new Timelinr(root);

    const link = root.querySelectorAll('[data-timelinr-dates] a')[2] as HTMLAnchorElement | undefined;
    expect(link).toBeDefined();
    link!.click();
    expect(selectedIndex(root)).toBe(2);
  });

  // the list variants invite consumers to put an inline <svg> icon inside each
  // date link. The svg must not disturb index resolution (which goes through
  // #dateLinks, not sibling position) and must contribute nothing to the
  // textContent-derived surfaces: dot aria-labels and the live region.
  it('date links containing an inline svg keep working', () => {
    const root = buildRoot(null, 4, 'list');
    const dots = document.createElement('div');
    dots.setAttribute('data-timelinr-dots', '');
    root.appendChild(dots);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    root.querySelectorAll('[data-timelinr-dates] a').forEach((a) => a.prepend(svg.cloneNode(true)));

    document.body.appendChild(root);
    const t = new Timelinr(root);

    const link = root.querySelectorAll('[data-timelinr-dates] a')[2] as HTMLAnchorElement;
    link.click();
    expect(t.index).toBe(2);
    expect(selectedIndex(root)).toBe(2);

    // the svg carries no text, so textContent stays the bare year — that is
    // what the dot labels and the live region are built from
    expect(link.textContent).toBe('1903');
    expect(dots.querySelectorAll('button')[2]!.getAttribute('aria-label')).toBe('1903');
    expect(root.querySelector('.tl-visually-hidden')?.textContent).toBe('1903');
  });
});

describe('events', () => {
  it('dispatches timelinr:change with new index', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root);
    const spy = vi.fn();
    root.addEventListener('timelinr:change', spy);

    t.next();
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0]![0] as CustomEvent).detail.index).toBe(1);
  });

  it('does not dispatch when index unchanged', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root);
    const spy = vi.fn();
    root.addEventListener('timelinr:change', spy);

    t.goTo(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('keyboard navigation', () => {
  it('arrow keys navigate when arrowKeys is true and focus is within the root', () => {
    const root = buildRoot('horizontal');
    document.body.appendChild(root);
    new Timelinr(root, { arrowKeys: true });
    root.querySelector<HTMLAnchorElement>('[data-timelinr-dates] a')!.focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(selectedIndex(root)).toBe(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(selectedIndex(root)).toBe(0);
  });

  it('vertical orientation uses up/down arrows', () => {
    const root = buildRoot('vertical');
    document.body.appendChild(root);
    new Timelinr(root, { arrowKeys: true });
    root.querySelector<HTMLAnchorElement>('[data-timelinr-dates] a')!.focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(selectedIndex(root)).toBe(1);
  });

  it('ignores arrow keys when focus is outside the root', () => {
    const root = buildRoot('horizontal');
    document.body.appendChild(root);
    new Timelinr(root, { arrowKeys: true });
    (document.activeElement as HTMLElement | null)?.blur();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(selectedIndex(root)).toBe(0);
  });

  it('ignores arrow keys when arrowKeys is false (default)', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    new Timelinr(root);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(selectedIndex(root)).toBe(0);
  });

  it('ignores arrow keys typed into an unrelated form field', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    new Timelinr(root, { arrowKeys: true });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(selectedIndex(root)).toBe(0);
  });
});

describe('autoplay', () => {
  it('advances automatically and wraps forward at the end', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root, { autoPlay: true, autoPlayPause: 1000 });

    vi.advanceTimersByTime(1000);
    expect(t.index).toBe(1);
    for (let i = 0; i < 5; i++) vi.advanceTimersByTime(1000);
    expect(t.index).toBe(2); // wrapped past end
  });

  it('wraps backward when direction is backward', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root, {
      autoPlay: true,
      autoPlayDirection: 'backward',
      autoPlayPause: 1000,
      startAt: 1,
    });

    vi.advanceTimersByTime(1000);
    expect(t.index).toBe(3); // wrapped to last
  });

  it('play/pause control the timer', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root, { autoPlay: true, autoPlayPause: 1000 });

    t.pause();
    vi.advanceTimersByTime(5000);
    expect(t.index).toBe(0);
    t.play();
    vi.advanceTimersByTime(1000);
    expect(t.index).toBe(1);
  });

  it('pauses on root mouseenter and resumes on mouseleave', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root, { autoPlay: true, autoPlayPause: 1000 });

    root.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(5000);
    expect(t.index).toBe(0);
    root.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(1000);
    expect(t.index).toBe(1);
  });

  it('does not resume on mouseleave after an explicit pause()', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root, { autoPlay: true, autoPlayPause: 1000 });

    t.pause();
    root.dispatchEvent(new Event('mouseenter'));
    root.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(5000);
    expect(t.index).toBe(0);
  });

  it('hover pauses an instance started with autoPlay:false after play()', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root, { autoPlayPause: 1000 });

    t.play();
    root.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(5000);
    expect(t.index).toBe(0);
  });
});

describe('accessibility', () => {
  it('marks the root as a carousel region and each item as a labeled slide', () => {
    const root = buildRoot('horizontal', 3);
    document.body.appendChild(root);
    new Timelinr(root);

    expect(root.getAttribute('role')).toBe('region');
    expect(root.getAttribute('aria-roledescription')).toBe('carousel');
    const items = root.querySelectorAll('[data-timelinr-issues] li');
    expect(items[0]!.getAttribute('role')).toBe('group');
    expect(items[0]!.getAttribute('aria-roledescription')).toBe('slide');
    expect(items[0]!.getAttribute('aria-label')).toBe('1 of 3');
    expect(items[2]!.getAttribute('aria-label')).toBe('3 of 3');
  });

  it('hides inactive slides from assistive tech and un-hides the active one', () => {
    const root = buildRoot('horizontal', 3);
    document.body.appendChild(root);
    const t = new Timelinr(root);
    const items = root.querySelectorAll('[data-timelinr-issues] li');

    expect(items[0]!.hasAttribute('aria-hidden')).toBe(false);
    expect(items[1]!.getAttribute('aria-hidden')).toBe('true');

    t.next();
    expect(items[0]!.getAttribute('aria-hidden')).toBe('true');
    expect(items[1]!.hasAttribute('aria-hidden')).toBe(false);
  });

  it('announces the current date via a polite live region', () => {
    const root = buildRoot('horizontal', 3);
    document.body.appendChild(root);
    const t = new Timelinr(root);
    const status = root.querySelector('.tl-visually-hidden')!;

    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('1901');
    t.next();
    expect(status.textContent).toBe('1902');
  });

  it('ignores arrow keys typed into an unrelated form field, even while focused inside the root', () => {
    const root = buildRoot('horizontal', 3);
    document.body.appendChild(root);
    new Timelinr(root, { arrowKeys: true });

    const input = document.createElement('input');
    root.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(selectedIndex(root)).toBe(0);
  });

  // The list variants render every entry at once. Marking nine of ten visible,
  // readable rows aria-hidden gave screen reader users one row of ten — the
  // regression this suite exists to pin down.
  describe.each(['list', 'list-alternating'] as const)('%s semantics', (variant) => {
    it('never hides an entry from assistive tech, at any index', () => {
      const root = buildRoot(null, 3, variant);
      document.body.appendChild(root);
      const t = new Timelinr(root);
      const items = root.querySelectorAll('[data-timelinr-issues] li');

      for (const index of [0, 1, 2]) {
        t.goTo(index);
        for (const item of items) expect(item.hasAttribute('aria-hidden')).toBe(false);
      }
    });

    it('carries list semantics instead of carousel semantics', () => {
      const root = buildRoot(null, 3, variant);
      document.body.appendChild(root);
      new Timelinr(root);

      expect(root.getAttribute('role')).toBe('region');
      expect(root.hasAttribute('aria-roledescription')).toBe(false);

      const list = root.querySelector('[data-timelinr-issues] ul')!;
      expect(list.getAttribute('role')).toBe('list');
      for (const item of root.querySelectorAll('[data-timelinr-issues] li')) {
        expect(item.getAttribute('role')).toBe('listitem');
        expect(item.hasAttribute('aria-roledescription')).toBe(false);
        expect(item.hasAttribute('aria-label')).toBe(false);
      }
    });

    it('selects an entry when its title or body is clicked', () => {
      const root = buildRoot(null, 4, variant);
      document.body.appendChild(root);
      const t = new Timelinr(root);
      const items = [...root.querySelectorAll('[data-timelinr-issues] li')];

      items[2]!.querySelector('h3')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(t.index).toBe(2);

      items[0]!.querySelector('p')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(t.index).toBe(0);
    });

    // An `li` is not focusable, so a row click that left focus on <body> would
    // trip #onKeydown's "activeElement inside root" guard and switch the arrow
    // keys off for the rest of the session — selecting by mouse must not cost
    // the user the keyboard.
    it('hands focus to the row it selected, so arrow keys keep working', () => {
      const root = buildRoot(null, 4, variant);
      document.body.appendChild(root);
      const t = new Timelinr(root, { arrowKeys: true });
      const items = [...root.querySelectorAll('[data-timelinr-issues] li')];
      const links = [...root.querySelectorAll('[data-timelinr-dates] a')];

      items[2]!.querySelector('h3')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(t.index).toBe(2);
      expect(document.activeElement).toBe(links[2]);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(t.index).toBe(3);
    });

    // A mousedown-drag-mouseup to select a row's prose still fires a `click`
    // on the same target a plain click would — without this guard, reading a
    // row by selecting its text would re-select the row out from under you.
    it('ignores a click that ends a text-selection drag', () => {
      const root = buildRoot(null, 4, variant);
      document.body.appendChild(root);
      const t = new Timelinr(root);
      const items = [...root.querySelectorAll('[data-timelinr-issues] li')];
      const getSelection = vi
        .spyOn(window, 'getSelection')
        .mockReturnValue({ isCollapsed: false } as Selection);

      items[2]!.querySelector('p')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(t.index).toBe(0);

      getSelection.mockRestore();
      items[2]!.querySelector('p')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(t.index).toBe(2);
    });

    it('leaves a link inside a slide alone, and stops selecting after destroy', () => {
      const root = buildRoot(null, 4, variant);
      document.body.appendChild(root);
      const t = new Timelinr(root);
      const items = [...root.querySelectorAll('[data-timelinr-issues] li')];
      const link = document.createElement('a');
      link.href = '#somewhere';
      items[3]!.appendChild(link);

      link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(t.index).toBe(0);

      t.destroy();
      items[2]!.querySelector('h3')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(t.index).toBe(0);
    });

    it('strips the list roles on destroy', () => {
      const root = buildRoot(null, 3, variant);
      document.body.appendChild(root);
      const list = root.querySelector('[data-timelinr-issues] ul')!;

      new Timelinr(root).destroy();

      expect(list.hasAttribute('role')).toBe(false);
      for (const item of root.querySelectorAll('[data-timelinr-issues] li')) {
        expect(item.hasAttribute('role')).toBe(false);
      }
    });
  });

  // …while the sliding variants keep the model they always had.
  it('keeps the carousel model for the sliding variants', () => {
    const root = buildRoot(null, 3, 'stack');
    document.body.appendChild(root);
    new Timelinr(root);

    expect(root.getAttribute('aria-roledescription')).toBe('carousel');
    expect(root.querySelector('[data-timelinr-issues] ul')!.hasAttribute('role')).toBe(false);
    expect(root.querySelectorAll('[data-timelinr-issues] li')[1]!.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  // …and clicking a slide selects nothing there: all but one slide is clipped
  // out of view, so a click on one would be a click the user could not aim.
  it('does not make slides clickable in the sliding variants', () => {
    const root = buildRoot(null, 4, 'tabs');
    document.body.appendChild(root);
    const t = new Timelinr(root);

    root
      .querySelectorAll('[data-timelinr-issues] li')[2]!
      .querySelector('h3')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(t.index).toBe(0);
  });
});

describe('destroy', () => {
  it('removes listeners, stops autoplay, drops selection classes', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root, { arrowKeys: true, autoPlay: true, autoPlayPause: 500 });
    root.querySelector<HTMLAnchorElement>('[data-timelinr-dates] a')!.focus();

    t.destroy();
    vi.advanceTimersByTime(5000);
    expect(selectedIndex(root)).toBe(-1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(selectedIndex(root)).toBe(-1);
  });

  it('removes ARIA attributes and the live region', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const t = new Timelinr(root);

    t.destroy();

    expect(root.hasAttribute('role')).toBe(false);
    expect(root.hasAttribute('aria-roledescription')).toBe(false);
    expect(root.querySelector('.tl-visually-hidden')).toBeNull();
    for (const item of root.querySelectorAll('[data-timelinr-issues] li')) {
      expect(item.hasAttribute('role')).toBe(false);
      expect(item.hasAttribute('aria-roledescription')).toBe(false);
      expect(item.hasAttribute('aria-label')).toBe(false);
      expect(item.hasAttribute('aria-hidden')).toBe(false);
    }
  });

  // #apply() writes --tl-index AND --tl-count; both have to come off. --tl-count
  // is load-bearing now (rail's track inset and fill width are calc()s over it),
  // so a stale one gives a re-initialised root the old count's geometry.
  it('removes both custom properties it wrote on the root', () => {
    const root = buildRoot('horizontal', 6);
    document.body.appendChild(root);
    const t = new Timelinr(root);
    expect(root.style.getPropertyValue('--tl-count')).toBe('6');

    t.destroy();
    expect(root.style.getPropertyValue('--tl-index')).toBe('');
    expect(root.style.getPropertyValue('--tl-count')).toBe('');
  });

  it('removes the per-item --tl-i from both lists', () => {
    const root = buildRoot('horizontal', 3);
    document.body.appendChild(root);
    const t = new Timelinr(root);
    const links = [...root.querySelectorAll<HTMLElement>('[data-timelinr-dates] a')];
    const items = [...root.querySelectorAll<HTMLElement>('[data-timelinr-issues] ul > li')];
    expect(links.map((l) => l.style.getPropertyValue('--tl-i'))).toEqual(['0', '1', '2']);
    expect(items.map((l) => l.style.getPropertyValue('--tl-i'))).toEqual(['0', '1', '2']);

    t.destroy();
    expect(links.every((l) => l.style.getPropertyValue('--tl-i') === '')).toBe(true);
    expect(items.every((l) => l.style.getPropertyValue('--tl-i') === '')).toBe(true);
  });
});

describe('autoInit', () => {
  it('initializes every [data-timelinr] root under scope', () => {
    document.body.append(buildRoot(), buildRoot('vertical'));
    const instances = autoInit();
    expect(instances).toHaveLength(2);
    expect(instances[0]).toBeInstanceOf(Timelinr);
    expect(instances.every((i) => i.index === 0)).toBe(true);
  });

  it('skips already-initialized roots', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    const first = autoInit();
    const second = autoInit();
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it('initializes remaining roots when an earlier one is malformed', () => {
    const broken = document.createElement('div');
    broken.setAttribute('data-timelinr', '');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    document.body.append(broken, buildRoot());
    const instances = autoInit();

    expect(instances).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});

describe('variant resolution', () => {
  it('defaults to rail and writes the resolved variant onto the root', () => {
    const root = buildRoot(null);
    document.body.appendChild(root);
    new Timelinr(root);

    expect(root.getAttribute('data-timelinr-variant')).toBe('rail');
  });

  it('derives stack from a vertical orientation', () => {
    const root = buildRoot('vertical');
    document.body.appendChild(root);
    new Timelinr(root);

    expect(root.getAttribute('data-timelinr-variant')).toBe('stack');
  });

  it('takes the variant from the attribute when present', () => {
    const root = buildRoot(null, 4, 'tabs');
    document.body.appendChild(root);
    new Timelinr(root);

    expect(root.getAttribute('data-timelinr-variant')).toBe('tabs');
  });

  it('lets the option win over the attribute', () => {
    const root = buildRoot(null, 4, 'tabs');
    document.body.appendChild(root);
    new Timelinr(root, { variant: 'list' });

    expect(root.getAttribute('data-timelinr-variant')).toBe('list');
  });

  it('falls back to rail when the attribute is not a known variant', () => {
    const root = buildRoot(null, 4, 'bogus');
    document.body.appendChild(root);
    new Timelinr(root);

    expect(root.getAttribute('data-timelinr-variant')).toBe('rail');
  });

  it('accepts list-alternating from the attribute and derives vertical orientation', () => {
    const root = buildRoot(null, 4, 'list-alternating');
    document.body.appendChild(root);
    const t = new Timelinr(root, { arrowKeys: true });

    expect(root.getAttribute('data-timelinr-variant')).toBe('list-alternating');
    root.querySelector('a')!.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(t.index).toBe(1);
  });

  it('lets a list-alternating option override the attribute, and restores it on destroy', () => {
    const root = buildRoot(null, 4, 'list');
    document.body.appendChild(root);
    const t = new Timelinr(root, { variant: 'list-alternating' });
    expect(root.getAttribute('data-timelinr-variant')).toBe('list-alternating');

    t.destroy();
    expect(root.getAttribute('data-timelinr-variant')).toBe('list');
  });

  it('derives vertical orientation from variant=list, binding up/down keys', () => {
    const root = buildRoot(null, 4, 'list');
    document.body.appendChild(root);
    const t = new Timelinr(root, { arrowKeys: true });

    root.querySelector('a')!.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

    expect(t.index).toBe(1);
  });

  it('keeps an explicit orientation that contradicts the variant', () => {
    const root = buildRoot('horizontal', 4, 'list');
    document.body.appendChild(root);
    const t = new Timelinr(root, { arrowKeys: true });

    root.querySelector('a')!.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    expect(t.index).toBe(1);
  });

  it('removes the variant attribute on destroy only when it wrote it', () => {
    const owned = buildRoot(null);
    document.body.appendChild(owned);
    new Timelinr(owned).destroy();
    expect(owned.hasAttribute('data-timelinr-variant')).toBe(false);

    const authored = buildRoot(null, 4, 'tabs');
    document.body.appendChild(authored);
    new Timelinr(authored).destroy();
    expect(authored.getAttribute('data-timelinr-variant')).toBe('tabs');
  });

  // The case the two above miss: the constructor OVERWROTE an authored value
  // rather than creating one. It "owns" the attribute in both situations, so a
  // destroy() that just removes it deletes markup the author wrote.
  it('restores an authored variant the option overrode, instead of deleting it', () => {
    const root = buildRoot(null, 4, 'tabs');
    document.body.appendChild(root);
    const t = new Timelinr(root, { variant: 'list' });
    expect(root.getAttribute('data-timelinr-variant')).toBe('list');

    t.destroy();
    expect(root.getAttribute('data-timelinr-variant')).toBe('tabs');
  });

  it('restores an unrecognised authored variant on destroy', () => {
    const root = buildRoot(null, 4, 'carousel');
    document.body.appendChild(root);
    const t = new Timelinr(root);
    expect(root.getAttribute('data-timelinr-variant')).toBe('rail');

    t.destroy();
    expect(root.getAttribute('data-timelinr-variant')).toBe('carousel');
  });
});

// happy-dom runs no layout, so geometry is stubbed: these are tests of the
// state machine (which boxes may be scrolled, which alignment each variant
// asks for, animation timing staying in CSS hands) — not of the layout.
describe('scrolling the active entry into view', () => {
  type Rect = { top: number; left: number; width: number; height: number };

  function stubRect(el: Element, r: Rect) {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      x: r.left,
      y: r.top,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      right: r.left + r.width,
      bottom: r.top + r.height,
      toJSON: () => r,
    } as DOMRect);
  }

  // happy-dom resolves INLINE overflow styles into getComputedStyle, so a test
  // marks its candidate scrollers the same way real CSS would.
  function makeScroller(el: HTMLElement): HTMLElement {
    el.style.overflowY = 'auto';
    return el;
  }

  function setup(variant: string) {
    const root = buildRoot(null, 4, variant);
    document.body.appendChild(root);
    const t = new Timelinr(root); // constructor's #apply runs BEFORE any spy
    const links = [...root.querySelectorAll<HTMLElement>('[data-timelinr-dates] a')];
    const items = [...root.querySelectorAll<HTMLElement>('[data-timelinr-issues] li')];
    const scrollSpies = [
      vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(() => {}),
      vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {}),
    ];
    return { root, t, links, items, calls: () => scrollSpies[0]!.mock.calls, intoView: scrollSpies[1]! };
  }

  it('never calls scrollIntoView on anything', () => {
    const { t, intoView } = setup('list');
    t.goTo(2);
    expect(intoView).not.toHaveBeenCalled();
  });

  it('autoplay never scrolls anything above the component root, even when entries sit far outside', () => {
    // A typical app frame: the widget sits inside a page-level scroll box.
    // Geometry is faked so EVERY scroller (wrapper, document) would be a
    // tempting target; autoplay must stay inside the component's own containers.
    const { root, t, links, items, calls } = setup('list-alternating');
    const wrap = document.createElement('div');
    makeScroller(wrap);
    root.parentElement!.insertBefore(wrap, root);
    wrap.appendChild(root);
    stubRect(wrap, { top: 2000, left: 0, width: 800, height: 600 });
    stubRect(links[2]!, { top: 4000, left: 10, width: 80, height: 40 });
    stubRect(items[2]!, { top: 4040, left: 10, width: 200, height: 60 });

    t.play();
    vi.advanceTimersByTime(6000); // several autoplay ticks
    expect(calls()).toHaveLength(0);
  });

  // Clicking the ALREADY-SELECTED entry changes no state, but the user still
  // asked to SEE it: the view correction must run even though goTo would
  // otherwise no-op.
  it('re-selecting the active entry still corrects the view', () => {
    const { t, links, items, calls } = setup('list');
    const doc = document.scrollingElement!;
    const docSpy = vi.spyOn(doc, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(doc, 'scrollTop', { value: 473, writable: true, configurable: true });
    Object.defineProperty(doc, 'scrollHeight', { value: 1200, configurable: true });
    Object.defineProperty(doc, 'clientHeight', { value: 500, configurable: true });
    stubRect(links[0]!, { top: -205, left: 10, width: 80, height: 40 });
    stubRect(items[0]!, { top: -205, left: 95, width: 250, height: 40 });

    t.goTo(0); // already the active index (startAt default) — state no-op
    expect(t.index).toBe(0);
    expect(docSpy).toHaveBeenCalledTimes(1);
    expect(docSpy.mock.calls[0]?.[0]).toMatchObject({ top: 268 });
    expect(calls()).toHaveLength(0);
  });

  // The page IS a legitimate target for user actions, but only the document
  // scroller (never intermediate ancestors) and only the LEAST movement that
  // fits the entry into the band. This is the measured fixed-header case: a
  // short viewport with the widget behind the header strands entries at
  // scrollTop 0, where no internal scrolling can help.
  it('user navigation moves the page minimally when internal scrolling cannot reveal the entry', () => {
    const { t, links, items, calls } = setup('list');
    const doc = document.scrollingElement!;
    const docSpy = vi.spyOn(doc, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(doc, 'scrollTop', { value: 473, writable: true, configurable: true });
    Object.defineProperty(doc, 'scrollHeight', { value: 1200, configurable: true });
    Object.defineProperty(doc, 'clientHeight', { value: 500, configurable: true });
    // widget window sits above/behind the header: entry far above the band
    stubRect(links[2]!, { top: -205, left: 10, width: 80, height: 40 });
    stubRect(items[2]!, { top: -205, left: 95, width: 250, height: 40 });

    t.goTo(2);
    // no scroll-padding declared → band top is 0; dy = -205 - 0 = -205;
    // scrollTop 473 - 205 = 268, and NOTHING else was scrolled (the doc's own
    // spy shadows the prototype spy for the doc; the prototype spy staying at
    // zero proves no OTHER element was scrolled)
    expect(docSpy).toHaveBeenCalledTimes(1);
    expect(docSpy.mock.calls[0]?.[0]).toMatchObject({ top: 268 });
    expect(calls()).toHaveLength(0);
  });

  // The alignment target under the list variants is the link ∪ issue item —
  // one entry, two halves — so both rects are stubbed here.
  it('scrolls only containers inside the component — here the list root', () => {
    const { root, t, links, items, calls } = setup('list');
    makeScroller(root);
    Object.defineProperty(root, 'scrollTop', { value: 0, writable: true, configurable: true });
    Object.defineProperty(root, 'scrollHeight', { value: 1200, configurable: true });
    Object.defineProperty(root, 'clientHeight', { value: 300, configurable: true });
    stubRect(root, { top: 0, left: 0, width: 400, height: 300 });
    stubRect(links[2]!, { top: 900, left: 10, width: 80, height: 40 });
    stubRect(items[2]!, { top: 900, left: 95, width: 250, height: 40 });

    t.goTo(2);
    expect(calls()).toHaveLength(1);
    expect(calls()[0]![0]).toMatchObject({ top: 640 });
  });

  // The alignment band is the container's on-screen portion, inset by its
  // scroll-padding: aligning to an edge hidden behind a fixed header would
  // park entries under the overlay.
  it('aligns to the visible band, inset by scroll-padding, not to hidden edges', () => {
    const { root, t, links, items, calls } = setup('list');
    makeScroller(root);
    // widget window straddles the fold: top 30px behind the header, bottom on screen
    root.style.scrollPaddingTop = '64px';
    Object.defineProperty(root, 'scrollTop', { value: 100, writable: true, configurable: true });
    Object.defineProperty(root, 'scrollHeight', { value: 1200, configurable: true });
    Object.defineProperty(root, 'clientHeight', { value: 400, configurable: true });
    stubRect(root, { top: -30, left: 0, width: 400, height: 400 });
    stubRect(links[2]!, { top: -19.5, left: 10, width: 80, height: 40 });
    stubRect(items[2]!, { top: -19.5, left: 95, width: 250, height: 40 });

    t.goTo(2);
    expect(calls()).toHaveLength(1);
    // band top = max(-30, 0) + 64 = 64; entry top -19.5 < 64, so dy = -83.5;
    // scrollTop 100 - 83.5 = 16.5, rounded up to 17 so no truncated sliver of
    // the entry's edge stays hidden
    expect(calls()[0]![0]).toMatchObject({ top: 17 });
  });

  // An entry TALLER than the scroll window arrives head-first, like native
  // scrollIntoView('nearest') — pinning its bottom would show only its tail.
  it('pins the start edge of an entry taller than the scroll window', () => {
    const { root, t, links, items, calls } = setup('list');
    makeScroller(root);
    Object.defineProperty(root, 'scrollTop', { value: 0, writable: true, configurable: true });
    Object.defineProperty(root, 'scrollHeight', { value: 2400, configurable: true });
    Object.defineProperty(root, 'clientHeight', { value: 300, configurable: true });
    stubRect(root, { top: 0, left: 0, width: 400, height: 300 });
    stubRect(links[2]!, { top: 900, left: 10, width: 80, height: 40 });
    stubRect(items[2]!, { top: 900, left: 95, width: 250, height: 420 }); // union: 460px tall

    t.goTo(2);
    expect(calls()).toHaveLength(1);
    // NOT 1060 (= 900 + 460 - 300), which bottom-flush arithmetic would ask
    expect(calls()[0]![0]).toMatchObject({ top: 900 });
  });

  // `nearest` on the two strip variants whose entry is one slide wide: the
  // link sits right of the strip, so move just enough to centre it.
  it.each(['rail', 'tabs'] as const)('%s centres the active date horizontally', (variant) => {
    const { root, t, links, calls } = setup(variant);
    const strip =
      variant === 'rail'
        ? root.querySelector<HTMLElement>('[data-timelinr-dates]')!
        : root.querySelector<HTMLElement>('[data-timelinr-dates] ul')!;
    makeScroller(strip);
    Object.defineProperty(strip, 'scrollLeft', { value: 0, writable: true, configurable: true });
    Object.defineProperty(strip, 'scrollTop', { value: 0, writable: true, configurable: true });
    Object.defineProperty(strip, 'scrollWidth', { value: 1000, configurable: true });
    Object.defineProperty(strip, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(strip, 'scrollHeight', { value: 50, configurable: true });
    Object.defineProperty(strip, 'clientHeight', { value: 50, configurable: true });
    stubRect(strip, { top: 0, left: 0, width: 300, height: 50 });
    // link sits right of the strip: centring asks for dx = 730 - 150 = 580
    stubRect(links[2]!, { top: -100, left: 700, width: 60, height: 20 });

    t.goTo(2);
    expect(calls()).toHaveLength(1);
    expect(calls()[0]![0]).toMatchObject({ left: 580, top: 0 });
    // no `behavior` anywhere: animation timing defers to CSS scroll-behavior,
    // which the reduced-motion block forces back to auto
    for (const [options] of calls()) {
      expect(options).not.toHaveProperty('behavior');
    }
  });

  // `stack` positions its clipped dates column with a CSS translateY — the
  // column IS a clip (overflow: hidden), not a scroll affordance, and JS
  // scrolling it would fight the transform. Even with geometry begging for a
  // scroll, an overflow:hidden ancestor must be left alone.
  it('stack scrolls nothing: its clip is overflow hidden, not a scroller', () => {
    const { t, links, calls } = setup('stack');
    const clip =
      document.querySelector<HTMLElement>('[data-timelinr-dates]') ??
      links[2]!.closest<HTMLElement>('div')!;
    clip.style.overflowY = 'hidden';
    Object.defineProperty(clip, 'scrollTop', { value: 0, writable: true, configurable: true });
    Object.defineProperty(clip, 'scrollHeight', { value: 2000, configurable: true });
    Object.defineProperty(clip, 'clientHeight', { value: 300, configurable: true });
    stubRect(clip, { top: 0, left: 0, width: 200, height: 300 });
    stubRect(links[2]!, { top: 1800, left: 10, width: 80, height: 40 });

    t.goTo(2);
    expect(calls()).toHaveLength(0);
  });

  // …but list-alternating's entry spans TWO grid rows and the link is only the
  // first of them, so it asks for start alignment: put the entry's top edge on
  // the scrollport's top edge, however tall the text below turns out to be.
  it('aligns list-alternating with block start, because its entry spans two rows', () => {
    const { root, t, links, items, calls } = setup('list-alternating');
    makeScroller(root);
    Object.defineProperty(root, 'scrollTop', { value: 0, writable: true, configurable: true });
    Object.defineProperty(root, 'scrollHeight', { value: 2400, configurable: true });
    Object.defineProperty(root, 'clientHeight', { value: 300, configurable: true });
    stubRect(root, { top: 0, left: 0, width: 400, height: 300 });
    stubRect(links[2]!, { top: 900, left: 10, width: 80, height: 40 });
    stubRect(items[2]!, { top: 940, left: 10, width: 250, height: 60 });

    t.goTo(2);
    expect(calls()).toHaveLength(1);
    // 900 - 0, unclamped because max scrollTop (2100) allows it — NOT 640,
    // which is what `nearest`'s bottom-edge arithmetic would have asked for
    expect(calls()[0]![0]).toMatchObject({ top: 900 });
  });
});

// Same caveat as above, sharpened: happy-dom reports every scroll metric as 0,
// so nothing here overflows on its own and the fade could never be observed.
// The geometry is therefore STUBBED, which makes these tests of the state
// machine — given this scroll position, what does the library publish — and
// not of the layout that produces the position. The layout was measured in
// Chrome instead (rail: fill within 0.01px of the active dot's centre in both
// the fitting and the overflowing regime).
describe('dates strip overflow affordance', () => {
  function stubMetrics(el: HTMLElement, scrollLeft: number, clientWidth = 300, scrollWidth = 800) {
    Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
    Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
    Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, writable: true, configurable: true });
    el.dispatchEvent(new Event('scroll'));
  }

  function setup(variant: string) {
    const root = buildRoot(null, 4, variant);
    document.body.appendChild(root);
    const t = new Timelinr(root);
    const dates = root.querySelector<HTMLElement>('[data-timelinr-dates]')!;
    return {
      root,
      t,
      dates,
      // the box that scrolls is the wrapper in rail and the `ul` in tabs
      strip: variant === 'rail' ? dates : dates.querySelector<HTMLElement>('ul')!,
      prev: dates.querySelector<HTMLButtonElement>('[data-timelinr-dates-prev]'),
      next: dates.querySelector<HTMLButtonElement>('[data-timelinr-dates-next]'),
      state: () => [...dates.classList].filter((c) => c.startsWith('is-')).sort(),
    };
  }

  it('publishes which side of the tabs strip has more, and disables the spent button', () => {
    const { strip, prev, next, state } = setup('tabs');

    stubMetrics(strip, 0);
    expect(state()).toEqual(['is-overflow-end']);
    expect(prev!.disabled).toBe(true);
    expect(next!.disabled).toBe(false);

    stubMetrics(strip, 250);
    expect(state()).toEqual(['is-overflow-end', 'is-overflow-start']);
    expect(prev!.disabled).toBe(false);
    expect(next!.disabled).toBe(false);

    // 800 - 300 = 500 is the far end
    stubMetrics(strip, 500);
    expect(state()).toEqual(['is-overflow-start']);
    expect(prev!.disabled).toBe(false);
    expect(next!.disabled).toBe(true);
  });

  // The state that must cost nothing: a strip with room to spare publishes
  // neither class, so the mask stays a no-op and the buttons stay display:none.
  it('publishes nothing when the strip fits', () => {
    const { strip, state } = setup('tabs');
    stubMetrics(strip, 0, 800, 800);
    expect(state()).toEqual([]);
  });

  it('scrolls the tabs strip by most of a screenful, deferring to CSS for smoothness', () => {
    const { strip, prev, next } = setup('tabs');
    const scrollBy = vi.fn();
    Object.defineProperty(strip, 'scrollBy', { value: scrollBy, configurable: true });
    stubMetrics(strip, 250);

    next!.click();
    prev!.click();

    expect(scrollBy).toHaveBeenNthCalledWith(1, { left: 240 });
    expect(scrollBy).toHaveBeenNthCalledWith(2, { left: -240 });
    // no `behavior`: the default defers to the element's computed
    // scroll-behavior, which is what makes prefers-reduced-motion work without
    // a second check here
    expect(scrollBy.mock.calls.every(([opts]) => !('behavior' in opts))).toBe(true);
  });

  // rail reaches its off-screen dates through the prev/next arrows already
  // sitting in its gutters; a second pair would be two controls for one job.
  it('gives rail the fade but no buttons of its own', () => {
    const { dates, strip, prev, next, state } = setup('rail');
    expect(prev).toBeNull();
    expect(next).toBeNull();

    stubMetrics(strip, 250);
    expect(state()).toEqual(['is-overflow-end', 'is-overflow-start']);
    expect(dates.querySelectorAll('button').length).toBe(0);
  });

  // Their dates run down the block axis: they grow the widget instead of
  // hiding anything, so there is nothing for an affordance to point at.
  it.each(['stack', 'list', 'list-alternating'] as const)(
    'leaves %s alone entirely',
    (variant) => {
      const { strip, prev, next, state } = setup(variant);
      expect(prev).toBeNull();
      expect(next).toBeNull();
      stubMetrics(strip, 250);
      expect(state()).toEqual([]);
    },
  );

  it('takes its buttons and its state classes back on destroy', () => {
    const { t, dates, strip, state } = setup('tabs');
    stubMetrics(strip, 250);
    expect(state()).not.toEqual([]);
    expect(dates.querySelectorAll('[data-timelinr-dates-prev], [data-timelinr-dates-next]').length).toBe(2);

    t.destroy();

    expect(state()).toEqual([]);
    expect(dates.querySelectorAll('[data-timelinr-dates-prev], [data-timelinr-dates-next]').length).toBe(0);
    // and the detached listener no longer answers
    stubMetrics(strip, 250);
    expect(state()).toEqual([]);
  });
});

describe('prev/next disabled state', () => {
  it('disables prev at the first index and next at the last', () => {
    const root = buildRoot('horizontal', 3);
    document.body.appendChild(root);
    const t = new Timelinr(root);
    const prev = root.querySelector<HTMLButtonElement>('[data-timelinr-prev]')!;
    const next = root.querySelector<HTMLButtonElement>('[data-timelinr-next]')!;

    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    t.goTo(1);
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);

    t.goTo(2);
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(true);
  });

  it('clears both flags on destroy', () => {
    const root = buildRoot('horizontal', 3);
    document.body.appendChild(root);
    const t = new Timelinr(root);
    const prev = root.querySelector<HTMLButtonElement>('[data-timelinr-prev]')!;

    expect(prev.disabled).toBe(true);
    t.destroy();
    expect(prev.disabled).toBe(false);
  });
});

describe('counter', () => {
  it('writes position and total, and clears on destroy', () => {
    const root = buildRoot('vertical', 4);
    const counter = document.createElement('span');
    counter.setAttribute('data-timelinr-counter', '');
    root.appendChild(counter);
    document.body.appendChild(root);

    const t = new Timelinr(root);
    expect(counter.textContent).toBe('1 / 4');

    t.goTo(3);
    expect(counter.textContent).toBe('4 / 4');

    t.destroy();
    expect(counter.textContent).toBe('');
  });

  it('is optional — a timeline without one still works', () => {
    const root = buildRoot();
    document.body.appendChild(root);
    expect(() => new Timelinr(root).goTo(1)).not.toThrow();
  });
});

describe('dots', () => {
  function buildWithDots(count = 4) {
    const root = buildRoot(null, count, 'tabs');
    const dots = document.createElement('div');
    dots.setAttribute('data-timelinr-dots', '');
    root.appendChild(dots);
    document.body.appendChild(root);
    return { root, dots };
  }

  it('generates one labelled button per item', () => {
    const { root, dots } = buildWithDots(4);
    new Timelinr(root);

    const buttons = dots.querySelectorAll('button');
    expect(buttons).toHaveLength(4);
    expect(buttons[0]!.getAttribute('aria-label')).toBe('1901');
    expect(buttons[3]!.getAttribute('aria-label')).toBe('1904');
    expect(buttons[0]!.type).toBe('button');
  });

  it('marks the active dot and moves the mark on change', () => {
    const { root, dots } = buildWithDots(4);
    const t = new Timelinr(root);
    const buttons = dots.querySelectorAll('button');

    expect(buttons[0]!.classList.contains('is-selected')).toBe(true);
    expect(buttons[0]!.getAttribute('aria-current')).toBe('true');

    t.goTo(2);
    expect(buttons[0]!.classList.contains('is-selected')).toBe(false);
    expect(buttons[0]!.hasAttribute('aria-current')).toBe(false);
    expect(buttons[2]!.classList.contains('is-selected')).toBe(true);
  });

  it('navigates when a dot is clicked', () => {
    const { root, dots } = buildWithDots(4);
    const t = new Timelinr(root);

    dots.querySelectorAll('button')[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(t.index).toBe(2);
  });

  it('empties the container on destroy', () => {
    const { root, dots } = buildWithDots(4);
    new Timelinr(root).destroy();
    expect(dots.children).toHaveLength(0);
  });

  // the symmetric case the counter suite already covers: [data-timelinr-dots]
  // is queried optionally, so navigation must be unaffected by its absence
  it('is optional — a timeline without one still works', () => {
    const root = buildRoot(null, 4, 'tabs');
    document.body.appendChild(root);
    const t = new Timelinr(root);

    expect(root.querySelector('[data-timelinr-dots]')).toBeNull();
    expect(() => t.goTo(2)).not.toThrow();
    expect(t.index).toBe(2);
    expect(selectedIndex(root)).toBe(2);
    expect(() => t.destroy()).not.toThrow();
  });
});
