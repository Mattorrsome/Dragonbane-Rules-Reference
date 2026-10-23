# Components

Every class below is defined in `assets/dragonbane.css`. Use them as written.

## Page frame

```html
<nav class="navbar"><div class="nav-content">
  <a class="nav-brand" href="#">Title</a>
  <div class="nav-links"><a href="...">GitHub</a></div>
</div></nav>

<header class="hero"><div class="hero-content">
  <h1 class="hero-title">Title</h1>
  <p class="hero-subtitle">One-line italic tagline</p>
  <div class="hero-actions">
    <a class="btn btn-primary" href="#install">Get Started</a>
    <a class="btn btn-secondary" href="#how">Learn More</a>
  </div>
</div></header>

<div class="page-shell"><div class="page-scroll">
  ...lore quote and main content...
</div></div>

<footer class="footer"><div class="footer-content">
  <p class="footer-disclaimer">Not affiliated with Fria Ligan AB...</p>
  <div class="footer-links"><p>Credits</p></div>
</div></footer>
```

Nav links can carry a 20px inline SVG icon before the text (the original uses the GitHub mark).

## Sections and columns

```html
<section class="section" id="how">
  <h2 class="chapter-title">How It Works</h2>
  <div class="segment">
    <div class="segment-full"><p>Intro across both columns.</p></div>
  </div>
  <div class="segment">
    <div class="segment-col"><h3>Left</h3>...</div>
    <div class="segment-col"><h3>Right</h3>...</div>
  </div>
</section>
```

One `chapter-title` per section. `h3` inside a column is the sub-heading (display font, ink colour, not uppercase). `h4` is for box titles. A section can hold several `.segment` rows; use `segment-full` for text that should span both columns.

## Lore quote

```html
<section class="lore-quote"><blockquote>
  <p>"In-world narration..."</p>
</blockquote></section>
```

Centred, italic, soft ink. Goes once, at the top of the scroll, before `main-content`. Optional.

## Boxes

| Class | Looks like | Use for |
|---|---|---|
| `.dragonbox` | darker parchment, green border, thick left edge | rules details, sub-procedures, tips |
| `.demonbox` | solid green, parchment text | the one most important thing: install steps, a key rule |
| `.emptybox` | transparent with a tan outline | quiet asides |

```html
<div class="dragonbox"><h4>Ferocity</h4><p>...</p></div>
```

Use `.demonbox` sparingly, ideally once per page. Links and `code` inside it are restyled automatically.

## Lists

Unordered lists get the green ✦ bullet automatically. Ordered lists keep numbers, coloured green. Start items with a **bold term:** when listing rules or features.

## Tables

```html
<div class="table-wrap"><table class="data-table">
  <thead><tr><th>Symbol</th><th>Meaning</th></tr></thead>
  <tbody><tr><td>...</td><td>...</td></tr></tbody>
</table></div>
```

Headers are uppercase display font in green on dark parchment. Always wrap in `.table-wrap` so wide tables scroll on phones.

## Code

Inline `code` gets a tan background. For a block, use `<pre><code>` inside a `.dragonbox` and add `white-space: pre-wrap` on the `pre`.

## Extending the style

When something new is needed (a stat block, a card, a form), build it from the existing tokens: `--parchment-dark` background, a 2px `--accent` or `--parchment-darker` border, 2–4px radius, display font for labels, `--spacing-*` for padding. A Dragonbane initiative card, for example, is a small rectangle in `--bone-white` with a `--demon-green` border and a large Colus numeral.
