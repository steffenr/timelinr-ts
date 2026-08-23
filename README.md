# timelinr

Framework-agnostic timeline slider. Modern TypeScript rebuild of
[jQuery Timelinr](https://www.csslab.cl/2011/08/18/jquery-timelinr/).

- Zero dependencies, ~7.6 kB ESM (~2.3 kB gzipped); CSS ships minified too
- Five visual variants — `rail`, `stack`, `tabs`, `list`, `list-alternating` — picked by one attribute
- Plain CSS (custom properties), CSS-transition animations, `prefers-reduced-motion` support
- Horizontal & vertical orientation, keyboard nav scoped to the widget (ignores focused form fields
  and fires only while focus is inside), autoplay with hover pause
- 5 built-in themes: `default`, `dark`, `ocean`, `forest`, `sunset` — body text, accent text and the
  accent-tinted washes behind active entries all meet WCAG AA contrast (4.5:1)
- ARIA out of the box, matched to the variant: carousel/slide roles with the inactive slides hidden
  where only one slide is on screen, list/listitem roles and nothing hidden where every entry is,
  plus a polite live region announcing the current date on change

## Install

```sh
npm install @steffenr/timelinr
```

## Usage

```html
<link rel="stylesheet" href="timelinr.css" />

<div data-timelinr>
  <div data-timelinr-dates><ul>
    <li><a href="#1900">1900</a></li>
    <li><a href="#1930">1930</a></li>
  </ul></div>
  <div data-timelinr-issues><ul>
    <li><h3>1900</h3><p>…</p></li>
    <li><h3>1930</h3><p>…</p></li>
  </ul></div>
  <button type="button" data-timelinr-prev aria-label="Previous">&lsaquo;</button>
  <button type="button" data-timelinr-next aria-label="Next">&rsaquo;</button>
</div>
```

```ts
import { Timelinr } from '@steffenr/timelinr';

const t = new Timelinr(document.querySelector('[data-timelinr]')!, {
  variant: 'rail',     // 'rail' | 'stack' | 'tabs' | 'list' | 'list-alternating'; overrides the attribute
  orientation: 'horizontal', // overrides the attribute; defaults from the variant
  startAt: 1,          // 1-based
  arrowKeys: true,     // left/right (horizontal) or up/down (vertical)
  autoPlay: true,
  autoPlayPause: 4000,
  autoPlayDirection: 'forward',
});

t.next();
t.goTo(2);
t.pause();
t.destroy();
```

Or zero-config:

```ts
import { autoInit } from '@steffenr/timelinr';
autoInit(); // initializes every [data-timelinr] on the page
```

### Markup contract

| Attribute | Required | Purpose |
|---|---|---|
| `data-timelinr` | yes | root element |
| `data-timelinr-variant` | no | `rail`, `stack`, `tabs`, `list`, `list-alternating` — see Variants |
| `data-timelinr-orientation` | no | `vertical` (default: horizontal) |
| `data-timelinr-theme` | no | theme name (`dark`, `ocean`, `forest`, `sunset`) |
| `data-timelinr-dates` | yes | container with a `ul > li > a` date list |
| `data-timelinr-issues` | yes | container with a `ul > li` slide list |
| `data-timelinr-prev` / `-next` | optional | navigation buttons; the library sets `disabled` at the ends |
| `data-timelinr-dots` | optional | empty container; the library fills it with one button per item |
| `data-timelinr-counter` | optional | element the library writes `"3 / 10"` into |

The date list and the slide list are index-parallel: date `n` selects slide `n`,
so the two `<ul>`s must have the same number of `<li>`s in the same order. The
`list` variants rely on this literally — they draw date `n` and slide `n` as one
entry — so they are where a mismatched pair shows up fastest.

Events: the root fires `timelinr:change` (`event.detail.index`) on every change.

Selecting an entry: clicking a date link always works. Under `list` and
`list-alternating`, where every entry's text is on screen, clicking an entry's
**title or body** selects it too. Interactive content you put inside a slide —
a link, a button, a form field — keeps its own behaviour and does not select
the row.

#### Accessibility

The library picks its ARIA model from the variant, because the variants are not
the same kind of widget:

| | `rail`, `stack`, `tabs` | `list`, `list-alternating` |
|---|---|---|
| on the root | `role="region"` + `aria-roledescription="carousel"` | `role="region"` |
| on the slide `<ul>` | — | `role="list"` |
| on each slide `<li>` | `role="group"`, `aria-roledescription="slide"`, positional `aria-label` ("3 of 10") | `role="listitem"` |
| `aria-hidden` | on every inactive slide | never |

One slide is on screen at a time in the first group, so hiding the others is
right. In the second every entry is permanently visible and readable, so it is
a list, not a carousel — hiding the inactive entries would have exposed one row
of ten to a screen reader while sighted users read them all. `role="list"` is
set explicitly there because those variants flatten the wrapping `<ul>` with
`display: contents`, which removes the native list role.

Both models also set `aria-current="true"` on the active date link, and a
visually-hidden `aria-live="polite"` region announces the current date on every
change. `destroy()` removes all of it. Consider adding your own `aria-label` on
the root describing what the timeline is (e.g. "Company history"). Arrow-key
navigation (`arrowKeys: true`) only fires while focus is inside the widget, so
multiple instances on one page never fight over the same keypress.

### Variants

`data-timelinr-variant` picks the layout. All five ship in the one stylesheet.

| Variant | Orientation | What it looks like | Parts it's designed around |
|---|---|---|---|
| `rail` | horizontal | A year strip above the slide with a progress line running dot-to-dot; the fill reaches the active dot, and the active year grows and turns `--tl-accent`. Circular arrow buttons at the left and right edges. The strip compresses its columns down to `--tl-date-min` and scrolls beyond that, fading out on whichever side has more; the progress line scrolls with the dots. | `prev` / `next`, restyled as circular edge buttons |
| `stack` | vertical | Dates run down a clipped, fixed-height column on the left, side by side with the slide on the right. The column scrolls in fixed steps to keep the active year a couple of rows from the top; the active year gets a tinted pill and a filled dot on a continuous rail. Slides slide vertically. | `prev` / `next`, moved top/bottom-centre with up/down chevrons; `counter` |
| `tabs` | horizontal | Years become pills in a row that scrolls horizontally, the active pill filled in `--tl-accent`. When the row overflows it fades at the side with more and grows a pair of library-created chevron buttons that scroll it. Dot pagination sits below the slide. Slides slide horizontally. | `dots` |
| `list` | vertical | One row per entry — year, themed icon medallion (see `--tl-icon`), title and body all in line — threaded onto a continuous rail down the left. Every entry is visible at once: non-active rows are greyed to `--tl-muted`, and the active row is washed in `--tl-accent` across its full width. There is no separate slide panel and nothing slides; the list scrolls natively inside a windowed viewport, and clicking a row's text selects it. Images are hidden. | `prev` / `next`, with up/down chevrons, pinned to the top-right and bottom-right of the scroll window |
| `list-alternating` | vertical | `list` with the rail moved to the **middle** and entries hung alternately off either side of it: each entry shows its year (with the medallion on the rail) above its title and body, right-aligned on the left-hand side and left-aligned on the right. Same colours, same interleave, same scrolling and same click-to-select. Below 641px it falls back to the plain `list` row, because two alternating columns of prose don't fit a phone. | same as `list` |

The library wires up every optional part it finds, but the *styling* splits two
ways:

- **`dots` and `counter` are styled only by the variant listed above.** Put dots
  in a `rail` timeline and you get working but unstyled buttons; put a counter
  anywhere but `stack` and it renders as plain in-flow text.
- **Prev/next are always styled**, by rules that carry no variant condition:
  absolute positioning at the left/right edges, the chevron mask, and the
  hover/disabled states apply to any prev/next button in any variant. The
  variant blocks only layer placement and icon direction on top.

That second point has a sharp edge worth knowing. `rail` and `stack` reserve
room for their arrows on the root (`padding-inline` and `padding-block`
respectively); `tabs` has no such gutter, because it isn't designed with
arrows. So adding prev/next to a `tabs` timeline gives you positioned,
chevron-iconed buttons floating over the content rather than beside it. If you
want arrows there, add your own root padding, or reposition the buttons
yourself.

The `list` variants are the one place the arrows are not absolutely positioned
at all: their root is also the scroll container, and an absolutely positioned
button inside a scroll container scrolls away with the content. There they
become `position: sticky` grid items pinned to the top-right and bottom-right
of the scroll window, on an opaque circular chip so they stay legible over the
entries they float above.

Prev/next render as a chevron icon rather than a labelled button, so keep your
`aria-label` on them: the visible text content is collapsed, and `aria-label`
is what supplies the accessible name. On narrow viewports (≤640px) a slide's
image stacks above its text, and `rail` moves its arrows into flow below the
slide rather than floating them over the image. Its progress line stays — it is
drawn at every width now.

#### The dates strip when it doesn't fit

`rail` and `tabs` lay their dates out in one horizontal row, and both hide the
scrollbar, so an overflowing strip used to say nothing at all about the dates
past its edge. Both now scroll, and both show which way there is more: the
strip dissolves into the background on whichever side has content you haven't
reached — `--tl-fade` wide, `2rem` by default, and nothing at all when the
strip fits.

`tabs` also gets a pair of chevron buttons that scroll the strip by most of a
screenful. The library creates them, because whether a strip overflows is a
runtime fact about width; they are hidden entirely while the strip fits, and
the one for the exhausted direction goes `disabled` at each end. `rail` gets no
equivalent on purpose: its prev/next arrows already sit in the gutters at
either end of the strip, and selecting an entry scrolls that date into view, so
a second pair beside them would be two controls for one job.

`rail` compresses its columns until they would go narrower than `--tl-date-min`
(`5rem`) and scrolls beyond that, so the point at which it starts scrolling is
yours to set. Raise it for labels longer than a year — the columns stay equal
whatever you choose, which is what keeps the progress line landing on the dots.

Both respect `prefers-reduced-motion`: the buttons defer to the strip's CSS
`scroll-behavior`, which that media query forces to `auto`.

#### Variant and orientation

The two attributes cross-derive, so either one alone is enough markup:

| Markup | Variant | Orientation |
|---|---|---|
| neither attribute | `rail` | `horizontal` |
| `data-timelinr-orientation="horizontal"` | `rail` | `horizontal` |
| `data-timelinr-orientation="vertical"` | `stack` | `vertical` |
| `data-timelinr-variant="rail"` | `rail` | `horizontal` |
| `data-timelinr-variant="stack"` | `stack` | `vertical` |
| `data-timelinr-variant="tabs"` | `tabs` | `horizontal` |
| `data-timelinr-variant="list"` | `list` | `vertical` |
| `data-timelinr-variant="list-alternating"` | `list-alternating` | `vertical` |
| both set | as written | as written |

The `variant` and `orientation` constructor options override the attributes.
Everything visual comes from the variant — no CSS rule keys off orientation.
Orientation only decides which arrow keys navigate (left/right vs. up/down),
so setting both to a mismatched pair is legal and simply changes the keys.

The library writes the resolved variant back onto the root as
`data-timelinr-variant` (that is what the stylesheet matches). `destroy()`
restores whatever was there before: it removes the attribute if the library
created it, and puts your original value back if the library overwrote one —
including the case where a `variant` option deliberately overrode the
attribute you authored.

#### Icons (`list`, `list-alternating`)

Both list variants draw an icon medallion for each entry, masked from
`--tl-icon`. Set it on the date `<li>`, not on the slide: custom properties
inherit down the tree, and the medallion is painted on the date link.

The value is used as a CSS `mask-image`, so the glyph takes its colour from the
theme and any single-colour SVG works. Inline it as a data URI with `<`, `>` and
`#` percent-escaped. A complete entry, using [Lucide](https://lucide.dev)'s
`music` icon (Lucide is ISC licensed):

```html
<li style="--tl-icon: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 18V5l12-2v13'/%3E%3Ccircle cx='6' cy='18' r='3'/%3E%3Ccircle cx='18' cy='16' r='3'/%3E%3C/svg%3E&quot;)">
  <a href="#1950">1950</a>
</li>
```

No icon set ships with the library and there is no default glyph, so set
`--tl-icon` on every date `<li>`. `examples/list/` and
`examples/list-alternating/` have ten worked entries each to copy from.

#### Window size (`list`, `list-alternating`)

`--tl-row` is the nominal entry height and `--tl-visible` (default `5`; `2`
below 640px) how many of those the scroll window is tall — the timeline root
gets `max-height: calc(var(--tl-visible) * var(--tl-row))` and scrolls, keeping
the active entry in view. `--tl-row` defaults to `5rem` for `list` and `9rem`
for `list-alternating`, whose entries are two rows tall (year above text).

Entry heights follow their text, so **`--tl-visible` is an approximation, not an
exact count**: it sets a viewport height as a multiple of the nominal row, and
how many entries actually fit depends on how long your title and body wrap. In
`examples/list/` the ten rows range from 87px to 110px against a nominal 80px,
so a `--tl-visible` of `5` shows about four. Raise `--tl-row` if your entries
run long and you want the window to keep pace.

### Theming

Override custom properties on the root or any ancestor:

| Property | Default | Applies to |
|---|---|---|
| `--tl-bg` / `--tl-fg` | `#ffffff` / `#1a1a1a` | all |
| `--tl-accent` | `#0a66c2` | all |
| `--tl-muted` / `--tl-border` | `#6b6b6b` / `#d9d9d9` | all |
| `--tl-speed` | `500ms` | all |
| `--tl-radius` | `0.375rem` | all |
| `--tl-height` | `70vh` | `stack` (its fixed overall height) |
| `--tl-img-width` | `26rem` | the slide's image column (`rail`, `stack`, `tabs`) |
| `--tl-date-min` | `5rem` | `rail`, `tabs` — the narrowest a dates column may get before the strip scrolls instead of compressing further |
| `--tl-fade` | `2rem` | `rail`, `tabs` — how much of the strip's edge dissolves to show there is more that way |
| `--tl-row` / `--tl-visible` | `5rem` (`9rem` for `list-alternating`) / `5` | the `list` variants (see above) |
| `--tl-alt-rail-col` | `3rem` | `list-alternating`'s centre rail track — every horizontal position in that layout derives from it |
| `--tl-icon` | none | the `list` variants, per date `<li>` (see above) |

`stack`'s slide image uses a fixed `max-height` (`11rem`; `8rem` below 640px)
rather than an aspect ratio, because its column has a fixed height budget. That
cap is tuned for the `26rem` `--tl-height` used in `examples/stack/`; with a very
different `--tl-height`, override
`[data-timelinr-variant="stack"] [data-timelinr-issues] img { max-height: … }`
to match.

## Migrating from the jQuery Timelinr

This rewrite replaces the original dotted-line styling with the variants above. No markup
or JavaScript change is required — a timeline with no `data-timelinr-variant`
now renders as `rail` (horizontal) or `stack` (vertical) — but **the visual
result differs**. There is no flag to restore the 1.x look; copy the 1.x
`styles/timelinr.css` into your own project if you need it.

What to check in an existing integration:

- **Prev/next `disabled` is now owned by the library**, which sets it at the
  first and last item. If you were setting it yourself, delete that code.
- **Custom CSS targeting `[data-timelinr-dates] a` needs rewriting** against the
  variant selectors, since each variant styles its date list differently.

`data-timelinr-dots` and `data-timelinr-counter` are new *optional* parts, not
migrations: they do nothing unless you add the elements, so an existing timeline
needs no change for them.

## Development

```sh
npm install
npm run dev             # examples at http://localhost:5173/examples/, live TS transform
npm test                # vitest (64 tests)
npm run typecheck       # tsc --noEmit
npm run build           # dist/timelinr.js + .css (minified) + .d.ts, and examples/*/main.js
npm run build:lib       # just the library
npm run build:examples  # just the examples' compiled JS/CSS
```

Examples live in [`examples/`](examples/), one per variant —
[rail](examples/rail/), [stack](examples/stack/), [tabs](examples/tabs/),
[list](examples/list/),
[list-alternating](examples/list-alternating/) — plus
[autoplay](examples/autoplay/) (with a live theme switcher). Sample images via
<https://picsum.photos>. Their HTML references
compiled, minified `main.js` + `assets/*.min.css` (not raw `.ts`) as a plain
`<script>` (no `type="module"`), so they work through any static file server —
not just `npm run dev` — with no separate build step needed after cloning; a
plain (non-module) script also isn't subject to the same-origin restriction
that blocks `<script type="module">`'s `import` under `file://`, though we
haven't exhaustively verified opening the file directly in every browser. If
you edit an example's `.ts`/`.css` source, run `npm run build:examples` to
regenerate the committed output.

MIT licensed; original jQuery plugin © 2011 CSSLab.cl (MIT).
