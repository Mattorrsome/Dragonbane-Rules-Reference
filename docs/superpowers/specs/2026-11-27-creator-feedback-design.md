# Character Creator feedback (2026-11-27): design

Source: `feedback 2026-11-27.md` plus a second round in conversation. Builds on
`2026-11-26-character-creator-design.md` and `2026-10-27-npc-manager-and-feedback-design.md`.

## Intent

The Character Creator works, but at the table it feels cluttered (list and creator on one page), picking spells, abilities
and gear by typing into a box gives no way to browse or read what you are choosing, the editor lets any character learn
any spell, and the PDF only comes in a colour version that wastes ink. This round tidies the page, makes picking a
browse-and-read experience across both apps, enforces the spell rule, and adds a printer-friendly PDF.

## Goals

1. **Header brand.** `a.nav-brand` reads "Dragonbane " + the app label ("Dragonbane Character Creator", "Dragonbane NPC
   Manager", "Dragonbane Rules Reference"). The ☰ menu keeps the short labels (no "Dragonbane").
2. **/characters views.** One of three views at a time, never two:
   - **List** (landing): "Create character" button on top, then "My characters" (table, JSON export/import, save status).
   - **Create**: the step-by-step creator. Save stores the character and returns to the list.
   - **Edit**: the existing `app-character-editor`. Save or Cancel returns to the list.
   - Remove the line "Work through the steps in order, or roll any of them. Changing an early step clears what no
     longer fits."
3. **Nickname beside the name.** The card's name line reads "Veroulun Waverider" (name, space, nickname; no quotes); the
   nickname no longer has a line of its own. Applies to the card view (creator/editor summary, export image) and the
   text and Markdown exports.
4. **Dice button.** The step-roll button shows a minimalist outline **d6 with pips** (inline SVG, `currentColor`) instead
   of the 🎲 emoji: transparent background, green (`--accent`) border and icon; on hover and focus-visible it fills
   green and the icon turns white. Same icon replaces the word "Roll" on the per-row buttons in the Treasure table
   (`treasure.page.html:53`; aria-labels already present) and on the result dialog's "Re-roll" button
  (`treasure.page.html:23`; it gets `aria-label="Re-roll"`).
5. **PDF: colour or printer friendly.** The export dialog offers a choice (remembered like the descriptions flag):
   - **Colour** (default): page 1 of `Source Material/DB-Character-Sheet.pdf`, then the parchment description pages as
     today.
   - **Printer friendly**: page 2 of `DB-Character-Sheet.pdf`, then description pages on plain white, headings and
     text in black (no parchment tile, no red).
6. **Export before saving.** The creator has an Export button that opens the same export dialog for the character as it
   stands now, whether or not it is complete or saved.
7. **Picker dialog** replaces the chip picker for **spells, heroic abilities and gear** in the creator, the character
   editor and the NPC editor, and replaces the creator's heroic-ability `<select>`. A button ("Add spell…", "Add heroic
   ability…", "Add gear…"; creator ability: "Choose heroic ability…") opens a modal: filter box on top, grouped list on
   the left, description of the highlighted item on the right; on a phone the description stacks under the list.
   Choosing an item calls the caller's existing `accept` (or equivalent); the chips below stay as they are.
   In the creator's gear step (`creation-gear.html`) the dialog also replaces **both** drop-downs: the gear package
   choice (description: what the package contains) and each "Choose: X or Y" item choice (description: the item's
   cost, weight, effect and weapon/armour stats).
   **Behaviour (builder's call, agreed):** a pick closes the dialog and returns focus to its button. A refused pick
   (for example spells full) shows a message in the dialog and keeps it open. Items already chosen are marked "added",
   not hidden.
   **Order by type:**
   - Spells: grouped by school; within a school tricks first, then rank 1, 2, 3; then by name.
   - Gear: grouped by Equipment category, in source order.
   - Heroic abilities: alphabetical (they have no type in the data).
8. **Spell rule in the character editor.** Spells are offered only from schools whose magic skill the character has
   (in `skills`, level ≥ 1). General Magic is offered once any school skill is held. A character with no school skill
   gets no spell picker (a short line says why). The creator's General Magic exceptions apply here too (Harmonism takes
   none, Alchemy and Enchanting take only its tricks); a school's skill is `MagicSchoolDto.skill`, and a school with
   no skill (General Magic) is reached only through the rule above. Ranks above 1 stay allowed (advancement). Spells already known stay and
   can be removed. The creator already enforces its stricter rule (`spellOptions` in `creation.ts`); unchanged.

## Non-goals

- The NPC editor's skill picker and the creator's free-skill picker keep the chip picker (feedback did not name them).
- No spell gating in the NPC editor (NPCs are tweaked freely).
- No export button in the character editor (the character is already saved; export from the list).
- No routes per view; no change to the API, DB or importer.
- "Roll treasure (D40)" keeps its words.

## Anti-goals

- No raw colours: the button and the printer-friendly palette use tokens (the PDF's black is the existing `INK`, white
  is page default).
- Not AXE-clean or not WCAG AA at 1280×800 and 375×812 = failure. The dialog must be keyboard-complete (filter, arrow
  through the list, Enter chooses, Escape closes, focus returns to the opening button).
- The colour PDF must not change from today's apart from the sheet now coming from page 1 of the new file.

## Constraints

- Angular standalone + signals, OnPush; parchment style tokens (`web/src/styles/`); business logic in tested TS.
- Reuse `toggleDialog` / `BackdropDismiss` (`shared/dialog.ts`) and `app-dialog` styles.
- pdf-lib stays lazily loaded.

## Approaches (picker)

- **A. One shared picker dialog (chosen).** Input: groups of `{ heading, items: { label, description } }` plus an accept
  callback. One component, every caller passes data it already has. Richer panes can come later by passing better
  descriptions.
- B. One dialog per kind (spell/ability/gear): richer panes, three components doing the same job. Rejected.
- C. Keep the chip picker and add "Browse…": two ways to do one thing; feedback asked for *instead of*. Rejected.

Dice icon: d6 with pips chosen over an outline d20 and the word "Roll".

## Decided

- Views are a signal on the characters page, not routes (the editor already swaps in the same way).
- The creator has a "Back to list" button that discards the unfinished character (user's call). Create character always
  starts fresh; Save resets it too.
- Printer-friendly description pages: same layout as colour, white background, black headings.
- Both sheet pages ship: `web/public/character-sheet.pdf` is replaced by the two-page `DB-Character-Sheet.pdf` (or two
  one-page files) and the builder picks the page by option. Confirmed by the user: both pages share one layout, so
  `SHEET_FIELDS` serves both unchanged.

## Left to the builder

- Shape of the descriptions per kind (spell: rank, casting time, requirement, description; ability: prerequisite, WP,
  effect; gear: cost, weight, effect, weapon/armour stats as text). Reuse existing card/entry helpers where they fit.
- Exact markup of the list (listbox with group headings or similar) as long as AXE and keyboard rules hold.
- Where the export-option toggle sits in the dialog, and the wording of the "no magic skill" line.
- Test updates: `app.spec.ts` brand text, characters page spec, export menu spec, sheet-pdf spec, Playwright a11y.
- `DECISIONS.md` entries for the shared picker dialog and the two PDF variants.
