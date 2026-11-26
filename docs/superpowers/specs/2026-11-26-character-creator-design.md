# Dragonbane: Character Creator and nav feedback (2026-11-26) design

Source: `feedback 2026-11-26.md` (repo root), `Source Material/Dragonbane_Character_Creation.md`,
`Source Material/DB-Character-Sheet.pdf` (page 2), `Source Material/Example_Character_filled_in.pdf`, and the
brainstorming conversation on 2026-11-26 (layout chosen in the browser mockup `creator-layout.html`, option B).

Everything in `2026-10-22-dragonbane-reference-design.md`, `2026-10-23-table-feedback-design.md` and
`2026-10-27-npc-manager-and-feedback-design.md` still holds, including the hard rules (integer copper, round once
and down at display time, never show the Currency Exchange table, never parse treasure effect text at runtime, the
pricing order, the parchment styles in `web/src/styles/`, AXE-clean and WCAG AA).

Build order: Part 1 to Part 6. Each part ends in a working, committed app with `dotnet test`, `ng test`,
`ng build` and `npm run e2e` passing.

## Intent

The app gets a third tool, the **Character Creator**, for two users with equal weight:

- **Players at session zero** work through the book's creation steps, making each choice themselves.
- **The GM** wants a usable character in one click (Random character), then tweaks it.

Both then keep the character, raise its skills and add heroic abilities as it advances, and hand it out as text,
Markdown, an image or a filled-in official character sheet PDF.

The user also asked that new work reuse what the NPC Manager already built and follow the style that has gone
before. This shapes the approach (Part 2 comes before any creator code).

Success: a player creates "Archmaster Aodhan" (Human, old, elementalist mage) step by step, or a GM clicks Random and
changes only the name; either saves it, later raises Elementalism and adds Robust (HP +2), and downloads a PDF that
looks like `Example_Character_filled_in.pdf` with a second parchment page describing Fireball and the others.

## Approaches considered

1. **Extract the shared parts first, then build the creator on them.** *Chosen.* One early commit moves everything
   in `npc/` and `features/npcs/` that is not NPC-specific into shared modules with no behaviour change; the existing
   NPC tests and e2e gate prove it. The creator then builds on shared code from its first commit. Costs one commit
   before visible creator work.
2. **Copy the NPC pieces into the creator, refactor later.** Fastest start, but two stores, two pickers and two
   export menus drift apart, and the later refactor is easy to skip. Against the user's stated aim.
3. **One model: an NPC is a character without attributes.** One editor and card for both. Rejected: NPCs derive
   attributes backwards from HP and damage bonus (`npcAttributes`); characters roll attributes and derive everything
   else forwards. Forcing one model complicates both and risks regressions in the working NPC Manager. Sharing the
   rules and UI pieces gets most of the benefit.

PDF approaches considered: (a) ship the official sheet and draw onto page 2, (b) draw our own sheet in the app's
parchment style, (c) the user loads their own copy of the official PDF once. **The user chose (a):** Fria Ligan's
character sheets are free to use.

## Part 1: Quick fixes

- `/npcs` page heading becomes **"Dragonbane NPC Manager"**.
- The Reference's name in the nav (brand text and the apps menu entry) becomes **"Rules Reference"**.
- `app.html` currently picks the brand with `currentApp() === 'reference' ? 'Dragonbane Reference' : 'NPC Manager'`.
  Replace this with a label on each entry of the `apps` array, looked up by the current app, so a third app needs no
  template change. Update e2e and unit tests that assert the old text.

## Part 2: Extract the shared parts (no behaviour change)

Move to shared modules (*builder's call:* names and folder, e.g. `web/src/app/hero/` for rules and
`web/src/app/shared/` for UI and file helpers):

- **Local storage list store.** `NpcStore` becomes a generic store parameterised by storage key and an entry checker
  (`checkNpc` today), keeping: versioned key, cross-tab `storage` sync, ignore-bad-entries-on-read, never overwrite
  until the user saves, JSON export, JSON import that replaces by id and appends the rest. `NpcStore` becomes a thin
  instance with the same key `dragonbane.npcs.v1`; saved NPCs must survive the change.
- **File import.** The list-level part of `parseNpcFile` (valid JSON, is a list, not empty, duplicate ids, error
  messages naming the entry) becomes generic over the per-entry checker and a noun ("NPC", "character").
- **File helpers.** `fileName` and `download` from `npc-export.ts`; `fileName` accepts `pdf` and `json` too.
- **Hero rules.** `setAbilityCount` (Robust +2 HP, Focused +2 WP per step, never below 0), `isStacking`,
  `stackingLast`, `STACKING_ABILITIES`, the damage bonus type and its `STR: D6` format, the spell ref type
  (`NpcSpellRef` becomes a neutral name), `addSpell`/`removeSpell`, `findItem`, `describeItem`, `ATTRIBUTES`.
  They work on any object with the fields they touch (`hp`, `wp`, `abilities`, `spells`), so NPCs and characters
  share them.
- **UI pieces.** The editor's searchable chip pickers (skills with level, heroic abilities with count, gear, spells)
  and the export menu (Copy / Download × Image / Text / Markdown, the clipboard fallback, the remembered options).
  The export menu takes what to render as inputs instead of an `Npc`, and allows an extra format (PDF, download only)
  to be added by the creator.

Gate: every existing NPC unit test and the NPC e2e/axe tests pass with no change to what they assert. Record the
extraction in `DECISIONS.md`.

## Part 3: Creation data (import, as for every other section)

The data is never typed into the front end (anti-goal). The importer loads `Dragonbane_Character_Creation.md`;
each table gets one `MapSection` line. Normalised schema, no JSON bags, no generic table/row model.

Entities (*builder's call:* exact names, and whether a small table is a column on its parent instead):

- **Kin:** name, D12 range (from, to), base movement; **KinAbility** rows (name, WP cost nullable for "no WP",
  effect) because Mallard has two innate abilities; **KinName** rows (D6, name).
- **Profession:** name, D10 roll, key attribute (link to Attribute); **ProfessionSkill** junction to Skill (8 rows);
  **ProfessionHeroicAbility** junction to HeroicAbility (Artisan has three to choose from, Mage none);
  **ProfessionNickname** rows (D6, nickname).
- **Magic schools: extend the existing `MagicSchool` entity** (imported from the Spell Tables), do not add a second
  school table. Add from the creation markdown: a **MagicSchoolStartingSkill** junction to Skill (its 8-skill list,
  which includes the school skill itself) and the entry rule as data: required profession (Harmonism: Bard; others:
  Mage), required skill and level (Harmonism: Performance 12 to learn spells; Enchanting: Crafting 12), and whether it
  may be chosen at creation (every school except Dracomancy). The school's own skill row (Animism etc.) must exist as
  a secondary skill in the Skills table; if it does not, add the school skills there *(builder's call: Skills
  markdown or derived from schools)*. Harmonism has no school skill.
- **Age:** name, D6 range, free skill count (2/4/6), attribute adjustments as **AgeAdjustment** rows (attribute,
  delta).
- **Memento, Weakness, Appearance:** D20 roll + text each. Weakness splits into name ("Gullible") and text.
- **Gear packages** are prose with choices and dice ("broadsword, battleaxe **or** morningstar", "D8 silver",
  "two daggers"). Do not parse them. Like `TreasureSeed`, add a hand-curated **GearPackageSeed** keyed by profession
  and D6 range (1-2, 3-4, 5-6), each entry a list of: an equipment item (by name, with quantity), a choice between
  items, a dice-rolled quantity of rations, or dice-rolled silver. Items link to Equipment rows; an alias map covers
  names that differ ("light warhammer", "lyre", "orbuculum", "combat-trained horse", "one dose sleeping poison",
  "book on any subject"). **Any name that matches nothing fails the import loudly**, as `NpcImporter` does. If an
  item genuinely is not in the Equipment table, add it to `Dragonbane_Equipment_Tables.md` only if the rulebook lists
  it; otherwise keep it as a named unlinked item (as `NpcSkill.UnlinkedName` does) *(builder's call, listed in
  DECISIONS.md)*.
- Profession skill names in the markdown use "Hunting & Fishing" / "Myths & Legends" in the mage table and "and"
  elsewhere; match both to the Skills table.
- The two static lookup tables (attribute score → base chance, AGL → movement modifier, attribute → damage bonus) are
  rules, not roll tables: implement them as front-end rule functions with unit tests, like pricing. *(My call: these
  are formulas the book states once; importing three tiny range tables adds schema for no gain.)*

API tests for the importer: row counts per table, every link resolved, aliases resolved, failure on an unknown name,
Mallard's two abilities, Artisan's three heroic abilities, Mage's none.

Regenerate API types (`npm run gen:api`).

## Part 4: Creation rules and the Character Creator page

### Route and nav

- Route `/characters`, title "Character Creator". Apps menu entry **"Character Creator"**, page heading
  **"Dragonbane Character Creator"** (the feedback's "Dragonbane character Creator" read as a typo).
- Lazy-loaded like the other pages; joins the e2e/axe gate at 1280×800 and 375×812.

### Layout (option B, approved)

One page. Left: the creation steps as collapsible sections, in book order, each with a 🎲 button that rolls just that
step and a tick when done. Right: a live character summary (stacks below on phones), the same editor-plus-preview
pattern as the NPC editor. A **Random character** button fills every step. Save at the bottom.

Steps (book sequence; optional steps can be skipped):

1. **Kin** (choose or D12). Shows its innate ability or abilities.
2. **Profession** (choose or D10). Mage asks for a school (see Magic).
3. **Age** (choose or D6).
4. **Name** (choose from the kin's six, D6, or type one) and optional **nickname** (profession table, D6, or type).
5. **Attributes:** 4D6 drop the lowest per attribute, rolled and assigned in order STR, CON, AGL, INT, WIL, CHA;
   then optionally swap any two once. Age adjustments apply after, never above 18. Manual entry (3-18) is also
   allowed for players who rolled real dice *(my call: common at the table)*.
6. **Derived ratings** (shown, not a step to fill): HP = CON, WP = WIL, Movement = kin base + AGL modifier, damage
   bonus for STR and AGL, carrying capacity = half STR rounded up.
7. **Skills:** pick 6 from the profession list plus 2/4/6 free (by age) from any core skill. Trained skills start at
   twice the base chance; untrained at the base chance. The picker shows the counts and blocks over-picking. Random
   picks valid skills.
8. **Heroic ability or magic:** non-mage gets the profession's ability (Artisan chooses one of three). Spells come
   from the Spells API. The user's rules for magic at creation (Book of Magic in play; user's text, 2026-11-26):
   - **Every school except Dracomancy can be chosen** (eleven): Animism, Elementalism, Mentalism, Demonology,
     Harmonism, Illusionism, Necromancy, Symbolism, Witchcraft, Alchemy, Enchanting.
   - **Mage (all schools but Harmonism):** one school, whose 8-skill list replaces the profession list in step 7.
     The school skill is INT-based and trained, and *(my call)* it is a required one of the six profession picks (it
     is on every school's list). Three rank 1 spells and three tricks from that school or General Magic. No heroic
     ability.
   - **Alchemy:** its rank 1 "spells" are rank 1 **recipes**; it has no tricks of its own, so its three tricks come
     from General Magic *(my call)*. Extra starting gear: a small field laboratory, D6 doses of general herbs, and
     three finished doses chosen from its known recipes.
   - **Enchanting:** requires CRAFTING 12, so it is offered only when the character's Crafting is trained and reaches
     12 (base chance 6, i.e. STR 13+ after age), and Random picks it only then. No tricks of its own: tricks from
     General Magic *(my call)*. Extra starting gear: blacksmithing, carpentry or tanning tools (choose or roll), and
     one starting item may be marked as bearing a known enchanting spell plus PERMANENCE (a note on that item).
   - **Harmonism: bard only.** A bard may choose to be a harmonist: swap Musician for three rank 1 harmonistic
     spells, three harmonistic tricks and a grimoire. No school skill; spells use PERFORMANCE, and learning them
     needs PERFORMANCE 12 (shown as a note at creation, enforced nowhere). Harmonists cannot take General Magic, so
     the picker shows Harmonism only (this rules out FAMILIAR). The bard keeps the bard skill list.
9. **Weakness** and **memento** (optional; choose, D20 or type).
10. **Gear package** (choose or D6). Choices inside a package are picked; dice quantities (rations, silver) are
    rolled. Silver is stored as integer copper. Simple clothes are always added.
11. **Appearance** (optional; choose, D20 or type, one or more).

Changing an earlier step re-validates later ones: e.g. changing profession clears profession skills that are no
longer on the list and the gear package; changing age trims free skills over the new limit. *(Builder's call: exact
invalidation rules, as long as the character is never left in an invalid state silently; say what was cleared.)*

**Cut at creation:** Dracomancy (needs a rank 5 spell from another school). The profession abilities' own
mechanics are named, not modelled.

### Rules in services, with tests

All creation rules live in front-end TypeScript with unit tests, using the injectable seeded `DiceRoller`: 4D6 drop
lowest, table rolls by range, age adjustments with the 18 cap, base chance, movement, damage bonus, carrying
capacity, skill counts and starting levels, mage school rules, gear package resolution, re-validation on change, and
Random character producing a valid character for every seed tried in a property-style test.

## Part 5: Saving, the editor and advancement

- **Character model:** name, nickname, kin, profession, magic school (nullable), age, attributes (six scores),
  skills (name, level, trained flag), heroic abilities (name, count), kin abilities, spells (shared spell ref), gear
  (names with quantity and an optional note, e.g. an enchantment), money (integer copper), weakness, memento,
  appearance. References are **by name**, as for NPCs, so characters survive a database rebuild; an unmatched name is
  kept and shown as text.
- **Derived values are computed, never stored** *(my call, accepted)*: HP max = CON + 2 per Robust, WP max = WIL +
  2 per Focused, movement = kin base + AGL modifier, damage bonuses from STR and AGL, carrying capacity = half STR
  rounded up. Raising CON raises HP. Skill levels are stored as set. The NPC rule `setAbilityCount` moves HP/WP
  directly; for characters only its count logic is used and HP/WP follow from the formula *(builder's call: split
  the shared function so both callers stay simple)*.
- **Storage:** the Part 2 generic store, key `dragonbane.characters.v1`, with its own entry checker and file import
  (same corrupt-storage guarantees as NPCs). JSON export/import of all characters, like My NPCs.
- **My characters** list on the page: name, kin, profession, with **Edit**, **Export** and **Delete** (in-page
  confirm, as for NPCs). Empty-state text.
- **Edit is for advancement (user's choice, 2026-11-26).** It opens the same layout-B page on the saved character
  with **kin, profession, age and magic school shown but locked**, and no creation 🎲 buttons or Random. So the saved
  character need not remember which skills were profession picks or which gear package was rolled. Editable: skill
  levels 0-18 (up and down, including untrained skills), adding any heroic ability (its prerequisite is shown, **not
  enforced**), Robust and Focused (+2 HP / +2 WP per step via the formula), attributes, gear, money, spells, name,
  nickname, weakness, memento and appearance.
- No D20 advancement roll, no session marks, no current HP/WP or conditions tracking, no server sync.

## Part 6: Exports

The shared export menu (Part 2) with four formats:

| | Copy to clipboard | Download |
| --- | --- | --- |
| Image | PNG | `<name>.png` |
| Plain text | text | `<name>.txt` |
| Markdown | Markdown | `<name>.md` |
| PDF | – | `<name>.pdf` |

- Text, Markdown and the image follow one character card model (like `buildCard` for NPCs): identity, attributes,
  derived ratings, skills, abilities and spells (names; descriptions with the existing "include descriptions"
  option), weapons, armour, gear, money, weakness, memento, appearance. The image uses `html-to-image` as the NPC
  card does.
- **PDF** (pdf-lib, new dependency, recorded in `DECISIONS.md`):
  - **Page 1:** page 2 of `DB-Character-Sheet.pdf` (the easy-print version; only this page is used), copied into
    `web/public/` and loaded at export time. The character is written onto it in **Caveat** (the font used in
    `Example_Character_filled_in.pdf`; OFL, self-hosted like Colus). Fields: name, kin, age, profession (with school
    for a mage, e.g. "Mage – Elementalist"), weakness, appearance, the six attributes, damage bonus STR and AGL ("–"
    when none), movement, encumbrance limit, every skill level, secondary (school) skills, **abilities & spells as
    names only** (kin ability, heroic abilities, spells and tricks), inventory, memento, tiny items, money
    (gold/silver/copper split from copper), armour and helmet with rating, weapons (grip, range, damage, durability,
    features from the Equipment table), max WP and max HP.
  - **Gear placement comes from the Equipment table** *(my call, accepted)*: the first three weapons or shields are
    ready weapons, the first armour and first helmet are worn, items of weight 0 go under tiny items, up to four
    rations count as one weight, everything else fills Inventory rows by weight. Overflow (a fourth weapon, more
    items than rows) is listed on page 2. No ready/worn flag in the saved character.
  - Each field's position, font size and box width live in one data file of coordinates, measured once against the
    sheet. Long text shrinks or wraps to fit its box. A unit test checks every field in the map is written.
  - **Page 2 (ours):** same page size, parchment background (`scroll-tile.webp`), Colus headings, listing each heroic
    ability (WP cost, effect) and kin ability, and each spell and trick (rank, casting time, range, duration,
    description) the character knows. Flows onto further pages if long.
  - Fria Ligan's character sheets are free to use (user's statement, 2026-11-26); record this in `DECISIONS.md`.

## Non-goals

- Running a session: current HP/WP, conditions, death rolls, advancement marks and rolls.
- Dracomancy at creation.
- Changing kin, profession, age or magic school after a character is saved.
- Enforcing heroic ability prerequisites when advancing.
- Saving characters on the server or syncing between devices.
- Page 1 of the official sheet (only the easy-print page 2 is used).

## Anti-goals

- Creation tables typed into the front end instead of imported from the markdown.
- Parsing gear package prose at runtime.
- A JSON property bag or generic table/row model.
- Copy-pasted NPC code (stores, pickers, export menu) instead of shared modules.
- Saved characters or NPCs lost silently (bad storage, the Part 2 refactor).
- A page that fails AXE or WCAG AA, or scrolls sideways at 375 px.

## Left to the builder

Marked *builder's call* above, plus: component, service and entity names; the exact section and summary
typography; how invalidation messages are shown; how PDF text fitting works; whether My characters sits below the
creator or on its own tab of the page.
