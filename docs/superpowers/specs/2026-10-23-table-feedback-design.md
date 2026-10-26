# Dragonbane Reference: table feedback (2026-10-23) design

Source: `2026-10-23_Feedback` (repo root), the user's notes after using the app at the table, plus the
brainstorming conversation on 2026-10-23. This spec covers only that round of changes. Everything in
`2026-10-22-dragonbane-reference-design.md` still holds, including the hard rules (integer copper, round
once and down at display time, never show the Currency Exchange table, never parse treasure effect text
at runtime, and the pricing order).

## Intent

The app works, but using it at the table showed four problems:

- On a real laptop or monitor, much of the screen is wasted and the text is small.
- The treasure result shows dice arithmetic the GM doesn't need. The GM wants the outcome.
- Mastercrafted weapons are hard to compare, because the variant is shown in a separate sub-row.
- The price controls take up too much vertical space.

Success means the GM can roll treasure, read the outcome at a glance in a popup, close it, and price
mastercrafted weapons straight from the table.

## Goals

### General

1. **Page background.** Remove the background image (the gradients and SVG noise) on `body`. Set
   `background-color: #403f3e`. The green bands and the parchment scroll stay as they are.
2. **Default coin standard is "As written"** (`'written'`). The choice is already saved in
   localStorage (`CoinStandardStore`, key `dragonbane.coinStandard`), which stays. Only the fallback
   changes, from `'gold'` to `'written'`. The coin standard is the only thing saved in localStorage.
   Treasure results and price options are not saved.
3. **Footer smaller.** Reduce footer padding and font size. On `.footer-disclaimer`, remove the border,
   the padding and the margin.
4. **Header bigger.** Make the navbar taller and its text larger (brand, section links, coin standard
   control). It must still fit at 375px wide with no horizontal scroll.
5. **Wider page and larger text on wide screens.** Cause (to confirm in Chrome at a real window size,
   not the device toolbar): `--max-width` is 1100px and table text is about 0.85rem, so wide windows
   show bare margins and small text. The device toolbar emulates narrow viewports, so the cap never
   shows there. Fix: raise the cap to about 1600px (*builder's call: exact value*) and scale the base
   text up on wide screens, e.g. with a `clamp()` on the root or body font size (*builder's call: exact
   curve*). Phone layout (375px) must not change for the worse. The cap applies to the scroll, the nav
   content and the footer content alike, because they all use `--max-width`.
6. **Update the `dragonbane-parchment-style` skill** at `.claude/skills/dragonbane-parchment-style/`
   (the unpacked folder, which replaces the deleted `.skill` archive) so it matches the app:
   - The seamless scroll: top cap, loop-safe middle tile, bottom cap. Add the three webp files to
     `assets/`.
   - Tables: transparent backgrounds over the parchment, denser cells, and whole-word wrapping.
   - The `#403f3e` body background.
   - The raised `--max-width` (goal 5; the page width, not the cap artwork) and wide-screen text
     scaling, and the larger header and smaller footer.

   Update `SKILL.md` ("The look, in short", layout) and `assets/dragonbane.css`, and `template.html` if
   it is affected. `scripts/inline_assets.py` must still inline whatever assets the template references.

### Treasure

7. **Result in a popup.** Rolling the whole table (D40) or a single row opens the result in a modal
   dialog. Use native `<dialog>` with `showModal()`: it gives the focus trap and Esc to close, and the
   modal hides the rest of the page from assistive tech. A close button sits at the **top left** with an
   accessible name ("Close"). On close, focus goes back to the button that opened the dialog. A
   "Roll again" button in the dialog re-rolls the D40 after a table roll, or the same entry after a
   single-row roll. The new result replaces the content in place, focus stays on "Roll again", and
   the dialog never stacks.
8. **Heading.** The dialog title is `<h2>` in the format `N - Treasure`, e.g. `40 - Rat`. It labels the
   dialog (`aria-labelledby`).
9. **Outcomes only, no dice.** Remove the dice-arithmetic lines (the `describeDice` output, including
   the "D40 → …" line) from the result. Show the entry's effect text exactly as stored, then each
   resolved value on a new line. Effect text is shown, never parsed. Values come from the roll specs,
   as now.
   - Rat (40): "Roll EVADE. On failure, take D4 damage ignoring armour.", then "4 damage". Rusty nail
     (34) is the same, with D6. Generic `Number` rolls show the total plus the spec label.
   - Coins and valuables (1–25): the effect text, then the coin amount, e.g. "70 silver". When the coin
     standard isn't "As written", show the amount converted to that standard, the same way prices are.
     *Builder's call:* when converted, show only the converted amount or show both.
   - Gemstone (26): the outcome label with its value, e.g. "Sapphire — 15 gold". The value follows the
     coin standard.
   - Poison dagger (33): the rolled poison type.
   - Picks that resolve to an equipment item (27–32, 36, 38, 39): keep the link to Equipment, which
     filters by category and name, as now. Add a summary of the item's stats, laid out like its
     equipment table row:
     - Weapons: Grip, STR, Range, Damage, Durability, Cost, Features.
     - Armour: Rating, Cost, Effect.
     - Everything else: Cost plus the category's effect column, when the category has one.

     Mastercrafted weapons (31) show the mastercrafted stats: cost ×10, STR −3 (zero or less shows as
     none), Durability +3, using `mastercraft()`.

     *Builder's call:* the summary can be a small definition list or a one-row table. Reuse the
     equipment page's column definitions (`columnsFor`) rather than writing a second copy.
   - Bottle (36): the rolled contents. A healing potion shows "2D6 HP" or "3D6 HP" without rolling the
     HP. Today the seed (`TreasureSeed.cs`, roll 36) nests a `Number` roll "HP" under each potion
     outcome. *Builder's call:* drop those nested rolls from the seed and put the dice in the outcome
     label (needs a re-import and the committed `dragonbane.db` regenerated), or show `Number` specs
     nested under picks as dice text without rolling. The seed change is preferred, because it keeps
     the display code free of special cases.
   - Grimoire (35): the school, the rank (tricks when the rank is 0) and the number of spells. Then list
     that many spell names, picked at random without repeats from the spells matching the school and
     rank, using the injectable, seedable `DiceRoller`. If fewer spells match than were rolled, list
     them all. Keep the "Show matching spells" link. Each suggested name may link to the Spells page,
     filtered to that spell (*builder's call*).
10. **Links to references stay** on every entry that has one.
11. The resolver keeps returning dice data, so tests stay deterministic. Only the view stops showing
    dice.

### Equipment

12. **Mastercrafted changes the row in place.** Remove the mastercrafted sub-row. Toggling a melee
    weapon's Mastercrafted button swaps that row's STR, Durability and Cost cells for the mastercrafted
    values, and gives the row a distinct "mastercrafted" colour treatment. The colour must keep AA
    contrast. Colour must not be the only cue: the button shows its state with `aria-pressed`, and
    the name cell gets a visible "(mastercrafted)" marker or similar.
13. **The Mastercrafted button always sits on its own line** under the item name, including in the
    stacked phone layout.
14. **Melee only.** The mastercrafted rule is in the Melee weapons note, so the button appears only on
    melee weapons that have a price. Ranged weapons lose the button. The row model should use
    `WeaponDto.isRanged`, not the category name.
15. **Global mastercrafted toggle.** One toggle near the price controls: "Show all melee weapons as
    mastercrafted". While it is on, every priced melee weapon row (the same set that has the button;
    unpriced Unarmed and blunt objects stay as they are, *builder's call*) shows mastercrafted values and the theme,
    and the per-row buttons have no effect. They are shown as pressed and disabled, or hidden
    (*builder's call*). Turning it off restores each row's own per-row state. The toggle is not saved.
16. **Price controls on one line.** The contents of `app-price-controls` (Price, Sell rate, Bartering)
    sit on one line when there is room, and wrap into columns or rows as the width shrinks. Use CSS
    only (flex-wrap or grid auto-fit).
17. **Sell rate becomes a radio group** (100% / 50% / 20% / 10%), styled like the Price buy/sell
    group. It still shows only in Sell mode.

## Non-goals

- No other persisted state.
- No changes to the API contract, apart from what a seed change implies.
- No new sections, and no change to how other sections display.
- No dice-rolling UI for the GM beyond what exists.

## Anti-goals

- Parsing the effect text to get values, such as "D4 damage". Values come only from the structured
  seed.
- Showing the Currency Exchange table.
- Rounding before display, or showing less than 1 copper.
- A JS-driven layout for the price controls or the page width when CSS does it.
- A popup that traps keyboard users or isn't announced, or regressions in the axe/e2e gate at
  1280×800 or 375×812.

## Constraints

- Angular standalone components, signals and OnPush, as in the rest of `web/`.
- Business logic stays in tested TypeScript services and functions (spell suggestion picking, the
  mastercrafted row values). Components only display.
- The full check must pass: `dotnet test`, `npx ng test --watch=false`, `npx ng build` and
  `npm run e2e`. Update the e2e checks for the dialog: open it, check it with axe, and close it.
- Record significant decisions in `DECISIONS.md`: the dialog approach, the scroll cap and font scaling,
  the seed change for healing potions, and limiting mastercrafted to melee.

## Decided by the user

- Grow to a bigger cap on wide screens, rather than filling the full width.
- The global mastercrafted toggle overrides the per-row toggles, and the theme applies to every melee
  row while it is on.
- The coin standard is the only value saved in localStorage.
- This round gets a new spec file (this one), and the original design spec stays unchanged.
- Treasure display as played back: the effect text, then resolved values on new lines. Healing potions
  show the dice unrolled, and the grimoire lists random spell names.
- The treasure dialog has a "Roll again" button. A table roll re-rolls the D40, and a single-row roll
  re-rolls that same entry.

## Left to the builder

These are marked *builder's call* above:

- The exact scroll cap and font curve.
- Whether converted coin values also show the amount as written.
- The layout of the stat summary.
- The approach for the healing potion dice.
- How per-row buttons behave while the global toggle is on.
- Whether suggested spell names link to the Spells page.

## Changes after review (2026-10-23)

The user reviewed the built app and asked for these changes. They supersede the goals above where they
differ. Each is recorded in `DECISIONS.md`.

- **Scroll cap:** 1500px, not about 1600px. Narrower laptops fill their width minus the page gutter.
- **Treasure dialog (goals 7–8):**
  - The title is at the top left. Close is a round X icon, drawn like the radio buttons, that floats
    in the top right corner. "Re-roll" (renamed from "Roll again") sits at the bottom centre.
  - A click outside the dialog (on the dark backdrop) closes it.
  - The dialog opens near the top of the window at a fixed width, with a minimum height that fits the
    tallest result. Neither the controls nor the dialog's size move between rolls at laptop widths.
  - There is no scrollbar. The dialog scrolls only when the window is too short to hold it.
  - In the item summary, effects and weapon features take a full row. A grimoire's spells sit on one
    line.
- **Mastercraft all (goal 15):** a flat toggle button (pressed or not), not a checkbox, labelled
  "Mastercraft all". It is right-aligned on the Melee weapons heading row.
- **Row Mastercrafted button (goal 13):** not underlined.
- **Bartering (goals 16–17):** the Roll checkbox is gone. The fieldset reads "Roll:" followed by None,
  Success and Dragon. They are always shown, with None selected by default. Bartering sits on its own
  line below Price and Sell rate.
- **Radios and checkboxes (all pages):**
  - A demon-green ring or box on bone white, with the green four-point star centred when selected.
  - Drawn as SVG so the star stays centred.
- **Filter rows (all pages):**
  - Labels share a top edge, and the search box and the selects are the same height.
  - An unlabelled button in the row lines up with the bottom of the inputs.
