---
name: dragonbane-parchment-style
description: Style web pages, landing pages, docs, rules references and artifacts in the Dragonbane RPG "parchment scroll" look of the Card Initiative for Dragonbane site (cardinitiativefordragonbane.netlify.app) - demon-green hero and nav bands, a torn-edge parchment scroll, Colus/Cinzel Decorative display titles, Crimson Pro body text, dragon-red title flourishes, star bullets and dragonbox/demonbox call-outs. Use this skill whenever the user wants something to look like that site, mentions Dragonbane, Fria Ligan, a parchment/scroll/old-book/fantasy RPG style, a TTRPG or Owlbear Rodeo extension landing page, a homebrew rules page, a character handout or a campaign site, even if they don't name the site.
---

# Dragonbane Parchment Style

This skill reproduces the look of https://cardinitiativefordragonbane.netlify.app/, which is itself based on Sibling Dex's "Dragonbane Template" for LaTeX. The goal is a page that feels like a page torn from a Dragonbane rulebook: dark green bands top and bottom, a parchment scroll in the middle, uppercase display headings with a little red flourish.

## Files in this skill

- `assets/dragonbane.css` — the complete stylesheet (the site's own CSS, lightly cleaned, plus a seamless scroll, transparent tables and a table wrapper). Use it as-is; don't rewrite it from memory.
- `assets/template.html` — a page skeleton that uses every component. Start from this.
- `assets/Colus.otf` — the title font.
- `assets/scroll-top.webp`, `assets/scroll-tile.webp`, `assets/scroll-bottom.webp` — the scroll texture split into a top cap, a loop-safe middle tile and a bottom cap, so a scroll of any height has no seams.
- `scripts/inline_assets.py` — embeds the CSS, font and the three scroll pieces into the HTML so the page is one self-contained file.
- `references/components.md` — snippets and when to use each component, including interactive pieces (disclosure names, chips, pickers, format menus, dialog Close). Read it when building anything beyond a simple page.
- `references/original-landing.css` — the untouched original, only for checking a detail.

## Workflow

1. Copy `assets/template.html` to the working directory and fill it in. Keep the structure: `navbar` → `hero` → `page-shell > page-scroll` (lore quote + `main-content` with sections) → `footer`.
2. Write content into the components (see below). Delete the parts you don't need, such as the lore quote.
3. Run `python scripts/inline_assets.py page.html /mnt/user-data/outputs/page.html`. Every delivered page goes through this step, because the scroll and the Colus font are local files that won't load otherwise (published artifacts block everything except Google Fonts and a few script CDNs).
4. Publish or present the output file as usual.

For a React component or a page that lives inside an existing project, import the classes from `dragonbane.css` and copy the font and scroll next to it instead of inlining.

## The look, in short

**Colours** (CSS variables in `:root`): demon green `#227262` (accent, links, headings), light `#3d8f7b`, dark `#14443a` (nav, footer, hero edges); dragon red `#e72f32` used only for small flourishes; bone white parchment `#f5f2eb` with darker parchment `#e3dac6` and `#d0c1a0` for boxes and table headers; ink `#231f20` and soft ink `#4a3f30` for text.

**Page background**: plain `#403f3e` behind the scroll, no texture or gradient, in light and dark mode alike.

**Type**: Display = Colus (falls back to Cinzel Decorative), always for h1–h6, buttons, table headers and the nav brand; major titles are UPPERCASE with wide letter spacing. Body = Crimson Pro at `clamp(1.15rem, 0.9rem + 0.45vw, 1.45rem)` / 1.65 line height, so text grows on wide monitors; table headers and small buttons are sized in `em` to scale with it. Italic body text for subtitles and flavour text.

**Layout**: full-width green nav (brand 1.75rem, links 1.15rem, generous padding) and hero; content inside a parchment scroll, centred, 640px wide on phones and growing from 768px up to `--max-width: 1500px`, so laptops use their full width minus the page gutter. Sections stack with generous spacing; two columns from 768px (`.segment` with `.segment-col`), one column on phones. The footer is slim: 0.85rem text, small padding, no rule under the disclaimer.

**Tables** lie on the parchment: transparent background, the parchment-dark header band and row rules keep them readable, denser cells (0.5rem 0.6rem) so wide tables fit, words wrap whole. Always wrap them in `.table-wrap`.

**Signature details** that make it recognisable — keep all of them:
- `.chapter-title`: centred, uppercase, green, with a 3px green underline and a short red gradient bar in its centre.
- List bullets are a green `✦`, not dots.
- Buttons are square-ish (2px radius), uppercase display font; primary is parchment on green, secondary is outlined.
- Subtle SVG noise on the hero for a printed feel.

## Writing for this style

The original site mixes plain instructions with a bit of in-world flavour. Carry that over: an optional italic lore quote near the top, game terms in **bold**, short action-oriented headings ("Starting Combat", "Your Turn"). Keep dragon red rare; if everything is red nothing stands out.

## Things to avoid

- Don't swap in other fonts, rounded pill buttons, drop shadows on cards, or bright gradients; they break the printed-rulebook feel.
- Don't put body text directly on the green hero beyond the title, subtitle and buttons.
- Don't draw the scroll as one repeating image (`scroll.webp` with `repeat-y`); its torn edges show a seam every texture height. Use the three pieces as the stylesheet does.
- Keep credits in the footer when the page uses the scroll texture (Esther Sanz, CC BY 3.0, attribution required) and mention the style inspiration (Sibling Dex's Dragonbane Template). For anything Dragonbane-branded, include Fria Ligan's third-party disclaimer as the original does.

## Dark mode

The look is designed for light parchment on a dark page. The `#403f3e` background already reads as a scroll lying on a dark table, so the same stylesheet serves light and dark mode with no separate variant; no extra work is needed.
