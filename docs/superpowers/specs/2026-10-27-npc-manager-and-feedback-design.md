# Dragonbane: NPC Manager and table feedback (2026-10-27) design

Source: `2026-10-27 Feedback.md` (repo root), `NPC_Image_Example.png` (repo root), `spinner-dragon.svg`
(repo root) and the brainstorming conversation on 2026-10-27, which used browser mockups. Everything in
`2026-10-22-dragonbane-reference-design.md` and `2026-10-23-table-feedback-design.md` still holds,
including the hard rules (integer copper, round once and down at display time, never show the Currency
Exchange table, never parse treasure effect text at runtime, and the pricing order), **except one
reversal:** the NPC table is no longer excluded (see Part 3).

Build order: Part 1, then Part 2, then Part 3. Each part ends in a working, committed app.

## Intent

At the table the GM often needs an NPC fast. The way they do it is to take one of the book's typical NPCs
and tweak it: rename it, add a weapon or a spell, change a skill. Today that happens on paper. The NPC
Manager lets the GM tweak a typical NPC in the app, keep their creations, and hand them out as a card
image like the book's own NPC boxes (`NPC_Image_Example.png`), or as text or Markdown.

Alongside it: the treasure dialog gets a rolling spinner and a better Close button, the styles stop
depending on a Claude skill that may change, and the app gets a menu to move between the Reference and
the NPC Manager.

Success: mid-session, the GM opens the NPC Manager, tweaks the Bandit chief into "Grok" with a new
spell in under a minute, and copies Grok's card into their notes or chat.

## Part 1: Quick fixes

### 1.1 Spinner in the treasure dialog

- Move `spinner-dragon.svg` from the repo root to `web/public/spinner-dragon.svg`.
- Replace its hardcoded colours (`fill="#14443a"`, `stroke="#ffffff"`) so it takes the theme colour:
  `fill="currentColor"` set from the token (`--demon-green-dark`), stroke from the dialog colour token.
  *Builder's call:* inline the SVG markup in a small component or use it as a CSS mask; whichever keeps
  `currentColor` working.
- When the user rolls and when they press Re-roll, the dialog shows the spinner and the text "Rolling…"
  for **at least 0.5 s**, then the result. The roll itself is synchronous; the delay is deliberate and
  cosmetic. Use an injectable/fakeable timer (RxJS `timer` or `setTimeout` under `fakeAsync`) so tests
  don't wait.
- The spinner rotates with CSS. Under `prefers-reduced-motion: reduce` it does not rotate; the text still
  shows.
- Accessibility: the SVG is decorative (`aria-hidden="true"`, drop its `role="img"` and `<title>`).
  "Rolling…" is announced through a polite live region. Focus stays in the dialog during the delay.
- The dialog keeps its current fixed size so it does not jump between spinner and result.

### 1.2 Floating Close button

- The Close button is centred on the dialog's **top-right corner**: half in, half out
  (`top: 0; right: 0; transform: translate(50%, -50%)`).
- Round, at least 44 × 44 px. Its fill is the dialog colour (`--bone-white`); the ring and the X glyph
  are `--demon-green-dark`, which gives the 3:1 non-text contrast against both the dialog and the dark
  backdrop.
- The dialog today has `overflow-y: auto`, which would clip the button. Move the scrolling to an inner
  wrapper and give the `<dialog>` `overflow: visible`. The dialog's fixed size, the bottom-centre
  Re-roll and close-on-backdrop-click stay as they are.
- Approved in the 2026-10-27 mockup (`treasure-dialog.html`).

### 1.3 Styles in the repo, not in the skill

The app already does not read the skill at runtime: `web/src/dragonbane.css` holds the tokens (copied
from the skill) and `web/src/styles.scss` builds on them. The risk is `CLAUDE.md`, which tells future
work to follow the skill, which can change.

- Create `web/src/styles/` and move the global styles there:
  - `_tokens.scss` (or `tokens.css`): every CSS custom property (colours, fonts, spacing, max width).
  - `parchment.css`: the rest of today's `dragonbane.css`.
  - `app.scss`: today's `styles.scss`.
  *Builder's call:* exact file split and names, as long as tokens are in one file and nothing is
  duplicated. Update `angular.json` `styles` accordingly.
- Update `CLAUDE.md`: `web/src/styles/` is the source of truth for the look. The skill is where the style
  came from, not what the app follows. New components use the tokens, never raw colour values.
- Pure move: no visual change. The e2e/axe gate must pass unchanged.

## Part 2: Menu and routes

Approved option A in the mockup (`nav-v2.html`).

- A hamburger button at the left of the navbar opens a menu with two entries:
  **Dragonbane Reference** and **NPC Manager**. The current one is marked (`aria-current="page"`).
- The brand text shows the current app's name.
- On the Reference, the five section tabs and the coin standard select stay in the bar as today.
  On the NPC Manager, neither shows.
- Routes:
  - `/reference/skills`, `/reference/heroic-abilities`, `/reference/spells`, `/reference/equipment`,
    `/reference/treasure`. `/reference` redirects to `/reference/skills`.
  - `/npcs` for the NPC Manager.
  - `''` redirects to `/reference/skills` (the Reference is the default).
  - The old paths (`/skills` etc.) redirect to their new ones so bookmarks keep working.
  - `**` redirects to `/reference/skills`.
- The menu button is a real `<button>` with `aria-expanded` and `aria-controls`; Escape closes the menu
  and returns focus to the button; it works with keyboard only. *Builder's call:* the native `popover`
  attribute or a small signal-driven panel.
- Works at 375 px with no horizontal scroll. At 375 px the section tabs may wrap or scroll as they do
  today; this part does not redesign them.

## Part 3: NPC Manager

### Reversal of the original spec

The 2026-10-22 design lists the NPC table as excluded (Source data, and Non-goals). The user has asked
for it. Update that spec's two mentions to point here, and add a `DECISIONS.md` entry.

### Data: import, as for every other section

- The importer loads `Dragonbane_NPC_Table.md` into the database. The API serves it with one
  `MapSection` line: `GET /api/npcs`, `GET /api/npcs/{id}`. Read-only, like every section.
- Normalised schema, no JSON bags:
  - `Npc`: Type (e.g. "Bandit chief"), IsBoss (from "(boss)" in the type), HP, WP (nullable),
    DamageBonus as attribute + dice (e.g. STR, D6; nullable).
  - `NpcSkill` junction: Npc, Skill, Level.
  - `NpcHeroicAbility` junction: Npc, HeroicAbility, Count ("Robust x6" → Robust, 6; no "xN" → 1).
  - `NpcGear` junction: Npc, EquipmentItem.
- **Every name links to a real row.** The importer fails loudly (as `EquipmentImporter` does for unknown
  weapon features) if a skill, ability or gear name in the NPC table has no match. Names that don't match
  as written are resolved by a small alias map in the importer, which is hand-curated data like the
  treasure seed:
  - "leather armour" → Leather
  - "Wooden club" → Small wooden club (*my call*)
  - "Relevant book" → Book
  - Casing differences ("studded leather", "short bow") match case-insensitively without an alias.
- **"Magic school 15"** (Archmage) is not in the Skills table; a magic school skill is a school name.
  *My call:* import it as a skill row that is not linked to the Skills table (a nullable skill link with
  a display name), shown as "Magic school 15", and let the tweak editor replace it with a real school.
  The builder may instead link it to a named school if one is clearly intended.
- **Weapon → skill.** The Equipment markdown has no skill column, but weapons need one to show "skill
  level N". Add a `Skill` column to the Melee weapons and Ranged weapons tables in
  `Dragonbane_Equipment_Tables.md` (Knife → Knives, Staff → Staves, Large shield → Brawling per the
  rulebook, etc.), import it as a link from `Weapon` to `Skill`, and expose it on the equipment DTO.
  The markdown stays the single source of truth. Unarmed and the improvised objects map to Brawling;
  weapons whose group is unclear (halberd, flail, trident) follow the rulebook's skill list and the
  table's grouping order (*builder's call*).
- WP "-" means none. Damage bonus "-" means none.

### Typical NPCs page (`/npcs`)

- Table of the 11 typical NPCs in source order, with the source columns. Read-only.
- Clicking a skill, heroic ability or gear name shows its description (from the Reference data) in a
  popover or expandable row. *Builder's call:* reuse whatever the Reference sections already use for
  descriptions.
- Each row has a **Tweak** button.
- Below it, a second table **My NPCs** (name, based on), each with **Edit**, **Export** and **Delete**.
  Delete asks for confirmation (in-page, not `window.confirm`). Empty state text when there are none.

### Tweak / edit dialog

Approved option B in the mockup (`npc-editor.html`): a native modal dialog over the tables, styled like
the treasure dialog (and using the floating Close from 1.2).

- **Tweak** on a typical NPC opens the dialog on a copy. The 11 typical NPCs are never changed.
  **Edit** on a saved NPC opens it.
- Left side: the editor. Right side: a live preview of the export card. Stacked on narrow screens.
- Fields: Name (required), Description (free text, optional), Movement (number, default **10**, since
  the source has no Movement), HP, WP, damage bonus.
- Lists as removable chips, each with **+ Add** that picks from the Reference data (searchable):
  - Skills, with an editable level.
  - Heroic abilities, with a count for those that stack (Robust, Focused). *Builder's call:* which
    abilities allow a count; at minimum Robust and Focused.
  - Gear: any equipment item.
  - Spells: any spell (tricks, spells, recipes). The typical NPCs have no spells; spells are only added
    by tweaking.
- **Adding a weapon whose skill the NPC lacks adds that skill at level 5.** It can then be edited.
  The same rule runs when a typical NPC is copied by **Tweak**: any weapon whose skill the NPC lacks
  gets that skill at 5 (e.g. the Villager's club adds Hammers 5). If the GM later removes a weapon skill
  while the weapon stays, the weapon line shows "skill level –" (*my call*).
- **Robust and Focused change HP and WP.** Each Robust is +2 max HP and each Focused is +2 max WP (the
  source HP/WP already include them). Changing a count, adding the ability or removing its chip adjusts
  the current HP or WP by 2 per step (e.g. Robust ×6 → ×4 takes HP 30 → 26). HP and WP stay editable by
  hand; a count change applies its delta to whatever value is there. Values never go below 0.
- Save / Cancel. Save validates (name required, numbers ≥ 0).

### Saved NPCs (local storage)

- Saved in this browser's local storage under a versioned key (e.g. `dragonbane.npcs.v1`). Not sent to
  the server, not synced between devices.
- *My call:* store references by **name** (skill, ability, item, spell names), not database Id, so
  creations survive a database rebuild. On load, a name that no longer matches anything is kept and
  shown as plain text rather than dropped.
- Spell names are not unique (ERASE is both a Symbolism trick and a rank-6 spell), so a saved spell
  stores name plus school and kind (*my call*).
- Store which typical NPC it was based on (by type name) for the "Based on" column.
- Corrupt or unreadable storage must not break the page: ignore it and start empty (do not overwrite it
  until the user saves).

### Export card

Approved option B with changes (`npc-card-v2.html`). Book-style card like `NPC_Image_Example.png`,
parchment look from the repo styles, approximating the book's frame with the existing scroll images.
The book's banner/skull art is not copied.

Rows, top to bottom; a row with nothing in it is hidden:

1. Name (banner).
2. Description.
3. **Movement:** N · **Damage Bonus:** `STR: +D6` (attribute, colon, plus, dice).
4. **Armor:** armour piece names and the total rating in brackets, e.g. "Chainmail, open helmet (5)" ·
   **HP:** N · **WP:** N. The rating is the sum of the NPC's armour and helmet ratings from the Equipment
   table.
5. **Skills:** non-weapon and weapon skills, "Name level", comma separated.
6. **Heroic Abilities:** names, with "×N" for counts. **Robust and Focused always come last.**
7. **Weapons:** each weapon with "(skill level N, damage X)"; N from the NPC's matching skill, X from the
   Equipment table.
8. **Spells:** names.
9. **Gear:** everything that is neither weapon nor armour.

**Include spell and heroic ability descriptions** (checkbox, off by default): when on, each heroic
ability shows its WP cost and effect, and each spell its rank, casting time, range and duration and its
description, in **smaller text** under the name. **Robust and Focused never get a description.**

### Export formats and actions

The Export menu has six actions:

| | Copy to clipboard | Download |
| --- | --- | --- |
| Image | PNG on the clipboard | `<name>.png` |
| Plain text | text | `<name>.txt` |
| Markdown | Markdown | `<name>.md` |

- Text and Markdown follow the same rows, order and description option as the card.
- *My call:* render the image from the card's HTML with the `html-to-image` library (new dependency,
  recorded in `DECISIONS.md`). Alternative was drawing the card by hand on a canvas, which duplicates the
  layout. The builder must make sure the fonts (Colus, Crimson Pro) are embedded in the PNG; if the
  Google Fonts stylesheet blocks this, self-host the font files.
- Copying an image uses `navigator.clipboard.write` with a `ClipboardItem`. If it is unavailable or
  refused, say so in the page and offer the download.

### Logic and tests

All rules live in front-end TypeScript services with unit tests: copying a typical NPC, the add-weapon
→ skill-at-5 rule (on add and on copy), the Robust/Focused → HP/WP rule, armour rating sum, weapon lines, row ordering (Robust/Focused last), damage bonus
format, hidden empty rows, text and Markdown output, storage load/save/corrupt handling. The importer
gets API tests for the NPC table (11 rows, counts parsed, aliases resolved, failure on an unknown name)
and for the weapon skill column.

## Non-goals

- Building an NPC from scratch.
- Editing or deleting the 11 typical NPCs.
- Saving creations on the server or syncing between devices.
- Monsters, or any NPC data beyond `Dragonbane_NPC_Table.md`.
- Redesigning the section tabs on phones.

## Anti-goals

- A JSON property bag or generic table/row model for NPCs (the schema rule holds).
- Typical NPC data typed into the front end instead of imported from the markdown.
- A card that fails AXE or WCAG AA, or a Close button that disappears against the backdrop.
- Creations lost silently (a bad storage read wiping saved NPCs).
- Copying the book's art.

## Left to the builder

Marked *builder's call* above, plus: component and service names, the exact card typography and
spacing, popover vs expandable row for descriptions, how the picker searches. Add the NPC Manager (table,
dialog, card) to the e2e/axe gate at 1280×800 and 375×812.
