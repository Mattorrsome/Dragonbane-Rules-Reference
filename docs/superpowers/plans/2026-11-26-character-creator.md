# Character Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the nav and NPC heading, extract the NPC Manager's reusable parts, and add a Character Creator
(`/characters`). It offers guided or random creation from imported rules data, advancement editing, local storage
with JSON import/export, and export as text, Markdown, image and the official sheet as a PDF.

**Architecture:** The creation tables are imported from `Dragonbane_Character_Creation.md` into normalised EF Core
tables. Each table is served with one `MapSection` line, and the gear packages come from a hand-curated seed like
`TreasureSeed`. All rules are pure TypeScript functions with unit tests, using the injectable seeded `DiceRoller`.
The UI reuses shared modules first extracted from the NPC Manager:
- the list store
- the file parser
- the hero rules
- the chip picker
- the export menu

**Tech Stack:** .NET 10 minimal API, EF Core + SQLite, xUnit; Angular 22 (standalone, signals, `httpResource`),
Vitest, Playwright + axe; new: `pdf-lib`, `@pdf-lib/fontkit`.

**Spec:** `docs/superpowers/specs/2026-11-26-character-creator-design.md` (read it with this plan).

## Global Constraints

- Hard rules in `CLAUDE.md` hold:
  - money is integer copper, rounded down once at display time
  - never parse gear/treasure prose at runtime
  - no JSON property bags or generic table/row model
  - styles use tokens from `web/src/styles/tokens.css`, never raw colours
- Creation data is imported from markdown, never typed into the front end. Exceptions:
  - the gear package seed (Task 8)
  - the rule formulas for base chance, movement modifier, damage bonus and carrying capacity (Task 10)
- Every name in imported creation data links to a real row. Unknown names fail the import loudly with
  `InvalidDataException`, as `NpcImporter` does.
- Saved characters store references **by name**, never database Id.
- AXE-clean (wcag2a, wcag2aa, wcag21a, wcag21aa) and no sideways overflow at 1280×800 and 375×812.
- Exact copy:
  - nav entries "Rules Reference", "NPC Manager", "Character Creator"
  - headings "Dragonbane NPC Manager", "Dragonbane Character Creator"
- Storage keys: `dragonbane.npcs.v1` (unchanged), `dragonbane.characters.v1`.
- Robust is +2 HP max and Focused is +2 WP max per count.
- Skill levels are 0-18. Attributes are 3-18 at creation, capped at 18 after the age adjustment.
- Every commit passes `dotnet test`, then in `web/`: `npx ng test --watch=false && npx ng build && npm run e2e`.
  Stop any running API before `dotnet test`.
- Record each decision marked *(DECISIONS)* in `DECISIONS.md` with the repo's template, in the task that makes it.

## Review Focus

1. **Saved NPCs after the store refactor.** NPCs saved before Task 3 must still load under `dragonbane.npcs.v1`, and
   an NPC file exported before it must still import. Test in Task 3.
2. **Changing an earlier creation step.** Changing profession, age, attributes or school after skills, spells and
   gear were picked must never leave an invalid character silently. Each setter returns what it cleared. Tests in
   Task 11.
3. **Random character across many seeds.** It must always be valid, including the edge paths: a harmonist bard, an
   enchanter only when Crafting can reach 12, an alchemist with recipes and General Magic tricks. Test in Task 12.
4. **Hand-edited or corrupt character data.** A hand-edited character file, or corrupt `dragonbane.characters.v1`
   storage, must not break the page or wipe characters. Tests in Task 14.
5. **Hard-to-fit text in the PDF.** Long text (name, weakness, appearance, 20 inventory items) and characters outside
   Latin-1 (e.g. "Ærwyn ✨") must not throw or spill out of their boxes. Tests in Task 18.

---

## Part 1: Quick fixes

### Task 1: Nav labels from the apps list, NPC heading

**Files:**
- Modify: `web/src/app/app.ts`, `web/src/app/app.html`, `web/src/app/features/npcs/npcs.page.html:2`
- Test: `web/src/app/app.spec.ts`, `web/src/app/features/npcs/npcs.page.spec.ts`, any `web/e2e/*.spec.ts` asserting
  the old text

**Interfaces:**
- Produces: `App.apps: { path: string; label: string }[]` (the menu entries); `App.currentApp: Signal<{ path; label }>`.
  A third app is added by appending an entry to `apps` (Task 13).

- [ ] **Step 1: Update tests to the new copy**
  - `app.spec.ts`: brand on `/reference/skills` is `"Rules Reference"`; brand on `/npcs` is `"NPC Manager"`; the
    menu lists `["Rules Reference", "NPC Manager"]`.
  - `npcs.page.spec.ts`: the `h1` text is `"Dragonbane NPC Manager"`.
- [ ] **Step 2: Run** `npx ng test --watch=false --include src/app/app.spec.ts --include src/app/features/npcs/npcs.page.spec.ts`.
  Expected: FAIL on the old text.
- [ ] **Step 3: Implement.**
  - `apps` becomes `[{ path: '/reference', label: 'Rules Reference' }, { path: '/npcs', label: 'NPC Manager' }]`.
  - `currentApp` becomes the entry whose `path` the URL starts with, defaulting to the first.
  - The template's brand uses `currentApp().label` and `[routerLink]="currentApp().path"`.
  - The section tabs and coin select show when `currentApp().path === '/reference'`.
  - Change the `h1` copy in `npcs.page.html`.
- [ ] **Step 4: Run** the same tests plus `npx ng build`. Expected: PASS. Run `npm run e2e`, fix any asserted copy.
- [ ] **Step 5: Commit** `fix(web): rename the Reference to Rules Reference and title the NPC Manager page`

## Part 2: Extract the shared parts (no behaviour change)

Gate for every task in this part: the existing NPC unit tests and the NPC e2e tests pass with **no change to what they
assert** (only import paths may change).

### Task 2: Shared file helpers

**Files:**
- Create: `web/src/app/shared/file.ts`, `web/src/app/shared/file.spec.ts`
- Delete: `web/src/app/npc/npc-export.ts`, `web/src/app/npc/npc-export.spec.ts`. Move their tests into
  `file.spec.ts`.
- Modify: importers of `npc-export`

**Interfaces:**
- Produces:
  - `fileName(name: string, ext: 'png' | 'txt' | 'md' | 'pdf' | 'json', fallback = 'npc'): string`
  - `download(blob: Blob, name: string): void`

- [ ] **Step 1:** Move the existing tests and add two:
  - `fileName('Aodhan', 'pdf') === 'aodhan.pdf'`
  - `fileName('!!', 'json', 'character') === 'character.json'`
- [ ] **Step 2:** Run `npx ng test --watch=false --include src/app/shared/file.spec.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Move the code and widen `ext`. The `fallback` parameter replaces the hard-coded `'npc'`.
- [ ] **Step 4:** Run the full `npx ng test --watch=false`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor(web): move file name and download helpers to shared`

### Task 3: Generic local-storage list store and list file parser

**Files:**
- Create: `web/src/app/shared/list-store.ts`, `web/src/app/shared/list-store.spec.ts`
- Modify:
  - `web/src/app/npc/npc.store.ts`: becomes a thin subclass
  - `web/src/app/npc/npc-file.ts`: `parseNpcFile` delegates
- Test: the existing `npc.store.spec.ts` and `npc-file.spec.ts` are unchanged and still pass.

**Interfaces:**
- Produces:
  - `parseListFile<T extends { id: string; name: string }>(text: string, check: (entry: unknown, n: number) => T, noun: string): T[]`
    - `noun` is singular ("NPC", "character").
    - Its messages are today's with the noun swapped in: "That file is not valid JSON.", "That file does not hold
      a list of NPCs.", "That file holds no NPCs.", `NPC 2 ("x") has the same id as NPC 1.`
  - `abstract class ListStore<T extends { id: string; name: string }>`, constructed with
    `(key: string, check: (entry: unknown, n: number) => T, noun: string)`. Members:
    - `readonly items: Signal<readonly T[]>`
    - `save(entry: Omit<T, 'id'> & { id?: string }): T`
    - `remove(id: string): void`
    - `exportJson(): string`
    - `importJson(text: string): number`
  - Behaviour: exactly today's `NpcStore` (cross-tab `storage` event sync, bad entries skipped on read and never
    overwritten until a save, storage errors swallowed).
  - `NpcStore extends ListStore<SavedNpc>`, key `'dragonbane.npcs.v1'`, keeps `readonly npcs = this.items` so callers
    don't change.

- [ ] **Step 1:** Write the `list-store.spec.ts` tests against a tiny test type `{ id, name }`.
  - Use key `'test.list.v1'`.
  - The `parseListFile` messages use noun `'thing'`: "That file does not hold a list of things."
  - **Review Focus 1:** write a v1 NPC array (one with legacy `damageBonus`) to `localStorage['dragonbane.npcs.v1']`,
    construct `NpcStore`, and expect both NPCs in `npcs()`. Then `importJson` of the same array returns 2.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement, then reduce `NpcStore` and `parseNpcFile` to calls into it.
- [ ] **Step 4:** Run `npx ng test --watch=false`. Expected: PASS, with the NPC specs unchanged.
- [ ] **Step 5: Commit** `refactor(web): generic local-storage list store shared by NPCs and characters`

### Task 4: Hero rules module

**Files:**
- Create: `web/src/app/hero/hero.ts`, `web/src/app/hero/hero-card.ts`, `web/src/app/hero/hero.spec.ts`
- Modify:
  - `web/src/app/npc/npc.ts`: keeps only NPC rules
  - `web/src/app/npc/npc-card.ts`: uses the `hero-card` entries
  - the NPC components' imports

**Interfaces:**
- Produces from `hero/hero.ts` (moved from `npc.ts` unless noted):
  - `SpellRef` (was `NpcSpellRef`; keep `export type NpcSpellRef = SpellRef` in `npc.ts`)
  - `DamageBonus`, `DAMAGE_BONUS_ATTRIBUTES`
  - `HeroReference { skills; abilities; equipment; spells }` (keep `export type NpcReference = HeroReference`)
  - `Ability { name: string; count: number }`, `STACKING_ABILITIES`, `isStacking`, `stackingLast`
  - `ATTRIBUTES`, `Attribute`
  - `findItem(ref, name)`, `describeItem(item)`
  - `addSpell<T extends { spells: SpellRef[] }>(x: T, s: SpellRef): T`, `removeSpell` (same generic shape)
  - **new** `withAbilityCount(abilities: readonly Ability[], name: string, count: number): { abilities: Ability[]; delta: number }`:
    today's count logic of `setAbilityCount` (stacking or 0/1, never below 0)
  - **new** `formatDamageBonus(b: DamageBonus): string` → `"STR: D6"`
  - **new** `POINTS_PER_STACK = 2`
- Produces from `hero/hero-card.ts`:
  - `CardEntry` (moved from `npc-card.ts`)
  - `abilityEntries(abilities: readonly Ability[], ref: HeroReference, withDescriptions: boolean): CardEntry[]`
  - `spellEntries(spells: readonly SpellRef[], ref: HeroReference, withDescriptions: boolean): CardEntry[]`
  - Both are today's logic from `buildCard`: stacking last, Robust/Focused never described.
- `npc.ts`'s `setAbilityCount` becomes `withAbilityCount` plus the HP/WP move by `delta * POINTS_PER_STACK`.

- [ ] **Step 1:** `hero.spec.ts` covers the two new functions:
  - `withAbilityCount([{name:'Robust',count:6}], 'Robust', 4)` → `{ abilities: [{name:'Robust',count:4}], delta: -2 }`
  - `withAbilityCount([], 'Berserker', 3)` → count 1, delta 1
  - `formatDamageBonus({attribute:'AGL',dice:'D4'}) === 'AGL: D4'`

  Move the moved functions' existing tests from `npc.spec.ts` / `npc-card.spec.ts` only if they no longer test NPC
  behaviour.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Move the code, rewire the imports.
- [ ] **Step 4:** Run `npx ng test --watch=false` and `npx ng build`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor(web): move hero rules shared by NPCs and characters into hero/`

### Task 5: Shared chip picker and export menu

**Files:**
- Create:
  - `web/src/app/shared/chip-picker.ts`, `.html`, `.spec.ts`
  - `web/src/app/shared/export-menu.ts`, `.html`, `.spec.ts`
- Modify:
  - `web/src/app/features/npcs/npc-editor.ts/.html`: the `picker` ng-template becomes `<app-chip-picker>`
  - `web/src/app/features/npcs/npc-export-menu.ts/.html`: becomes the NPC options plus card inside `<app-export-menu>`
  - Move the styles they use in `web/src/styles/app.scss` from npc-specific to shared class names where they are
    renamed.

**Interfaces:**
- Produces `ChipPicker` (`app-chip-picker`). Today's picker markup and behaviour (searchable `datalist`, Add button,
  clear ✕ keeping focus, error text).
  - Inputs:
    - `options: string[]`
    - `noun: string`
    - `pickerId: string`
    - `accept: (text: string) => boolean`. Called on Add. If it returns true the box clears; if false it shows
      today's not-found error.
- Produces `ExportMenu` (`app-export-menu`):
  - Inputs:
    - `fileBase: string`
    - `fallbackName: string`
    - `text: () => string`
    - `markdown: () => string`
    - `pdf: (() => Promise<Blob>) | null = null`
  - Projects `[exportOptions]` content (the checkboxes) above the buttons and the default content (the card) below.
  - Draws the image from the first `.export-card` element in the projected card.
  - When `pdf` is set, Download shows a fourth button, aria-label `"Download PDF"`. Copy never shows PDF.
  - `CARD_RENDERER` moves here, and gains `PDF_FAILED = 'The PDF could not be made.'` as the status text when `pdf()`
    rejects.
- The NPC card view's root element gains class `export-card`.

- [ ] **Step 1:** Write `chip-picker.spec.ts`:
  - Add with `accept` returning true clears the box.
  - Returning false shows the error.
  - ✕ refocuses the box.

  Write `export-menu.spec.ts`:
  - With `pdf` null, Download shows Image/Text/Markdown.
  - With `pdf` set, there is a "Download PDF" button that calls `download` with `<fileBase>.pdf`.
  - A rejecting `pdf` shows `PDF_FAILED`.
- [ ] **Step 2:** Run both. Expected: FAIL.
- [ ] **Step 3:** Implement and switch the NPC editor and NPC export menu to them.
- [ ] **Step 4:** Run `npx ng test --watch=false`, `npx ng build`, `npm run e2e`. Expected: PASS, with
  `npc-editor.spec.ts`, `npc-export-menu.spec.ts` and the NPC e2e unchanged in what they assert.
- [ ] **Step 5:** Add the *(DECISIONS)* entry "Shared hero and UI modules before the Character Creator". **Commit**
  `refactor(web): shared chip picker and export menu`

## Part 3: Creation data

All entities go in a new `src/Dragonbane.Api/Data/Entities/Characters.cs`, plus the additions to `MagicSchool` in
`Magic.cs`. Importer: new `src/Dragonbane.Api/Import/CharacterCreationImporter.cs`, called from
`SourceImporter.RebuildAsync` after `SpellsImporter` and before `NpcImporter`. It needs Skills, Attributes,
HeroicAbilities, Equipment and MagicSchools. Tests go in
`tests/Dragonbane.Api.Tests/Import/CharacterCreationImporterTests.cs`, set up like `NpcImporterTests` (in-memory
SQLite, import the prerequisites, then the real markdown). Add every new `DbSet`, FK and unique-name index to
`DragonbaneDbContext`, following the NPC block. `SchemaTests` must still pass.

### Task 6: Kin, ages, names and the D20 tables

**Files:** `Characters.cs`, `DragonbaneDbContext.cs`, `CharacterCreationImporter.cs`, `SourceImporter.cs`, the test file

**Interfaces:**
- Produces entities:
  - `Kin { Id, Name, RollFrom, RollTo, Movement, List<KinAbility> Abilities, List<KinName> Names }`
  - `KinAbility { Id, KinId, Name, int? Wp, Effect }`: null Wp means "no WP"
  - `KinName { Id, KinId, Roll, Name }`
  - `Age { Id, Name, RollFrom, RollTo, FreeSkills, List<AgeAdjustment> Adjustments }`
  - `AgeAdjustment { Id, AgeId, AttributeId, Attribute, Delta }`
  - `Memento { Id, Roll, Text }`, `Weakness { Id, Roll, Name, Text }`, `Appearance { Id, Roll, Text }`
- Produces `CharacterCreationImporter.Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)`.
- Parsing rules:
  - Roll ranges: `"1-4"` gives 1 to 4, `"10"` gives 10 to 10.
  - Kin ability cell: each `**Name (N WP):** effect` or `**Name (no WP):** effect`. Mallard has two.
  - Age trained skills: `"6 profession + N free"` gives N.
  - Age adjustments: `"AGL +1, CON +1"`, or `"None"` for none.
  - Weakness: `**Gullible.** text` gives Name "Gullible", Text "I believe…".
  - Names table: one column per kin.

- [ ] **Step 1:** Write the tests:
  - 6 kin; Human 1-4, movement 10; Wolfkin 12-12, movement 12
  - Mallard has abilities `["Ill-Tempered", "Webbed Feet"]` with Wp `[3, null]`
  - Elf "Inner Peace" Wp null
  - each kin has 6 names; Dwarf name 2 is "Halwyld"
  - 3 ages; Old FreeSkills 6 with adjustments STR-2, AGL-2, CON-2, INT+1, WIL+1
  - 20 mementos, 20 weaknesses (weakness 5 Name "Fainthearted"), 20 appearances
  - a kin row with a malformed ability cell throws `InvalidDataException`
- [ ] **Step 2:** `dotnet test --filter CharacterCreationImporterTests`. Expected: FAIL.
- [ ] **Step 3:** Implement the entities, DbContext config and importer.
- [ ] **Step 4:** Run `dotnet test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): import kin, ages, names, mementos, weaknesses and appearances`

### Task 7: Professions, nicknames and magic school creation rules

**Files:**
- `Characters.cs`, `Magic.cs`, `DragonbaneDbContext.cs`, `CharacterCreationImporter.cs`, the test file
- `Source Material/Dragonbane_Character_Creation.md`: restructure the mage table

**Interfaces:**
- Markdown change: replace the "Mage Starting-skill lists" table with columns
  `| School | Profession | Starting skills | Requires | At creation | Note |`.
  - Profession is `Mage`, or `Bard` for Harmonism.
  - Starting skills is the 8-skill list, or `-` for Harmonism.
  - Requires is `Performance 12`, `Crafting 12` or `-`.
  - At creation is `Yes`, or `No` for Dracomancy.
  - Note keeps today's prose.
  - Use the Skills table spelling ("Hunting and Fishing", "Myths and Legends").
- Produces entities:
  - `Profession { Id, Name, Roll, KeyAttributeId, KeyAttribute, List<ProfessionSkill> Skills, List<ProfessionHeroicAbility> HeroicAbilities, List<ProfessionNickname> Nicknames, List<GearPackage> GearPackages }`
  - `ProfessionSkill { Id, ProfessionId, SkillId, Skill }`
  - `ProfessionHeroicAbility { Id, ProfessionId, HeroicAbilityId, HeroicAbility }`
  - `ProfessionNickname { Id, ProfessionId, Roll, Name }`
  - `MagicSchool` gains:
    - `int? SkillId`, `Skill? Skill`: the school's own skill row. Null for Harmonism, which is cast with
      Performance.
    - `List<MagicSchoolStartingSkill> StartingSkills`
    - `int? RequiredProfessionId`, `Profession? RequiredProfession`
    - `int? RequiredSkillId`, `Skill? RequiredSkill`, `int? RequiredSkillLevel`
    - `bool ChoosableAtCreation`
  - General Magic has no row in the mage table: it gets all nulls, empty lists and `false`.
- Starting benefit cell: strip `**`, split on `,` and ` or `, and link each to HeroicAbility. The profession named
  `Mage` gets none (constant `MageProfession = "Mage"`).

- [ ] **Step 1:** Write the tests:
  - 10 professions in D10 order; Artisan key STR with 8 skills including "Sleight of Hand"
  - Artisan abilities `["Master Blacksmith", "Master Carpenter", "Master Tanner"]`; Mage none; Knight `["Guardian"]`
  - each profession has 6 nicknames; Thief 6 is "Nightstabber"
  - Harmonism: RequiredProfession Bard, RequiredSkill Performance 12, no Skill, ChoosableAtCreation true
  - Enchanting: Crafting 12, Skill "Enchanting", 8 starting skills
  - Dracomancy: ChoosableAtCreation false
  - 11 schools choosable
  - an unknown skill name in a profession list throws `InvalidDataException`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `dotnet test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): import professions, nicknames and magic school creation rules`

### Task 8: Gear package seed

**Files:**
- Create: `src/Dragonbane.Api/Import/GearPackageSeed.cs`
- Modify: `Characters.cs`, `DragonbaneDbContext.cs`, `CharacterCreationImporter.cs`, the test file

**Interfaces:**
- Produces entities:
  - `GearPackage { Id, int? ProfessionId, int? MagicSchoolId, RollFrom, RollTo, List<GearPackageEntry> Entries }`,
    with a check constraint that exactly one parent is set (like `CK_TreasureRoll_OneParent`).
    - Profession packages are keyed D6 1-2/3-4/5-6.
    - School extras (Alchemy, Enchanting, Harmonism) have RollFrom = RollTo = 0.
  - `GearPackageEntry { Id, GearPackageId, GearEntryKind Kind, Quantity, int? DiceCount, int? DiceSides, List<GearPackageOption> Options }`
    - `enum GearEntryKind { Item, Silver }`, stored as a string like `SpellKind`.
    - An Item entry with more than one option is a choice.
    - The quantity is `Quantity`, or the dice when set: "D8 rations" is the Item "Field ration" with D8.
    - Silver has no options; its dice give silver.
  - `GearPackageOption { Id, GearPackageEntryId, int? EquipmentItemId, EquipmentItem?, string? UnlinkedName }`,
    with a check constraint that exactly one is set.
- `GearPackageSeed.Packages`: `IReadOnlyDictionary<string, SeedPackage[]>` keyed by profession or school name,
  transcribed by hand from the markdown, with an `Aliases` map to Equipment names. Example aliases:
  - "lyre" → "Lyre"
  - "hemp rope" → "Hemp rope, 10 m"
  - "quiver" → "Wooden-headed arrow quiver"
  - "bandages" → "Bandages, 10"
  - "lamp oil" → "Lamp oil, 10 doses"
  - "one dose sleeping poison" → "Sleeping poison, dose"
  - "book on any subject" → "Book"
  - "two daggers" → Dagger, quantity 2
  - "D8 rations" → "Field ration"
- Items not in the Equipment table (small field laboratory, general herbs) are seeded as `UnlinkedName`. List them in
  a *(DECISIONS)* entry.
- School extras:
  - Alchemy: small field laboratory; general herbs ×D6
  - Enchanting: choice of Blacksmithing/Carpentry/Tanning tools
  - Harmonism: Grimoire
- The importer fails loudly on a seed name that is neither in Equipment, nor an alias, nor marked unlinked.

- [ ] **Step 1:** Write the tests:
  - every profession has 3 packages covering 1-6
  - Fighter 1-2 has a choice entry with options `["Battleaxe", "Morningstar"]`
  - Mariner silver is D10
  - Knight 5-6 contains "Combat-trained horse"
  - Thief 5-6 has Dagger quantity 2
  - the Alchemy extras exist
  - an unknown seed name throws
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `dotnet test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): seed profession gear packages and school starting extras`

### Task 9: Creation DTOs and endpoints

**Files:**
- `src/Dragonbane.Api/Sections/Dtos/Dtos.cs`, `src/Dragonbane.Api/Program.cs`
- `tests/Dragonbane.Api.Tests/Sections/SectionEndpointTests.cs`
- `web/src/app/api/models.ts`
- regenerated `web/openapi/Dragonbane.Api.json`, `web/src/app/api/schema.d.ts`, `src/Dragonbane.Api/dragonbane.db`

**Interfaces:**
- Produces DTOs. Lists are ordered by roll or Id.
  - `KinDto(Id, Name, RollFrom, RollTo, Movement, KinAbilityDto[] Abilities, string[] Names)`
  - `KinAbilityDto(Name, int? Wp, Effect)`
  - `ProfessionDto(Id, Name, Roll, KeyAttribute, string[] Skills, string[] HeroicAbilities, string[] Nicknames, GearPackageDto[] GearPackages)`
  - `GearPackageDto(RollFrom, RollTo, GearEntryDto[] Entries)`
  - `GearEntryDto(GearEntryKind Kind, Quantity, int? DiceCount, int? DiceSides, string[] Options)`
  - `AgeDto(Id, Name, RollFrom, RollTo, FreeSkills, AgeAdjustmentDto[] Adjustments)`
  - `AgeAdjustmentDto(Attribute, Delta)`
  - `MementoDto(Id, Roll, Text)`, `WeaknessDto(Id, Roll, Name, Text)`, `AppearanceDto(Id, Roll, Text)`
  - `MagicSchoolDto` gains `string? Skill, string[] StartingSkills, string? RequiredProfession, string? RequiredSkill, int? RequiredSkillLevel, bool ChoosableAtCreation, GearPackageDto[] Extras`
- Routes, each one `MapSection` line using `NameFilter<T>` (or a no-op filter for the roll tables):
  `kin`, `professions`, `ages`, `mementos`, `weaknesses`, `appearances`.
- Front-end type aliases in `models.ts` for every DTO above.

- [ ] **Step 1:** Write endpoint tests:
  - `/api/kin` returns 6 with Mallard's 2 abilities
  - `/api/professions/{fighterId}` has 3 gear packages
  - `/api/magic-schools` Harmonism `RequiredProfession == "Bard"`
  - `/api/weaknesses` returns 20
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Then:
  - `dotnet run --project src/Dragonbane.Api -- import`
  - `dotnet build src/Dragonbane.Api --no-incremental`
  - in `web/`: `npm run gen:api`
  - add the aliases to `models.ts`
- [ ] **Step 4:** Run `dotnet test` (including `CommittedDatabaseTests`), `npx ng build`. Expected: PASS.
- [ ] **Step 5:** Add the *(DECISIONS)* entry "Character creation data: imported tables, gear package seed, mage table
  restructured". **Commit** `feat(api): serve character creation data`

## Part 4: Creation rules and the creator page

### Task 10: Character model, rule formulas and derived ratings

**Files:**
- Create: `web/src/app/character/character.ts`, `web/src/app/character/rules.ts`, and their `.spec.ts`

**Interfaces:**
- Produces from `rules.ts`:
  - `baseChance(score: number): number` (1-5 → 3, 6-8 → 4, 9-12 → 5, 13-15 → 6, 16-18 → 7)
  - `movementModifier(agl: number): number` (≤6 → -4, 7-9 → -2, 10-12 → 0, 13-15 → +2, ≥16 → +4)
  - `damageBonusDice(score: number): 'D4' | 'D6' | null` (≤12 null, 13-16 D4, ≥17 D6)
  - `carryingCapacity(str: number): number` (`Math.ceil(str / 2)`)
  - `rollAttribute(roller: DiceRoller): number` (4D6, drop the lowest)
  - `rollOnTable<T extends { rollFrom: number; rollTo: number }>(roller: DiceRoller, sides: number, rows: readonly T[]): T`
  - `applyAge(scores: Record<Attribute, number>, age: AgeDto): Record<Attribute, number>` (cap 18, floor 3)
- Produces from `character.ts`:
  - `interface Character { name; nickname; kin; profession; school: string | null; age; attributes: Record<Attribute, number>; skills: CharacterSkill[]; abilities: Ability[]; kinAbilities: string[]; spells: SpellRef[]; gear: GearItem[]; copper: number; weakness; memento; appearance }`
  - `CharacterSkill { name: string; level: number; trained: boolean }`
  - `GearItem { name: string; quantity: number; note: string }`
  - `SavedCharacter = Character & { id: string }`
  - `interface CreationReference extends HeroReference { kin: KinDto[]; professions: ProfessionDto[]; ages: AgeDto[]; schools: MagicSchoolDto[]; mementos: MementoDto[]; weaknesses: WeaknessDto[]; appearances: AppearanceDto[] }`
  - `skillLevel(c: Character, skill: SkillDto): number`: the stored level, else `baseChance` of its attribute. A
    secondary skill with no stored level is 0. Harmonism has no level of its own.
  - `derived(c: Character, ref: CreationReference): { hpMax; wpMax; movement; damageBonuses: DamageBonus[]; capacity }`
    - HP max is CON + 2 per Robust; WP max is WIL + 2 per Focused.
    - Movement is the kin base plus the AGL modifier.
    - Damage bonuses come from STR and AGL, STR first.
  - `setSkillLevel(c, name, level): Character`: clamps 0-18 and adds an untrained entry if missing.
  - `setCharacterAbility(c, name, count): Character` via `withAbilityCount`.

- [ ] **Step 1:** Write the tests:
  - every boundary of the four tables (5→3, 6→4, 12→5, 13→6, 16→7; AGL 6→-4, 7→-2, 12→0, 13→+2, 16→+4;
    12→null, 13→D4, 16→D4, 17→D6; capacity(7)=4)
  - `rollAttribute` with a seeded roller giving [1,6,6,6] returns 18
  - `applyAge(Old)` on STR 3 stays 3, and on WIL 18 stays 18
  - Aodhan (Human, CON 11, WIL 18, AGL 9) has HP 11, WP 18, movement 8
  - adding Robust ×2 makes HP 15
  - raising CON to 13 raises HP to 17
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): character model, creation formulas and derived ratings`

### Task 11: Creation steps (guided)

**Files:**
- Create: `web/src/app/character/creation.ts`, `web/src/app/character/creation.spec.ts`

**Interfaces:**
- Produces:
  - `interface Creation { character: Character; professionSkills: string[]; freeSkills: string[]; rolledAttributes: Record<Attribute, number> | null; swapUsed: boolean; packageChoices: Record<number, number> }`.
    `packageChoices` maps an entry index to the chosen option index.
  - `type Step = { creation: Creation; cleared: string[] }`. `cleared` holds human messages, e.g.
    `"Removed Bluffing: not on the Mage (Animism) skill list."`
  - `newCreation(): Creation`
  - `setKin(c, kin: KinDto): Creation`: sets `kin` and `kinAbilities`
  - `setProfession(c, p: ProfessionDto, ref): Step`: clears the school, profession skills and gear that no longer
    fit; sets the heroic ability when there is exactly one
  - `setAge(c, age: AgeDto, ref): Step`: re-applies the age to the rolled attributes and trims free skills over the
    new limit
  - `setAttributes(c, rolled: Record<Attribute, number>, ref): Step`: stores the rolled scores and applies the age.
    Also used for manual entry (3-18).
  - `swapAttributes(c, a: Attribute, b: Attribute, ref): Step`: allowed once (`swapUsed`). Clears Enchanting if
    Crafting can no longer reach 12.
  - `professionSkillList(c, ref): string[]`: the school's starting skills for a Mage with a school; the profession's
    skills otherwise (a harmonist bard keeps the bard list)
  - `skillLimits(c, ref): { profession: 6; free: number }`
  - `toggleSkill(c, name, ref): Creation`
    - A skill on the profession list fills the profession picks first, then the free picks.
    - Adding beyond the limits is a no-op.
    - A mage's school skill is required among the profession picks (`creationProblems` reports it).
  - `schoolsAvailable(c, ref): MagicSchoolDto[]`
    - Mage: choosable schools requiring Mage. Enchanting only when `2 * baseChance(STR) >= 12` and Crafting is on
      the school list.
    - Bard: Harmonism.
    - Others: none.
  - `setSchool(c, school: MagicSchoolDto | null, ref): Step`
    - Bard → Harmonism replaces Musician with the harmonist's spells and Grimoire.
    - Mage → the school's skill becomes a trained skill.
  - `spellOptions(c, ref): SpellDto[]`
    - Harmonism: Harmonism rank 1 spells and tricks only.
    - Alchemy: rank 1 recipes, plus General Magic tricks.
    - Enchanting: rank 1 Enchanting spells, plus General Magic tricks.
    - Others: rank 1 spells and tricks of the school or General Magic.
  - `toggleSpell(c, spell: SpellRef, ref): Creation`: at most 3 non-tricks and 3 tricks
  - `setHeroicAbility(c, name): Creation`: one of the profession's choices
  - `resolveGearPackage(pkg: GearPackageDto, choices: Record<number, number>, roller: DiceRoller): { gear: GearItem[]; copper: number }`.
    Silver dice ×10 copper.
  - `chooseGearPackage(c, pkg, ref, roller): Creation`: adds the school extras and "Simple clothes". An alchemist
    also gets three finished doses, one `GearItem` per pick named `"<Recipe name>, dose"`, chosen from its known
    recipes (`setAlchemistDoses(c, recipes: string[]): Creation`, exactly 3, repeats allowed).
  - `setItemNote(c, itemIndex: number, note: string): Creation`: the enchanter marks one starting item, e.g.
    note `"Enchanted: <spell> + PERMANENCE"`. The page offers it only for an enchanter.
  - `creationProblems(c, ref): string[]`: empty when the character is complete and valid
  - `finishCreation(c, ref): Character`: trained skills at `2 * baseChance`

- [ ] **Step 1:** Write the tests, including **Review Focus 2**:
  - With Fighter and 6 profession skills picked, `setProfession(Mage)` returns `cleared` naming each removed skill,
    and the result has no profession skills outside the new list.
  - Adult with 4 free skills → `setAge(Young)` leaves 2 free and `cleared` names the 2 removed.
  - An enchanter whose STR swap drops Crafting below 12 loses Enchanting, with a cleared message.
  - Harmonist bard: `spellOptions` holds only Harmonism; Musician is gone.
  - Alchemist: options are rank 1 recipes plus General Magic tricks.
  - STR 12 mage: `schoolsAvailable` has no Enchanting; at STR 13 it does.
  - Fighter 1-2 with choice index 1 gives Morningstar, and seeded D6 silver gives copper as a multiple of 10.
  - `finishCreation` on an INT 16 mage with Elementalism trained gives Elementalism 14.
  - An alchemist with 3 known recipes gets 3 dose items after `setAlchemistDoses`, and `creationProblems` reports
    missing doses before that.
  - `creationProblems` on `newCreation()` lists kin, profession, age, attributes, skills.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): guided character creation rules`

### Task 12: Random character and per-step rolls

**Files:**
- Create: `web/src/app/character/random.ts`, `web/src/app/character/random.spec.ts`

**Interfaces:**
- Produces:
  - `type CreationStep = 'kin' | 'profession' | 'age' | 'name' | 'attributes' | 'skills' | 'magic' | 'weakness' | 'memento' | 'gear' | 'appearance'`
  - `rollStep(c: Creation, step: CreationStep, ref: CreationReference, roller: DiceRoller): Step`:
    - kin D12, profession D10, age D6
    - name: kin D6 and nickname D6
    - attributes: `rollAttribute` ×6 in book order
    - skills: random valid picks
    - magic: a random available school and valid spells, or the profession's ability
    - weakness, memento and appearance: D20
    - gear: D6 package and random choices
  - `randomCharacter(ref: CreationReference, roller: DiceRoller): Creation`: every step in order, optional steps
    included

- [ ] **Step 1:** Write the tests with a test `CreationReference` fixture built from the real markdown values needed
  (*builder's call*: a trimmed fixture file `character.fixture.ts`, like `npc.fixture.ts`).
  - **Review Focus 3:** for seeds 1..500, `creationProblems(randomCharacter(ref, roller), ref)` is `[]`.
  - Across those seeds at least one harmonist, one alchemist and one enchanter occur, and every enchanter has
    Crafting ≥ 12.
  - `rollStep(c, 'kin', …)` with a seed rolling 11 gives Mallard.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): random character and per-step rolls`

### Task 13: Character Creator page (layout B)

**Files:**
- Create:
  - `web/src/app/features/characters/characters.page.ts/.html/.spec.ts`
  - `web/src/app/features/characters/character-summary.ts/.html`
- Modify:
  - `web/src/app/app.routes.ts`: `{ path: 'characters', title: 'Character Creator', loadComponent: … }`
  - `web/src/app/app.ts`: append `{ path: '/characters', label: 'Character Creator' }` to `apps`
  - `web/src/styles/app.scss`
  - `web/e2e/a11y.spec.ts`: add `/characters`

**Interfaces:**
- Consumes:
  - from Tasks 10-12: everything above
  - `httpResource` for the creation sections, as `NpcsPage` does
  - `ChipPicker` for the free skill and spell picks
- Produces `CharactersPage`:
  - `h1` "Dragonbane Character Creator"
  - one `<details>` section per `CreationStep` in book order, each with a 🎲 button (aria-label
    `"Roll <step label>"`) and a done tick (visually, plus text "done" for screen readers)
  - a "Random character" button
  - a live `CharacterSummary` (`app-character-summary`, input `character: Character`, `ref: CreationReference`),
    beside the sections at ≥ tablet width and below them on phones
  - a polite live region announcing `Step.cleared` messages
  - a Save button, disabled with `creationProblems` listed while incomplete
  - name and nickname: pick from the rolled tables or type
  - attributes: roll, manual entry 3-18 and one swap
- The `e2e` route check waits for the page's `h1` instead of a `table` for `/characters`.

- [ ] **Step 1:** Write the tests in `characters.page.spec.ts`, with `RANDOM` provided as `seededRandom(7)` and
  HTTP mocked:
  - "Random character" fills the summary (a name, a kin, HP > 0)
  - the profession 🎲 changes only the profession section and announces any cleared picks
  - Save is disabled on a fresh page and lists the problems
  - the brand reads "Character Creator" on `/characters`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Use the existing NPC editor/preview layout classes and tokens, no raw colours.
- [ ] **Step 4:** Run `npx ng test --watch=false`, `npx ng build`, `npm run e2e`. Expected: PASS (axe-clean, no
  overflow, both viewports).
- [ ] **Step 5: Commit** `feat(web): Character Creator page with guided and random creation`

## Part 5: Saving, the editor and advancement

### Task 14: Character storage, My characters, JSON import/export

**Files:**
- Create:
  - `web/src/app/character/character.store.ts`, `web/src/app/character/character-file.ts`, and their `.spec.ts`
- Modify: `characters.page.ts/.html/.spec.ts`

**Interfaces:**
- Produces:
  - `checkCharacter(entry: unknown, n: number): SavedCharacter`. Messages follow `checkNpc`'s style ("Character 2
    ("Aodhan"): skill 3 needs a name and a level from 0 to 18.").
    - Attributes are 1-18.
    - Skill levels are 0-18.
    - Copper is a whole number ≥ 0.
    - `school` is a string or null.
    - Missing optional text fields default to `''`.
  - `parseCharacterFile(text): SavedCharacter[]`, via `parseListFile(text, checkCharacter, 'character')`
  - `CharacterStore extends ListStore<SavedCharacter>`, key `'dragonbane.characters.v1'`, `readonly characters = this.items`
- Page:
  - **My characters** table (name, kin, profession) with Edit, Export and Delete (in-page confirm, as on the NPC
    page)
  - the empty-state text "No saved characters yet."
  - Export all as JSON (`characters.json`) and Import JSON, as on the NPC page
  - Save from the creator calls `store.save(finishCreation(...))`

- [ ] **Step 1:** Write the tests, including **Review Focus 4**:
  - corrupt JSON in `dragonbane.characters.v1` gives an empty list, and storage is unchanged until a save
  - an array with one bad entry keeps the good ones
  - an import file whose skill level is 19 fails with a message naming the character and the skill, and imports
    nothing
  - an export → import round-trip is equal
  - delete asks in-page and removes only that character
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the web tests and e2e. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): save, import and export characters`

### Task 15: Edit for advancement

**Files:** `characters.page.ts/.html/.spec.ts`; optionally `character-editor.ts` if the page grows too large
*(builder's call)*

**Interfaces:**
- Consumes `setSkillLevel`, `setCharacterAbility`, `derived`, `ChipPicker`.
- Produces edit mode: the same layout-B page opened on a `SavedCharacter`.
  - Kin, profession, age and school are shown read-only, with no 🎲 buttons and no Random.
  - Editable:
    - skill levels 0-18 for every core skill and known secondary skill (number inputs)
    - add any heroic ability (the chip picker shows its prerequisite in the chip title, not enforced) and set
      Robust/Focused counts
    - attributes 1-18
    - gear (chip picker of Equipment, quantity, note)
    - money (gold/silver/copper inputs stored as copper)
    - spells (chip picker of every spell)
    - name, nickname, weakness, memento, appearance
  - Save replaces the saved character (same id). Cancel discards.

- [ ] **Step 1:** Write the tests:
  - editing Aodhan shows kin "Human" as text, not a control
  - setting Robust to 2 shows HP 15 in the summary
  - raising CON shows HP following it
  - a skill can be set to 18 but not 19 (the input clamps)
  - Save keeps the id and the store has one entry
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the web tests and e2e. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): edit saved characters for advancement`

## Part 6: Exports

### Task 16: Character card, text, Markdown and image export

**Files:**
- Create:
  - `web/src/app/character/character-card.ts/.spec.ts`
  - `web/src/app/features/characters/character-card-view.ts/.html`
  - `web/src/app/features/characters/character-export-menu.ts/.html`
- Modify: `characters.page.*`

**Interfaces:**
- Produces:
  - `buildCharacterCard(c: Character, ref: CreationReference, withDescriptions: boolean): CharacterCard`
    - Contains: identity (name, nickname, kin, profession with school, age), attributes, derived ratings, skills
      ("Name level", trained and changed ones only), abilities (kin abilities then `abilityEntries`), spells
      (`spellEntries`), weapons, armour, gear, money, weakness, memento, appearance.
    - Empty rows are hidden.
  - `characterCardToText(card): string`, `characterCardToMarkdown(card): string`
  - `CharacterExportMenu` wraps `ExportMenu` with a descriptions checkbox (key
    `dragonbane.characterExport.descriptions`), and the card view has the `export-card` class.
    `fallbackName: 'character'`. `pdf` is null until Task 18.

- [ ] **Step 1:** Write the tests:
  - Aodhan's text contains `"Archmaster Aodhan"`, `"Human, Mage (Elementalism), Old"`, `"STR 8 CON 11 AGL 9 INT 16 WIL 18 CHA 14"`,
    `"HP 11 · WP 18 · Movement 8"`
  - Markdown has a `##` per non-empty row
  - with descriptions, Fireball shows its rank and range
  - Robust never has a description
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the web tests and e2e (add the export dialog to the axe check as on the NPC page). Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): export characters as text, Markdown and image`

### Task 17: Sheet assets, field map and gear placement

**Files:**
- Create:
  - `web/public/character-sheet.pdf` (page 2 only of `Source Material/DB-Character-Sheet.pdf`)
  - `web/public/fonts/Caveat-Regular.ttf`, plus its OFL licence next to it
  - `web/scripts/extract-sheet-page.mjs`
  - `web/src/app/character/pdf/sheet-fields.ts`
  - `web/src/app/character/pdf/gear-placement.ts/.spec.ts`
  - `web/scripts/calibrate-sheet.mjs`
- Modify: `web/package.json` (add `pdf-lib`, `@pdf-lib/fontkit`)

**Interfaces:**
- `extract-sheet-page.mjs`: a one-off node script using pdf-lib that writes page 2 only. Commit the script so it can
  be re-run.
- `calibrate-sheet.mjs`: draws a labelled 10-pt grid and every `SHEET_FIELDS` box over the sheet into
  `scratch/calibrated.pdf` (git-ignored). Use it to measure and check the boxes against
  `Example_Character_filled_in.pdf`.
- Produces:
  - `type SheetField`, a union of every field named in the spec's PDF section. Skills are `skill:<Skills table name>`,
    with secondary skill rows `secondary:1`..`secondary:6`, weapon rows `weapon:1..3:<column>` and inventory rows
    `inventory:1..10`.
  - `SHEET_FIELDS: Record<SheetField, { x: number; y: number; width: number; size: number; lines?: number }>`, in
    PDF points from the bottom-left
  - `placeGear(c: Character, ref: CreationReference): { weapons: GearItem[]; armour: GearItem | null; helmet: GearItem | null; inventory: string[]; tiny: string[]; overflow: string[] }`
    - The first 3 weapons or shields are ready weapons.
    - The first armour and first helmet are worn.
    - Weight `-` goes under tiny items.
    - Field rations count as one row per 4.
    - Weight N takes N inventory rows.
    - Rows past 10 (or past capacity, *builder's call*) and weapons past 3 go to `overflow`.

- [ ] **Step 1:** Write the tests:
  - `gear-placement.spec.ts`:
    - 4 weapons gives 3 ready and 1 in overflow
    - 5 field rations take 2 inventory rows
    - Flint and tinder is tiny
    - Chainmail is armour and Open helmet is helmet
    - a weight-2 item takes 2 rows
  - `sheet-fields` test: every `SheetField` has a box with width > 0 and the coordinates inside the page
    (612×792 or the measured size)
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Add the deps, run the extraction, download Caveat-Regular.ttf from the Google Fonts
  repository (OFL), calibrate the fields.
- [ ] **Step 4:** Run the tests and `npx ng build`. Expected: PASS.
- [ ] **Step 5:** Add the *(DECISIONS)* entries: "pdf-lib and fontkit for the character sheet PDF", and "Official sheet
  page 2 shipped in public/ (Fria Ligan character sheets are free to use)". **Commit**
  `feat(web): character sheet assets, field map and gear placement`

### Task 18: PDF writer (page 1 sheet, page 2 descriptions)

**Files:**
- Create: `web/src/app/character/pdf/sheet-pdf.ts/.spec.ts`
- Modify: `character-export-menu.ts` (pass `pdf`)

**Interfaces:**
- Produces:
  - `SHEET_ASSETS`, an `InjectionToken<() => Promise<{ sheet: ArrayBuffer; font: ArrayBuffer; parchment: ArrayBuffer }>>`.
    The default factory fetches `/character-sheet.pdf`, `/fonts/Caveat-Regular.ttf` and `/scroll-tile.webp`
    converted to PNG via a canvas (pdf-lib embeds PNG and JPG only). Tests provide bytes.
  - `sheetValues(c: Character, ref: CreationReference): Partial<Record<SheetField, string>>`
    - Profession reads "Mage – Elementalism".
    - Damage bonus "–" when there is none.
    - Abilities & spells are **names only**.
    - Gold/silver/copper are split from copper.
    - Weapon columns come from the Equipment table.
  - `buildSheetPdf(c: Character, ref: CreationReference, assets): Promise<Uint8Array>`
    - Page 1 writes each value in Caveat into its box. It shrinks the font down to 60% of the field size, then wraps
      within `lines`, then truncates with "…".
    - Page 2 onwards: the same page size, the parchment tiled as background, a Colus-like heading (Caveat if Colus
      can't be embedded, *builder's call*), each heroic and kin ability (WP cost, effect) and each spell (rank,
      casting time, range, duration, description), then the gear overflow. It flows across pages.
    - Characters the font cannot draw are replaced with "?" rather than throwing.

- [ ] **Step 1:** Write the tests with real asset bytes read from `public/` (pdf-lib runs in jsdom), including
  **Review Focus 5**:
  - Aodhan's PDF has ≥ 2 pages, and page 1 is the sheet's size
  - `sheetValues` gives `"Mage – Elementalism"`, `"–"` for both bonuses, INT `"16"` and abilities
    `["Adaptive","Fireball",…]`
  - a 200-character weakness, the name "Ærwyn ✨" and 20 inventory items all build without throwing
  - a fitted string never exceeds its box width (measure with the embedded font's `widthOfTextAtSize`)
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement, and pass `pdf: () => buildSheetPdf(...).then(b => new Blob([b], { type: 'application/pdf' }))`
  to the export menu.
- [ ] **Step 4:** Run the full gate: `dotnet test`, then in `web/`: `npx ng test --watch=false && npx ng build && npm run e2e`.
  Open one generated PDF by hand and compare it with `Example_Character_filled_in.pdf`. Expected: PASS, and fields
  sit on their lines.
- [ ] **Step 5:** Update `CLAUDE.md` "What it is" with the Character Creator (`/characters`) and the new spec path.
  **Commit** `feat(web): export characters as a filled-in character sheet PDF`
