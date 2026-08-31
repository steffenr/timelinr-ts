# timelinr

Framework-agnostic timeline slider. Modern TypeScript rebuild of [jQuery Timelinr](https://www.csslab.cl/2011/08/18/jquery-timelinr/).

* Zero dependencies, one self-registering `<timelinr-slider>` script: ~13.3 kB ESM (~4.3 kB gzipped); CSS ships minified too (~27.7 kB)
* Changelog in [CHANGELOG.md](CHANGELOG.md)
* Five visual variants — `rail`, `stack`, `tabs`, `list`, `list-alternating` — picked by one attribute
* Plain CSS (custom properties), CSS-transition animations, `prefers-reduced-motion` support
* Horizontal & vertical orientation, keyboard nav scoped to the widget (ignores focused form fields and fires only while focus is inside), autoplay with hover pause
* 5 built-in themes: `default`, `dark`, `ocean`, `forest`, `sunset` — body text, accent text and the accent-tinted washes behind active entries all meet WCAG AA contrast (4.5:1)
* ARIA out of the box, matched to the variant: carousel/slide roles with the inactive slides hidden where only one slide is on screen, list/listitem roles and nothing hidden where every entry is, plus a polite live region announcing the current date on change

## Install

```sh
npm install timelinr-ts
```

Import the stylesheet from the package (the export map resolves it to the minified `dist/timelinr.css`):

```html
<link rel="stylesheet" href="node_modules/timelinr-ts/dist/timelinr.css" />
```

or however your bundler exposes package imports, e.g.

```css
@import "timelinr-ts/styles/timelinr.css";
```

## Usage

Load the stylesheet and the self-registering script, then write markup — that is the entire integration. No bundler, no import map, no glue JavaScript:

```html
<script type="module" src="…/dist/timelinr.element.js"></script>

<timelinr-slider
  data-timelinr-variant="rail"
  data-timelinr-start-at="3"
  data-timelinr-arrow-keys
  data-timelinr-autoplay
  data-timelinr-autoplay-pause="6000">
  <div data-timelinr-dates>
    <ul>
      <li><a href="#1900">1900</a></li>
      <li><a href="#1930">1930</a></li>
    </ul>
  </div>

  <div data-timelinr-issues>
    <ul>
      <li><h3>1900</h3><p>…</p></li>
      <li><h3>1930</h3><p>…</p></li>
    </ul>
  </div>

  <button type="button" data-timelinr-prev aria-label="Previous">&lsaquo;</button>
  <button type="button" data-timelinr-next aria-label="Next">&rsaquo;</button>
</timelinr-slider>
```

Bundled consumers use `import 'timelinr-ts';` (the package entry **is** the element; it is declared in `sideEffects`, so bundlers will not tree-shake the registration away).

### Lifecycle and behaviour

* The stylesheet keys everything off the `<timelinr-slider>` tag selector, so a connected element is styled immediately.
* It initialises on insertion and destroys on removal: replacing the element's container (AJAX pagers, route changes) cannot leak an autoplay timer. Moving the element within the document keeps the current slide and playing state.
* Attribute changes after initialisation rebuild the timeline in place, keeping the current position.
* The instance methods are re-exposed on the element — `document.querySelector('timelinr-slider')!.next()` is the whole API, alongside `prev()`, `goTo(i)`, `play()`, `pause()` and the `index` / `count` getters. The root fires `timelinr:change` (`event.detail.index`) on every change.
* An empty `<timelinr-slider>` does not throw: it retries once in a microtask, then warns and stays inert (its `index` reads `0` while inert).
* Browser-only by design (`customElements` at module scope). Adopting an initialised slider into another document (an iframe) is not supported — move it within the same document instead.

### Markup contract

| Attribute                      | Required | Purpose                                                             |
| ------------------------------ | -------- | ------------------------------------------------------------------- |
| `data-timelinr-variant`        | no       | `rail`, `stack`, `tabs`, `list`, `list-alternating` — see Variants  |
| `data-timelinr-orientation`    | no       | `vertical` (default: horizontal)                                    |
| `data-timelinr-theme`          | no       | Theme name (`dark`, `ocean`, `forest`, `sunset`) — read by CSS only |
| `data-timelinr-dates`          | yes      | Container with a `ul > li > a` date list                            |
| `data-timelinr-issues`         | yes      | Container with a `ul > li` slide list                               |
| `data-timelinr-prev` / `-next` | optional | Navigation buttons; the library sets `disabled` at the ends         |
| `data-timelinr-dots`           | optional | Empty container; the library fills it with one button per item      |
| `data-timelinr-counter`        | optional | Element the library writes `"3 / 10"` into                          |

Every behaviour option has an attribute form, so a timeline is fully configured from markup:

| Attribute                          | Value                             |
| ---------------------------------- | --------------------------------- |
| `data-timelinr-start-at`           | Integer, 1-based (clamped to ≥ 1) |
| `data-timelinr-arrow-keys`         | Boolean                           |
| `data-timelinr-autoplay`           | Boolean                           |
| `data-timelinr-autoplay-direction` | `forward` | `backward`            |
| `data-timelinr-autoplay-pause`     | Integer ms (clamped to ≥ 500)     |

Booleans are presence-based: bare, `""`, and `"true"` mean true; `"false"` means false — both spellings case-insensitive. Numbers must be whole integers; trailing garbage (e.g. `3abc`) is invalid, not a leading 3.

Invalid values fall back to the default with a console warning rather than throwing — these values often come from a CMS field.

The date list and the slide list are index-parallel: date `n` selects slide `n`, so the two `<ul>`s must have the same number of `<li>`s in the same order. The `list` variants rely on this literally — they draw date `n` and slide `n` as one entry — so they are where a mismatched pair shows up fastest.

Events: the root fires `timelinr:change` (`event.detail.index`) on every change.

Selecting an entry: clicking a date link always works. Under `list` and `list-alternating`, where every entry's text is on screen, clicking an entry's **title or body** selects it too. Interactive content you put inside a slide — a link, a button, a form field — keeps its own behaviour and does not select the row.

#### Accessibility

The library picks its ARIA model from the variant, because the variants are not the same kind of widget:

|                      | `rail`, `stack`, `tabs`                                                             | `list`, `list-alternating` |
| -------------------- | ----------------------------------------------------------------------------------- | -------------------------- |
| On the root          | `role="region"` + `aria-roledescription="carousel"`                                 | `role="region"`            |
| On the slide `<ul>`  | —                                                                                   | `role="list"`              |
| On each slide `<li>` | `role="group"`, `aria-roledescription="slide"`, positional `aria-label` ("3 of 10") | `role="listitem"`          |
| `aria-hidden`        | On every inactive slide                                                             | Never                      |

One slide is on screen at a time in the first group, so hiding the others is right. In the second, every entry is permanently visible and readable, so it is a list, not a carousel — hiding the inactive entries would have exposed one row of ten to a screen reader while sighted users read them all. `role="list"` is set explicitly there because those variants flatten the wrapping `<ul>` with `display: contents`, which removes the native list role.

Both models also set `aria-current="true"` on the active date link, and a visually-hidden `aria-live="polite"` region announces the current date on every change; removing the element from the DOM removes all of it.

Consider adding your own `aria-label` on the root describing what the timeline is (e.g. "Company history").

Arrow-key navigation (`data-timelinr-arrow-keys`) only fires while focus is inside the widget, so multiple instances on one page never fight over the same keypress.

## Variants

`data-timelinr-variant` picks the layout. All five ship in the one stylesheet.

| Variant            | Orientation | What it looks like                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Parts it's designed around                                                                            |
| ------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `rail`             | horizontal  | A year strip above the slide with a progress line running dot-to-dot; the fill reaches the active dot, and the active year grows and turns `--tl-accent`. Circular arrow buttons at the left and right edges. The strip compresses its columns down to `--tl-date-min` and scrolls beyond that, fading out on whichever side has more; the progress line scrolls with the dots.                                                                                               | `prev` / `next`, restyled as circular edge buttons                                                    |
| `stack`            | vertical    | Dates run down a clipped, fixed-height column on the left, side by side with the slide on the right. The column scrolls in fixed steps to keep the active year a couple of rows from the top; the active year gets a tinted pill and a filled dot on a continuous rail. Slides slide vertically.                                                                                                                                                                              | `prev` / `next`, moved top/bottom-centre with up/down chevrons; `counter`                             |
| `tabs`             | horizontal  | Years become pills in a row that scrolls horizontally, the active pill filled in `--tl-accent`. When the row overflows it fades at the side with more and grows a pair of library-created chevron buttons that scroll it. Dot pagination sits below the slide. Slides slide horizontally.                                                                                                                                                                                     | `dots`                                                                                                |
| `list`             | vertical    | One row per entry — year, themed icon medallion (inline `<svg>`, see Icons), title and body all in line — threaded onto a continuous rail down the left. Every entry is visible at once: non-active rows are greyed to `--tl-muted`, and the active row is washed in `--tl-accent` across its full width. There is no separate slide panel and nothing slides; the list scrolls natively inside a windowed viewport, and clicking a row's text selects it. Images are hidden. | `prev` / `next`, with up/down chevrons, pinned to the top-right and bottom-right of the scroll window |
| `list-alternating` | vertical    | `list` with the rail moved to the **middle** and entries hung alternately off either side of it: each entry shows its year (with the medallion on the rail) above its title and body, right-aligned on the left-hand side and left-aligned on the right. Same colours, same interleave, same scrolling and same click-to-select. When the component itself is narrow it falls back to the plain `list` row, because two alternating columns of prose don't fit a narrow box.  | Same as `list`                                                                                        |

The library wires up every optional part it finds, but the *styling* splits two ways:

* **`dots` and `counter` are styled only by the variant listed above.** Put dots in a `rail` timeline and you get working but unstyled buttons; put a counter anywhere but `stack` and it renders as plain in-flow text.
* **Prev/next are always styled**, by rules that carry no variant condition: absolute positioning at the left/right edges, the chevron mask, and the hover/disabled states apply to any prev/next button in any variant. The variant blocks only layer placement and icon direction on top.

That second point has a sharp edge worth knowing. `rail` and `stack` reserve room for their arrows on the root (`padding-inline` and `padding-block` respectively); `tabs` has no such gutter, because it isn't designed with arrows.

So adding prev/next to a `tabs` timeline gives you positioned, chevron-iconed buttons floating over the content rather than beside it. If you want arrows there, add your own root padding, or reposition the buttons yourself.

The `list` variants are the one place the arrows are not absolutely positioned at all: their root is also the scroll container, and an absolutely positioned button inside a scroll container scrolls away with the content. There they become `position: sticky` grid items pinned to the top-right and bottom-right of the scroll window, on an opaque circular chip so they stay legible over the entries they float above.

Prev/next render as a chevron icon rather than a labelled button, so keep your `aria-label` on them: the visible text content is collapsed, and `aria-label` is what supplies the accessible name.

When the component itself is narrow (≤640px of available width — a phone, or the same slider in a narrow column on a wide page) a slide's image stacks above its text, and `rail` moves its arrows into flow below the slide rather than floating them over the image. Its progress line stays — it is drawn at every width now.

#### The dates strip when it doesn't fit

`rail` and `tabs` lay their dates out in one horizontal row, and both hide the scrollbar, so an overflowing strip used to say nothing at all about the dates past its edge.

Both now scroll, and both show which way there is more: the strip dissolves into the background on whichever side has content you haven't reached — `--tl-fade` wide, `2rem` by default, and nothing at all when the strip fits.

`tabs` also gets a pair of chevron buttons that scroll the strip by most of a screenful. The library creates them, because whether a strip overflows is a runtime fact about width; they are hidden entirely while the strip fits, and the one for the exhausted direction goes `disabled` at each end.

`rail` gets no equivalent on purpose: its prev/next arrows already sit in the gutters at either end of the strip, and selecting an entry scrolls that date into view, so a second pair beside them would be two controls for one job.

`rail` compresses its columns until they would go narrower than `--tl-date-min` (`5rem`) and scrolls beyond that, so the point at which it starts scrolling is yours to set. Raise it for labels longer than a year — the columns stay equal whatever you choose, which is what keeps the progress line landing on the dots.

Both respect `prefers-reduced-motion`: the buttons defer to the strip's CSS `scroll-behavior`, which that media query forces to `auto`.

#### Where the active entry lands

Activating an entry — clicking a date link, clicking a row (list variants), prev/next, arrow keys — scrolls the timeline's **own** containers first:

* the dates strip where one exists (`rail`, `tabs`)
* the root's scroll window on the `list` variants

The alignment target is the **whole entry** — under the list variants the union of the date link and its issue item — brought into view with per-variant alignment (`nearest` everywhere but `list-alternating`, whose two-row entries align to the start edge), with the entry's computed `scroll-margin` honored, and with an entry taller than the scroll window arriving **head-first** (native `nearest` semantics — pinning the tail would show only its last lines).

Alignment happens against the container's **on-screen portion**, inset by the container's `scroll-padding-*`: a widget whose window straddles the page fold or slides under a fixed header has edges you cannot see, and aligning an entry to a hidden edge would park it under the overlay.

The library cannot know your overlay heights, so it honors the standard declaration — a fixed-header site sets one `scroll-padding-top` on the root and entries align below the header. `examples/fixed-header/` is that exact frame.

When internal scrolling cannot fully reveal the entry — a short viewport with part of the widget behind a header can strand entries at the end of the internal scroll range, where no internal movement reaches them — a **user-initiated** action (clicks, prev/next, arrow keys) moves the **page** by the least amount that fits the entry into the viewport band inset by the root's `scroll-padding-*`.

**Autoplay never touches the page**, and neither does the initial `startAt` positioning; only something you did can move it, and only as far as your entry needs.

If you scroll entries at the page level yourself (deep links, anchor jumps), `--tl-scroll-margin-top` / `--tl-scroll-margin-bottom` reserve overlay space for those too — `scroll-margin` is honored by every scrolling ancestor.

#### Variant and orientation

The two attributes cross-derive, so either one alone is enough markup:

| Markup                                     | Variant            | Orientation  |
| ------------------------------------------ | ------------------ | ------------ |
| neither attribute                          | `rail`             | `horizontal` |
| `data-timelinr-orientation="horizontal"`   | `rail`             | `horizontal` |
| `data-timelinr-orientation="vertical"`     | `stack`            | `vertical`   |
| `data-timelinr-variant="rail"`             | `rail`             | `horizontal` |
| `data-timelinr-variant="stack"`            | `stack`            | `vertical`   |
| `data-timelinr-variant="tabs"`             | `tabs`             | `horizontal` |
| `data-timelinr-variant="list"`             | `list`             | `vertical`   |
| `data-timelinr-variant="list-alternating"` | `list-alternating` | `vertical`   |
| both set                                   | as written         | as written   |

Everything visual comes from the variant — no CSS rule keys off orientation. Orientation only decides which arrow keys navigate (left/right vs. up/down), so setting both to a mismatched pair is legal and simply changes the keys.

`data-timelinr-variant` (that is what the stylesheet matches). Removing the element restores whatever was there before: the attribute is removed if the library created it, and your original value is put back if the library overwrote one — including the case where an explicit `data-timelinr-variant` deliberately overrode a `data-timelinr-orientation` you authored.

#### Icons (`list`, `list-alternating`)

Both list variants draw an icon medallion for each entry: a disc behind a glyph.

Drop a real inline `<svg>` into the date `<a>` and the stylesheet places it on the disc for you — sized, centred, and above it in stacking order.

The glyph is tinted with the CSS `color` property, so write your icon against `currentColor` — any icon set drawn that way picks up the theme automatically (Lucide markup does by default).

An `<a>` without an `<svg>` just renders no glyph; there is no default icon.

A complete entry, using [Lucide](https://lucide.dev/)'s `music` icon (Lucide is ISC licensed):

```html
<li>
  <a href="#1950">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
    1950
  </a>
</li>
```

No icon set ships with the library. `examples/list/` and `examples/list-alternating/` have ten worked entries each to copy from.

#### Window size (`list`, `list-alternating`)

`--tl-row` is the nominal entry height and `--tl-visible` (default `5`; `2` when the component is narrow) how many of those the scroll window is tall — the timeline root gets `max-height: calc(var(--tl-visible) * var(--tl-row))` and scrolls, keeping the active entry in view.

`--tl-row` defaults to `5rem` for `list` and `9rem` for `list-alternating`, whose entries are two rows tall (year above text).

Entry heights follow their text, so **`--tl-visible` is an approximation, not an exact count**: it sets a viewport height as a multiple of the nominal row, and how many entries actually fit depends on how long your title and body wrap.

In `examples/list/` the ten rows range from 87px to 110px against a nominal 80px, so a `--tl-visible` of `5` shows about four. Raise `--tl-row` if your entries run long and you want the window to keep pace.

Set `--tl-list-max-height: none` to remove the window entirely: the root auto-sizes to its content, every entry is permanently visible and nothing scrolls internally (the page takes over when entries fall outside the viewport).

`--tl-list-max-height` replaces the whole computed `max-height`, so it also accepts any length.

## Theming

Override custom properties on the root or any ancestor:

| Property                                               | Default                                      | Applies to                                                                                                                                                                        |
| ------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--tl-bg` / `--tl-fg`                                  | `#ffffff` / `#1a1a1a`                        | all                                                                                                                                                                               |
| `--tl-accent`                                          | `#0a66c2`                                    | all                                                                                                                                                                               |
| `--tl-muted` / `--tl-border`                           | `#6b6b6b` / `#d9d9d9`                        | all                                                                                                                                                                               |
| `--tl-speed`                                           | `500ms`                                      | all                                                                                                                                                                               |
| `--tl-radius`                                          | `0.375rem`                                   | all                                                                                                                                                                               |
| `--tl-height`                                          | `70vh`                                       | `stack` (its fixed overall height)                                                                                                                                                |
| `--tl-img-width`                                       | `26rem`                                      | the slide's image column (`rail`, `stack`, `tabs`)                                                                                                                                |
| `--tl-date-min`                                        | `5rem`                                       | `rail`, `tabs` — the narrowest a dates column may get before the strip scrolls instead of compressing further                                                                     |
| `--tl-list-max-height`                                 | `calc(var(--tl-visible) * var(--tl-row))`    | the `list` variants — replaces the whole scroll window; `none` auto-sizes to content (see above)                                                                                  |
| `--tl-row` / `--tl-visible`                            | `5rem` (`9rem` for `list-alternating`) / `5` | the `list` variants (see above)                                                                                                                                                   |
| `--tl-alt-rail-col`                                    | `3rem`                                       | `list-alternating`'s centre rail track — every horizontal position in that layout derives from it                                                                                 |
| `--tl-pad-block` / `--tl-pad-inline`                   | `1.25rem` / `2rem`                           | all — the component's own edge spacing inside its `--tl-bg` box (`rail` widens the inline pad to `3rem` to clear its edge arrows; when narrow it falls back to `--tl-pad-inline`) |
| `--tl-scroll-margin-top` / `--tl-scroll-margin-bottom` | `0px`                                        | all — overlay space (a fixed site header, typically) reserved when an entry is scrolled against a viewport edge; see "Where the active entry lands"                               |

`stack`'s slide image uses a fixed `max-height` (`11rem`; `8rem` when the component is narrow) rather than an aspect ratio, because its column has a fixed height budget.

That cap is tuned for the `26rem` `--tl-height` used in `examples/stack/`; with a very different `--tl-height`, override:

```css
[data-timelinr-variant="stack"] [data-timelinr-issues] img {
  max-height: …;
}
```

to match.

## Development

```sh
npm install
npm run dev             # examples at http://localhost:5173/examples/, live TS transform
npm test                # vitest
npm run typecheck       # tsc --noEmit
npm run build           # dist/timelinr.element.js + .css (minified) + .d.ts, and examples/*/main.js
npm run build:lib       # just the library
npm run build:examples  # just the examples' compiled JS/CSS
```

Examples live in [`examples/`](examples/), one per variant:

* [`rail`](examples/rail/)
* [`stack`](examples/stack/)
* [`tabs`](examples/tabs/)
* [`list`](examples/list/)
* [`list-alternating`](examples/list-alternating/)

Plus:

* [`autoplay`](examples/autoplay/) — with a live theme switcher
* [`fixed-header`](examples/fixed-header/) — a `list` timeline under a fixed site header, demonstrating how the active entry stays fully in view
* [`auto-size`](examples/auto-size/) — a `list` timeline with `--tl-list-max-height: none` and a toggle against the default window

Sample images via [Picsum Photos](https://picsum.photos/).

Their HTML references compiled, minified `main.js` + `assets/*.min.css` (not raw `.ts`) as a plain `<script>` (no `type="module"`), so they work through any static file server — not just `npm run dev` — with no separate build step needed after cloning.

A plain (non-module) script also isn't subject to the same-origin restriction that blocks `<script type="module">`'s `import` under `file://`, though we haven't exhaustively verified opening the file directly in every browser.

If you edit an example's `.ts` / `.css` source, run `npm run build:examples` to regenerate the committed output.

MIT licensed; original jQuery plugin © 2011 CSSLab.cl (MIT).
