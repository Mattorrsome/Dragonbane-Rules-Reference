# Dragonbane Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lookup app for the Dragonbane RPG table: an ASP.NET minimal API serves SQLite data imported from the markdown sources, and an Angular front end holds all the pricing, coin, dice and treasure logic.

**Architecture:** An explicit `dotnet run --project src/Dragonbane.Api -- import` command builds a SQLite database from `Source Material/*.md` plus a hand-curated treasure seed; the API serves that prebuilt file read-only (amended after Task 7 at the user's request). EF Core maps it with TPT inheritance. One generic `MapSection<TEntity, TDto, TFilter>` helper produces every typed list and detail route. At build time the API writes its OpenAPI document into `web/openapi/`, and `openapi-typescript` turns it into TypeScript types. The Angular app (standalone, zoneless, signals, `httpResource`) renders the five sections. Its business logic lives in pure, unit-tested TypeScript.

**Tech Stack:** .NET 10 (SDK 10.0.402), ASP.NET Core minimal APIs, EF Core 10 + SQLite, xUnit + `Microsoft.AspNetCore.Mvc.Testing`; Angular 22 (CLI 22.2.x) with the default Vitest runner, `openapi-typescript`, Playwright + `@axe-core/playwright`; Node 24.

**Spec:** `docs/superpowers/specs/2026-10-22-dragonbane-reference-design.md`. Read it first. It wins over this plan on anything this plan does not pin.

## Global Constraints

- Source data is `C:\Projects\Dragonbane\Source Material\*.md`. Never hand-copy display data anywhere else. The only hand-curated data is the treasure roll seed (Task 6) and the magic trick rule: casting time `Action` and requirement `Gesture` on every trick.
- `Dragonbane_NPC_Table.md` is never imported.
- Money is integer copper in the DB, stored alongside the original cost text. Front-end calculations stay exact until display. Display rounds **down** exactly once and never shows less than `1 copper`.
- Pricing order: base copper → sell rate (100/50/20/10 %) → bartering (Success: buy −20 %, sell +20 %; Dragon: buy ×½, sell ×2) → coin standard → round down.
- Coin standards: `written`, `copper`, `silver`, `gold`. Zero denominations are omitted. `written` applies only to unmodified base prices; calculated prices fall back to `gold`.
- The Currency Exchange table is fetched by the front end for conversion and is **never rendered**. Coin conversion must use the fetched rates, never hard-coded 10/100.
- Never parse treasure effect text at runtime. Dice come from the seed via the API.
- Schema is normalised: TPT supertype/subtype tables, junction tables for multi-valued fields, no JSON columns, no generic table/row/cell model.
- API serves data only, with no per-section controllers. Routes are `GET /api/{section}?search=&…` and `GET /api/{section}/{id}`, plus `GET /api/currency-rates`.
- The dice RNG is injectable and seedable.
- UI uses the parchment style from skill `anthropic-skills:dragonbane-parchment-style` (load it before any UI task). It is laptop-first, still usable at 375 px wide, AXE-clean and WCAG AA.
- Every significant decision is appended to `C:\Projects\Dragonbane\DECISIONS.md` (context, decision, alternatives, why) in the task that makes it.
- Config is environment-driven (`Dragonbane__SourceMaterialPath`, `Dragonbane__DatabasePath`). Nothing hosting-specific.

## Review Focus

1. **Search text containing `%`, `_` or `'`** (e.g. `day's`, `50%`) must match literally and never act as a wildcard or cause an error. Test: Task 7 `Search_treats_wildcards_literally`.
2. **Tiny prices after sell rate and bartering** (Tallow candle, 1 copper, sold at 10 %) must display `1 copper`, never `0` or a fraction. Test: Task 9 `quote floors only at display, minimum 1`.
3. **Browser storage unavailable** (private mode, or `localStorage` throws) must leave the app working with the coin standard defaulting to `gold`. Test: Task 8 `CoinStandardStore survives throwing storage`.
4. **Unit-suffixed costs under sell/barter** (`500/shift or more`, `200 x potency`, `2500, varies`) must keep their suffix after calculation. Test: Task 9 `formatPrice keeps unit and or-more`.
5. **Bad ids and bad filter values** (`/api/spells/99999`, `?rank=abc`) must return 404 / 400 ProblemDetails, never 500. Tests: Task 7 `Unknown_id_returns_404`, `Invalid_filter_returns_400`.

---

## File Structure

```
DECISIONS.md                         decision log (Task 1, appended throughout)
Dragonbane.slnx
src/Dragonbane.Api/
  Program.cs                         host, config, import command, MapSection lines
  Data/DragonbaneDbContext.cs        DbSets + TPT / junction config
  Data/Entities/*.cs                 one file per aggregate: Magic.cs, Equipment.cs, Skills.cs, Treasure.cs, Currency.cs
  Import/MarkdownDocument.cs         pipe-table + heading parser
  Import/CostParser.cs               "200/day", "5 gold" → copper
  Import/SourceImporter.cs           rebuild DB, call section importers in order
  Import/{Currency,Equipment,Skills,HeroicAbilities,Spells,Treasure}Importer.cs
  Import/TreasureSeed.cs             hand-curated dice specs keyed by roll
  Sections/SectionEndpoints.cs       MapSection + ISectionDto + ISectionFilter + SearchPattern
  Sections/Dtos/*.cs                 per-section DTO records with Projection
  Sections/Filters/*.cs              per-section filter records
tests/Dragonbane.Api.Tests/
  TestPaths.cs                       locates Source Material from bin dir
  ApiFactory.cs                      WebApplicationFactory with temp DB
  Import/*Tests.cs, Sections/*Tests.cs
web/                                 Angular workspace
  openapi/Dragonbane.Api.json        generated at API build
  src/app/api/schema.d.ts            generated by openapi-typescript
  src/app/api/models.ts              type aliases over schema
  src/app/core/coin-standard.store.ts, currency-rates.ts
  src/app/money/coins.ts, pricing.ts, mastercraft.ts   (+ .spec.ts)
  src/app/dice/dice-roller.ts, seeded-random.ts        (+ .spec.ts)
  src/app/treasure/treasure-resolver.ts, dice-format.ts (+ .spec.ts)
  src/app/shared/search-box.ts
  src/app/features/{skills,heroic-abilities,spells,equipment,treasure}/*.page.ts
  e2e/a11y.spec.ts
```

---

## Phase A: API

### Task 1: Repo scaffold and markdown parser

**Files:**
- Create: `.gitignore`, `Dragonbane.slnx`, `DECISIONS.md`, `src/Dragonbane.Api/*` (template), `tests/Dragonbane.Api.Tests/*` (template), `src/Dragonbane.Api/Import/MarkdownDocument.cs`, `tests/Dragonbane.Api.Tests/TestPaths.cs`, `tests/Dragonbane.Api.Tests/Import/MarkdownDocumentTests.cs`
- Modify: `CLAUDE.md` ("Project state": list build/test commands, remove "Not a git repository yet")

**Interfaces:**
- Produces:
  ```csharp
  public sealed record MarkdownSection(string Heading, int Level, string? Note,
      IReadOnlyList<string> Columns, IReadOnlyList<IReadOnlyDictionary<string, string>> Rows);
  public static class MarkdownDocument { public static IReadOnlyList<MarkdownSection> Parse(string markdown); }
  public static class TestPaths { public static string SourceMaterial { get; } }  // test project
  ```
  Each `#`-heading starts a section. `Note` is the section's non-table, non-list prose with `*`/`**` markers stripped, or `null`. In cells, `<br>` becomes `\n` and whitespace is trimmed. A section with no table has empty `Columns`/`Rows`.

- [ ] **Step 1: Scaffold.** `git init -b main`. Write a `.gitignore` covering `bin/ obj/ *.db node_modules/ dist/ .angular/ test-results/ playwright-report/`. Run `dotnet new sln --format slnx -n Dragonbane`, `dotnet new web -n Dragonbane.Api -o src/Dragonbane.Api`, `dotnet new xunit -n Dragonbane.Api.Tests -o tests/Dragonbane.Api.Tests`, add both projects to the solution, add a project reference from the tests to the API, and add `Microsoft.AspNetCore.Mvc.Testing` 10.* to the tests. Create `DECISIONS.md` with a one-line header and an entry template, then first entries: *Minimal APIs over controllers*, *SQLite*, *Monorepo layout*.
- [ ] **Step 2: Write failing tests** in `MarkdownDocumentTests`:
  ```csharp
  [Fact] void Parses_heading_levels_and_table_rows()  // inline md: "## A\n\n| X | Y |\n| --- | ---: |\n| 1 | two |" → Heading "A", Level 2, Columns ["X","Y"], Rows[0]["Y"] == "two"
  [Fact] void Converts_br_to_newline()                 // cell "a<br>b" → "a\nb"
  [Fact] void Captures_note_without_emphasis()         // "A **mastercrafted** version…" → Note starts "A mastercrafted version"
  [Fact] void Parses_real_equipment_file()             // File.ReadAllText(Path.Combine(TestPaths.SourceMaterial, "Dragonbane_Equipment_Tables.md")): section "Melee weapons" has 29 rows; "Services" 17 rows; "Currency Exchange" 3 rows
  ```
- [ ] **Step 3: Run** `dotnet test --filter MarkdownDocumentTests`. Expected: build FAIL (`MarkdownDocument` does not exist).
- [ ] **Step 4: Implement** `MarkdownDocument.Parse` with line-by-line state (no regex for tables, no Markdig). Skip the `| --- |` separator row. `TestPaths.SourceMaterial` walks up from `AppContext.BaseDirectory` until it finds `Source Material`.
- [ ] **Step 5: Run** `dotnet test`. Expected: all PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "chore: scaffold solution and markdown table parser"`. The first commit also brings in the existing docs and source material.

### Task 2: Entities and DbContext

**Files:**
- Create: `src/Dragonbane.Api/Data/DragonbaneDbContext.cs`, `src/Dragonbane.Api/Data/Entities/{Currency,Equipment,Magic,Skills,Treasure}.cs`, `tests/Dragonbane.Api.Tests/Data/SchemaTests.cs`
- Modify: `src/Dragonbane.Api/Dragonbane.Api.csproj` (add `Microsoft.EntityFrameworkCore.Sqlite` 10.*)

**Interfaces:**
- Produces (all `int Id`, all implement `IEntity { int Id { get; } }`; lookups also implement `INamedEntity : IEntity { string Name { get; } }`):
  ```
  CurrencyRate      (Id, Name, CopperValue int)
  EquipmentCategory (Id, Name, NameHeader, EffectHeader?, HasWeight bool, CanResell bool, Note?)      INamedEntity
  Supply            (Id, Name, Description)                                                           INamedEntity
  WeaponTerm        (Id, Name, Description)                                                           INamedEntity
  WeaponFeature     (Id, Name, Description)                                                           INamedEntity
  DamageType        (Id, Name)                                                                        INamedEntity
  EquipmentItem     (Id, CategoryId, Category, Name, CostCopper int?, CostUnit?, CostOrMore bool, CostText, SupplyId?, Supply?, Weight string?, Effect?)
  Weapon : EquipmentItem   (Grip?, StrRequirement int?, Range, Damage, Durability int?, IsRanged bool, FeaturesText,
                            Features List<WeaponFeature>, DamageTypes List<DamageType>)
  Armour : EquipmentItem   (Rating int, IsHelmet bool)
  MagicSchool       (Id, Name, Description, Note?)                                                    INamedEntity
  Requirement       (Id, Name)
  enum SpellKind { Trick, Spell, Recipe }
  Spell             (Id, SchoolId, School, Name, Rank int, Kind SpellKind, CastingTime, RequirementText, Description, Requirements List<Requirement>)
  RankedSpell : Spell      (Prerequisite, Range, Duration)
  Recipe : RankedSpell     (CostPerDoseCopper int?, CostPerDoseUnit?, SupplyId?, Supply?)
  SkillType         (Id, Name)                                                                        INamedEntity
  Attribute         (Id, Code)
  Skill             (Id, Name, SkillTypeId, SkillType, AttributeId, Attribute, AttributeNote?, Description)
  HeroicAbility     (Id, Name, Prerequisite, Wp, Effect)
  enum RollPurpose { Coins, Pick, Number, SpellRank }
  TreasureEntry     (Id, Roll int, Name, EffectText, Rolls List<TreasureRoll>)
  TreasureRoll      (Id, EntryId int?, OutcomeId int?, Sequence, Label, DiceCount, DieSides, Modifier, Multiplier, Purpose RollPurpose,
                     CoinId int?, Coin CurrencyRate?, Outcomes List<TreasureOutcome>)
  TreasureOutcome   (Id, RollId, Face, Label, ValueCopper int?, ValueText?, EquipmentItemId int?, IsMastercrafted bool,
                     MagicSchoolId int?, Rolls List<TreasureRoll>)
  DragonbaneDbContext(DbContextOptions<DragonbaneDbContext>) with a DbSet per type above
  ```
- Model config: `UseTptMappingStrategy()` on `EquipmentItem` and `Spell`. Many-to-many join tables are named `SpellRequirement`, `WeaponWeaponFeature` and `WeaponDamageType`. Enums are stored as strings. `TreasureRoll` gets a check constraint `CK_TreasureRoll_OneParent` meaning exactly one of `EntryId`/`OutcomeId` is set. Unique indexes go on `Name` of every lookup and on `TreasureEntry.Roll`.

- [ ] **Step 1: Write failing test** `SchemaTests.Creates_tpt_and_junction_tables`. Open an in-memory SQLite connection, run `EnsureCreated`, then query `sqlite_master`. Assert the tables `Spell, RankedSpell, Recipe, EquipmentItem, Weapon, Armour, SpellRequirement, WeaponWeaponFeature, WeaponDamageType, TreasureRoll` exist.
- [ ] **Step 2: Write failing test** `SchemaTests.Rejects_roll_with_two_parents`. Insert a `TreasureRoll` with both `EntryId` and `OutcomeId` set and assert `DbUpdateException`.
- [ ] **Step 3: Run** `dotnet test --filter SchemaTests`. Expected: FAIL (types missing).
- [ ] **Step 4: Implement** the entities and `OnModelCreating`.
- [ ] **Step 5: Run** `dotnet test`. Expected: PASS.
- [ ] **Step 6: DECISIONS.md:** add *TPT for spells/equipment*, *Damage types split from weapon features* (the glossary row "Piercing, slashing, bludgeoning" is one row, but weapons need each type separately), *Prerequisite/Range/Duration kept as text*, *Raw `FeaturesText`/`RequirementText`/`CostText` kept for as-is display*, *Category/school `Note` holds source prose such as the mastercrafted rule*, and *`Recipe.SupplyId` nullable because one recipe lists cost "—" with no supply*.
- [ ] **Step 7: Commit** `feat(api): add normalised EF Core model`.

### Task 3: Currency and equipment importer

**Files:**
- Create: `src/Dragonbane.Api/Import/CostParser.cs`, `Import/CurrencyImporter.cs`, `Import/EquipmentImporter.cs`, `tests/.../Import/CostParserTests.cs`, `tests/.../Import/EquipmentImporterTests.cs`

**Interfaces:**
- Consumes: `MarkdownDocument.Parse`, entities from Task 2.
- Produces:
  ```csharp
  public sealed record ParsedCost(int? Copper, string? Unit, bool OrMore);
  public static class CostParser {
      public static ParsedCost ParseCopperColumn(string text);              // "200/day" → (200,"/day",false); "500/shift or more" → (500,"/shift",true); "200 x potency" → (200," x potency",false); "2500, varies" → (2500,", varies",false); "-" → (null,null,false)
      public static ParsedCost ParseCoinText(string text, IReadOnlyDictionary<string,int> copperPerCoin); // "6 silver × potency" → (60," × potency",false); "—" → (null,null,false); coin names case-insensitive
  }
  public static class CurrencyImporter  { public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db); }
  public static class EquipmentImporter { public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db); }
  ```
- Mapping rules:
  - Every `##` section with a table is a category, except `Currency Exchange`, `Supply and Weapon Terms` and `Weapon Features`. `SortOrder` is source order (use Id).
  - `NameHeader` is the first column header. `EffectHeader` is whichever of `Effect`, `Musician effect`, `Capacity/effect`, `Effect/capacity`, `Capacity`, `Features` is present.
  - `HasWeight` is true when a `Weight` column is present. `CanResell` is `Name != "Services"`. `Note` is the section note.
  - Supply/Weapon Terms rows: the names `Common/Uncommon/Rare/Unique` go to `Supply`; the rest go to `WeaponTerm`.
  - Weapons (`Melee weapons`, `Ranged weapons`; the latter sets `IsRanged`):
    - `-` becomes `null` for Grip, STR, Durability, Cost and Supply.
    - Split `Features` on the first `;`. The left side is comma tokens, matched case-insensitively. `subtle`, `long` and `toppling` map to the features of the same name. `thrown` maps to `Can be thrown`. `piercing`, `slashing` and `bludgeoning` are `DamageType`s. The right side, trimmed, goes to `Effect`.
    - Any other token throws `InvalidDataException` naming the weapon and the token.
  - Armour: `Rating` `"+1"` → 1 with `IsHelmet = true`.
  - Every other cell: `-` → `null`.

- [ ] **Step 1: Write failing tests** in `CostParserTests` covering each example in the signature comments, plus `"1"` → `(1,null,false)`.
- [ ] **Step 2: Write failing tests** in `EquipmentImporterTests`. Use an in-memory SQLite context and the real file.
  - `Imports_all_items`: 15 categories, 157 items, 35 weapons, 6 armour (2 helmets), 3 currency rates (Gold = 100).
  - `Maps_weapon_features_and_damage_types`: Dagger features `{Subtle, Can be thrown}`, damage types `{Piercing, Slashing}`. Flail `Effect == "cannot parry"` and `Durability == null`. Short spear `Range == "STR x 2"`.
  - `Maps_costs`: Bodyguard `(200,"/day")`. Teacher `CostOrMore`. Unarmed `CostCopper == null`. Field ration `Weight == "1/4"`.
  - `Keeps_mastercrafted_note`: `Melee weapons` note starts `"A mastercrafted version costs 10 times normal"`.
  - `Category_headers`: Animals `EffectHeader == "Effect/capacity"`. Services `CanResell == false`, `HasWeight == false`.
  - `Unknown_feature_token_fails_loudly`: a doctored markdown string with `"Bludgeoning, sparkly"` throws `InvalidDataException` whose message contains `sparkly`.
- [ ] **Step 3: Run** `dotnet test --filter "CostParserTests|EquipmentImporterTests"`. Expected: FAIL.
- [ ] **Step 4: Implement.** Use regex `^(?<n>\d+)(?<unit>.*?)(?<more> or more)?$` for copper columns. Coin text is `<n> <coin><suffix>`.
- [ ] **Step 5: Run** `dotnet test`. Expected: PASS.
- [ ] **Step 6: DECISIONS.md:** *Cost unit stored as verbatim suffix*, *Hand-written table parser instead of Markdig*.
- [ ] **Step 7: Commit** `feat(api): import currency and equipment`.

### Task 4: Skills and heroic abilities importers

**Files:**
- Create: `Import/SkillsImporter.cs`, `Import/HeroicAbilitiesImporter.cs`, `tests/.../Import/SkillsImporterTests.cs`

**Interfaces:**
- Produces: `SkillsImporter.Import(doc, db)` and `HeroicAbilitiesImporter.Import(doc, db)`, same shape as Task 3.
- Rules:
  - `SkillType` and `Attribute` rows are created on first sight, in source order.
  - The Attribute cell `"CHA (uses PERFORMANCE)"` becomes Code `CHA` with `AttributeNote = "uses PERFORMANCE"`.
  - Skill types are taken from the data as-is: `Core`, `Weapon`, `Secondary`.
  - Heroic `WP` is kept as text (`"3"`, `"Varies"`, `"-"`).

- [ ] **Step 1: Write failing tests:**
  - `Imports_skills`: 42 skills, types `[Core, Weapon, Secondary]` with 20/10/12 skills, Harmonism `AttributeNote == "uses PERFORMANCE"`.
  - `Imports_heroic_abilities`: 44 rows, Catlike `Wp == "Varies"`.
- [ ] **Step 2: Run** `dotnet test --filter SkillsImporterTests`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `dotnet test`. Expected: PASS.
- [ ] **Step 5: DECISIONS.md:** *Skill type "Secondary" kept from source.* The spec says "Magic", but the markdown is the source of truth. Flag this to the user at the next checkpoint.
- [ ] **Step 6: Commit** `feat(api): import skills and heroic abilities`.

### Task 5: Spells importer

**Files:**
- Create: `Import/SpellsImporter.cs`, `tests/.../Import/SpellsImporterTests.cs`

**Interfaces:**
- Consumes: `CostParser.ParseCoinText`, `Supply` rows (Task 3 runs first).
- Produces: `SpellsImporter.Import(doc, db)`.
- Rules:
  - Section `Schools of Magic` gives `MagicSchool` rows. Each `## <School>` note goes to `MagicSchool.Note`.
  - `### … Magic Tricks` gives `Spell` with `Kind = Trick`, `Rank = 0`, `CastingTime = "Action"`, `RequirementText = "Gesture"` and requirement `Gesture`. This is the user's trick rule.
  - `### … Spells` gives `RankedSpell` with `Kind = Spell`. `### Alchemy Recipes` gives `Recipe` with `Kind = Recipe`.
  - Requirements:
    - If the text contains `;`, split on `;`. Otherwise split on `,`.
    - Trim each part and upper-case its first letter. Deduplicate `Requirement` rows case-insensitively.
  - Recipe cost: match `Cost per dose: (?<cost>[^(<\n]+?)\s*(\((?<supply>\w+)\))?$` on the description's last line, then `ParseCoinText` it. The description text stays intact.

- [ ] **Step 1: Write failing tests:**
  - `Imports_counts`: 13 schools, 38 tricks, 245 spells, 33 recipes.
  - `Tricks_follow_user_rule`: every trick has `CastingTime == "Action"`, a single requirement `Gesture`, `Rank == 0`, and no `RankedSpell` row (`db.Set<RankedSpell>()` excludes them).
  - `Splits_requirements`: DISPEL has `{Word, Gesture}`. FOCUS TONIC has `{Alchemical laboratory, Ingredients: general herbs, wolf blood}`.
  - `Parses_recipe_cost`: HERBAL CONCOCTION `(100, null, Uncommon)`. SLEEPING POISON `(60, " × potency", Uncommon)`. At least one recipe has `CostPerDoseCopper == null && SupplyId == null`.
  - `Keeps_school_notes`: Alchemy note starts `"All recipes require an alchemical laboratory"`.
  - `Converts_br`: REJUVENATION description contains `\n`.
- [ ] **Step 2: Run** `dotnet test --filter SpellsImporterTests`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `dotnet test`. Expected: PASS.
- [ ] **Step 5: DECISIONS.md:** *Requirement split rule*, *Trick casting time stored as "Action" to match the source column vocabulary*.
- [ ] **Step 6: Commit** `feat(api): import spells, tricks and recipes`.

### Task 6: Treasure seed and importer

**Files:**
- Create: `Import/TreasureSeed.cs`, `Import/TreasureImporter.cs`, `tests/.../Import/TreasureImporterTests.cs`

**Interfaces:**
- Consumes: equipment items and magic schools by exact name, and currency rates.
- Produces:
  ```csharp
  public sealed record SeedRoll(string Label, int Count, int Sides, RollPurpose Purpose,
      int Modifier = 0, int Multiplier = 1, string? Coin = null, SeedOutcome[]? Outcomes = null);
  public sealed record SeedOutcome(string Label, string? Item = null, bool Mastercrafted = false,
      string? School = null, int? Value = null, string? ValueCoin = null, SeedRoll[]? Rolls = null);
  public static class TreasureSeed { public static IReadOnlyDictionary<int, SeedRoll[]> Rolls { get; } }
  public static class TreasureImporter { public static void Import(IReadOnlyList<MarkdownSection> doc, DragonbaneDbContext db); }
  ```
  An outcome's `Face` is its 1-based index. `Value`/`ValueCoin` become `ValueCopper` (via rates) and `ValueText` (`"10 silver"`). Display text (`Name`, `EffectText`) always comes from the markdown.
- Seed content. Derive it from `Dragonbane_Treasure_Table.md` with these decisions:
  - **1–25**: one `Coins` roll, `Label "value"`, `Coin` = `Copper`/`Silver`/`Gold` from the text, and `Multiplier` from `x N`.
  - **26**: `Pick` D6 with gem outcomes carrying `Value`/`ValueCoin`.
  - **27–30, 32, 38, 39**: `Pick` with `Item` set to the exact equipment name. Non-obvious names: `perfume` → `Perfume, 10 doses`; `open helmet` → `Open helmet`; `chess set` → `Chess set`.
  - **31**: as above, plus `Mastercrafted = true`.
  - **33**: `Pick` D3 `"type"`, labels `lethal`/`paralysing`/`sleeping`.
  - **34**: `Number` D6 `"damage"`. **40**: `Number` D4 `"damage"`.
  - **35**: three rolls:
    - `Pick` D4 `"school"`, outcomes with `School` = `Animism`/`Elementalism`/`Mentalism`/`General Magic`.
    - `SpellRank` D4 `Modifier -1`, label `"spell rank (0 = tricks)"`.
    - `Number` D4 `"number of spells"`.
  - **36**: `Pick` D6 with these outcomes:
    1. `lethal poison potency 12` → `Lethal poison, dose`
    2. `sleeping poison potency 14` → `Sleeping poison, dose`
    3. `alcohol`
    4. `herbal concoction` → `Herbal concoction, dose`
    5. `healing potion` → `Healing potion, dose`, nested `Number` 2D6 `"HP"`
    6. `healing potion` → `Healing potion, dose`, nested `Number` 3D6 `"HP"`
  - **37**: no rolls (text only).
- Importer validation throws `InvalidDataException` on any of:
  - a seed key with no markdown row, or a markdown row with no seed key other than 37
  - a `Pick` whose outcome count ≠ `Sides`
  - an unknown `Item`, `School` or `Coin`
  - an outcome roll that has outcomes of its own (max depth 2)

- [ ] **Step 1: Write failing tests:**
  - `Imports_40_entries`: 40 entries. Entry 37 has 0 rolls.
  - `Coin_rolls`: entry 4 is `2D6 × 10 Copper`. Entry 8 is `1D6 × 5 Silver`.
  - `Gem_values`: entry 26 face 1 is `glass` with `ValueCopper 2` and `ValueText "2 copper"`. Face 6 is `diamond` with `ValueCopper 10000`.
  - `Mastercrafted_links`: entry 31 face 3 links to `Battleaxe` with `IsMastercrafted`.
  - `Grimoire`: entry 35 has 3 rolls in sequence and its rank roll has `Modifier == -1`.
  - `Bottle_nested_hp`: entry 36 face 6 has one nested roll `3D6`, `Purpose Number`.
  - `Seed_validation_rejects_bad_item`: call the internal `TreasureImporter.Import(doc, db, seedOverride)` with an item `"Vorpal sword"` and expect a throw.
- [ ] **Step 2: Run** `dotnet test --filter TreasureImporterTests`. Expected: FAIL.
- [ ] **Step 3: Implement** the seed and the importer. `Import` has an `internal` overload taking the seed for tests (`InternalsVisibleTo` the test project).
- [ ] **Step 4: Run** `dotnet test`. Expected: PASS.
- [ ] **Step 5: DECISIONS.md:** *Treasure seed in C# (compile-checked, keyed by roll)*, *Roll/outcome tree schema with check constraint*.
- [ ] **Step 6: Commit** `feat(api): import treasure with curated roll seed`.

### Task 7: Startup import, generic section endpoints, OpenAPI

**Files:**
- Create: `Import/SourceImporter.cs`, `Sections/SectionEndpoints.cs`, `Sections/Dtos/*.cs`, `Sections/Filters/*.cs`, `tests/.../ApiFactory.cs`, `tests/.../Sections/SectionEndpointTests.cs`
- Modify: `Program.cs`, `appsettings.json`, `Dragonbane.Api.csproj` (add `Microsoft.AspNetCore.OpenApi` 10.* and `Microsoft.Extensions.ApiDescription.Server` 10.*)

**Interfaces:**
- Produces:
  ```csharp
  public static class SourceImporter { public static Task RebuildAsync(DragonbaneDbContext db, string sourceDirectory, CancellationToken ct); } // EnsureDeleted, EnsureCreated, then Currency → Equipment → Skills → HeroicAbilities → Spells → Treasure, then one SaveChanges
  public interface ISectionDto<TEntity, TSelf> where TSelf : ISectionDto<TEntity, TSelf> { static abstract Expression<Func<TEntity, TSelf>> Projection { get; } }
  public interface ISectionFilter<TEntity> { IQueryable<TEntity> Apply(IQueryable<TEntity> query); }
  public static class SearchPattern { public static string Contains(string term); } // escapes \ % _ with '\', wraps in %…%; use EF.Functions.Like(col, pattern, "\\")
  public static RouteGroupBuilder MapSection<TEntity, TDto, TFilter>(this IEndpointRouteBuilder app, string section)
      where TEntity : class, IEntity where TDto : ISectionDto<TEntity, TDto> where TFilter : ISectionFilter<TEntity>;
      // GET /api/{section}         ([AsParameters] TFilter) → Ok<TDto[]> ordered by Id
      // GET /api/{section}/{id:int} → Results<Ok<TDto>, NotFound>
      // .WithTags(section)
  ```
- Filters (records, `[AsParameters]`-bound, every property nullable):
  - `SkillFilter(Search, TypeId)`
  - `HeroicAbilityFilter(Search)`
  - `SpellFilter(Search, SchoolId, Rank, Kind SpellKind?)`
  - `EquipmentFilter(Search, CategoryId)`
  - `TreasureFilter(Search)`
  - `NameFilter<TEntity>(Search) where TEntity : class, INamedEntity`

  Search fields: Name plus Description, Effect or EffectText as appropriate per section.
- DTOs (records):
  - `SkillDto(Id, Name, Type, TypeId, Attribute, AttributeNote, Description)`
  - `HeroicAbilityDto(Id, Name, Prerequisite, Wp, Effect)`
  - `SpellDto(Id, Name, SchoolId, School, Rank, Kind, CastingTime, RequirementText, Description, Ranked RankedSpellDto?, Recipe RecipeDto?)`
    - `RankedSpellDto(Prerequisite, Range, Duration)`
    - `RecipeDto(CostPerDoseCopper, CostPerDoseUnit, Supply)`
  - `EquipmentItemDto(Id, CategoryId, Name, CostCopper, CostUnit, CostOrMore, CostText, Supply, Weight, Effect, Weapon WeaponDto?, Armour ArmourDto?)`
    - `WeaponDto(Grip, StrRequirement, Range, Damage, Durability, IsRanged, FeaturesText)`
    - `ArmourDto(Rating, IsHelmet)`
  - Lookup DTOs:
    - `EquipmentCategoryDto(Id, Name, NameHeader, EffectHeader, HasWeight, CanResell, Note)`
    - `MagicSchoolDto(Id, Name, Description, Note)`
    - `SkillTypeDto(Id, Name)`
    - `GlossaryDto(Id, Name, Description)`, used for `Supply`, `WeaponTerm` and `WeaponFeature` via three `ISectionDto` implementations or one generic `GlossaryDto<TEntity>`. Pick whichever compiles cleanly with static abstract members, and note the choice in DECISIONS.
  - `TreasureEntryDto(Id, Roll, Name, EffectText, Rolls TreasureRollDto[])`
    - `TreasureRollDto(Sequence, Label, DiceCount, DieSides, Modifier, Multiplier, Purpose, Coin string?, Outcomes TreasureOutcomeDto[])`
    - `TreasureOutcomeDto(Face, Label, ValueCopper, ValueText, EquipmentItemId, IsMastercrafted, MagicSchoolId, Rolls TreasureRollDto[])`
    - Nested rolls always have empty `Outcomes`.
  - `CurrencyRateDto(Name, CopperValue)` at `GET /api/currency-rates`.
- `Program.cs` route lines, one per section:
  - `skills`, `skill-types`, `heroic-abilities`
  - `spells`, `magic-schools`
  - `equipment`, `equipment-categories`, `supplies`, `weapon-terms`, `weapon-features`
  - `treasure`
- `Program.cs` host setup:
  - `AddProblemDetails()` and `AddOpenApi()`. Map OpenAPI at `/openapi/v1.json`.
  - `ConfigureHttpJsonOptions` adds `JsonStringEnumConverter`.
  - Bind options from section `Dragonbane` (`SourceMaterialPath`, `DatabasePath`), resolving relative paths against `ContentRootPath`.
  - Before `app.Run()`, call `SourceImporter.RebuildAsync`. Skip it when `Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider"`, which is build-time OpenAPI generation.
- csproj: `<OpenApiDocumentsDirectory>$(MSBuildProjectDirectory)/../../web/openapi</OpenApiDocumentsDirectory>`, `<OpenApiGenerateDocumentsOptions>--file-name Dragonbane.Api</OpenApiGenerateDocumentsOptions>`.
- `ApiFactory : WebApplicationFactory<Program>` points `Dragonbane:DatabasePath` at a fresh temp file and `Dragonbane:SourceMaterialPath` at `TestPaths.SourceMaterial`.

- [ ] **Step 1: Write failing tests** in `SectionEndpointTests` (an `IClassFixture<ApiFactory>`):
  ```csharp
  [Theory] [InlineData("skills",42)] [InlineData("heroic-abilities",44)] [InlineData("spells",316)] [InlineData("equipment",157)] [InlineData("treasure",40)] [InlineData("magic-schools",13)]
  async Task List_returns_all_rows(string section, int count)
  async Task Filters_skills_by_type()            // typeId of "Weapon" → 10 rows
  async Task Filters_spells_by_school_rank_kind()// kind=Trick → 38; schoolId(Alchemy)&kind=Recipe → 33; rank=6 → 10
  async Task Filters_equipment_by_category()     // categoryId(Melee weapons) → 29, first is "Unarmed"
  async Task Search_is_case_insensitive()        // skills?search=ACRO → ["Acrobatics"]; spells?search=dispel → contains "DISPEL"
  async Task Search_treats_wildcards_literally() // skills?search=% → 0 rows; skills?search=_ → 0 rows; heroic-abilities?search=round's → no 500
  async Task Unknown_id_returns_404()            // /api/spells/99999 → 404 with application/problem+json
  async Task Invalid_filter_returns_400()        // /api/spells?rank=abc → 400
  async Task Get_by_id_returns_typed_dto()       // equipment Dagger → Weapon.FeaturesText "Subtle, piercing, slashing, thrown", Armour null
  async Task Currency_rates_endpoint()           // [{Copper,1},{Silver,10},{Gold,100}]
  async Task Treasure_dto_nests_rolls()          // roll 36 → Rolls[0].Outcomes[5].Rolls[0].DiceCount == 3
  async Task OpenApi_lists_every_section()       // /openapi/v1.json contains "/api/skills/{id}", "/api/currency-rates", and enum value "Trick"
  ```
- [ ] **Step 2: Run** `dotnet test --filter SectionEndpointTests`. Expected: FAIL.
- [ ] **Step 3: Implement** `SourceImporter`, `SectionEndpoints`, the filters, the DTOs and `Program.cs`. Add `public partial class Program;` for the factory.
- [ ] **Step 4: Run** `dotnet test`. Expected: all PASS.
- [ ] **Step 5: Run** `dotnet build src/Dragonbane.Api`. Expected: `web/openapi/Dragonbane.Api.json` exists and the build did not run the importer (no `.db` created by the build).
- [ ] **Step 6: Manual check.** Run `dotnet run --project src/Dragonbane.Api`, then fetch `GET /api/treasure/31` and confirm JSON enums are strings.
- [ ] **Step 7: DECISIONS.md:** *Rebuild DB from markdown on every start (no migrations, no change detection; ~900 rows import in well under a second)*, *MapSection takes a third type parameter for typed filters*, *LIKE with escaping instead of FTS5*, *Build-time OpenAPI document*, *No paging (max 316 rows)*.
- [ ] **Step 8: Update CLAUDE.md commands** (`dotnet test`, `dotnet run --project src/Dragonbane.Api`).
- [ ] **Step 9: Commit** `feat(api): generic section endpoints with OpenAPI`.

---

## Phase B: Front end

> Before every UI task, load skill `anthropic-skills:dragonbane-parchment-style` and follow it.

### Task 8: Angular scaffold, API types, shell, coin standard

**Files:**
- Create:
  - `web/` via `npx @angular/cli@22 new web --style=scss --routing --ssr=false --skip-git`
  - `web/proxy.conf.json` (`/api` → `http://localhost:5080`)
  - `web/src/app/api/models.ts`
  - `web/src/app/core/coin-standard.store.ts` (+ `.spec.ts`)
  - `web/src/app/core/currency-rates.ts`
  - `web/src/app/app.ts`, `app.html`, `app.scss`, `app.routes.ts`
  - placeholder pages under `features/`
- Modify:
  - `src/Dragonbane.Api/Properties/launchSettings.json` (http port 5080)
  - `web/package.json` scripts: `"gen:api": "openapi-typescript openapi/Dragonbane.Api.json -o src/app/api/schema.d.ts"`, and `"start"` with `--proxy-config proxy.conf.json`
  - `web/angular.json` (proxy)

**Interfaces:**
- Produces:
  ```ts
  // api/models.ts — aliases only, e.g.
  export type SkillDto = components['schemas']['SkillDto'];   // likewise every DTO from Task 7
  export type CoinStandard = 'written' | 'copper' | 'silver' | 'gold';
  @Injectable({ providedIn: 'root' }) export class CoinStandardStore {
    readonly standard: Signal<CoinStandard>;   // default 'gold'
    set(value: CoinStandard): void;            // persists to localStorage key 'dragonbane.coinStandard'; read/write wrapped in try/catch
  }
  export interface CurrencyRates { readonly copper: number; readonly silver: number; readonly gold: number } // copper per coin
  @Injectable({ providedIn: 'root' }) export class CurrencyRatesService {
    readonly rates: Signal<CurrencyRates | undefined>; // httpResource('/api/currency-rates') mapped by Name
  }
  ```
- Routes:
  - `''` → redirect to `skills`
  - `skills`, `heroic-abilities`, `spells`, `equipment`, `treasure`: lazy `loadComponent`
- App config: `provideRouter(routes, withComponentInputBinding())`, `provideHttpClient(withFetch())`, zoneless (CLI default).
- Shell layout:
  - Header: app title, `<nav>` with the five links (`routerLinkActive` + `aria-current`), and a labelled `<select>` "Coin standard" bound to the store.
  - `<main>` holding the `<router-outlet>`.
  - Parchment styling: fonts (Cinzel Decorative, Crimson Pro) are loaded in `index.html`.

- [ ] **Step 1: Scaffold.** Generate the app, install `openapi-typescript` as a dev dependency, then `npm run gen:api`. Expected: `src/app/api/schema.d.ts` is created.
- [ ] **Step 2: Write failing tests** in `coin-standard.store.spec.ts`:
  ```ts
  it('defaults to gold')
  it('persists and restores the choice')                // set('silver'); new instance via TestBed.resetTestingModule → 'silver'
  it('CoinStandardStore survives throwing storage')     // vi.spyOn(Storage.prototype,'getItem'/'setItem').mockImplementation(() => { throw new Error() }) → standard() === 'gold'; set('copper') does not throw and updates the signal
  it('ignores an invalid stored value')                 // stored 'platinum' → 'gold'
  ```
- [ ] **Step 3: Run** `cd web && npx ng test --watch=false`. Expected: FAIL.
- [ ] **Step 4: Implement** the store, the rates service, the shell, the routes and placeholder pages (heading only).
- [ ] **Step 5: Run** `npx ng test --watch=false && npx ng build`. Expected: PASS, build OK.
- [ ] **Step 6: Manual check.** Start the API and `npm start`. Header renders, nav works, and the standard survives a reload.
- [ ] **Step 7: DECISIONS.md:** *Zoneless + signals + httpResource*, *openapi-typescript types only (no generated client)*, *Dev proxy instead of CORS*, *Coin standard in localStorage with safe fallback*.
- [ ] **Step 8: Update CLAUDE.md** with the web commands (`npm start`, `npx ng test --watch=false`, `npm run gen:api`).
- [ ] **Step 9: Commit** `feat(web): scaffold Angular shell with coin standard`.

### Task 9: Money logic (coins, pricing, mastercraft)

**Files:**
- Create: `web/src/app/money/coins.ts`, `pricing.ts`, `mastercraft.ts` (+ `.spec.ts` each)

**Interfaces:**
- Consumes: `CurrencyRates`, `CoinStandard`.
- Produces:
  ```ts
  /** Exact copper → whole copper for display: floor, minimum 1. The only rounding in the app. */
  export function toDisplayCopper(exactCopper: number): number;
  /** Whole copper in a standard. 'written' is treated as 'gold' (caller handles as-written text). */
  export function formatCoins(copper: number, standard: CoinStandard, rates: CurrencyRates): string;
  export type TradeMode = 'buy' | 'sell';
  export type SellRate = 100 | 50 | 20 | 10;
  export type BarterResult = 'none' | 'success' | 'dragon';
  export interface PriceOptions { mode: TradeMode; sellRate: SellRate; barter: BarterResult }
  export const BASE_PRICE: PriceOptions; // { mode:'buy', sellRate:100, barter:'none' }
  /** Exact (possibly fractional) copper, or null when there is no price or it cannot be sold. One integer division by 10_000. */
  export function quote(baseCopper: number | null, canResell: boolean, options: PriceOptions): number | null;
  export function isBasePrice(options: PriceOptions): boolean;
  /** Full display text: as-written CostText when standard 'written' and base price, else formatCoins(toDisplayCopper(exact)) + unit + ' or more'. Null exact → '—'. */
  export function formatPrice(exactCopper: number | null, standard: CoinStandard, rates: CurrencyRates,
      cost: { costText: string; costUnit: string | null; costOrMore: boolean }, isBase: boolean): string;
  export interface WeaponStats { costCopper: number | null; strRequirement: number | null; durability: number | null }
  /** ×10 cost, STR −3 (≤0 → null, null stays null), durability +3 (null stays null). */
  export function mastercraft(stats: WeaponStats): WeaponStats;
  ```
  Factors: sell rate %, barter % (buy: success 80, dragon 50; sell: success 120, dragon 200; none 100). `quote = base * ratePct * barterPct / 10_000`, where buy always uses rate 100.

- [ ] **Step 1: Write failing tests** with `rates = {copper:1, silver:10, gold:100}`:
  ```ts
  // coins.spec.ts
  expect(formatCoins(1255,'copper',r)).toBe('1255 copper');
  expect(formatCoins(1255,'silver',r)).toBe('125 silver 5 copper');
  expect(formatCoins(1255,'gold',r)).toBe('12 gold 5 silver 5 copper');
  expect(formatCoins(1205,'gold',r)).toBe('12 gold 5 copper');
  expect(formatCoins(1200,'written',r)).toBe('12 gold');
  expect(formatCoins(1200,'gold',{copper:1,silver:20,gold:200})).toBe('6 gold'); // uses rates, not constants
  // pricing.spec.ts
  expect(quote(1200,true,BASE_PRICE)).toBe(1200);
  expect(quote(1200,true,{mode:'sell',sellRate:50,barter:'none'})).toBe(600);
  expect(quote(1255,true,{mode:'sell',sellRate:20,barter:'success'})).toBeCloseTo(301.2);
  expect(quote(1200,true,{mode:'buy',sellRate:10,barter:'success'})).toBe(960);   // sell rate ignored when buying
  expect(quote(1200,true,{mode:'buy',sellRate:100,barter:'dragon'})).toBe(600);
  expect(quote(1200,true,{mode:'sell',sellRate:100,barter:'dragon'})).toBe(2400);
  expect(quote(null,true,BASE_PRICE)).toBeNull();
  expect(quote(50,false,{mode:'sell',sellRate:100,barter:'none'})).toBeNull();     // services
  it('quote floors only at display, minimum 1')  // toDisplayCopper(quote(1,true,{sell,10,none})!) === 1; toDisplayCopper(quote(1,true,{sell,10,success})!) === 1; toDisplayCopper(301.2) === 301
  it('formatPrice keeps unit and or-more')       // Teacher {costText:'5 gold/shift or more', costUnit:'/shift', costOrMore:true}, sell 50 dragon, gold → '5 gold/shift or more'; written+base → '5 gold/shift or more' (CostText); written+calculated → gold fallback
  it('formatPrice shows dash for null')          // → '—'
  // mastercraft.spec.ts
  expect(mastercraft({costCopper:1000,strRequirement:13,durability:9})).toEqual({costCopper:10000,strRequirement:10,durability:12});
  expect(mastercraft({costCopper:100,strRequirement:null,durability:9})).toEqual({costCopper:1000,strRequirement:null,durability:12}); // Dagger
  expect(mastercraft({costCopper:1600,strRequirement:13,durability:null}).durability).toBeNull();                                    // Flail
  ```
- [ ] **Step 2: Run** `npx ng test --watch=false`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx ng test --watch=false`. Expected: PASS.
- [ ] **Step 5: DECISIONS.md:** *Business logic as pure functions (DI only where state or RNG is involved)*, *Exact copper with a single integer division; floor only in `toDisplayCopper`*.
- [ ] **Step 6: Commit** `feat(web): coin, pricing and mastercraft logic`.

### Task 10: Dice and treasure resolution

**Files:**
- Create: `web/src/app/dice/dice-roller.ts`, `dice/seeded-random.ts`, `treasure/treasure-resolver.ts`, `treasure/dice-format.ts` (+ `.spec.ts` each)

**Interfaces:**
- Consumes: `TreasureEntryDto`, `TreasureRollDto`, `TreasureOutcomeDto` (Task 8 aliases), `CurrencyRates`.
- Produces:
  ```ts
  export const RANDOM = new InjectionToken<() => number>('RANDOM', { factory: () => Math.random });
  export function seededRandom(seed: number): () => number;                 // mulberry32
  @Injectable({ providedIn: 'root' }) export class DiceRoller { roll(count: number, sides: number): number[] } // each 1..sides
  export interface RolledDice { count: number; sides: number; faces: number[]; modifier: number; multiplier: number; total: number } // total = (sum+modifier)*multiplier
  export function rollDice(roller: DiceRoller, count: number, sides: number, modifier?: number, multiplier?: number): RolledDice;
  export function describeDice(d: RolledDice): string;
  export interface ResolvedRoll { spec: TreasureRollDto; dice: RolledDice; outcome: TreasureOutcomeDto | null; valueCopper: number | null; nested: ResolvedRoll[] }
  export interface TreasureResult { entry: TreasureEntryDto; d40: RolledDice | null; rolls: ResolvedRoll[] }
  export function resolveEntry(entry: TreasureEntryDto, roller: DiceRoller, rates: CurrencyRates): TreasureResult;
  export function rollTreasure(entries: readonly TreasureEntryDto[], roller: DiceRoller, rates: CurrencyRates): TreasureResult; // D40 picks entry by Roll
  ```
  Resolution rules:
  - `Coins`: `valueCopper = total × rates[coin]`.
  - `Pick`: `outcome = outcomes.find(o => o.face === total)`. `valueCopper = outcome.valueCopper`. `nested` resolves `outcome.rolls`.
  - `Number` and `SpellRank`: just the dice.

- [ ] **Step 1: Write failing tests:**
  ```ts
  // dice-format.spec.ts — build RolledDice literals
  'D6 → 4'                                  // 1D6
  '2D6 → 3 + 4 = 7'                         // 2D6
  '2D6 → 3 + 4 = 7 × 10 = 70'               // ×10
  'D6 → 4 × 5 = 20'
  'D4-1 → 3 - 1 = 2'
  // dice-roller.spec.ts
  it('is deterministic with a seeded RANDOM')   // TestBed provide {provide: RANDOM, useValue: seededRandom(42)} twice → identical sequences
  it('stays in range')                          // 10_000 rolls of D6 ⊂ [1..6], every face seen
  // treasure-resolver.spec.ts — fake roller returning queued faces
  it('resolves coins via rates')                // entry 10 (2D6×10 Silver), faces [3,4] → total 70, valueCopper 700
  it('resolves a pick list')                    // entry 30, face [2] → outcome.label 'short bow', equipmentItemId set
  it('resolves gem value')                      // entry 26, face [5] → valueCopper 2500
  it('resolves nested healing roll')            // entry 36, faces [6, 2,3,4] → outcome 6, nested[0].dice.total 9
  it('resolves grimoire rank with modifier')    // entry 35, faces [1, 1, 3] → school outcome 1, rank total 0, count 3
  it('text-only entry has no rolls')            // entry 37 → rolls []
  it('rolls D40 to pick the entry')             // faces [26, …] → entry.roll 26, d40.total 26
  ```
  Fixture: one `treasure.fixture.ts` with hand-built DTOs for entries 10, 26, 30, 35, 36, 37, using the shapes from Task 7.
- [ ] **Step 2: Run** `npx ng test --watch=false`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx ng test --watch=false`. Expected: PASS.
- [ ] **Step 5: DECISIONS.md:** *Injectable RANDOM token with mulberry32 for seeding*.
- [ ] **Step 6: Commit** `feat(web): dice roller and treasure resolver`.

### Task 11: Skills and Heroic Abilities pages, shared search box

**Files:**
- Create: `web/src/app/shared/search-box.ts`, `features/skills/skills.page.ts` (+ html/scss), `features/heroic-abilities/heroic-abilities.page.ts` (+ html/scss), `features/skills/skills.page.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  @Component({ selector: 'app-search-box' }) export class SearchBox {
    readonly label = input.required<string>();
    readonly value = model<string>('');        // emits debounced (250 ms) changes
  }
  ```
  Page pattern, reused by Tasks 12–14:
  - Filters are component `input()`s bound from query params via `withComponentInputBinding`.
  - Changes call `router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true })`.
  - Data comes from `httpResource<XDto[]>(() => ({ url: '/api/x', params: definedOnly({...}) }))`.
  - The page renders a semantic `<table>` with `<caption>` and `<th scope="col">`, the same columns as the source, plus loading and error states.
- Skills:
  - Columns: Name, Type, Attribute (shown as `CHA (uses PERFORMANCE)` when a note exists), Description.
  - Type filter is a radio group "All / Core / Weapon / Secondary" from `/api/skill-types`, query param `typeId`.
- Heroic Abilities: columns Ability, Prerequisite, WP, Effect. Search only.
- Multi-line cells use `white-space: pre-line`.

- [ ] **Step 1: Write failing test** `skills.page.spec.ts` using `provideHttpClientTesting`:
  - Flushes `/api/skill-types` and `/api/skills`.
  - Asserts the table renders 2 rows and the Attribute cell `CHA (uses PERFORMANCE)`.
  - Setting input `typeId=2` issues a request with `typeId=2`.
- [ ] **Step 2: Run** `npx ng test --watch=false`. Expected: FAIL.
- [ ] **Step 3: Implement** SearchBox and both pages.
- [ ] **Step 4: Run** `npx ng test --watch=false && npx ng build`. Expected: PASS.
- [ ] **Step 5: Manual check** against the running API. Search `bart` shows Bartering. The filter survives a reload (query param).
- [ ] **Step 6: Commit** `feat(web): skills and heroic abilities sections`.

### Task 12: Spells page

**Files:**
- Create: `features/spells/spells.page.ts` (+ html/scss/spec)

**Interfaces:**
- Consumes: `SpellDto`, `MagicSchoolDto`, page pattern from Task 11.
- Behaviour:
  - Filters (query params): `schoolId` (select from `/api/magic-schools`), `rank` (select 0–6), `kind` (radio All / Trick / Spell / Recipe).
  - Results are grouped by school, then by kind, matching the source's sub-tables: "<School> Magic Tricks", "<School> Spells", "Alchemy Recipes".
  - Trick tables show Name, Casting Time, Requirement, Description. Spell and recipe tables show Name, Rank, Prerequisite, Requirement, Casting Time, Range, Duration, Description.
  - A school's `Note` is shown above its tables.
  - A collapsible "Schools of Magic" glossary (`<details>`) lists name and description for all schools.

- [ ] **Step 1: Write failing tests:**
  - `renders trick table with Action and Gesture`.
  - `query params drive request`: inputs `schoolId=3, rank=0` produce a request with both.
  - `groups by school then kind`: fixture of 3 spells across 2 schools produces 3 `<table>` captions in order.
- [ ] **Step 2: Run** `npx ng test --watch=false`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx ng test --watch=false && npx ng build`. Expected: PASS.
- [ ] **Step 5: Manual check.** `/spells?schoolId=<Animism>&rank=0` shows Animism tricks only.
- [ ] **Step 6: Commit** `feat(web): spells section with school/rank/kind filters`.

### Task 13: Equipment page with pricing controls

**Files:**
- Create: `features/equipment/equipment.page.ts` (+ html/scss/spec), `features/equipment/price-controls.ts` (+ html)

**Interfaces:**
- Consumes: `EquipmentItemDto`, `EquipmentCategoryDto`, the glossary DTOs, `quote`/`formatPrice`/`isBasePrice`/`mastercraft` (Task 9), `CoinStandardStore`, `CurrencyRatesService`.
- Produces:
  ```ts
  @Component({ selector: 'app-price-controls' }) export class PriceControls {
    readonly options = model.required<PriceOptions>();   // Buy/Sell radio; Sell rate select (100/50/20/10, shown only in Sell); Bartering checkbox → None/Success/Dragon radio (reset to 'none' when unchecked)
  }
  ```
- Behaviour:
  - The category filter (`categoryId`, select) and search use the Task 11 pattern.
  - One `<table>` per category, in category order. Caption is the category name. Columns come from `EquipmentCategoryDto`:
    - Weapons: Name, Grip, STR, Range, Damage, Durability, Cost, Supply, Features.
    - Armour: Name, Rating (`+N` when `isHelmet`), Cost, Supply, Effect.
    - Others: `NameHeader`, Cost, Supply, Weight (if `hasWeight`), `EffectHeader`.
  - Cost cells use `formatPrice(quote(item.costCopper, category.canResell, options), standard, rates, item, isBasePrice(options))`.
  - Each weapon row has a "Mastercrafted" disclosure button (`aria-expanded`). It reveals a sub-row with the mastercrafted STR, Durability and price, priced through the same pipeline with `mastercraft(...).costCopper`. That price is never `written`, because `isBase` is false.
  - The category `Note` (mastercrafted rule) appears under the Melee weapons table.
  - Glossaries `Supply and Weapon Terms` (supplies then weapon terms) and `Weapon Features` render in `<details>` blocks.
  - The Currency Exchange table is never rendered.
  - Price options live in a page-level `signal<PriceOptions>(BASE_PRICE)`.

- [ ] **Step 1: Write failing tests:**
  - `sell 50% halves price`: Dagger 100 copper, sell 50 → cell `5 silver` (gold standard).
  - `services show dash when selling`: Inn bath in Sell mode → `—`.
  - `written standard shows CostText for base price only`: base → `1 gold`; sell 50 → `5 silver`.
  - `mastercrafted row`: Battleaxe → STR `10`, Durability `12`, price `100 gold`.
  - `never renders currency exchange`: the page text does not contain `Currency Exchange`.
  - `bartering toggle resets result`: check → Success → uncheck → options barter `none`.
- [ ] **Step 2: Run** `npx ng test --watch=false`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx ng test --watch=false && npx ng build`. Expected: PASS.
- [ ] **Step 5: Manual check** against the API at 1280 px and 375 px. Tables scroll horizontally inside their own container, never the page.
- [ ] **Step 6: Commit** `feat(web): equipment section with buy/sell, bartering and mastercrafted`.

### Task 14: Treasure page

**Files:**
- Create: `features/treasure/treasure.page.ts` (+ html/scss/spec), `features/treasure/treasure-result.ts` (+ html)

**Interfaces:**
- Consumes: `resolveEntry`, `rollTreasure`, `describeDice` (Task 10), `formatCoins`/`toDisplayCopper`/`formatPrice`/`mastercraft`/`BASE_PRICE` (Task 9), `/api/treasure`, `/api/equipment` (all items, for the id → item map), `/api/magic-schools`.
- Behaviour:
  - Show the full 40-row table: Roll, Treasure, Value or Effect. Search filters it.
  - A "Roll Treasure" button rolls D40. Each row has a "Roll" button with `aria-label="Roll <Name> (<Roll>)"`.
  - Results appear in one `aria-live="polite"` region, which shows the latest result only (no history).
  - Result lines:
    - D40 line: `D40 → 26: Gemstone`.
    - Coin rolls: `describeDice + ' ' + coin.toLowerCase()`, plus ` (<formatCoins(value, standard)>)` when the standard ≠ `written`. Example: `2D6 → 3 + 4 = 7 × 10 = 70 silver (7 gold)`.
    - Pick rolls: `describeDice: <label>`. Then:
      - Gem value: `ValueText` when `written`, else `formatCoins`.
      - Equipment link: `routerLink /equipment` with `queryParams {categoryId, search: name}`, and base price via `formatPrice(…, isBase true)`. If mastercrafted, the link text is prefixed "Mastercrafted" and the price is `mastercraft(...)` (isBase false).
      - School outcome: shown as text.
    - Number rolls: `describeDice <label>`, e.g. `D6 → 4 damage`.
    - Entry 35: a link "Show matching spells" → `/spells?schoolId=<school>&rank=<rank>`, with `kind=Trick` instead of rank when rank is 0.
    - Effect text from the entry is always shown above the dice lines.
  - Found coin and gem values are never affected by equipment price options.

- [ ] **Step 1: Write failing tests** with `{provide: RANDOM, useValue: queued faces}`:
  - `roll button resolves row 10`: faces [3,4] → text contains `2D6 → 3 + 4 = 7 × 10 = 70 silver`.
  - `gold standard adds conversion`: same with standard gold → `(7 gold)`.
  - `mastercrafted result links and prices`: row 31, face [3] → link text `Mastercrafted Battleaxe`, price `100 gold`.
  - `grimoire links filtered spells`: row 35, faces [1,1,3] → href contains `kind=Trick` and `schoolId=`.
  - `live region holds only latest result`: two rolls → one result.
- [ ] **Step 2: Run** `npx ng test --watch=false`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx ng test --watch=false && npx ng build`. Expected: PASS.
- [ ] **Step 5: Manual check.** Roll D40 about 10 times against the live API. Every result renders without console errors.
- [ ] **Step 6: Commit** `feat(web): treasure section with transparent dice rolls`.

### Task 15: Accessibility end-to-end checks and wrap-up

**Files:**
- Create: `web/playwright.config.ts`, `web/e2e/a11y.spec.ts`
- Modify: `web/package.json` (`"e2e": "playwright test"`), `CLAUDE.md` (e2e command, remove "Pre-code"), `DECISIONS.md`

**Interfaces:**
- Playwright `webServer`: `[ { command: 'dotnet run --project ../src/Dragonbane.Api -- import && dotnet run --project ../src/Dragonbane.Api', url: 'http://localhost:5080/api/currency-rates' }, { command: 'npm start', url: 'http://localhost:4200' } ]`, with `reuseExistingServer: true`.

- [ ] **Step 1: Install** `@playwright/test` and `@axe-core/playwright` as dev dependencies, then run `npx playwright install chromium`.
- [ ] **Step 2: Write tests** in `a11y.spec.ts`:
  - For each route `/skills`, `/heroic-abilities`, `/spells`, `/equipment`, `/treasure`, at viewports 1280×800 and 375×812:
    - wait for the first `table`
    - run `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()` and expect `violations` to equal `[]`
    - expect `document.documentElement.scrollWidth <= innerWidth`
  - `equipment controls by keyboard`: Tab to Sell, Space, then the sell-rate select becomes visible and focusable.
  - `treasure roll announces`: click "Roll Treasure", then the live region is non-empty.
- [ ] **Step 3: Run** `npm run e2e`. Expected: either all pass or violations listed. Fix each violation at its source component, especially parchment colour contrast. Re-run until it passes.
- [ ] **Step 4: Full verification:** `dotnet test` (all PASS), then `cd web && npx ng test --watch=false && npx ng build && npm run e2e` (all PASS).
- [ ] **Step 5: DECISIONS.md:** *Playwright + axe for AXE-clean gate*, then review the log so every task's decisions are present.
- [ ] **Step 6: Commit** `test(web): axe accessibility and responsive checks`.
