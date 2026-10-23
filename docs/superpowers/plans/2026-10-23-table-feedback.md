# Table Feedback (2026-10-23) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the 2026-10-23 table feedback. The app gets a wider page, larger text, a dark background, a resized header and footer, a treasure popup that shows outcomes only, mastercrafted values shown in the weapon row itself, and compact price controls.

**Architecture:** Front-end changes only, plus one seed edit (healing-potion dice and the grimoire spell-count label) that needs a re-import of the committed `dragonbane.db`. New logic goes into small pure functions with unit tests:
- `mastercraftedItem` in `money/mastercraft.ts`
- `suggestSpells` in `treasure/`
- `columnsFor`, extracted to `features/equipment/columns.ts`

Components only display.

**Tech Stack:** Angular (standalone, signals, OnPush, vitest + jsdom), ASP.NET/.NET 10 + EF Core SQLite, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-23-table-feedback-design.md` (implements goals 1–17; numbers below refer to it).

## Global Constraints

- Hard rules from `2026-10-22-dragonbane-reference-design.md`:
  - Money is integer copper, rounded down once at display time, never shown as less than 1 copper.
  - Never display the Currency Exchange table.
  - Never parse treasure effect text at runtime.
  - Pricing order: base → sell rate → bartering → coin standard → round down.
- The coin standard is the only thing saved in localStorage (key `dragonbane.coinStandard`). The default is `'written'`.
- Body background: `background-color: #403f3e`, with no background image.
- The mastercrafted rule (`mastercraft()`): cost ×10, STR −3 (zero or less becomes none), Durability +3. It applies only to melee weapons (`weapon.isRanged === false`) that have a price (`costCopper !== null`).
- A mastercrafted price is never shown "as written" (`isBase` is false).
- AXE-clean at WCAG 2.1 AA, with no overflow at 1280×800 or 375×812.
- After any `.md` or seed change, run `dotnet run --project src/Dragonbane.Api -- import` and commit `dragonbane.db`.
- Full check before each commit that touches behaviour:
  1. `dotnet test` (stop the API first).
  2. In `web/`: `npx ng test --watch=false && npx ng build`.
  3. Run `npm run e2e` in the tasks that say so.
- Record decisions in `DECISIONS.md`, one entry each: dialog approach, scroll cap and font scaling, seed change, mastercrafted limited to melee.

## Review Focus

1. **Global toggle on, then off, keeps per-row state.** A row toggled on before the global toggle must still be mastercrafted after the global toggle goes off. Test in Task 5.
2. **A grimoire that rolls more spells than exist.** Rank 4 Animism might have fewer spells than the D4 asks for. List every matching spell with no repeats. Test in Task 3.
3. **A grimoire with rank 0.** List tricks (kind `Trick`), never spells with `rank === 0` of another kind. Test in Task 3.
4. **"Roll again" after a single-row roll** must re-roll that row, never a D40. Test in Task 4.
5. **Sell mode with bartering while mastercrafted.** The mastercrafted cost still goes through the full pricing order (the sell rate applies to the ×10 cost). Test in Task 5.

---

### Task 1: Page chrome (background, header, footer, width, text size, coin default)

Spec goals 1–5.

**Files:**
- Modify: `web/src/dragonbane.css`. This covers `--max-width`, `body` (≈line 62–74), `.nav-content`, `.nav-brand`, `.nav-links a`, `.footer` and `.footer-disclaimer` (≈511–530).
- Modify: `web/src/styles.scss`. This covers the `.coin-standard` control size and the `.data-table` font size, if it is fixed at 0.85rem.
- Modify: `web/src/app/core/coin-standard.store.ts`. In `read()`, change the fallback `'gold'` to `'written'` in both places.
- Test: `web/src/app/core/coin-standard.store.spec.ts`, `web/src/app/app.spec.ts:32`.
- Modify: `DECISIONS.md`.

**Interfaces:** none.

- [ ] **Step 1: Update tests.**
  - In `coin-standard.store.spec.ts`, rename `defaults to gold` to `defaults to as written`. Change every fallback expectation `toBe('gold')` (lines 16, 31, 39) to `toBe('written')`.
  - In `app.spec.ts:32`, expect `select.value` to be `'written'`.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/core/coin-standard.store.spec.ts --include src/app/app.spec.ts`. Expected: these tests fail.
- [ ] **Step 3: Implement.**
  - Store fallback becomes `'written'`.
  - `body`:
    - `background-color: #403f3e`.
    - Delete the `background-image` and `background-blend-mode` lines.
    - Font size `clamp(1.15rem, 0.9rem + 0.45vw, 1.45rem)`, which grows above about 1000px wide.
  - `--max-width: 1600px`.
  - Table text: remove any fixed `0.85rem` on `.data-table`, or set it to `0.95em`, so tables scale with body text.
  - Header: `.nav-content` padding `var(--spacing-md)`, `.nav-brand` font size `1.75rem`, `.nav-links a` font size `1.15rem`. Scale the coin-standard label and select to match. The navbar must still wrap cleanly at 375px.
  - Footer: `.footer` padding `var(--spacing-sm) var(--spacing-md)` and font size `0.85rem`. On `.footer-disclaimer`, set `border-bottom: none; padding: 0; margin: 0`.
- [ ] **Step 4: Run** the same tests. Expected: pass.
- [ ] **Step 5: Verify in Chrome at a real window size.**
  - Start the API and `npm start`.
  - Open http://localhost:4200/spells in a normal (non-device-toolbar) Chrome window that is at least 1920px wide.
  - Confirm the scroll grows to about 1600px and the text is larger. Note the window width and measured scroll width in DECISIONS.md.
  - Check 375px with the device toolbar.
- [ ] **Step 6: Run** `npm run e2e`. Expected: all pass.
- [ ] **Step 7:** Add a DECISIONS.md entry, "Wider scroll cap and fluid body text", recording why the device toolbar hid the problem. Commit: `feat(web): darker page, bigger header, slimmer footer, wider scroll, as-written default`.

---

### Task 2: Seed: healing potion dice unrolled, grimoire count label

Spec goal 9 (Bottle and Grimoire).

**Files:**
- Modify: `src/Dragonbane.Api/Import/TreasureSeed.cs:83-92`.
- Modify: `web/src/app/treasure/treasure.fixture.ts:61-62` (mirror the seed).
- Regenerate: `src/Dragonbane.Api/dragonbane.db`.
- Test: the existing API tests (the importer and `CommittedDatabaseTests` catch a stale DB).
- Modify: `DECISIONS.md`.

**Interfaces:**
- Produces: in roll 36, the outcomes 5 and 6 have labels `healing potion 2D6 HP` and `healing potion 3D6 HP`, each with `Item: "Healing potion, dose"` and no `Rolls`. In roll 35, the third spec's label becomes `spells` (it was `number of spells`), so a `Number` roll reads `"3 spells"`.

- [ ] **Step 1:** Edit the seed as described in Produces.
- [ ] **Step 2:** Run `dotnet test`. Expected: `CommittedDatabaseTests` fails because the DB is stale.
- [ ] **Step 3:** Run `dotnet run --project src/Dragonbane.Api -- import`, then `dotnet test`. Expected: pass.
- [ ] **Step 4:** Update `treasure.fixture.ts` outcomes 5 and 6 to the new labels without `rolls`, and the roll-35 label to `spells`. Run `npx ng test --watch=false`. Expected: pass, or failures only in treasure tests that assert dice text, which Task 4 rewrites. If any fail, note them and leave them for Task 4. Do not delete them.
- [ ] **Step 5:** Add a DECISIONS.md entry, "Healing potion HP shown as dice, not rolled". Commit the seed, the DB, the fixture and DECISIONS.md: `feat(api): show healing potion HP as dice, label grimoire spell count`.

---

### Task 3: Shared pure logic (equipment columns, mastercrafted item, spell suggestions)

Spec goals 9 (equipment summary, grimoire) and 12.

**Files:**
- Create: `web/src/app/features/equipment/columns.ts`. Move `Column`, `COST`, `SUPPLY` and `columnsFor` out of `equipment.page.ts` and export `Column` and `columnsFor`.
- Modify: `web/src/app/features/equipment/equipment.page.ts` to import them.
- Modify: `web/src/app/money/mastercraft.ts`.
- Test: `web/src/app/money/mastercraft.spec.ts` (create it if it doesn't exist, otherwise extend it).
- Create: `web/src/app/treasure/spell-suggestions.ts` and `web/src/app/treasure/spell-suggestions.spec.ts`.

**Interfaces:**
- Produces: `export function columnsFor(category: EquipmentCategoryDto, sample: EquipmentItemDto | undefined): Column[]` and `export interface Column`. The behaviour is unchanged.
- Produces: `export function mastercraftedItem(item: EquipmentItemDto): EquipmentItemDto`. It returns a copy with `costCopper`, `weapon.strRequirement` and `weapon.durability` replaced by `mastercraft(...)`, and everything else unchanged. An item without `weapon` is returned unchanged.
- Produces: `export function suggestSpells(spells: readonly SpellDto[], schoolId: number, rank: number, count: number, roller: DiceRoller): SpellDto[]`.
  - The pool is spells with `schoolId` matching, and either `rank <= 0 ? s.kind === 'Trick' : s.rank === rank`.
  - It returns `min(count, pool.length)` distinct spells. Each one is picked by `roller.roll(1, remaining.length)[0] - 1` from the remaining pool, then removed from the pool.

- [ ] **Step 1: Write failing tests.**
  - `mastercraftedItem`, with Battleaxe (STR 13, Dur 9, 1000 copper): the result has `costCopper` 10000, `weapon.strRequirement` 10, `weapon.durability` 12, and the same `name`. The input object is not mutated. With STR 3, the result is `strRequirement === null`.
  - `suggestSpells`:
    - It returns the requested count with no duplicates when the pool is big enough.
    - With a pool of 2 and count 4, it returns both spells.
    - Rank 0 returns only `kind === 'Trick'` spells of that school.
    - Spells of another school are never returned.
    - Use a stub roller `{ roll: () => [1] }`, which always takes the first remaining spell, so the order is deterministic.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/money/mastercraft.spec.ts --include src/app/treasure/spell-suggestions.spec.ts`. Expected: FAIL (not defined).
- [ ] **Step 3:** Implement both functions, and do the `columns.ts` extraction (a move only).
- [ ] **Step 4: Run** `npx ng test --watch=false`. Expected: all pass, apart from treasure tests already noted in Task 2.
- [ ] **Step 5: Commit:** `refactor(web): share equipment columns; add mastercraftedItem and suggestSpells`.

---

### Task 4: Treasure dialog with outcomes only

Spec goals 7–11.

**Files:**
- Modify: `web/src/app/features/treasure/treasure.page.ts` and `treasure.page.html`.
- Modify: `web/src/app/features/treasure/treasure-result.ts` and `treasure-result.html`.
- Modify: `web/src/styles.scss` (`.treasure-result` and the new `.treasure-dialog`).
- Test: `web/src/app/features/treasure/treasure.page.spec.ts`. Rewrite the assertions that check dice text.
- Modify: `web/e2e/a11y.spec.ts` (the `treasure roll announces` test).
- Modify: `DECISIONS.md`.

**Interfaces:**
- Consumes:
  - `columnsFor` and `Column` (Task 3).
  - `mastercraftedItem` (Task 3).
  - `suggestSpells` (Task 3).
  - The seed labels (Task 2).
- Produces: `TreasureResultView` gets two new required inputs, `categories: ReadonlyMap<number, EquipmentCategoryDto>` and `suggested: readonly SpellDto[]`.
  - The view takes no roller. When it rolls, the page computes the suggestions with `suggestSpells`, using the school from the Pick outcome's `magicSchoolId`, the `SpellRank` total and the `Number` total. It stores them in a `suggested` signal, which holds `[]` for anything other than a grimoire.

**Page behaviour:**
- **Data.** The page also loads `/api/equipment-categories` and `/api/spells` (the full list, once). `ready` also waits for both.
- **Dialog.** A `<dialog class="treasure-dialog" aria-labelledby="treasure-result-title">`, opened with `showModal()` from both `rollTable()` and `rollEntry()`. It contains, in order:
  1. A Close button at the top left: `<button type="button" class="btn btn-secondary btn-small dialog-close">Close</button>`. It calls `dialog.close()`.
  2. `<app-treasure-result>`.
  3. A Roll again button: `<button type="button" class="btn btn-primary">Roll again</button>`.
- **Re-roll.** A `private rerun: (() => void) | null`. `rollTable` sets it to `rollTable`, and `rollEntry(entry)` sets it to `() => rollEntry(entry)`. Roll again calls `rerun()`. If the dialog is already open, `showModal()` is not called again.
- **Focus.** Native `<dialog>` handles the focus trap and Esc, and returns focus to the opener on close.
- **Live region.** Remove the old `.treasure-results` region. Keep the `aria-live` count status.

**Result view (`lines` replaces the dice lines):**
- **Heading.** `<h2 id="treasure-result-title">{{ entry.roll }} - {{ entry.name }}</h2>`, then the `effectText` paragraph, unchanged.
- **Lines.** One line per resolved roll, with nested rolls in order. No `describeDice` output anywhere. The `D40 →` line is gone.
  - **Coins:** `"70 silver"`. When the standard isn't `written`, show `"70 silver (7 gold)"` (the existing conversion, kept).
  - **`Number`:** `` `${total} ${spec.label}` ``, e.g. `"4 damage"` or `"3 spells"`.
  - **`SpellRank`:** `"Tricks"` when the total is 0 or less, otherwise `` `Rank ${total}` ``.
  - **`Pick` with an item:**
    - The link text is the item name, with a `Mastercrafted ` prefix for mastercrafted items. Keep the existing link query params.
    - Keep the existing ` (label)` suffix rule, so the healing potion shows `(healing potion 2D6 HP)`.
    - Then a stat summary: a `<dl class="item-stats">` over `columnsFor(category, item).filter(c => c.header !== 'Supply' && c.header !== 'Weight')`.
    - Values come from `mastercraftedItem(item)` when `isMastercrafted` is set. The Cost cell is `formatPrice(...)`, with `isBase` false for mastercrafted items, as now.
  - **`Pick` with a value:** `` `${capitalised label} — ${value}` ``, e.g. `"Sapphire — 15 gold"`. The value is `valueText` when the standard is `written`, otherwise `formatCoins`.
  - **Other `Pick`:** `` `${capitalised spec.label}: ${outcome.label}` ``, e.g. `"Type: lethal"` or `"School: Animism"`.
- **Grimoire.** After the lines, list the `suggested` spell names (`<ul>`), each a `routerLink="/spells"` with `[queryParams]="{ search: spell.name }"`. Keep the "Show matching spells" link.

- [ ] **Step 1: Write failing page tests** in `treasure.page.spec.ts`. Flush the two new requests in `render()`. Before each test, stub missing jsdom dialog methods:

  ```ts
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
  ```

  Tests:
  - `row 10 opens a dialog titled "10 - Silver coins" showing "70 silver" and no "→"`.
  - `gold standard shows "70 silver (7 gold)"`.
  - `rat shows effect then "4 damage"`.
  - `mastercrafted battleaxe shows STR 10, Durability 12 and the ×10 cost`.
  - `healing potion shows "2D6 HP" without consuming an HP die`: queue only the pick face, then `http.verify` and the face queue being empty prove it.
  - `grimoire lists N suggested spell names and keeps "Show matching spells"`.
  - `roll again after a row roll re-rolls the same row`: queue faces for two rolls of row 40, and assert no D40 is consumed (the faces queue is exactly drained).
  - `close button closes the dialog`: `dialog.open === false`.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/features/treasure/treasure.page.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the page and view as described above. Styles:
  - `.treasure-dialog`: parchment background (`var(--bone-white)`), `max-width: min(40rem, 100vw - 2rem)`, and `::backdrop` `rgba(0,0,0,.6)`.
  - `.dialog-close`: at the top left, in normal flow as the first child.
  - `.item-stats`: a `dt`/`dd` grid.
- [ ] **Step 4: Run** `npx ng test --watch=false`. Expected: all pass.
- [ ] **Step 5: Update the e2e test.** Rename `treasure roll announces` to `treasure roll opens an accessible dialog`. It clicks `Roll treasure (D40)` and expects `page.getByRole('dialog')` to be visible with a heading matching `/^\d+ - /`. It runs axe on the open dialog with no violations, clicks `Roll again` and expects the dialog to stay open, then clicks `Close` and expects the dialog to be hidden and the `Roll treasure (D40)` button to be focused. Run `npm run e2e`. Expected: pass.
- [ ] **Step 6:** Add a DECISIONS.md entry, "Treasure result in a native dialog, outcomes only". Commit: `feat(web): treasure result as a dialog showing outcomes, item stats and spell suggestions`.

---

### Task 5: Equipment mastercrafted in-row, global toggle, compact price controls

Spec goals 12–17.

**Files:**
- Modify: `web/src/app/features/equipment/equipment.page.ts` and `equipment.page.html`.
- Modify: `web/src/app/features/equipment/price-controls.ts` and `price-controls.html`.
- Modify: `web/src/styles.scss`:
  - Delete the `.sub-row` rules at lines 146 and 203.
  - `.link-button` becomes `display: block; margin-left: 0`.
  - `.price-controls` becomes `display: flex; flex-wrap: wrap; gap; align-items: flex-end`.
  - Add `tr.mastercrafted td` with a tinted background (for example `rgba(231, 47, 50, 0.08)`, which must keep AA contrast against ink) and `[aria-pressed="true"]::before { content: '✦ ' }`.
- Test: `equipment.page.spec.ts` (rewrite the `mastercrafted row` test), `price-controls.spec.ts`.
- Modify: `web/e2e/a11y.spec.ts` (the `equipment controls by keyboard` test).
- Modify: `DECISIONS.md`.

**Interfaces:**
- Consumes: `mastercraftedItem` (Task 3).
- Produces, in the page:
  - `mastercrafted = signal<ReadonlySet<number>>` (renamed from `expanded`) and `allMastercrafted = signal(false)`.
  - `canMastercraft(item): boolean`, true when `!!item.weapon && !item.weapon.isRanged && item.costCopper !== null`.
  - `isMastercrafted(item): boolean`, true when `canMastercraft(item) && (allMastercrafted() || mastercrafted().has(item.id))`.
  - `cell()` reads from `mastercraftedItem(item)` and passes `isBase` false when `isMastercrafted(item)`. Delete the old `mastercrafted()` string method.
- Produces, in `PriceControls`: `setRate(rate: SellRate): void`, which takes the value directly.

**Template:**
- Each row gets `[class.mastercrafted]="isMastercrafted(item)"`.
- The name cell is `{{ item.name }}`. When `canMastercraft(item)`, it shows `<button type="button" class="link-button" [attr.aria-pressed]="isMastercrafted(item)" [disabled]="allMastercrafted()" (click)="toggle(item.id)">Mastercrafted</button>` on its own line.
- Remove the sub-row `<tr>`.
- In the `.filters` row that holds `<app-price-controls>`, add `<label><input type="checkbox" id="all-mastercrafted" [checked]="allMastercrafted()" (change)="allMastercrafted.set($any($event.target).checked)" /> Show all melee weapons as mastercrafted</label>`.
- In price controls, the sell rate becomes `<fieldset class="choice-group"><legend>Sell rate</legend>`, with one `<label><input type="radio" name="sell-rate" [value]="rate" [checked]="options().sellRate === rate" (change)="setRate(rate)" /> {{ rate }}%</label>` per rate. It is shown only in sell mode.

- [ ] **Step 1: Write failing tests.**
  - `price-controls.spec.ts`: rename `hides the sell rate while buying` to check that `input[name="sell-rate"]` is absent while buying and four radios are present in sell mode. Add `sell rate radio sets 20` (click `value="20"`, then `options().sellRate === 20`).
  - `equipment.page.spec.ts`: update `page.sell('50')` to click the `sell-rate` radio. Replace `mastercrafted row` with these tests:
    - `mastercrafted toggles in row`: clicking the Battleaxe button sets `aria-pressed="true"` and the row has class `mastercrafted`. Its STR cell is `10`, its Durability cell is `12` and its Cost cell is `100 gold`. No `.sub-row` exists.
    - `ranged weapons have no mastercrafted button`: add a ranged weapon fixture with `isRanged: true`.
    - `global toggle mastercrafts every priced melee row and disables per-row buttons`.
    - `global off restores per-row state` (Review Focus 1): toggle Battleaxe on, global on, global off. Battleaxe is still mastercrafted, and a second melee weapon is not.
    - `sell mode applies to mastercrafted cost` (Review Focus 5): sell at 50% gives Battleaxe a cost of `50 gold`.
    - Keep `offers no mastercrafted version of an unpriced weapon`, and make it also check that the row lacks `mastercrafted` while the global toggle is on.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/features/equipment/**/*.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as described in the Interfaces and Template sections.
- [ ] **Step 4: Run** `npx ng test --watch=false && npx ng build`. Expected: pass.
- [ ] **Step 5: Update the e2e test.** In `equipment controls by keyboard`, replace the `#sell-rate` select steps. Expect `input[name="sell-rate"][value="100"]` to be visible, focus it, press ArrowRight, and expect `value="50"` to be checked. Run `npm run e2e`. Expected: pass at both viewports, with no overflow from the price-controls row at 375px.
- [ ] **Step 6:** Add a DECISIONS.md entry, "Mastercrafted shown in-row, melee only, global override". Commit: `feat(web): mastercrafted in-row with global toggle; sell rate radios; one-line price controls`.

---

### Task 6: Parchment skill update and final check

Spec goal 6, plus the full gate.

**Files:**
- Modify: `.claude/skills/dragonbane-parchment-style/SKILL.md` (the "Files in this skill" and "The look, in short" sections).
- Modify: `.claude/skills/dragonbane-parchment-style/assets/dragonbane.css`.
- Add: `.claude/skills/dragonbane-parchment-style/assets/scroll-top.webp`, `scroll-tile.webp` and `scroll-bottom.webp`, copied from `web/public/`.
- Modify: `.claude/skills/dragonbane-parchment-style/assets/template.html` and `scripts/inline_assets.py`, if they reference `scroll.webp` only.
- Git: stage the skill folder. The deletion of the `.skill` archive is the user's change. Leave it untouched unless the user says to commit it.

- [ ] **Step 1: Port the app's styles into the skill CSS:**
  - `body` with `#403f3e` and no image.
  - `--max-width: 1600px` and the fluid body font.
  - The `.page-scroll` three-piece seamless scroll from `web/src/styles.scss:1-49`.
  - Transparent `.data-table` with denser cells (0.5rem 0.6rem) and whole-word wrapping (copy the app's `overflow-wrap`/`word-break` rules).
  - The larger nav and slimmer footer from Task 1.

  Update the SKILL.md layout text: the scroll grows to 1600px, the page background is `#403f3e`, tables are transparent, and the three scroll images are named.
- [ ] **Step 2:** Check `scripts/inline_assets.py`. It must inline every `url(...)` asset the CSS references, including the three new webp files. Run it on `assets/template.html` into the scratchpad and confirm the output has no remaining relative `url('/scroll-` references.
- [ ] **Step 3: Full gate.**
  1. `dotnet test`.
  2. In `web/`: `npx ng test --watch=false && npx ng build && npm run e2e`.

  Expected: all pass.
- [ ] **Step 4: Commit:** `docs(skill): parchment style matches the app (dark page, wide seamless scroll, transparent tables)`.
