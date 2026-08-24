# AGENTS.md

Framework-agnostic TypeScript timeline slider. Zero runtime dependencies, single
class (`src/timelinr.ts`), CSS-driven animation. Usage docs are in
[`README.md`](README.md) — this file is for agents changing the code.

## Commands

```sh
npm test               # vitest run — tests/timelinr.test.ts
npm run typecheck       # tsc --noEmit
npm run build            # build:lib + build:examples (below)
npm run build:lib         # vite build (dist/timelinr.js) + tsc declarations + minified dist/timelinr.css
npm run build:examples     # bundles+minifies examples/*/main.js and examples/assets/*.min.css
npm run dev                # vite dev server, serves examples/ with live TS transform
```

Run `npm test && npm run typecheck` before considering any change to `src/`
done. Run `npm run build:lib` before touching `dist/`, `vite.config.ts`, or
`tsconfig.build.json`. Run `npm run build:examples` after editing any
`examples/**/*.ts` or `examples/shared/style.css` / `styles/timelinr.css` —
the examples' HTML references the *compiled* `main.js` and `assets/*.min.css`
files, not the `.ts`/source directly (see Gotchas).

## Architecture invariants

### Core

- **All animation is CSS, not JS.** The class only ever toggles `.is-selected`
  and writes custom properties: `--tl-index` / `--tl-count` onto the root
  (`src/timelinr.ts#apply`), and `--tl-i` — the item's own list position —
  onto each `#dateLinks` and `#items` entry once in the constructor (see
  `list`'s bullet for why). `styles/timelinr.css` does the transitions via
  `transform`/`opacity`. Never add JS-driven animation (rAF, timers moving
  pixels) — it belongs in CSS. The line to hold is that a written property is
  derived from *structure* (a position, a count), never from authored content:
  the moment JS starts publishing a value it read out of the consumer's
  markup, it has become a DOM-builder.
- **Strict DOM contract.** `#dateLinks` and `#items` are built once in the
  constructor via `querySelectorAll` and assumed to be index-parallel — item
  `i` in `#dateLinks` corresponds to item `i` in `#items`. Any code that
  derives an index from the DOM (click handlers, keyboard nav) must resolve
  through one of these two arrays (e.g. `#dateLinks.indexOf(link)`), not by
  recomputing position from `parentElement.children` — the arrays are the
  single source of truth for index membership.
- **One shared idempotency guard.** The module-level `initialized` WeakSet
  (not per-instance state) is what makes `autoInit()` safe to call more than
  once on the same page. `destroy()` must remove the root from it.
- **Options merge with `defaults`** (`src/types.ts`). Adding a
  `TimelinrOptions` field means updating both `defaults` and the constructor's
  merge block in `src/timelinr.ts`, and keeping `Required<TimelinrOptions>` (the
  type of `#opts`) satisfied.
- **`#opts.autoPlay` is live state, not just an initial flag** — `play()` and
  `pause()` mutate it, and the mouseenter/mouseleave handlers (always attached,
  regardless of the constructor's initial `autoPlay` value) read it to decide
  whether hovering should resume the timer. Don't reintroduce a version that
  only starts autoplay from the constructor option.
- **ARIA is owned unconditionally by the library, but WHICH ARIA depends on
  the variant.** There are two models, chosen once in the constructor by
  `LIST_VARIANTS` and remembered as `#carousel`:
  - *Carousel* (`rail`, `stack`, `tabs`): `role="region"` +
    `aria-roledescription="carousel"` on the root; `role="group"` +
    `aria-roledescription="slide"` + a positional `aria-label` ("3 of 10") on
    each slide; `#apply()` sets `aria-hidden` on every inactive slide.
  - *List* (`list`, `list-alternating`): `role="region"` on the root and
    nothing else — it is not a carousel; `role="list"` on the issues `ul`
    (via `#itemsList`, taken from `#items[0].parentElement`, never a fresh
    `querySelector`); `role="listitem"` on each entry; and **`aria-hidden` is
    never set**.

  The split is not cosmetic. Those two variants put every entry on screen at
  once, permanently readable, so the carousel model was wrong twice over and
  shipped as a real bug: nine of ten *visible, non-zero-height* rows carried
  `aria-hidden="true"`, i.e. a screen reader user got one row of ten, and each
  row was announced as slide "N of M" when a sighted user reads it as one item
  of a list. `role="list"` has to be explicit because both variants flatten
  the wrapping `ul`/`li` with `display: contents`, which strips the native
  list role. If you add a variant, decide which set it belongs to and put it
  in `LIST_VARIANTS` or not — don't reintroduce a single unconditional model.

  Everything else about the old rule still holds: these attributes are
  library-only, so the set/remove stays unconditional (no `hasAttribute`
  gating, no ownership tracking — that is `variant`'s job, see the bullet
  below), and `destroy()` must strip every one of them, `role="list"` on the
  `ul` included. The visually-hidden `aria-live="polite"` status div
  (`this.#status`, appended to root, updated by `#apply()`) is shared by both
  models and also removed by `destroy()`.
- **Clicking a slide selects it — but only under the list variants.**
  `#onIssuesClick` is attached to `[data-timelinr-issues]` when `#carousel` is
  false, and resolves its index through `#items.findIndex(...)` — the array,
  as the DOM-contract invariant above requires — not from sibling position.
  It bails on anything the consumer put in a slide that is interactive in its
  own right (`a[href]`, `button`, `[role="button"]`, `label`, `summary`, and
  `isTypingTarget`), because a link inside a slide was put there to be
  followed. It exists only for those variants because everywhere else all but
  one slide is clipped out of view, so there is nothing to click. The CSS
  counterpart is `cursor: pointer` on non-selected list entries. `destroy()`
  removes the listener unconditionally (a `removeEventListener` for a listener
  that was never added is a no-op), so it cannot drift out of step with the
  constructor's condition.
- **`data-timelinr-variant` is the one attribute the library writes back, and
  its write-back IS ownership-tracked** — the deliberate opposite of the ARIA
  rule directly above. `resolveLayout()` (`src/timelinr.ts`) cross-derives the
  pair so either attribute alone is enough markup: an explicit variant wins,
  else vertical → `stack` / anything else → `rail`; an explicit orientation
  wins, else it comes from `VARIANT_ORIENTATION`. The resolved variant is then
  written onto the root, because every layout rule in `styles/timelinr.css`
  keys off `[data-timelinr-variant='…']` and a page authored with only
  `data-timelinr-orientation` would otherwise match nothing.
  `#ownsVariantAttr` records whether the constructor's value differed from
  what was already there, and `destroy()` removes the attribute only if so.
  Ownership tracking is right here and wrong for ARIA for one reason: ARIA
  attributes are library-only, so an unconditional set/remove can never
  destroy consumer markup, whereas `variant` is author-authorable and an
  unconditional `removeAttribute` in `destroy()` would silently delete a hand
  written attribute. Don't "simplify" either one into the other's shape.
  Corollary: **no CSS rule may key off the orientation attribute.**
  Orientation is an input the library reads and never writes back, so a page
  carrying only a variant has no orientation attribute at all. Orientation's
  entire runtime job is choosing which arrow keys navigate (`#onKeydown`).
- **Dot buttons are generated even though slide content never is.** The
  constructor builds one `<button data-timelinr-dot>` per entry into
  `[data-timelinr-dots]` and `destroy()` empties it again; the examples, by
  contrast, hardcode every date and slide (see the examples invariant below).
  These are not in tension: a dot carries no authored content — it is a pure
  projection of the date list, down to its `aria-label`, which is copied from
  the corresponding date link's text. There is nothing for a consumer to
  write, and asking them to hand-maintain a parallel third list that must stay
  index-aligned with the other two would be a contract worse than generating
  it. Dates and slides are the opposite: they *are* the content. Keep the
  line there — generate projections of existing content, never content.
  `#dotButtons` is also the index source of truth for `#onDotsClick`, exactly
  as `#dateLinks` is for `#onDatesClick`.
- **Keyboard nav is scoped to the widget.** `#onKeydown` bails unless
  `document.activeElement` is inside `#root` (in addition to the
  `isTypingTarget` guard for text inputs nested in slide content). This is
  deliberate: a `window`-level listener with no focus check would let every
  `Timelinr` instance on the page react to the same arrow-key press
  simultaneously, and would hijack arrow keys anywhere on the page. Tests
  must `.focus()` an element inside root before dispatching a keydown.
- **Theme colors are contrast-checked, not just chosen for looks.** Every
  `--tl-fg`/`--tl-muted`/`--tl-accent` meets WCAG AA (4.5:1) against its
  theme's `--tl-bg` — verified by hand via the WCAG relative-luminance
  formula, not a linter. If you change a theme color, recheck it against
  `--tl-bg` before committing. Two follow-on rules about *which* pairings
  actually need their own measurement:
  - **A foreground/background swap needs no new check.** `tabs`' active pill
    paints `--tl-bg` text on a solid `--tl-accent` fill — the inverse of the
    accent-on-background pairing already on record. The WCAG ratio is
    `(L_lighter + 0.05) / (L_darker + 0.05)`, which is symmetric under the
    swap: the number is *identical*, not merely similar. That is also why
    there is no `--tl-accent-fg` token — `--tl-bg` on `--tl-accent` inherits
    the verified ratio for free, so don't reintroduce one.
  - **A `color-mix()` wash does need its own check**, because it composites a
    genuinely different background color, not a swap of two known ones.
    `stack`'s active-year pill (`--tl-accent` 12% over `--tl-bg`) and `list`'s
    active row (10%) are the two, and `list`'s row now carries **two**
    different text colors over that one wash, so both need measuring:
    - `--tl-accent` on the wash (the year, left half): light 4.92, dark 6.16,
      ocean 4.89, forest 4.67, sunset 4.70.
    - `--tl-fg` on the wash (the title and body, right half — this pairing
      arrived with the one-row redesign): light 15.06, dark 13.19, ocean
      10.62, forest 9.06, sunset 9.53.
    - `stack`'s pill, `--tl-accent` on its 12% wash: forest 4.54, sunset 4.57.
    - Non-active `list` rows are `--tl-muted` on plain `--tl-bg`: 5.30 to
      7.06 across the five themes.
    - `list-alternating` needs **no new measurement**: it reuses the same three
      pairings unchanged (verified in the browser — the same 10% wash, the
      year in `--tl-accent`, title and body in `--tl-fg`, non-active rows in
      `--tl-muted` at `opacity: 1`). It introduces no colour of its own. Adding
      a variant that only re-places existing colours is the one case where the
      rule above does not demand a fresh check — but confirm that is actually
      what it does before skipping it.

    All pass AA. **The accent-on-wash row is the thin one** — forest 4.67 and
    sunset 4.70 sit a few hundredths above 4.5 — so changing a theme's
    `--tl-accent` or `--tl-bg`, or nudging either mix percentage, means
    re-measuring the composite, not just the plain accent-on-background pair.
    The `--tl-fg` figures have room to spare and are not the constraint.
- **The slide `translateX`/`translateY` percentage is `-100% * index`, never
  divided by `--tl-count`.** This drives `rail` and `tabs` (`translateX`) and
  `stack` (`translateY`); `list` does not translate its panel at all (see its
  bullet). `[data-timelinr-issues] > ul` has no explicit width/height of its
  own (`rail`/`tabs`) or is `height: 100%` of its fixed-height grid cell
  (`stack`) — either way its *own* reference box is exactly one slide's
  size, because each `li`'s `flex: 0 0 100%` resolves against that same box.
  A percentage transform is relative to the transformed element's own
  reference box, so `-100% * index` already equals "move left/up by `index`
  full slides" — dividing by `--tl-count` shrinks that by a further factor of
  `count`, moving only `1/count` as far as it should. This was a real,
  shipped bug: at `index = count-1` the slide barely moved at all, so a
  screenshot at index 0 or 1 looks fine and the bug only shows up at higher
  indices — **when touching this transform, verify at `index = count - 1`
  (e.g. `goTo(count - 1)` then screenshot/`getBoundingClientRect()`), not
  just index 0/1.** No test in `tests/timelinr.test.ts` catches this class of
  bug: happy-dom simulates the DOM but doesn't run real layout, so it can't
  compute an actual `transform` or `getBoundingClientRect()` value — these
  tests only ever assert `.is-selected`/`aria-*`/index bookkeeping, which
  stays correct even when the visual position is wrong.
- **Keeping the active entry in view is internal-first, page-last.**
  `#apply()` → `#scrollDateIntoView()` never calls `scrollIntoView()`; it
  aligns the WHOLE entry (link ∪ item on the list variants) to each internal
  container's ON-SCREEN band (box ∩ viewport, inset by that container's
  computed `scroll-padding-*`), oversized entries head-first like native
  `nearest`. Only a USER-initiated navigation may then move the PAGE, by the
  least amount that fits the entry into the viewport band inset by the ROOT's
  `scroll-padding` — autoplay and the initial `startAt` apply never touch it,
  and `goTo()` still runs the correction when re-selecting the already-active
  entry. Tests stub geometry (happy-dom has none); the layout itself is
  browser-verified only.

### Per-variant layout

The five variants are the presentation layer; `styles/timelinr.css` has one
block each, matched only by `[data-timelinr-variant='…']` — except that `list`
and `list-alternating` share one block plus a small override block, for the
reason set out in their bullets below. The original jQuery
Timelinr demos are **no longer the visual authority** — that goal went away
with 1.x's dotted-line strip, so don't reintroduce comparisons against
`csslab.cl` as a correctness argument. What survived from that work is the
chevron-mask technique, documented in the prev/next bullet below.

- **`rail`'s dates strip scrolls, and the progress line survives it — but only
  because the `ul` is not the box that scrolls.** The line is two
  pseudo-elements on the `ul` (`::before` track, `::after` accent fill), and
  those cannot be drawn over an `overflow-x: auto` row: a scroll container's
  reference box is only the *visible scrollport*, not the full scrollable
  content, so a `left/right` spanning line stops short of every entry scrolled
  out of view. The resolution is to put the overflow one level up, on
  `[data-timelinr-dates]`, leaving the `ul` an ordinary non-scrolling block
  whose box is its full content width — both pseudo-elements span all of it and
  scroll along with the dots. **The incompatibility is real and the rule still
  holds; it is narrower than it looks.** A spanning line and `overflow-x`
  cannot live on the SAME element. They can live on parent and child. (This
  replaced an earlier design in which rail could not scroll at all and traded
  the line away for a `flex` row below 640px — that fallback is gone, and the
  line now renders at every width.)

- **What made rail's scrolling safe is that the `ul`'s width is
  DETERMINISTIC.** It is `width: max(100%, calc(var(--tl-count) *
  var(--tl-date-min)))`, computed from the count the library already publishes,
  so every column is `ul-width / count` — `1fr` each while the strip fits, all
  exactly `--tl-date-min` once it doesn't — and the dot-centre arithmetic below
  holds unchanged in both regimes (measured in Chrome: fill within 0.01px of
  the active dot's centre, fitting and overflowing). **Do not "simplify" this to
  `width: max-content`.** That also widens the `ul`, but the columns then size
  to their text, and since the selected date is a third larger than the rest
  (`a.is-selected` sets `font-size: 1.375rem`) the entire strip would resize on
  every navigation. Geometry follows from the equal
  columns: dot `i` sits at the centre of column `i`, i.e. `(i + 0.5) / count`
  of the width, so the track runs **dot-centre to dot-centre** — inset
  `calc(50% / var(--tl-count))` at each end, width
  `calc(100% - 100% / var(--tl-count))` — not edge to edge, and the fill is
  that same width scaled by `index / max(1, count - 1)`. The `max(1, …)`
  guards a single-item timeline against dividing by zero; at count 1 the
  track width is itself 0, so the fill collapses to 0 rather than going
  negative. Getting the geometry wrong is invisible at index 0 (zero-width
  fill either way) and shows as a fill that stops short of or overshoots the
  active dot at middle indices — **measure the fill's right edge against the
  dot's centre with `getBoundingClientRect()`, don't eyeball it.**

- **`stack`'s dates column is a clipped viewport scrolled by a FIXED step.**
  The root is a `7rem 1fr` two-column grid (dates, then issues — both in the
  *same* single grid row, side by side, not stacked) with a fixed
  `height: var(--tl-height, 70vh)` and `padding-block: 2.25rem` for the
  top/bottom arrows. `[data-timelinr-dates]` gets `height: 100%; overflow:
  hidden` to be the clipping viewport. Inside it every date `a` has a **fixed
  height** (`--tl-date-step`, declared once on the stack root so the row
  height and the scroll math reference the same value) — fixed regardless of
  the active date's styling, which is load-bearing: if the active row were
  allowed to grow taller, `--tl-date-step` would stop matching the real
  per-row pixel height and the scroll position would drift further out of
  sync with every navigation. The column scrolls via
  `translateY(clamp(min(0rem, calc((3 - var(--tl-count,1)) * var(--tl-date-step))), calc((2 - var(--tl-index,0)) * var(--tl-date-step)), 0rem))`
  — unlike the issues panel's `-100% * index` (each slide *is* the full
  viewport), several rows are visible at once here, so the shift has to be in
  fixed steps, not a whole-container percentage. The `2 -` term keeps the
  active date ~2 rows down from the top once there is enough list above it;
  the `0rem` upper bound stops it pulling blank space in above the first
  date; the computed lower bound does the same at the tail. **The
  `min(0rem, …)` around that lower bound is a degenerate-count guard, the
  sibling of `rail`'s `max(1, …)`:** at count 1 or 2 the expression evaluates
  *positive* (`+6.5rem` / `+3.25rem`), exceeding the `0rem` upper bound;
  `clamp()` with MIN > MAX collapses to MIN, so the column would be pushed
  down by a constant offset at every index, leaving permanent blank space
  above the first date. Verify both boundary indices (`0` and `count - 1`)
  **and** a count of 1 and 2 after touching this — a formula that looks right
  at a middle index of a long list can still leak blank space or overshoot.
  `list` deliberately does **not** use any of this; see its bullet.

- **`stack`'s image height is a hardcoded cap, not derived.** The shared base
  gives slide images `width: 100%` + `aspect-ratio: 4 / 3`; the stack block
  overrides that with `width: auto; max-height: 11rem` (`8rem` below 640px),
  so the aspect ratio drives width from a capped height instead of the other
  way round. This exists because stack has a *fixed* overall height
  (`--tl-height`, default 70vh, minus `padding-block: 2.25rem`) shared by the
  dates and issues columns — an unconstrained image sizes itself from its own
  aspect ratio and can be taller than the issues column has room for, and
  because CSS grid auto-sizing is circular with the image's own size
  (percentage `max-height` doesn't reliably resolve here — verified by hand,
  it silently falls back to the image's unconstrained intrinsic size), the
  cap has to be a fixed length. `11rem` was picked to fit the `26rem`
  `--tl-height` used in `examples/stack/`; it does not auto-scale with a
  different `--tl-height`. If you change either value, re-measure via
  `getBoundingClientRect()` on the image vs. its `li` that the image no
  longer overflows the slide (overflow here silently eats the visual gap
  below the dates row and can look like "slides are broken/missing"). No
  other variant needs this: `rail` and `tabs` have no fixed height budget,
  and `list` hides images entirely (`[data-timelinr-issues] img { display:
  none }`) — its design is text plus the medallion rail, so don't
  "re-enable" them looking for consistency.

- **Both strips scroll, but the scrolling BOX is a different element in each,
  and that difference is load-bearing.** `rail` scrolls
  `[data-timelinr-dates]`; `tabs` scrolls the `ul` inside it. Each has a
  reason the other doesn't share: rail's `ul` must keep a full-content
  reference box for the progress line (see rail's bullet), and tabs' wrapper
  must stay unscrolled because it is the flex row holding the strip's scroll
  buttons — a button inside the scrolling box would scroll away with the pills
  it exists to reach. **Don't unify them.** Two places encode the split and
  both must move together if it ever changes: the `#strip` ternary in the
  constructor, and the one two-selector mask rule in section 2 of the CSS.

- **Only `tabs` gets scroll buttons, and the library creates them.** They are
  generated like the dots and for the same reason: whether a strip overflows is
  a runtime fact about width, so there is no moment at which an author could
  have written them into the markup. `rail` deliberately has none — its
  prev/next arrows already sit in the gutters at either end of the strip, and
  moving the selection scrolls the active date into view, so a second pair
  beside them would be two controls for one job. `destroy()` removes them.

- **The strip's overflow state is two classes on `[data-timelinr-dates]`, in
  BOTH variants** — `is-overflow-start` / `is-overflow-end`, written by
  `#syncStripOverflow()` from `scrollLeft` against `scrollWidth - clientWidth`
  with a pixel of slack at each end (sub-pixel layout otherwise pins the "more
  this way" fade on forever at the far end). They go on the wrapper even in
  `tabs`, where the wrapper is not the scrolling box, so that the CSS has one
  place to read the state and the JS one place to write it; `--tl-fade-s` /
  `--tl-fade-e` then inherit down to whichever box carries the mask. With both
  at `0px` the gradient is two hard stops at the edges and the mask is a no-op,
  so a strip that fits costs nothing. **happy-dom reports every scroll metric
  as 0**, so no test can observe this without stubbing the geometry — the tests
  that exist stub it deliberately and are tests of the state machine, not of
  the layout.

- **The strip's scroll buttons pass no `behavior` to `scrollBy()`.** The
  default defers to the element's computed `scroll-behavior`, which the CSS
  sets to `smooth` and the reduced-motion block forces back to `auto`. Passing
  `'smooth'` explicitly would override the CSS and animate for users who asked
  it not to, and would need a second, separate `prefers-reduced-motion` check
  in the JS to avoid it. Leave it off.

- **`list` is ONE ROW PER ENTRY, interleaved out of two DOM lists by
  `--tl-i`.** A row is `[ year | medallion ] [ title + body ]`, every entry is
  on screen at once, non-active rows are greyed and the active one carries an
  `--tl-accent` wash across both halves. Nothing translates and nothing is
  hidden. Everything in this bullet is true of `list-alternating` too — see
  its own bullet for the little that differs. Three things make that work, and
  each is load-bearing:
  - *`--tl-i` is why the library writes a second custom property.* The DOM
    contract keeps dates and slides in two separate index-parallel lists, so
    date `i` and slide `i` are in different subtrees; CSS alone cannot pair
    them, because the root carries only `--tl-index`/`--tl-count` and neither
    says which row a given `li` belongs to. The constructor therefore writes
    `--tl-i` (the plain list position) onto every `#dateLinks` entry and every
    `#items` entry, both lists' wrappers are flattened into the root grid with
    `display: contents`, and each side places itself with
    `grid-row: calc(var(--tl-i) + 1)`. This is inside the "JS only toggles
    classes and writes custom properties" invariant, not an exception to it —
    the value is derived purely from list position and carries no authored
    content. `destroy()` removes it from both lists, like everything else.
  - *The ROOT is the scroll container, not `[data-timelinr-dates]`.* It has to
    be: `display: contents` means the dates wrapper generates no box at all,
    so it can be neither a scroll container nor an overflow clip. `max-height:
    calc(var(--tl-visible, 5) * var(--tl-row, 5rem)); overflow-y: auto;
    scroll-behavior: smooth` lives on the root, and the container-scoped
    scrolling `#apply()` makes on the active date link still positions it,
    since the root is among the containers it moves. Native scrolling (not `stack`'s fixed-step
    `translateY`) because entry heights follow their text — measured 87.3px to
    109.8px across the ten example rows against a nominal `--tl-row` of 80px —
    and a fixed step desynchronises further with every navigation, exactly as
    `stack`'s own bullet describes. Consequence: **`--tl-visible` is an
    approximation, not an exact count.** Don't document or reason about it as
    an exact number of rows. Second consequence: the reduced-motion
    `scroll-behavior: auto !important` rule must name the **root**, or the
    list variants keep smooth-scrolling under `reduce`. The root is one of
    three boxes that rule has to name, and they are three different elements:
    the root (the list variants' scroller), `[data-timelinr-dates]` (`rail`'s),
    and `[data-timelinr-dates] > ul` (`tabs`'). Every `scroll-behavior: smooth`
    in the file is set by a more specific selector than that rule, which is why
    it needs `!important`. **Keep all three.** Dropping any one silently
    re-enables smooth scrolling for that variant under `reduce`.
  - *Prev/next are `position: sticky` here, not `absolute`.* This is the one
    variant family that overrides the shared base's positioning wholesale, and
    it follows from the bullet directly above: the root is the scroll
    container, and an absolutely positioned box inside a scroll container is
    laid out against that container's padding box and then scrolls away with
    the content. It shipped that way and the arrows rode the list clean out of
    the window — reproduced in isolation, a button's top moved exactly -600px
    across a 600px scroll. There is no other element to anchor to (the
    `display: contents` wrappers generate no boxes and the library adds no
    DOM), so the buttons go back into flow as grid items and stick. Two
    consequences worth knowing before editing them: a sticky box can only
    float within its own grid area, so they need an explicit
    `grid-row: 1 / span var(--tl-count, 1)` — auto-placement would drop them
    into a fresh implicit row below every entry and pin them to a strip of
    nothing — and `inset: auto` has to come first, because the base's
    `left`/`right`/`top: 50%` become sticky *constraints* and `overflow-y:
    auto` makes the root a horizontal scrollport too.
  - *Dimming is by COLOUR, not by the shared base's `opacity`.* The base fades
    non-selected slides to `opacity: 0.25`, which is right for a panel showing
    one slide at a time and wrong here, where every entry is permanently on
    screen and has to stay readable: 0.25 puts body text at roughly 1.7:1
    against `--tl-bg`. `list` overrides it to `opacity: 1` plus `color:
    var(--tl-muted)` — the exact treatment the date link on the same row
    already used, so the two halves match, and `--tl-muted` is a value already
    contrast-checked against every theme's `--tl-bg` (measured 5.30:1 to
    7.06:1). Don't "restore consistency" with the base here.
  - *History.* Before 2.0.1 this variant put the description in a separate
    panel *below* the dates rail and revealed it with `display: none` /
    `display: grid` on the slides. That is gone — the panel no longer exists
    as a separate visual region and no slide is hidden. If you find a comment
    or doc claiming `list` "reveals the active slide by `display`", it is
    stale; fix it rather than coding to it.

- **`list-alternating` is `list` with the rail in the middle — a VARIANT, not
  a modifier, and that was a deliberate reversal.** It shares the entire model
  above: every entry visible, no translation, nothing hidden, `--tl-i`
  interleaving, the root as scroll container, colour-not-opacity dimming,
  sticky arrows, click-to-select. What differs is only where things sit:
  - *Why a variant and not a `data-timelinr-alternate` / `alternate?: boolean`
    modifier.* It was first specified as an orthogonal setting for "the
    vertical variants". It cannot be one. Alternation means putting sibling
    entries on opposite sides of a shared rail, which requires two or more
    entries laid out at once — true only where every entry is on screen.
    `stack` shows ONE entry at a time beside a scrolling column of bare years:
    there are no visible siblings to alternate against, and the only
    multi-entry surface it has is a 7rem clipped column holding no entry text
    at all. Alternating there would zig-zag bare years inside a strip whose
    fixed `--tl-date-step` and `--tl-stack-rail-inset` clip-clearance both
    assume full-width rows, and would still not look like an alternating
    timeline, because the thing being alternated — the entry's text — is not
    in that column. So the feature is meaningful in exactly one place, and a
    boolean that is a documented no-op in half its stated scope is worse
    markup than a variant name. If someone asks for it on `stack` again, this
    is the reasoning; don't generalise it back into an option.
  - *How the shared CSS is factored.* Section 6 of `styles/timelinr.css` is
    written for BOTH variants via
    `[data-timelinr]:is([data-timelinr-variant='list'],
    [data-timelinr-variant='list-alternating'])`, and section 7 overrides only
    the difference. `:is()` takes the specificity of its most specific
    argument, so that pair is exactly as specific as the plain
    `[data-timelinr][data-timelinr-variant='…']` it replaced — nothing else in
    the file shifted. The corollary is the trap: section 7's selectors **tie**
    with section 6's and win only on source order, so section 7 must stay
    below section 6. Don't duplicate section 6 per variant, and don't merge
    section 7 up into it.
  - *The geometry, and the one value it all comes from.* Three root columns,
    `[ content | --tl-alt-rail-col | content ]`, and TWO grid rows per entry
    (`2i + 1` for the year link, `2i + 2` for the title and body) because
    "year above its text" stacks two elements the DOM keeps in different
    subtrees. Both halves of an entry span the rail column (`1 / 3` on the
    left, `2 / 4` on the right) rather than stopping beside it — that is what
    makes the rail continuous, since the line is a background painted on each
    half. `padding-inline: 0` and `column-gap: 0` on the year link are
    load-bearing: they make the link's own medallion track coincide with the
    root's rail track, so the disc's centre is `rail / 2` from the facing edge
    on both sides, and the rail line is anchored the same `rail / 2` in from
    that same edge using the 4-value `background-position` syntax (a
    `calc(100% - …)` would resolve its percentage against box − image, not the
    box). Body text is held off the rail by exactly one rail track of padding
    on the far side. Measured at index 0, 4, 5 and 9: rail centre, disc centre
    and both background lines all at 591.00px, delta 0.00. This is the
    alignment lesson applied — change `--tl-alt-rail-col` and all six move
    together; there is no measured `left`/`right` in the block.
  - *Alternation is `:nth-child()` parity, not `--tl-i`.* `--tl-i` is a value
    and CSS has no selector that branches on a custom property's parity (style
    container queries match exact values, so it would take one query per
    index). The mirror needs three non-numeric switches — which columns the
    entry spans, the order of the two tracks inside the year link, and which
    edge the text and rail line anchor to — none of them expressible as
    arithmetic on `--tl-i` however it is written. Parity is safe where an
    index would not be: the "derive an index through `#dateLinks`/`#items`,
    never from sibling position" invariant is about identity, and this asks
    only "same side as my neighbours or the other one". `--tl-i` keeps its
    real job here — which row an entry occupies. The markup contract (both
    `ul`s hold the same number of `li`s in the same order) is what guarantees
    the two sides agree on parity; if that contract is ever loosened, this
    breaks before anything else does.
  - *Gated on `min-width: 641px`.* Two alternating columns of prose are
    unreadable on a phone. The narrow fallback is not a second layout to
    maintain: section 7 simply does not apply, so `list-alternating` renders
    as `list`, whose own narrow tuning in section 8 already names both
    variants. `--tl-row` is also raised to `9rem` there, because an entry is
    two rows tall and `--tl-visible` multiplies it.

- **Icons are inline `<svg>`s inside the date `<a>`, never on the slide.**
  The medallion is the disc pseudo-element `a::before` plus a real `<svg>`
  child of the date link; the stylesheet pins both to the same grid cell
  (row 1, column 2 — column 1 on even rows of `list-alternating`) and tints
  the glyph with `color: var(--tl-bg)`, so any `stroke`/`fill="currentColor"`
  icon picks up the theme. The svg must be authored inside the date link (see
  `examples/list/index.html`): it is a grid item OF that link's internal grid,
  and an element placed in a slide `<li>` could never participate in it — same
  subtree logic as the old custom-property rule, just structural instead of
  inheritance-based. An `<a>` without an `<svg>` renders no glyph; there is no
  default icon and no icon set ships with the library — deliberate, and what
  keeps the zero-dependency, single-stylesheet shape intact.

- **Prev/next are chevron masks, absolutely positioned, placed per variant.**
  The icon is a data-URI SVG chevron (adapted from
  [Lucide](https://lucide.dev), ISC licensed) applied as a CSS `mask-image`
  rather than an embedded `<svg>` or three real elements — `mask-image` lets
  the shape tint via `background-color` (`--tl-muted`, `--tl-accent` on
  hover) like every other themed color here, and needs zero markup change.
  This is the same tinting-by-mask trick the list variants' medallion used
  before icons became inline SVGs. Four separate data-URIs exist
  (left/right/up/down) and which pair applies is pure CSS: the shared base
  sets left/right, and one rule pair in the `stack` block — whose selectors
  name `stack` plus both list variants — overrides to up/down for the three
  variants whose dates run vertically. Don't consolidate them into one shape
  plus `transform: rotate()`; the variants also differ in *position*, not just
  icon rotation, so they are already separate rule blocks. **The whole shared
  block is deliberately unguarded by variant** — positioning, mask, hover and
  disabled states apply to any prev/next button in any variant, and the variant
  blocks only layer placement and icon direction on top. The consequence to keep
  in mind: `rail` and `stack` reserve a gutter for their arrows
  (`padding-inline` / `padding-block` on the root) but `tabs` has no root
  padding at all, so arrows added there float over the content. That is
  acceptable because it isn't designed with arrows — but don't "fix" it by
  guarding the shared block, which would strip the icon and positioning from
  every consumer who does want them. The list variants are the one place the
  shared *positioning* is overridden outright rather than layered on: they
  make the buttons `position: sticky` grid items, because their root is the
  scroll container and `absolute` scrolls away with the content (see `list`'s
  bullet). They float over the entries too, and answer it with an opaque
  circular chip rather than a gutter. Placement: elsewhere the buttons are
  `position: absolute` against `[data-timelinr]` (which is why the root has
  `position: relative`); the shared default is the left/right edge pair,
  vertically centred; `rail` overrides it to a `2.25rem` circular pair at
  `top: 1.5rem` sitting in the root's `padding-inline: 3rem` gutters (which
  exist only to clear those arrows, and are dropped below 640px along with the
  floating); `stack` moves them to `top: 0` / `bottom: 0`, horizontally
  centred, cleared by the root's `padding-block: 2.25rem` (if you resize the
  arrows, re-check that padding still clears them). Edge anchoring only looks right while the slide
  is a single row (image beside text, above 640px); once content stacks, the
  `@media (max-width: 640px)` block switches the arrows to `position:
  relative` (in flow below the slide) — **scoped to
  `[data-timelinr-variant='rail']`**, since it is the only variant with edge
  arrows, and stack's top/bottom pair never overlaps the stacked image. Don't
  drop that scoping without re-checking mobile. The button's own text content
  (`‹`/`›` in the example markup) is collapsed via `font-size: 0` purely to
  keep it simple (no wrapper span, no text-indent hack); it isn't for
  accessibility — `aria-label` already wins the accessible-name computation
  over text content regardless of how that text is hidden, so consumers must
  still set `aria-label` (e.g. `aria-label="Previous"`) themselves.

### Examples

- **There are seven example pages: one per variant plus `autoplay` and
  `fixed-header`** —
  `examples/{rail,stack,tabs,list,list-alternating,autoplay,fixed-header}/`,
  indexed by `examples/index.html`. (Pre-2.0 the set was
  horizontal/vertical/autoplay; those two directories no longer exist.)
  `autoplay` deliberately reuses the `rail` variant rather than adding a new
  layout — it demonstrates timing, hover pause and the live theme switcher,
  not a layout. `fixed-header` reuses `list` under a fixed site
  header and demonstrates the scrolling contract: entries align to the
  on-screen band inset by the root's `scroll-padding-top`. Adding a variant
  means adding its example page, its entry in `examples/index.html` *and* its
  entry point in `scripts/build-examples.mjs` — the third is easy to forget
  and fails silently, leaving the page with no compiled `main.js` at all.
- **Examples use static markup, not JS-generated DOM.** Each
  `examples/*/index.html` hardcodes its own `<ul>` of dates and `<ul>` of
  slides (the same 10 entries across six of the seven pages —
  `list-alternating` carries its own longer, deliberately uneven set, because
  a layout whose rows size to their text needs content that actually varies);
  each `main.ts` just does `document.getElementById('timeline')` and calls
  `new Timelinr(...)` — it doesn't build any markup. This is deliberate: it's
  the reference example of the library's actual DOM contract (see README's
  Markup contract table), and a consumer copying an example should be
  copying real usage, not a demo-only DOM-builder abstraction. There used to
  be a shared `examples/shared/timeline.ts` with a `buildTimeline()` helper
  that injected this markup via `createElement` calls — it was removed for
  this reason. Don't reintroduce a shared JS DOM-builder for examples; if the
  10-entry data ever needs to change, edit the `<li>`s in each of those six
  `index.html` files (a small `find`/`sed`, or a throwaway generation script
  you don't commit, is fine for doing that in one pass — just don't leave
  runtime example code depending on it). The two list pages are the exception
  worth knowing about: their date `<a>`s each carry an inline `<svg>` icon
  (pinned to the disc's grid cell by the stylesheet), so a bulk edit there has
  to preserve them, and `list-alternating`'s prose is not the shared set at all.

## Testing conventions

- Single file: `tests/timelinr.test.ts`, vitest + happy-dom. It verifies JS
  state (index, classes, ARIA, events) — it cannot catch a CSS/layout bug
  like the transform one above; those need an actual browser check.
- `vi.useFakeTimers()` runs in `beforeEach`; advance autoplay with
  `vi.advanceTimersByTime(...)`, never a real `setTimeout`/sleep.
- Build fixtures with the local `buildRoot(orientation, count, variant)`
  helper rather than hand-writing markup, so fixtures stay aligned with the
  real DOM contract. `orientation` and `variant` are typed `string | null` and
  passing `null` omits that attribute entirely — that is how the
  variant/orientation cross-derivation gets exercised, since a fixture with
  neither attribute is a real case, not a malformed one. (`count` is a plain
  `number` defaulting to `4`; it accepts omission but not `null`.)

### Browser verification is the only safety net for layout

happy-dom runs no layout, so every geometry invariant above (`rail`'s track
and fill, `stack`'s clamp, the `-100% * index` transform, `list`'s one-row
interleave) is verifiable *only* by opening the page in a real browser. That
makes the measuring itself load-bearing, and it has four sharp edges that cost
real time on this project. Each one produces a plausible-looking wrong number,
not an error, so a check that hits one reads as a passing check:

1. **Probe only in a focused, foreground tab.** Chrome returns *computed*
   rather than *used* values from `getComputedStyle` /
   `getBoundingClientRect` in background tabs and iframes. A correct
   `transform` reads back as the identity matrix under those conditions —
   indistinguishable from a transform that genuinely isn't applying. Bring
   the tab to the front and focus the window before measuring.
2. **Don't trust `getComputedStyle(el, '::before' | '::after')` on a
   transitioning property.** Measuring `rail`'s fill width mid-transition
   reported both `0px` and the full width for the same, correctly painted
   element. Pseudo-element readback during an in-flight transition is
   unreliable; measure real elements' rects, or wait out `--tl-speed` first.
3. **Don't believe a screenshot about a resize.** The screenshot tool's
   raster output has failed to change across a window resize even though the
   page's real layout did — so a responsive check "verified" from an image
   can be verifying the old viewport. Confirm the viewport actually changed
   with `window.innerWidth` and live DOM rects before reading anything into
   the picture. (The failure also runs the other way: `resize_window` has
   returned success while `window.innerWidth` stayed put, i.e. the page never
   resized at all. Same check catches both.)
4. **The automation tab may produce no animation frames at all.**
   `requestAnimationFrame` never ticks there — measured: 0 callbacks in
   300ms. Everything that depends on frames advancing therefore silently
   never runs: CSS `scroll-behavior: smooth` never progresses (so
   `scrollTo()` is a no-op and `scrollTop` stays where it was), and
   **CSS transitions never leave their start value**, so
   `getComputedStyle(...).backgroundColor` on a just-selected element reports
   `transparent` forever — a wrong answer that looks exactly like a rule that
   isn't applying. Confirm with a rAF tick count before trusting any
   motion-dependent check. The workarounds that do work: inject
   `transition: none !important` before reading a settled colour, and set
   `scroll-behavior: auto` before asserting on scroll position. Anything that
   genuinely requires animation to complete cannot be verified here — say so
   rather than reporting a number you could not observe.

**The alignment lesson.** Where a decoration must line up with an element
placed by a *different* layout system — a grid-placed box, or the edge of a
clipped container — derive both from one custom property, or make the
decoration a participant in the same layout. **Never hand-tune an absolute
offset against it.** This has cost real time twice: `list`'s medallion had a
disc at 96px, a `left: 4.6rem` glyph at 82.4px and a `left: 5.5rem` rail line
at 89px — and, because the disc's `justify-self` was left to resolve, the year
text was displaced out of column 1 as well. **Four** misaligned participants on
four different axes, not three, so glyphs poked outside their disc and the line
missed it entirely. The disc's 96px is worth remembering as its own trap: it
had no `justify-self`, and `justify-self: normal` resolves to `stretch`, which
falls back to `start` for a definite-width item — so the 2rem disc sat at the
`2.5rem` column's *start* (12 + 56 + 12 = 80, + 16 = 96), not its centre. 100px
is the correct **post-fix** number, which is what a measurement of today's code
returns; a report claiming the disc was already at 100px before the fix, or
that it "was never the misplaced participant", is describing the fixed code and
is wrong about the bug. The second case: `stack`'s dot and rail line drifted
apart the same way. Both are now single
properties (`--tl-rail-x`, `--tl-stack-rail-inset`) that every participant
reads, which is why a responsive override there restates *track values only*
and never a measured `left`/`right`. A hand-tuned offset is correct at exactly
one font size, one zoom level and one breakpoint, and nothing tells you when
it stops being.

## Gotchas

- `examples/` is not part of the published package (`package.json#files` is
  `dist` + `styles` only) — don't wire example code into the library build —
  but unlike a typical build artifact, its compiled output IS committed:
  `examples/*/main.js` (bundled+minified via `scripts/build-examples.mjs` /
  esbuild, `format: 'iife'`, no runtime imports) and
  `examples/assets/{timelinr,style}.min.css` are what the example HTML files
  actually reference, so the examples work by opening them through any plain
  static file server — not just `vite dev`. `main.ts` / `shared/style.css`
  remain the source of truth for editing; **after changing either, or
  `styles/timelinr.css`, run `npm run build:examples` and commit the
  regenerated output** — nothing regenerates it for you, and stale output
  silently drifts from the source.
- The library build (`vite build`) and the type declarations (`tsc -p
  tsconfig.build.json --emitDeclarationOnly`) are two separate steps chained
  in `npm run build:lib` — running only `vite build` will leave stale/missing
  `.d.ts` files in `dist/`. `dist/*.d.ts` are declaration-only (type
  signatures, no implementation) — that's the entire reason they're there:
  `package.json#types` points at `dist/index.d.ts` so TypeScript consumers
  get autocomplete/type-checking on `import { Timelinr } from 'timelinr'`.
  They are not, and must never become, a copy of the `.ts` source.
  Separately: Vite's ES-format lib builds deliberately keep whitespace and
  comments (`minifyWhitespace` is hardcoded false for them), so
  `vite.config.ts` carries an inline `minifyEsLibOutput()` plugin that runs
  esbuild over the written chunk in `closeBundle`. Don't remove it as redundant,
  and don't try to replace it with a `build.minify`/`esbuild` config option —
  those are overridden for ES lib builds. Bonus of doing it there: esbuild
  merges Vite's sourcemap, so `dist/timelinr.js.map` still points at `src/*.ts`.
- `dist/timelinr.css` (minified, via `scripts/build-css.mjs`) is what
  `package.json#exports["./styles/timelinr.css"]` actually resolves to.
  `styles/` is deliberately NOT in `package.json#files` — the published
  package contains only `dist/` (the unminified source stylesheet stays in
  the repo for development but does not ship). Don't re-add `styles` to
  `files`. If you rename or move either CSS file, update both the export map
  entry and `scripts/build-css.mjs`'s entry point together.
