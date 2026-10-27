# NPC Manager and Table Feedback (2026-10-27) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A rolling spinner and floating Close in the treasure dialog, repo-owned styles, an app menu with `/reference/*` routes, and an NPC Manager that tweaks the book's typical NPCs, saves them locally and exports them as a card image, text or Markdown.

**Architecture:** The NPC table is imported like every other section (normalised entities, one `MapSection` line). All NPC rules (copy, weapon skill at 5, Robust/Focused → HP/WP, card rows, text/Markdown) are pure TypeScript functions in `web/src/app/npc/` with unit tests; components only wire signals to them. Saved NPCs live in `localStorage` through a store shaped like `CoinStandardStore`.

**Tech Stack:** .NET 10, EF Core + SQLite, xUnit; Angular 22 (standalone, signals, `httpResource`), Vitest, Playwright + axe; new dependency `html-to-image`.

**Spec:** `docs/superpowers/specs/2026-10-27-npc-manager-and-feedback-design.md` (read it first; approved mockups are referenced by name there and live, gitignored, in `.superpowers/brainstorm/1184-1793093347/content/`).

## Global Constraints

- Everything in `docs/superpowers/specs/2026-10-22-dragonbane-reference-design.md` and `2026-10-23-table-feedback-design.md` holds, except the NPC exclusion (reversed in Task 6).
- No JSON property bags or generic table/row models: normalised entities and junction tables only.
- Typical NPC data comes only from `Source Material/Dragonbane_NPC_Table.md` through the importer, never typed into the front end.
- All business logic in front-end TypeScript with unit tests; components stay thin.
- AXE-clean (wcag2a, wcag2aa, wcag21a, wcag21aa) and no horizontal overflow at 1280×800 and 375×812.
- New styles use tokens from `web/src/styles/tokens.css` (after Task 3), never raw colour values.
- No `window.confirm`/`alert`/`prompt`.
- After any markdown or schema change: `dotnet run --project src/Dragonbane.Api -- import` and commit `src/Dragonbane.Api/dragonbane.db` (`CommittedDatabaseTests` fails otherwise).
- After any DTO change: `dotnet build src/Dragonbane.Api --no-incremental`, then in `web/` `npm run gen:api`.
- Each significant decision gets a `DECISIONS.md` entry in the existing format (`## Title (2026-10-27)`, Context / Decision / Alternatives / Why).
- Full check before each commit that touches both sides: `dotnet test`, then in `web/`: `npx ng test --watch=false && npx ng build && npm run e2e` (stop a running API before `dotnet test`).

## Review Focus

1. **Saved NPC names that no longer resolve** (an item, skill, ability or spell renamed after a database rebuild): the NPC still loads and the name shows as plain text in its row, never dropped, never a crash. Test in Task 8.
2. **Unreadable storage** (`dragonbane.npcs.v1` holding invalid JSON, a non-array, or entries missing `id`/`name`): the page starts with an empty list and does not write until the user saves. Test in Task 10.
3. **Clipboard blocked** (`navigator.clipboard` missing or `write` rejecting): the page says so in a status message and download still works. Test in Task 13.
4. **Phone width**: the floating Close stays inside a 375 px viewport and the NPC dialog stacks editor over preview with no overflow. e2e in Tasks 2 and 14.
5. **HP/WP floor**: removing Robust ×6 from an NPC whose HP was hand-edited to 5 gives HP 0, not −7; Focused added to an NPC with no WP gives WP 2. Test in Task 8.

---

## Part 1: Quick fixes

### Task 1: Rolling spinner in the treasure dialog

**Files:**
- Move: `spinner-dragon.svg` → `web/public/spinner-dragon.svg`
- Modify: `web/src/app/features/treasure/treasure.page.ts`, `treasure.page.html`
- Modify: `web/src/styles.scss` (spinner rules, next to the treasure dialog rules)
- Test: `web/src/app/features/treasure/treasure.page.spec.ts`

**Interfaces:**
- Produces: CSS class `.spinner` (a decorative rotating dragon) and the markup pattern `<div class="rolling" role="status"><span class="spinner" aria-hidden="true"></span>Rolling…</div>`, reused by nothing else yet.

- [ ] **Step 1: Write the failing tests** in `treasure.page.spec.ts` (use `vi.useFakeTimers()` / `vi.advanceTimersByTime`, restore real timers in `afterEach`):
  - `shows Rolling… for 500 ms before the result`: after `Roll treasure (D40)` click and `fixture.detectChanges()`, the dialog contains `[role="status"]` with text `Rolling…` and no `app-treasure-result`; after `advanceTimersByTime(499)` still rolling; after 1 more ms the result is shown and `[role="status"]` is gone.
  - `Re-roll shows the spinner again`: with a result showing, clicking `Re-roll` shows `Rolling…` again for 500 ms.
  - `Re-roll is ignored while rolling`: clicking `Re-roll` while rolling queues no extra dice (`faces` consumed only once) and the button has `aria-disabled="true"`.
- [ ] **Step 2: Run to verify they fail.** `cd web && npx ng test --watch=false` → the three new tests FAIL.
- [ ] **Step 3: Implement.** In `TreasurePage`: `protected readonly rolling = signal(false)`; `show(result)` opens the dialog at once with `rolling` true, then after `ROLL_DELAY_MS = 500` (`setTimeout`) sets `result`/`suggested` and `rolling` false. `rollAgain()` returns early while `rolling()`. Template: while `rolling()`, render the `.rolling` markup instead of `app-treasure-result`; the `h2` keeps its text from the previous result (first roll: `Treasure`); Re-roll gets `[attr.aria-disabled]="rolling() || null"`. CSS: `.spinner` is a 6rem square, `background-color: var(--demon-green-dark)`, `mask: url('/spinner-dragon.svg') center / contain no-repeat`, `animation: spin 1.2s linear infinite`; under `@media (prefers-reduced-motion: reduce)` `animation: none`. `.rolling` centres spinner and text in the dialog's fixed height. The mask makes the SVG's own colours irrelevant, so the file is moved unchanged.
- [ ] **Step 4: Run tests.** `npx ng test --watch=false` → all PASS.
- [ ] **Step 5: e2e.** In `web/e2e/a11y.spec.ts` `treasure roll opens an accessible dialog`: after each click (roll and Re-roll), first `await expect(dialog.getByRole('status')).toHaveText('Rolling…')`, then `await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(/^\d+ - /)`. Run `npm run e2e` → PASS.
- [ ] **Step 6: Commit.** `git add -A spinner-dragon.svg web/public/spinner-dragon.svg web/src web/e2e && git commit -m "feat(web): treasure dialog shows a rolling spinner for 0.5 s"`

### Task 2: Floating Close on the dialog corner

**Files:**
- Modify: `web/src/styles.scss` (treasure dialog block, ~lines 406–473)
- Modify: `web/src/app/features/treasure/treasure.page.html`
- Test: `web/e2e/a11y.spec.ts`

**Interfaces:**
- Produces: shared dialog classes for Task 12: `.app-dialog` (the `<dialog>`: `overflow: visible`, border, background, padding 0), `.dialog-body` (inner box: `overflow-y: auto`, padding, flex column, takes the dialog's height) and `.dialog-close` (the corner button). `.treasure-dialog` keeps only its size rules.

- [ ] **Step 1: Write the failing e2e test** `treasure dialog Close sits on the top-right corner` at 1280×800 and 375×812: roll, wait for the heading, then measure the dialog box `d` and the Close box `c`: `|c.x + c.width/2 − d.right| ≤ 1`, `|c.y + c.height/2 − d.top| ≤ 1`, `c.width ≥ 44`, `c.right ≤ innerWidth`, `c.top ≥ 0`.
- [ ] **Step 2: Run** `npm run e2e -- -g "top-right corner"` → FAIL.
- [ ] **Step 3: Implement.** Markup: `<dialog class="app-dialog treasure-dialog">` with the Close button as its first child and everything else inside `<div class="dialog-body">`. CSS: move `overflow-y: auto`, padding and the flex column from `.treasure-dialog` to `.dialog-body`; `.app-dialog { overflow: visible }`. `.dialog-close`: `top: 0; right: 0; transform: translate(50%, -50%); width: 2.75rem; height: 2.75rem`; the SVG background's circle fill stays `%23f5f2eb` (bone white) and its ring and X stroke become `%2314443a` (demon green dark). Treasure dialog width becomes `min(46rem, 100vw - 3.5rem)` so the half-outside button fits at 375 px. Drop the `.dialog-head` `padding-right` the old in-box button needed if the heading no longer collides.
- [ ] **Step 4: Run** `npm run e2e` → all PASS (including axe on the dialog), and `npx ng test --watch=false` → PASS.
- [ ] **Step 5: Commit.** `git commit -am "style(web): treasure dialog Close floats on the top-right corner"`

### Task 3: Styles folder owned by the repo

**Files:**
- Move: `web/src/dragonbane.css` lines 1–41 (`:root` variables) → `web/src/styles/tokens.css`; the rest → `web/src/styles/parchment.css`
- Move: `web/src/styles.scss` → `web/src/styles/app.scss`
- Modify: `web/angular.json` (`styles`: `src/styles/tokens.css`, `src/styles/parchment.css`, `src/styles/app.scss`)
- Modify: `CLAUDE.md` (UI hard rule), `DECISIONS.md`

**Interfaces:**
- Produces: `web/src/styles/tokens.css` as the only place colour, font, spacing and width tokens are defined.

- [ ] **Step 1: Move the files** with `git mv` so history follows; fix the comment on the first line of `app.scss` to name `tokens.css`. Asset URLs (`/Colus.otf`, `/scroll.webp`) are root-absolute and need no change.
- [ ] **Step 2: Verify no visual change.** `cd web && npx ng build` → succeeds; `npm run e2e` → all PASS.
- [ ] **Step 3: Docs.** `CLAUDE.md` UI rule becomes: "use the parchment style in `web/src/styles/` (tokens in `tokens.css`); it came from the `anthropic-skills:dragonbane-parchment-style` skill but the repo copy is the source of truth, and new styles use its tokens, never raw colours." Add a `DECISIONS.md` entry "Styles live in web/src/styles, not the skill (2026-10-27)".
- [ ] **Step 4: Commit.** `git add -A web/src web/angular.json CLAUDE.md DECISIONS.md && git commit -m "refactor(web): move global styles into web/src/styles with one tokens file"`

## Part 2: Menu and routes

### Task 4: Hamburger menu and `/reference/*` routes

**Files:**
- Modify: `web/src/app/app.routes.ts`, `app.ts`, `app.html`, `app.scss`, `app.spec.ts`
- Create: `web/src/app/features/npcs/npcs.page.ts`, `npcs.page.html` (heading only for now; Task 11 fills it)
- Modify: `web/src/app/features/treasure/treasure-result.html` (links), `treasure.page.spec.ts:127`
- Modify: `web/e2e/a11y.spec.ts` (`routes` and every `page.goto`)

**Interfaces:**
- Produces: route `/npcs` → `NpcsPage` (`selector: 'app-npcs-page'`); sections at `/reference/<section>`.

- [ ] **Step 1: Write the failing tests** in `app.spec.ts` (replace the existing link test):
  - `links to the five sections under /reference`: on `/reference/skills`, `nav[aria-label="Sections"] a` hrefs equal `['/reference/skills', '/reference/heroic-abilities', '/reference/spells', '/reference/equipment', '/reference/treasure']`.
  - `menu lists both apps`: `#app-menu a` texts are `['Dragonbane Reference', 'NPC Manager']`; hrefs `['/reference', '/npcs']`; the menu button has `popovertarget="app-menu"` and an accessible name `Menu`.
  - `brand shows the current app`: on `/npcs` the `.nav-brand` text is `NPC Manager`, there is no `nav[aria-label="Sections"]` and no `select#coin-standard`; on `/reference/spells` the brand is `Dragonbane Reference`.
  - `redirects`: navigating to `''` lands on `/reference/skills`; `/skills?search=x` lands on `/reference/skills?search=x`; `/nonsense` lands on `/reference/skills`.
- [ ] **Step 2: Run** `npx ng test --watch=false` → new tests FAIL.
- [ ] **Step 3: Implement.** Routes: `''` → `reference/skills`; `reference` with children (`''` → `skills`, then the five existing lazy routes); `npcs` (`title: 'NPC Manager'`, lazy `NpcsPage`); redirects `skills`, `heroic-abilities`, `spells`, `equipment`, `treasure` → `reference/<same>`; `**` → `reference/skills`. `App`: `currentApp = computed<'reference' | 'npcs'>` from the router URL (`toSignal` of `NavigationEnd`); section paths gain the `/reference` prefix. Template: a `<button type="button" class="menu-button" popovertarget="app-menu" aria-label="Menu">` before the brand; `<nav id="app-menu" popover aria-label="Apps">` with the two links (`routerLinkActive`, `ariaCurrentWhenActive="page"`), each calling `hidePopover()` on click; brand text and `routerLink` follow `currentApp()`; the Sections nav and coin select render only for `reference`. The native popover gives Escape, light dismiss and focus return. Menu styling uses tokens; 44 px button.
- [ ] **Step 4: Fix links** in `treasure-result.html` to `/reference/equipment` and `/reference/spells`; update `treasure.page.spec.ts:127` to `/reference/equipment`; e2e `routes` become `/reference/...` and every `page.goto` follows. Add `'/npcs'` to the axe loop only in Task 14 (it has no table yet).
- [ ] **Step 5: Run** `npx ng test --watch=false && npx ng build && npm run e2e` → PASS.
- [ ] **Step 6: Commit** with a `DECISIONS.md` entry "Menu switches apps; Reference keeps its tabs (2026-10-27)". `git commit -am "feat(web): app menu and /reference routes, with redirects from the old paths"` (add the new `features/npcs` files first).

## Part 3: NPC Manager

### Task 5: Weapons know their skill

**Files:**
- Modify: `Source Material/Dragonbane_Equipment_Tables.md` (Melee weapons and Ranged weapons tables: new last column `Skill`)
- Modify: `src/Dragonbane.Api/Data/Entities/Equipment.cs` (`Weapon`), `src/Dragonbane.Api/Import/EquipmentImporter.cs`, `src/Dragonbane.Api/Import/SourceImporter.cs`, `src/Dragonbane.Api/Sections/Dtos/Dtos.cs`
- Modify: `web/openapi/Dragonbane.Api.json`, `web/src/app/api/schema.d.ts` (generated); every web spec that builds a `WeaponDto` literal (e.g. `treasure.page.spec.ts` `battleaxe`)
- Test: `tests/Dragonbane.Api.Tests/Import/EquipmentImporterTests.cs`
- Commit: `src/Dragonbane.Api/dragonbane.db`

**Interfaces:**
- Produces: `Weapon.SkillId` (`int`) / `Weapon.Skill` (`Skill`); `WeaponDto` gains `string Skill` (skill name) → TS `WeaponDto.skill: string`.

Skill values (from the Skills table descriptions; improvised and shields as the spec says):
- Brawling: Unarmed, Light blunt object, Heavy blunt object, Small shield, Large shield
- Knives: Knife, Dagger, Parrying dagger
- Swords: Short sword, Broadsword, Longsword, Greatsword, Scimitar
- Axes: Handaxe, Battleaxe, Two-handed axe
- Hammers: Mace, Morningstar, Flail, Light warhammer, Heavy warhammer, Small wooden club, Large wooden club
- Staves: Staff
- Spears: Short spear, Long spear, Lance, Halberd (table grouping; flag in the commit message if the rulebook says otherwise), Trident
- Slings: Sling · Bows: Short bow, Longbow · Crossbows: Light crossbow, Heavy crossbow, Hand crossbow

- [ ] **Step 1: Write the failing test** `Weapons_link_their_skill`: import skills then equipment; `Heavy warhammer` → `Hammers`, `Large shield` → `Brawling`, `Hand crossbow` → `Crossbows`; every `Weapon` has a skill. And `Unknown_weapon_skill_fails`: markdown with a weapon row whose `Skill` is `Juggling` → `InvalidDataException` naming the weapon. Update the existing tests' setup to import skills before equipment.
- [ ] **Step 2: Run** `dotnet test --filter EquipmentImporterTests` → FAIL.
- [ ] **Step 3: Implement.** Add the column values above to the markdown. `SourceImporter.RebuildAsync`: `SkillsImporter` runs before `EquipmentImporter` (skills depend on nothing). `EquipmentImporter.Weapon` takes `Dictionary<string, Skill>` (`db.Skills.ToDictionary(s => s.Name)`) and throws `InvalidDataException($"Weapon '{name}' has unknown skill '{value}'.")`. `WeaponDto` projection adds `((Weapon)i).Skill.Name`.
- [ ] **Step 4: Run** `dotnet test` → PASS except `CommittedDatabaseTests`; run the import command, then `dotnet test` → all PASS.
- [ ] **Step 5: Regenerate API types** (`dotnet build src/Dragonbane.Api --no-incremental`, `npm run gen:api`), add `skill` to the web spec fixtures, `npx ng test --watch=false && npx ng build` → PASS.
- [ ] **Step 6: Commit** with a `DECISIONS.md` entry "Weapon skill is a markdown column (2026-10-27)". `git commit -am "feat(api): weapons link to their skill from a new Skill column"`

### Task 6: Import the typical NPCs

**Files:**
- Create: `src/Dragonbane.Api/Data/Entities/Npcs.cs`, `src/Dragonbane.Api/Import/NpcImporter.cs`
- Modify: `src/Dragonbane.Api/Data/DragonbaneDbContext.cs`, `src/Dragonbane.Api/Import/SourceImporter.cs`
- Modify: `docs/superpowers/specs/2026-10-22-dragonbane-reference-design.md` (lines 24 and 126 point to the 2026-10-27 spec), `DECISIONS.md`
- Test: `tests/Dragonbane.Api.Tests/Import/NpcImporterTests.cs`, `tests/Dragonbane.Api.Tests/Data/SchemaTests.cs`
- Commit: `src/Dragonbane.Api/dragonbane.db`

**Interfaces:**
- Produces (entities, all `IEntity`; `Npc` is `INamedEntity`):
  - `Npc { Id, Name ("Bandit chief", "(boss)" stripped), IsBoss, Hp, int? Wp, int? DamageBonusAttributeId, Attribute? DamageBonusAttribute, string? DamageBonusDice ("D6"), List<NpcSkill> Skills, List<NpcHeroicAbility> HeroicAbilities, List<NpcGear> Gear }`
  - `NpcSkill { Id, NpcId, int? SkillId, Skill? Skill, string? UnlinkedName, Level }` (exactly one of `SkillId`/`UnlinkedName` set: check constraint `CK_NpcSkill_OneName`)
  - `NpcHeroicAbility { Id, NpcId, HeroicAbilityId, HeroicAbility, Count }`
  - `NpcGear { Id, NpcId, EquipmentItemId, EquipmentItem }`
  - Collections are ordered by `Id`, which follows source order.
  - `NpcImporter.Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db)`

- [ ] **Step 1: Write the failing tests** in `NpcImporterTests` (same in-memory setup as `SkillsImporterTests`, importing equipment, skills, heroic abilities first):
  - `Imports_eleven_npcs_in_source_order`: names start `Guard, Cultist, Thief, Villager`; 11 rows.
  - `Bandit_chief`: `IsBoss`, `Hp` 30, `Wp` 16, bonus `STR`/`D6`; skills `Awareness 12, Brawling 15, Hammers 15`; abilities `Berserker ×1, Robust ×6, Veteran ×1`; gear `Heavy warhammer, Chainmail, Open helmet`.
  - `Aliases_resolve`: Hunter gear includes `Leather`; Villager gear is `Small wooden club`; Scholar gear is `Book`; Bandit gear `Short sword, Short bow` (case-insensitive match).
  - `Magic_school_is_unlinked`: Archmage has a skill with `SkillId` null, `UnlinkedName` `Magic school`, `Level` 15.
  - `Dashes_are_null`: Guard `Wp` null; Villager damage bonus null.
  - `Unknown_name_fails`: a copy of the markdown with `Swords 12` replaced by `Juggling 12` → `InvalidDataException` naming `Juggling` and the NPC.
  - `SchemaTests.Creates_tpt_and_junction_tables` subset gains `NpcSkill`, `NpcHeroicAbility`, `NpcGear`.
- [ ] **Step 2: Run** `dotnet test --filter "NpcImporterTests|SchemaTests"` → FAIL.
- [ ] **Step 3: Implement** the entities, `DbSet`s (`Npcs`, `NpcSkills`, `NpcHeroicAbilities`, `NpcGear`), the check constraint, and `NpcImporter`. Parsing: split list cells on `,`; skill "Name N" splits on the last space; ability "Name xN" → count N, else 1; bonus "STR +D6" → attribute code + dice after `+`; "-" → none. Lookups are `OrdinalIgnoreCase`; a static `Aliases` dictionary (`"leather armour" → "Leather"`, `"wooden club" → "Small wooden club"`, `"relevant book" → "Book"`) is tried before lookup; the only allowed unlinked skill name is `Magic school`; anything else unmatched throws. `SourceImporter` calls `NpcImporter` after `SpellsImporter`.
- [ ] **Step 4: Run** `dotnet test --filter "NpcImporterTests|SchemaTests"` → PASS. Run the import command; `dotnet test` → all PASS.
- [ ] **Step 5: Docs.** Update the 2026-10-22 spec's two NPC mentions; `DECISIONS.md` entries "NPC table imported (reverses the exclusion) (2026-10-27)" and "NPC name aliases in the importer (2026-10-27)".
- [ ] **Step 6: Commit.** `git add -A src tests docs DECISIONS.md && git commit -m "feat(api): import the typical NPC table with linked skills, abilities and gear"`

### Task 7: `/api/npcs` endpoint

**Files:**
- Modify: `src/Dragonbane.Api/Sections/Dtos/Dtos.cs`, `src/Dragonbane.Api/Program.cs`
- Modify (generated): `web/openapi/Dragonbane.Api.json`, `web/src/app/api/schema.d.ts`; `web/src/app/api/models.ts`
- Test: `tests/Dragonbane.Api.Tests/Sections/SectionEndpointTests.cs`

**Interfaces:**
- Produces:
  - `NpcDto(int Id, string Name, bool IsBoss, int Hp, int? Wp, string? DamageBonusAttribute, string? DamageBonusDice, NpcSkillDto[] Skills, NpcHeroicAbilityDto[] HeroicAbilities, string[] Gear)` with `NpcSkillDto(string Name, int Level)` (`Skill.Name ?? UnlinkedName`) and `NpcHeroicAbilityDto(string Name, int Count)`; `Gear` is equipment item names. All collections ordered by `Id`.
  - `app.MapSection<Npc, NpcDto, NameFilter<Npc>>("npcs");`
  - TS: `NpcDto`, `NpcSkillDto`, `NpcHeroicAbilityDto` exported from `models.ts`.

- [ ] **Step 1: Write the failing tests** `Npcs_list` (`GET /api/npcs` → 11, first `Guard`) and `Npc_by_id` (Bandit chief: `heroicAbilities` `[{Berserker,1},{Robust,6},{Veteran,1}]`, `gear` `["Heavy warhammer","Chainmail","Open helmet"]`, `damageBonusAttribute` `STR`).
- [ ] **Step 2: Run** `dotnet test --filter SectionEndpointTests` → FAIL.
- [ ] **Step 3: Implement** the DTOs and the `MapSection` line.
- [ ] **Step 4: Run** `dotnet test` → PASS; regenerate API types; add the three exports to `models.ts`; `npx ng build` → PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(api): serve typical NPCs at /api/npcs"`

### Task 8: NPC model and tweak rules

**Files:**
- Create: `web/src/app/npc/npc.ts` (types + rules), `web/src/app/npc/npc.fixture.ts` (DTO fixtures copied from the real data: Guard, Villager, Hunter, Bandit, Bandit chief, Archmage; and the reference rows they name)
- Test: `web/src/app/npc/npc.spec.ts`

**Interfaces:**
- Consumes: `NpcDto`, `SkillDto`, `HeroicAbilityDto`, `EquipmentItemDto` (with `weapon.skill`), `SpellDto`, `SpellKind` from `api/models`.
- Produces:
  ```ts
  export interface NpcSpellRef { name: string; school: string; kind: SpellKind }
  export interface Npc {
    name: string; description: string; basedOn: string; movement: number; hp: number; wp: number | null;
    damageBonus: { attribute: string; dice: string } | null;
    skills: { name: string; level: number }[]; abilities: { name: string; count: number }[];
    gear: string[]; spells: NpcSpellRef[];
  }
  export interface SavedNpc extends Npc { id: string }
  export interface NpcReference { skills: SkillDto[]; abilities: HeroicAbilityDto[]; equipment: EquipmentItemDto[]; spells: SpellDto[] }
  export const STACKING_ABILITIES = ['Robust', 'Focused'] as const;
  export function fromTypical(dto: NpcDto, ref: NpcReference): Npc;
  export function addGear(npc: Npc, itemName: string, ref: NpcReference): Npc;
  export function removeGear(npc: Npc, itemName: string): Npc;
  export function setAbilityCount(npc: Npc, name: string, count: number): Npc; // 0 removes
  export function addSpell(npc: Npc, spell: NpcSpellRef): Npc;
  export function removeSpell(npc: Npc, spell: NpcSpellRef): Npc;
  ```
  All functions return a new object; name lookups against `ref` are case-insensitive.

- [ ] **Step 1: Write the failing tests:**
  - `fromTypical copies the Bandit chief`: name and basedOn `Bandit chief`, description `''`, movement 10, hp 30, wp 16, damageBonus `{STR, D6}`, abilities `Berserker 1, Robust 6, Veteran 1`, gear as DTO, spells `[]`.
  - `fromTypical adds missing weapon skills at 5`: Villager (Brawling 8, Small wooden club) → skills `Brawling 8, Hammers 5`.
  - `addGear adds the weapon skill at 5 once`: Guard + `Short bow` → `Bows 5` appended; adding `Longbow` after does not add a second Bows; Guard + `Broadsword` adds nothing (has Swords 12).
  - `addGear keeps an unknown name as plain gear` (no skill added).
  - `Robust changes HP by 2 per step`: Bandit chief Robust 6 → 4 gives hp 26; → 0 removes Robust and gives hp 18; adding Robust to Guard (hp 12) gives Robust 1, hp 14.
  - `Focused changes WP`: Archmage Focused 6 → 7 gives wp +2; Focused added to Guard (wp null) gives wp 2.
  - `HP and WP never go below 0`: hp hand-set to 5, Robust 6 → 0 gives hp 0 (Review Focus 5).
  - `non-stacking abilities stay at count 1`: `setAbilityCount(npc, 'Berserker', 3)` keeps count 1.
  - `spells are matched by name, school and kind`: adding `ERASE`/Symbolism/Trick and `ERASE`/Symbolism/Spell keeps both; removing one keeps the other.
- [ ] **Step 2: Run** `npx ng test --watch=false` → FAIL.
- [ ] **Step 3: Implement** in `npc.ts`. `fromTypical` and `addGear` both run one private `withWeaponSkills(npc, ref)` that appends `{ name: item.weapon.skill, level: 5 }` for each weapon in gear whose skill is missing. `setAbilityCount` clamps stacking counts to ≥ 0 and non-stacking to 0/1, applies `2 × delta` to hp (Robust) or wp (Focused, `null` treated as 0), floors at 0.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git add web/src/app/npc && git commit -m "feat(web): NPC model with tweak rules (weapon skill at 5, Robust/Focused to HP/WP)"`

### Task 9: Card rows, text and Markdown

**Files:**
- Create: `web/src/app/npc/npc-card.ts`
- Test: `web/src/app/npc/npc-card.spec.ts`

**Interfaces:**
- Consumes: `Npc`, `NpcReference`, `STACKING_ABILITIES` (Task 8); `sentenceCase` from `shared/text`.
- Produces:
  ```ts
  export interface CardEntry { text: string; detail: string | null }
  export interface NpcCard {
    name: string; description: string; movement: number; damageBonus: string | null;
    armour: string | null; hp: number; wp: number | null;
    skills: string; abilities: CardEntry[]; weapons: string; spells: CardEntry[]; gear: string;
  }
  export function buildCard(npc: Npc, ref: NpcReference, withDescriptions: boolean): NpcCard;
  export function cardToText(card: NpcCard): string;
  export function cardToMarkdown(card: NpcCard): string;
  ```
  Empty strings / empty arrays / `null` mean "row hidden".

Rules the tests pin (spec "Export card"; `npc-card-v2.html` mockup):
- damageBonus `STR: +D6`.
- armour: names of gear items with `armour` in gear order, then the summed rating: `Chainmail, open helmet (5)`. In armour, weapons and gear rows the first item keeps its case and the rest start lower case (book style).
- weapons: `Heavy warhammer (skill level 15, damage 2D10)`; a missing skill gives `skill level –`.
- skills: `Name level`, comma separated, **excluding** skills used by a listed weapon (the approved mockup shows Hammers only in the weapon line).
- abilities: non-stacking in NPC order, then Robust, then Focused; stacking text `Robust ×6`. With descriptions, a non-stacking entry is `Berserker (3 WP)` with `detail` = effect; stacking entries never get a detail.
- spells: `sentenceCase(name)`; with descriptions, ranked spells read `Dispel (rank 1, Action, 10 metres, Instant)`, tricks `Name (trick)`, `detail` = description.
- gear: items that are neither weapon nor armour, plus any unresolved name (Review Focus 1).

- [ ] **Step 1: Write the failing tests** using "Grok" = `fromTypical(banditChief)` with name `Grok`, description `Scarred chief of the Red Ford bandits.`, plus spell DISPEL (General Magic, Spell):
  - `buildCard without descriptions`: `damageBonus` `STR: +D6`, `armour` `Chainmail, open helmet (5)`, `skills` `Awareness 12, Brawling 15`, `abilities` texts `['Berserker', 'Veteran', 'Robust ×6']` all `detail: null`, `weapons` `Heavy warhammer (skill level 15, damage 2D10)`, `spells` `[{ text: 'Dispel', detail: null }]`, `gear` `''`.
  - `buildCard with descriptions`: Berserker `text` `Berserker (3 WP)` and `detail` equal to its effect; Robust `detail` null; Dispel `text` `Dispel (rank 1, Action, 10 metres, Instant)`.
  - `two weapons and a removed skill`: Bandit (Bows 12, Evade 10, Swords 12; Short sword, Short bow) with Bows removed → weapons `Short sword (skill level 12, damage D10), short bow (skill level –, damage D10)`.
  - `unresolved names stay as text`: gear `Mystery orb` shows in `gear`.
  - `cardToText` for Grok without descriptions equals exactly:
    ```
    Grok
    Scarred chief of the Red Ford bandits.

    Movement: 10 · Damage Bonus: STR: +D6
    Armor: Chainmail, open helmet (5) · HP: 30 · WP: 16
    Skills: Awareness 12, Brawling 15
    Heroic Abilities: Berserker, Veteran, Robust ×6
    Weapons: Heavy warhammer (skill level 15, damage 2D10)
    Spells: Dispel
    ```
    With descriptions, a list row becomes the label line followed by `- text: detail` (or `- text`) lines.
  - `cardToMarkdown` for the same: first line `## Grok`, then a blank line, the description, a blank line, then each row as `**Movement:** 10 · **Damage Bonus:** STR: +D6` etc., one per line ending in two spaces; with descriptions, list rows become `**Heroic Abilities:**` followed by `- **Berserker (3 WP)**: effect` lines. Hidden rows produce no line in either format.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git add web/src/app/npc && git commit -m "feat(web): NPC card rows with text and Markdown output"`

### Task 10: Saved NPCs store

**Files:**
- Create: `web/src/app/npc/npc.store.ts`
- Test: `web/src/app/npc/npc.store.spec.ts`

**Interfaces:**
- Consumes: `Npc`, `SavedNpc` (Task 8).
- Produces: `@Injectable({ providedIn: 'root' }) class NpcStore { readonly npcs: Signal<readonly SavedNpc[]>; save(npc: Npc & { id?: string }): SavedNpc; remove(id: string): void }`. Key `dragonbane.npcs.v1`. `save` without `id` assigns `crypto.randomUUID()` and appends; with `id` replaces in place.

- [ ] **Step 1: Write the failing tests:** `starts empty`; `save then reload` (new `TestBed` reads it back); `save with id replaces`; `remove`; `invalid JSON, a non-array, or entries without string id/name are ignored and storage is not rewritten on load` (Review Focus 2: set `localStorage` to `'{bad'`, construct the store, `npcs()` is `[]`, `localStorage.getItem` still `'{bad'`); `blocked storage` (`setItem` throws) keeps the NPC in memory.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** following `core/coin-standard.store.ts` (try/catch around every storage access). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): saved NPCs in localStorage"` (after `git add`).

### Task 11: NPC Manager page (tables)

**Files:**
- Modify: `web/src/app/features/npcs/npcs.page.ts`, `npcs.page.html`; `web/src/styles/app.scss`
- Test: `web/src/app/features/npcs/npcs.page.spec.ts`

**Interfaces:**
- Consumes: `/api/npcs`, `/api/skills`, `/api/heroic-abilities`, `/api/equipment`, `/api/spells` via `httpResource`; `NpcStore`; `fromTypical`.
- Produces: `NpcsPage` protected members used by Task 12/13: `ref: Signal<NpcReference | undefined>`, `editing: WritableSignal<(Npc & { id?: string }) | null>`, `tweak(dto: NpcDto)`, `edit(npc: SavedNpc)`.

- [ ] **Step 1: Write the failing tests** (flush the five requests with fixtures from `npc.fixture.ts`):
  - `lists typical NPCs`: table caption `Typical NPCs`, rows in source order, columns Type, Skills, Heroic abilities, Bonus, HP, WP, Typical gear, actions; Bandit chief row reads `Robust ×6`.
  - `descriptions on demand`: each skill, ability and gear name is a `<details>` whose `<summary>` is the name and whose body is the reference description (skill `description`, ability `effect`, item `effect`); names with no reference row are plain text.
  - `My NPCs empty state`: text `No saved NPCs yet. Tweak a typical NPC to make one.`
  - `My NPCs rows`: with two saved NPCs, table caption `My NPCs`, columns Name, Based on, actions; buttons `Edit Grok`, `Export Grok`, `Delete Grok` (accessible names).
  - `delete confirms in the row`: `Delete Grok` replaces the row's actions with text `Delete Grok?` and buttons `Yes, delete` / `Keep`; `Keep` restores; `Yes, delete` calls `NpcStore.remove` and focus moves to the `My NPCs` heading (`h2` with `tabindex="-1"`).
  - `load error`: a failed `/api/npcs` shows `role="alert"` text `The NPC table could not be loaded. Is the API running?` (same wording pattern as the treasure page).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with the existing `.data-table stack` / `.table-wrap` classes; `Tweak` buttons are named `Tweak Bandit chief`; Tweak and Edit set `editing` (the dialog comes in Task 12). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): NPC Manager tables with descriptions and saved NPCs"` (after `git add`).

### Task 12: Tweak dialog with live preview

**Files:**
- Create: `web/src/app/features/npcs/npc-editor.ts`, `npc-editor.html`, `npc-card-view.ts`, `npc-card-view.html`
- Modify: `npcs.page.ts`, `npcs.page.html`, `web/src/styles/app.scss`
- Test: `web/src/app/features/npcs/npc-editor.spec.ts`, `npc-card-view.spec.ts`

**Interfaces:**
- Consumes: Task 8 rules, `buildCard` (Task 9), `NpcStore.save`, the shared dialog classes from Task 2.
- Produces:
  - `NpcCardView` (`app-npc-card`): `card = input.required<NpcCard>()`; renders the book-style card; root element has class `npc-card`.
  - `NpcEditor` (`app-npc-editor`): `npc = input.required<Npc>()`, `ref = input.required<NpcReference>()`, `saved = output<Npc>()`, `cancelled = output<void>()`; holds a local `draft` signal.

- [ ] **Step 1: Write the failing tests:**
  - `NpcCardView` hides empty rows (no `Spells:` label when `spells` is empty) and renders `detail` in an element with class `entry-detail`.
  - Editor: fields labelled `Name` (required), `Description`, `Movement`, `HP`, `WP`, `Damage bonus attribute` (none/STR/AGL), `Damage bonus dice` (D4/D6).
  - Chips: each skill/ability/gear/spell has a remove button named `Remove Awareness` etc.; skill levels are number inputs labelled `Awareness level`; stacking abilities have `Robust count`.
  - Adding: each list has an input with a `<datalist>` of reference names and an `Add` button (`Add skill`, `Add heroic ability`, `Add gear`, `Add spell`; spell options read `Dispel (General Magic)`); adding `Short bow` to the Guard shows a `Bows 5` chip; changing `Robust count` from 6 to 4 changes the `HP` field from 30 to 26.
  - The preview (`app-npc-card`) updates as the draft changes, and the `Include spell and heroic ability descriptions` checkbox switches the preview's details on.
  - `Save` with an empty name shows `Name is required` and emits nothing; HP `-1` shows `HP must be 0 or more` (same for Movement, WP and levels); with a name it emits the draft; `Cancel` emits `cancelled`.
  - Page: `Tweak Bandit chief` opens a modal `dialog` labelled `Tweak Bandit chief`; `Edit Grok` opens `Edit Grok`; saving calls `NpcStore.save` and closes; the dialog has the floating `Close` button.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** The page's `<dialog class="app-dialog npc-dialog">` reuses `.dialog-body`/`.dialog-close` and the backdrop-click close from the treasure page; editor left, preview right, stacked under 48rem. Card styles use tokens and the existing `scroll-top.webp`/`scroll-bottom.webp` for the frame; no book art. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): tweak dialog with live NPC card preview"` (after `git add`).

### Task 13: Export menu

**Files:**
- Modify: `web/package.json`, `web/package-lock.json` (`npm install html-to-image`)
- Create: `web/src/app/npc/npc-export.ts` (pure helpers), `web/src/app/features/npcs/npc-export-menu.ts`, `npc-export-menu.html`
- Modify: `npcs.page.html` (row `Export` and dialog `Export` open the menu), `DECISIONS.md`
- Test: `web/src/app/npc/npc-export.spec.ts`, `web/src/app/features/npcs/npc-export-menu.spec.ts`

**Interfaces:**
- Consumes: `buildCard`, `cardToText`, `cardToMarkdown` (Task 9), `NpcCardView` (Task 12).
- Produces: `export function fileName(npcName: string, ext: 'png' | 'txt' | 'md'): string`; `NpcExportMenu` (`app-npc-export-menu`): `npc = input.required<Npc>()`, `ref = input.required<NpcReference>()`.

- [ ] **Step 1: Write the failing tests:**
  - `fileName`: `Grok` → `grok.png`; `Old Tom's Bandit #2` → `old-toms-bandit-2.md`; `''` or only symbols → `npc.txt`.
  - Menu: a `Include spell and heroic ability descriptions` checkbox and six buttons: `Copy image`, `Download image`, `Copy text`, `Download text`, `Copy Markdown`, `Download Markdown`.
  - `Copy text` calls `navigator.clipboard.writeText` with `cardToText(...)` and shows status `Copied text.`; `Download Markdown` creates an anchor with `download="grok.md"` (spy `URL.createObjectURL`).
  - `clipboard blocked` (Review Focus 3): with `navigator.clipboard` undefined, and again with `write` rejecting, `Copy image` / `Copy text` show `role="status"` text `Your browser blocked the clipboard. Use Download instead.`; download buttons still work.
  - Image actions call an injectable `CARD_RENDERER` token (`(node: HTMLElement) => Promise<Blob>`, default `html-to-image`'s `toBlob`) on the rendered `.npc-card`; tests provide a fake.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** The menu renders an `app-npc-card` off-screen (positioned outside the viewport, not `display: none`) for capture. Copy image uses `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`.
- [ ] **Step 4: Run** → PASS. **Step 5: Fonts check.** `npm start` with the API running, export Grok as an image and open it: the title must be in Colus and the body in Crimson Pro. If Crimson Pro is missing (the Google Fonts stylesheet is cross-origin), self-host Crimson Pro in `web/public/` with an `@font-face` in `parchment.css` and drop it from the Google link; re-check.
- [ ] **Step 6: Commit** with a `DECISIONS.md` entry "NPC card image via html-to-image (2026-10-27)". `git commit -m "feat(web): export NPCs as image, text or Markdown, by copy or download"` (after `git add`).

### Task 14: Accessibility gate and final check

**Files:**
- Modify: `web/e2e/a11y.spec.ts`

- [ ] **Step 1: Add e2e tests:**
  - Add `'/npcs'` to the axe/overflow `routes` loop (both viewports). Clear `localStorage` first.
  - `tweak dialog is accessible` at both viewports: `Tweak Bandit chief` → dialog visible, axe on `dialog` clean, nothing overflows (reuse `overflow()`), Close inside the viewport; at 375 px the preview's top is below the editor's bottom (stacked; Review Focus 4). Change the name to `Grok`, `Save`; `My NPCs` lists `Grok`; reload; still listed.
  - `export menu is accessible`: `Export Grok` → axe clean.
- [ ] **Step 2: Run the full check:** `dotnet test`, then in `web/`: `npx ng test --watch=false && npx ng build && npm run e2e` → all PASS.
- [ ] **Step 3: Commit.** `git commit -am "test(web): NPC Manager in the accessibility and overflow gate"`
