# Creator Feedback (2026-11-27) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the 2026-11-27 feedback: header brand, list-first /characters with export before saving, nickname beside the name, d6 dice buttons, colour or printer-friendly PDF, a shared picker dialog for spells/abilities/gear, and the editor's spell rule.

**Architecture:** Front-end only (no API/DB change). Pure, tested helpers build the picker groups and the learnable spells; one shared `PickerDialog` component replaces the chip picker for spells, abilities and gear in three editors and the creator's selects. The PDF builder takes a `printer` flag and picks page 1 or 2 of the two-page sheet.

**Tech Stack:** Angular (standalone, signals, OnPush), Vitest via `ng test`, pdf-lib, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-27-creator-feedback-design.md`

## Global Constraints

- Styles use tokens from `web/src/styles/tokens.css` only; no raw colours (the PDF's black is the existing `INK`).
- AXE-clean and WCAG AA at 1280×800 and 375×812 (`npm run e2e`).
- Business logic in TypeScript with unit tests; components stay thin.
- pdf-lib stays a lazy chunk (dynamic import in `character-export-menu.ts`).
- Colour PDF output must not change apart from the sheet now being page 1 of `DB-Character-Sheet.pdf`.
- All commands from `web/` unless stated. Full check before the last commit: `dotnet test` (repo root), then `npx ng test --watch=false && npx ng build && npm run e2e`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Exporting from the creator before anything is chosen (no kin, profession or attributes): every format, including the PDF, must work and not throw. Test in Task 10.
2. A character in the editor whose only school skill is at level 0, or who knows spells from a school whose skill they no longer have: no picker or a picker without that school, and the known spells stay listed and removable. Test in Task 5 and Task 8.
3. Picker filter text that matches nothing: the list shows "No matches"; Enter does nothing; for NPC gear only, an "Add “text”" item appears and adds it. Test in Task 7 and Task 9.
4. Keyboard only: open with Enter, type to filter, ArrowDown/ArrowUp move across group boundaries, Enter picks, Escape closes, focus returns to the opening button. Test in Task 7.
5. Printer-friendly PDF with no abilities, spells or overflow gear: one page (page 2 of the sheet), no description pages. Test in Task 4.

---

### Task 1: Header brand

**Files:**
- Modify: `web/src/app/app.html:12`
- Test: `web/src/app/app.spec.ts:51,56,62`

- [ ] **Step 1: Update the three brand assertions** to `'Dragonbane NPC Manager'`, `'Dragonbane Rules Reference'`, `'Dragonbane Character Creator'`, and add one assertion that no `.app-menu a` text contains `Dragonbane`.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/app.spec.ts` — expect the three brand tests to FAIL.
- [ ] **Step 3: Change** the link text to `Dragonbane {{ currentApp().label }}`. Labels in `app.ts` stay as they are.
- [ ] **Step 4: Run** the same command — PASS.
- [ ] **Step 5: Commit** `feat(web): prefix the header brand with Dragonbane`.

### Task 2: Nickname beside the name

**Files:**
- Modify: `web/src/app/character/character-card.ts` (`CharacterCard`, `buildCharacterCard`, `characterCardToText`, `characterCardToMarkdown`)
- Modify: `web/src/app/features/characters/character-card-view.html:4-6`
- Modify: `web/src/app/features/characters/character-summary.ts:35`
- Test: `web/src/app/character/character-card.spec.ts`

**Interfaces:**
- Produces: `CharacterCard` without `nickname`; `name` is `"<name> <nickname>"` when there is a nickname.

- [ ] **Step 1: Write failing tests** in `character-card.spec.ts`: `name: 'Veroulun', nickname: 'Waverider'` gives `card.name === 'Veroulun Waverider'`, text starts `'Veroulun Waverider\n'` with no `“` anywhere, and Markdown starts `'# Veroulun Waverider\n'` with no `*“`. With `nickname: ''`, `card.name === 'Veroulun'`.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/character/character-card.spec.ts` — FAIL.
- [ ] **Step 3: Implement.** `name: [c.name, c.nickname].filter(Boolean).join(' ')`, drop `nickname` from the interface, the view's nickname paragraph and the two exporters. In the summary: `name: [c.name || 'Unnamed hero', c.nickname].filter(Boolean).join(' ')`. The PDF's name box is unchanged (still `c.name`).
- [ ] **Step 4: Run** the card spec plus `characters.page.spec.ts` and `character-export-menu.spec.ts` — PASS.
- [ ] **Step 5: Commit** `feat(web): show the nickname beside the character's name`.

### Task 3: d6 dice buttons

**Files:**
- Create: `web/public/d6.svg`
- Modify: `web/src/styles/app.scss` (new `.btn-dice`; `.creation-step .step-roll` keeps only its positioning)
- Modify: `web/src/app/features/characters/characters.page.html:211-213`
- Modify: `web/src/app/features/treasure/treasure.page.html:23,52-53`
- Test: `web/src/app/features/treasure/treasure.page.spec.ts`, `web/src/app/features/characters/characters.page.spec.ts`

**Interfaces:**
- Produces: CSS class `btn-dice`: an icon-only button. Use `<button class="btn btn-dice" aria-label="…"></button>` with no content.

- [ ] **Step 1: Write failing tests.**
  - Treasure: the row button for an entry has class `btn-dice`, empty text and aria-label `Roll <name> (<roll>)`.
  - Treasure: the result dialog's button has aria-label `Re-roll`, class `btn-dice` and empty text.
  - Characters: `.step-roll` has class `btn-dice` and no `🎲`.
  - Update any test that finds these buttons by the text `Roll` or `Re-roll` so it finds them by aria-label.
- [ ] **Step 2: Run** both specs — FAIL.
- [ ] **Step 3: Draw `d6.svg`**: a 24×24 viewBox, a rounded square outline (stroke-width 2, no fill) and five filled pips. It uses black only, because it is used as a mask.
- [ ] **Step 4: Add `.btn-dice` to `app.scss`.**
  - At rest: transparent background, 2px `var(--accent)` border, `color: var(--accent)`, 2.75rem square, padding 0.
  - `::before`: `content: ''`, a 1.5rem square, `background: currentColor`, `mask: url('/d6.svg') center / contain no-repeat`.
  - On `:hover` and `:focus-visible`: `background: var(--accent)` and `color: var(--bone-white)`.
  - Disabled and `[aria-disabled]`: use the existing disabled look for `.btn`.
- [ ] **Step 5: Apply the class** to the creator step roll (replacing `btn-secondary btn-small` and the emoji span), the treasure row button and Re-roll. "Roll treasure (D40)" stays as it is.
- [ ] **Step 6: Run** both specs — PASS. Run `npx ng build` and check visually that the icon draws, using `npm start` on `/characters` and `/reference/treasure`.
- [ ] **Step 7: Commit** `feat(web): d6 icon buttons for creator and treasure rolls`.

### Task 4: Colour or printer-friendly PDF

**Files:**
- Replace: `web/public/character-sheet.pdf` with a copy of `Source Material/DB-Character-Sheet.pdf` (2 pages). The Source Material PDF stays untracked.
- Modify: `web/src/app/character/pdf/sheet-pdf.ts` (`buildSheetPdf`, `Flow`)
- Modify: `web/src/app/character/pdf/sheet-assets.ts:4` (doc comment: "Both pages of DB-Character-Sheet.pdf: 1 colour, 2 printer friendly.")
- Modify: `web/src/app/features/characters/character-export-menu.ts`, `.html`
- Test: `web/src/app/character/pdf/sheet-pdf.spec.ts`, `web/src/app/features/characters/character-export-menu.spec.ts`

**Interfaces:**
- Produces: `buildSheetPdf(c: Character, ref: CreationReference, rates: CurrencyRates | null | undefined, assets: SheetAssets, printer = false): Promise<Uint8Array<ArrayBuffer>>`

- [ ] **Step 1: Write failing tests** in `sheet-pdf.spec.ts`. Build the test sheet as two blank pages of different sizes so the tests can tell which page was kept.
  - `printer: false`: page 0 has page 1's size.
  - `printer: true`: page 0 has page 2's size.
  - A character with no abilities, spells or overflow gear gives a 1-page document in both modes.
  - In printer mode the description pages draw no image. Check that no page's `Resources` has an `XObject` entry.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/character/pdf/sheet-pdf.spec.ts` — FAIL.
- [ ] **Step 3: Implement the page choice.** After load, `doc.removePage(printer ? 0 : 1)`, then `getPage(0)` as now.
- [ ] **Step 4: Implement plain description pages.**
  - `Flow` takes `tile: PDFImage | null` and draws no background when it is null.
  - Headings use `RED` in colour mode and `INK` in printer mode.
  - Embed the parchment only in colour mode.
- [ ] **Step 5: Add the option to the export menu.**
  - Add `printer = rememberedFlag('dragonbane.characterExport.printerFriendly')`.
  - Add a second `field-check` under the descriptions checkbox: id `export-printer`, label `Printer-friendly PDF (black and white)`.
  - `pdf()` passes `this.printer.value()`.
  - In `character-export-menu.spec.ts`, assert that ticking the box makes the injected maker run with `printer = true`. Spy on the lazily imported builder, or check that the page size of the blob matches the second test page.
- [ ] **Step 6: Run** both specs — PASS. Then `npx ng build` and confirm the PDF code is still a separate lazy chunk in the build output.
- [ ] **Step 7: Add a `DECISIONS.md` entry:** "PDF comes in colour (sheet page 1, parchment descriptions) or printer friendly (sheet page 2, plain black and white descriptions); one two-page asset, one field map, because both pages share a layout."
- [ ] **Step 8: Commit** `feat(web): printer-friendly character sheet PDF`.

### Task 5: Learnable spells for the editor

**Files:**
- Modify: `web/src/app/character/creation.ts` (add next to `spellOptions:179`, reusing `HARMONISM`, `GENERAL_MAGIC`, `TRICKS_FROM_GENERAL_MAGIC`)
- Test: `web/src/app/character/creation.spec.ts`

**Interfaces:**
- Produces: `learnableSpells(c: Character, ref: CreationReference): SpellDto[]`

Rules:
- A held school is a `ref.schools` entry with `skill` set and that skill in `c.skills` at level ≥ 1.
- No held school gives `[]`.
- Otherwise return every spell (all ranks, tricks and recipes) of each held school, plus General Magic:
  - all of it if any held school is outside Harmonism, Alchemy and Enchanting;
  - else only its tricks if any held school is Alchemy or Enchanting;
  - else none (Harmonism only).

- [ ] **Step 1: Write failing tests** with `character.fixture.ts`:
  - no skills gives `[]`;
  - the Animism skill at level 0 gives `[]`;
  - Animism at 1 gives every Animism spell plus every General Magic spell, including rank 2 and up;
  - Harmonism only gives no General Magic;
  - Enchanting only gives General Magic tricks only;
  - Enchanting and Animism together give all of General Magic.

  Add Harmonism, Animism or Enchanting spells and schools to the fixture if it lacks them.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/character/creation.spec.ts` — FAIL.
- [ ] **Step 3: Implement** `learnableSpells`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(web): spells a character can learn come from held school skills`.

### Task 6: Picker groups

**Files:**
- Create: `web/src/app/hero/picker-groups.ts`
- Modify: `web/src/app/hero/hero.ts:24-29` (add `categories: EquipmentCategoryDto[]` to `HeroReference`)
- Modify: pages that build a reference: `features/characters/characters.page.ts` resources (`categories: httpResource<EquipmentCategoryDto[]>(() => '/api/equipment-categories')`) and `features/npcs/npcs.page.ts`; fixtures `character/character.fixture.ts` and any NPC fixture or spec that builds a `HeroReference` (`npx ng build` lists them).
- Test: `web/src/app/hero/picker-groups.spec.ts`

**Interfaces:**
- Produces (also used by Task 7):

```ts
export interface PickerItem { id: string; label: string; description: string; added: boolean }
export interface PickerGroup { heading: string; items: PickerItem[] }
export function spellGroups(spells: readonly SpellDto[], known: readonly SpellRef[]): PickerGroup[]
export function abilityGroups(abilities: readonly HeroicAbilityDto[], known: readonly string[]): PickerGroup[]
export function gearGroups(equipment: readonly EquipmentItemDto[], categories: readonly EquipmentCategoryDto[], carried: readonly string[]): PickerGroup[]
```

Each function decides two things: what an item's `id` is, and how the list is ordered.

- **`spellGroups`**
  - `id`: `spellLabel(s)`.
  - `label`: `sentenceCase(name)` plus ` (trick)`, ` (recipe)`, or ` (rank N)` for a spell.
  - `description`: casting time, range, duration and requirement on one line when present, then a blank line, then `description`.
  - Order: one group per school, in the order schools first appear in `spells`. Within a school, tricks come first, then ranks ascending, then names.
  - An item is `added` when `known` holds it, compared with `sameSpell`.
- **`abilityGroups`**
  - One group with heading `Heroic abilities`, sorted alphabetically.
  - `id` and `label`: the name.
  - `description`: `Prerequisite: X · WP: Y`, a blank line, then the effect. Leave out the prerequisite when it is `None`.
- **`gearGroups`**
  - One group per category, in `categories` order, with heading `category.name`. Items keep source order and empty groups are dropped.
  - `id` and `label`: the item name.
  - `description`: `Cost <costText>`, then `Weight <weight>` when present, then `describeItem(item)`. For a weapon, add grip, range and durability.
  - An item is `added` when `carried` holds it, compared with `same`.

- [ ] **Step 1: Write failing tests** for the order, the `added` flags and one description per kind, using the values above.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/hero/picker-groups.spec.ts` — FAIL.
- [ ] **Step 3: Implement** the three functions and the `categories` field. Load the categories in both pages and add `categories: []` or real categories to the fixtures.
- [ ] **Step 4: Run** the whole suite with `npx ng test --watch=false` — PASS. The reference shape changed, so every spec has to compile.
- [ ] **Step 5: Commit** `feat(web): grouped, described picker lists for spells, abilities and gear`.

### Task 7: PickerDialog component

**Files:**
- Create: `web/src/app/shared/picker-dialog.ts`, `picker-dialog.html`, `picker-dialog.spec.ts`
- Modify: `web/src/styles/app.scss` (`.picker-dialog` layout)

**Interfaces:**
- Consumes: `PickerGroup`, `PickerItem` (Task 6), `toggleDialog`, `BackdropDismiss` (`shared/dialog.ts`).
- Produces: selector `app-picker-dialog`, with these inputs:
  - `buttonLabel: string` (required): the opening button's text, for example `Add spell…`.
  - `buttonAriaLabel: string | null` (default `null`).
  - `heading: string` (required): the dialog title.
  - `groups: PickerGroup[]` (required).
  - `accept: (id: string) => string | null` (required): `null` means added; a string is the message to show.
  - `custom: boolean` (default `false`): allows free text.

  Moving it is the caller's job. The host uses `display: contents`.

Behaviour, which the tests pin down:
- **Opening.** The button opens a modal `<dialog class="app-dialog picker-dialog">` with `aria-labelledby` pointing at its `h2`.
- **Filter.** A filter `<input type="search">` labelled `Filter` is focused when the dialog opens. It keeps items whose label contains the text, ignoring case.
- **List.** The list is `role="listbox"`, with one `role="group"` per group, labelled by its heading, and `role="option"` items. Added items show "added" (visible text). The filter input carries `aria-activedescendant` for the active option.
- **Keys.**
  - ArrowDown and ArrowUp move the active option across groups and clamp at the ends.
  - Enter picks the active option.
  - Clicking an option picks it.
  - Hovering or activating an option shows its `description` in the right pane, which is an `h3` with the label followed by the text in `white-space: pre-line`.
- **Picking.** A pick calls `accept(id)`. On `null` the dialog closes; the native dialog returns focus to the opening button. On a string, the dialog shows it in a `role="alert"` paragraph and stays open.
- **No matches.** When nothing matches, the dialog shows `No matches`. If `custom` is on and the text is not empty, there is one option `Add “<text>”` whose id is the text.
- **Closing.** Escape closes the dialog (native), and so does a Close button that uses the `.dialog-close` pattern from `characters.page.html:299`. A backdrop click closes it through `BackdropDismiss`. Reopening clears the filter and the message.
- **Layout.** Two columns (list and description) at ≥ 48rem, stacked below that. The list scrolls inside the dialog.

- [ ] **Step 1: Write failing tests** in `picker-dialog.spec.ts` for every behaviour above, with two groups of two items. Cover the order of keyboard moves across the group boundary, the `accept` message staying open, the null result closing the dialog, the filter, `No matches`, the custom item and the "added" marker.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/shared/picker-dialog.spec.ts` — FAIL.
- [ ] **Step 3: Implement** the component and its styles (tokens only).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Add a `DECISIONS.md` entry:** "One shared picker dialog (list left, description right) replaces the chip picker for spells, abilities and gear; per-kind dialogs and a Browse button beside the chip picker were rejected."
- [ ] **Step 6: Commit** `feat(web): shared picker dialog with filter and descriptions`.

### Task 8: Character editor uses the dialog and the spell rule

**Files:**
- Modify: `web/src/app/features/characters/character-editor.ts`, `.html:47-90`
- Test: `web/src/app/features/characters/characters.page.spec.ts` (the editor's tests live there), or a new `character-editor.spec.ts` if none exist

**Interfaces:**
- Consumes: `PickerDialog`, `abilityGroups`, `spellGroups`, `gearGroups`, `learnableSpells`.

- [ ] **Step 1: Write failing tests.**
  - With no school skill, the Spells fieldset shows `Learning spells needs a magic school skill at level 1 or more.` and has no `Add spell…` button.
  - With Animism 1, the spell dialog lists Animism and General Magic but not Elementalism.
  - Known spells from another school stay as chips, can be removed, and show as "added" only when listed.
  - Picking an ability or a gear item through the dialog adds the chip; picking carried gear raises its quantity.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Replace the three chip pickers.**
  - Buttons: `Add heroic ability…`, `Add spell…`, `Add gear…`.
  - Groups: `abilityGroups(ref.abilities, d.abilities.map(a => a.name))`, `spellGroups(learnableSpells(d, ref), d.spells)` and `gearGroups(ref.equipment, ref.categories, d.gear.map(g => g.name))`.
  - Each existing `accept*` becomes `(id) => string | null`: `null` on success, `'Not found.'` otherwise.
  - Remove `ChipPicker` from the editor's imports.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(web): character editor picks through the dialog and only learnable spells`.

### Task 9: NPC editor uses the dialog

**Files:**
- Modify: `web/src/app/features/npcs/npc-editor.ts`, `.html:52-92`
- Test: `web/src/app/features/npcs/npc-editor.spec.ts`

- [ ] **Step 1: Write failing tests.**
  - Abilities, spells (all spells, no rule) and gear are added through the dialog.
  - Gear text that matches nothing shows `Add “Rope of holding”` and adds that name, as typed gear does today.
  - Skills still use the chip picker.
  - Update the existing picker tests that type into `#ability-to-add`, `#gear-to-add` and `#spell-to-add`.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/features/npcs/npc-editor.spec.ts` — FAIL.
- [ ] **Step 3: Replace the ability, gear and spell chip pickers** with `app-picker-dialog`.
  - Gear gets `[custom]="true"`.
  - Wrap `add()` so each picker's accept returns `null` or `'Not found.'`.
  - The `accepts`/`options` records keep only `skill`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(web): NPC editor picks abilities, gear and spells through the dialog`.

### Task 10: /characters views, export before saving, creator spell and ability dialogs

**Files:**
- Modify: `web/src/app/features/characters/characters.page.ts`, `.html`
- Test: `web/src/app/features/characters/characters.page.spec.ts`

**Interfaces:**
- Produces:
  - `view = signal<'list' | 'create' | 'edit'>('list')`.
  - `exporting` becomes `signal<Character | null>`.

Behaviour:
- **List view** (landing):
  - At the top, a `Create character` button (`btn btn-primary`).
  - Then the `My characters` heading, save status, JSON actions and table.
  - Remove the `Editing X…` line and the `otherOpen` disabling, because the views are exclusive.
- **Create character** sets a fresh `newCreation()` and `cleared([])`, then `view = 'create'`.
- **Create view.**
  - The intro paragraph is gone. `Random character` stays.
  - The `creation-save` row holds `Save`, `Export` (`btn btn-secondary`, opens the export dialog with `character()`, enabled at any time) and `Back to list` (`btn btn-secondary`), which resets the creation and goes to the list.
  - Save stores the character, resets the creation, sets the status and goes to the list.
- **Edit view.** The Edit button sets `editing` and `view = 'edit'`. The editor's Save and Cancel go back to the list.
- **Focus.** Every return to the list focuses `#my-characters-heading`. Entering create focuses a new `h2#create-heading` (`tabindex="-1"`, text `New character`). The editor already focuses its own heading.
- **Save status** stays outside the view switch, so it is still announced after the view changes.
- **Export dialog.** The title is `Export {{ c.name || 'Unnamed hero' }}`. The file base falls back to `character`, as it does now.
- **Creator spells** (magic step). Replace the chip picker with `app-picker-dialog`:
  - `buttonLabel="Add spell…"` and groups `spellGroups(spellOptions(creation, ref), ch.spells)`.
  - Accept `toggleSpell`. When the spell is already known, return `Already known.`. When the creation is unchanged, return `No room: 3 spells and 3 tricks at most.`.
- **Creator heroic ability.** Replace the `<select>` when there is more than one ability:
  - `buttonLabel` is `Choose heroic ability…` while none is chosen, else `<name> (change)`.
  - Groups: `abilityGroups` of the profession's abilities, found in `ref.abilities`.
  - Accept `setHeroicAbility`.

- [ ] **Step 1: Write failing tests.**
  - The page lands on the list with no `.creation-steps`.
  - Create character shows the creator and hides the table.
  - Back to list discards: after it, Create character shows an empty name.
  - Save returns to the list with the new row and the status `Saved X.`.
  - Edit shows the editor and hides the table; Cancel returns.
  - Export from a fresh, empty creation opens the dialog, and text, Markdown and the PDF maker all resolve without throwing (Review Focus 1).
  - The creator spell dialog's full-limit message.
  - The ability dialog sets the ability.
  - Update the tests that relied on the list and the creator showing together.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/features/characters/characters.page.spec.ts` — FAIL.
- [ ] **Step 3: Implement.** If the empty-character PDF throws, fix it at the root (`sheetValues`, `derived` or `placeGear` with an empty kin or profession) and add a unit test there.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(web): list-first characters page with export before saving`.

### Task 11: Creator gear step uses the dialog

**Files:**
- Modify: `web/src/app/features/characters/creation-gear.ts`, `.html:3-23`
- Test: `web/src/app/features/characters/characters.page.spec.ts` (gear-step tests), or a new `creation-gear.spec.ts`

Behaviour:
- **Package choice.** It becomes `app-picker-dialog`.
  - Field text: `Gear package (D6)`, as a visible `<p class="field-label">` or the button's `aria-describedby`.
  - `buttonLabel`: `Choose gear package…` while none is chosen, else `packageLabel(pkg)`.
  - One group, `Gear packages`. Each item: id `String(rollFrom)`, label `packageLabel(pkg)`, and a description listing every entry, one per line, including the rolled entries (rations, silver) as written.
  - Accept: `choosePackage`.
- **"Choose: X or Y" entries.** Each becomes `app-picker-dialog`.
  - `buttonLabel`: the current option, with `buttonAriaLabel` `Choose: X or Y, currently <option>`.
  - One group, `Options`. Items: id the index, label the option, and as description the item's line from `gearGroups`, found with `findItem`, else empty.
  - Accept: `chooseOption`.
  - `chooseOption` and `choosePackage` take the id string instead of an `Event`.
- The doses and enchantment selects stay as they are.

- [ ] **Step 1: Write failing tests.**
  - Choosing package 3–4 through the dialog sets `gearPackage` and adds its items.
  - Choosing the second option of an "X or Y" entry swaps only that item.
  - The option button's aria-label names the current pick.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** To share the gear description, export a `gearDescription(item: EquipmentItemDto): string` from `picker-groups.ts` (Task 6 uses it internally).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(web): creator gear package and choices through the dialog`.

### Task 12: Accessibility gate and docs

**Files:**
- Modify: `web/e2e/a11y.spec.ts`
- Modify: `CLAUDE.md` (the /characters sentence: list first, Create character, export before saving, colour or printer-friendly PDF)

- [ ] **Step 1: Update the characters e2e flow.**
  - Land on the list, then Create character, Random character, Export (before saving) and download the PDF with printer-friendly ticked, then Save, which returns to the list.
  - Run axe with the spell picker dialog and the gear package dialog open, at both viewports.
  - The NPC flow opens the gear dialog.
  - The treasure flow uses aria-label `Re-roll`.
- [ ] **Step 2: Run the full check.** At the repo root run `dotnet test`. Then in `web/` run `npx ng test --watch=false && npx ng build && npm run e2e`. Everything must PASS, and axe must report no violations.
- [ ] **Step 3: Update `CLAUDE.md`.**
- [ ] **Step 4: Commit** `test(web): a11y gate covers the new characters views and picker dialog`.
