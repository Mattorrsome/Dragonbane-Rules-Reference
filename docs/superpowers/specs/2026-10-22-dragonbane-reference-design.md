# Dragonbane Reference — Design

## Intent

A web app that serves two purposes at once:

1. **A lookup tool used at the gaming table** (mainly on a laptop) for the Dragonbane RPG: skills, heroic abilities, spells, equipment and treasure, with search, filtering, price calculation and treasure rolling.
2. **A showcase / reference implementation** of current Angular + ASP.NET best practices. Code quality, structure, tests and documented decisions matter as much as the features.

Every significant technical decision is recorded with its reasoning in `C:\Projects\Dragonbane\DECISIONS.md` (one short entry per decision: context, decision, alternatives considered, why).

## Source data

Markdown files in `C:\Projects\Dragonbane\Source Material\`:

| File | Section |
| --- | --- |
| `Dragonbane_Skills_Table.md` | Skills |
| `Dragonbane_Heroic_Abilities_Table.md` | Heroic Abilities |
| `Dragonbane_Spell_Tables.md` | Spells |
| `Dragonbane_Equipment_Tables.md` | Equipment |
| `Dragonbane_Treasure_Table.md` | Treasure |

`Dragonbane_NPC_Table.md` was excluded here; since 2026-10-27 it is imported for the NPC Manager (see `2026-10-27-npc-manager-and-feedback-design.md`).

The markdown files are the source of truth for display data. An importer loads them into the database; data is never edited in two places. (More sections may be added later — "5 for now" — so adding a section should follow an obvious repeatable pattern.)

## Goals

### All sections
- View each section's tables as-is (same columns as the source).
- Text search within the current section (names and descriptions, case-insensitive).
- Filter by the section's sub-tables:
  - Skills: type (Core / Weapon / Magic).
  - Heroic Abilities: none beyond search.
  - Spells: school, rank, kind (magic trick / spell / recipe). Tricks are rank 0. Trick tables additionally display their casting time (1 action) and requirement (gesture).
  - Equipment: category (Armour and helmets, Melee weapons, Ranged weapons, Clothes, …).
  - Treasure: none beyond search.
- Reference/glossary tables (Supply and Weapon Terms, Weapon Features, Schools of Magic) are viewable in their section.

### Money
- All money is stored as an integer **copper** value, alongside the original `Cost` text from the source.
- Every calculation is done in copper. Rounding happens **only once, at display**, always **rounding down**, never showing less than 1 copper.
- The **Currency Exchange** table (copper/silver/gold rates) is stored in the DB and used by the front end for conversion, but is **never displayed**.
- A global **coin standard** toggle in the app header, remembered between visits (per-browser storage):
  - **As written** — show the source `Cost` text (e.g. `12 gold`). Only meaningful for unmodified base prices; once a price is calculated it falls back to Gold standard. *(my call)*
  - **Copper standard** — everything in copper: `1255 copper`.
  - **Silver standard** — silver plus copper remainder: `125 silver 5 copper`.
  - **Gold standard** — gold, then silver, then copper remainder: `12 gold 5 silver 5 copper`.
  - Zero-value denominations are omitted (`12 gold 5 copper`).

### Equipment pricing
- A **Buy / Sell** mode switch for the section.
- In Sell mode, a **sell rate** selector: 100%, 50%, 20%, 10% of base cost. *(my call: one selector for the whole section rather than per row)*
- Buying is always at 100% of base cost. *(my call, confirmed by silence)*
- A **Bartering** toggle. When on, a three-state result selector appears: **None / Success / Dragon**.
  - Success: buying price −20%; selling price +20%.
  - Dragon: buying price halved; selling price doubled. (Dragon on a full-rate sale = 2× base cost. Intended.)
  - Demon result is out of scope.
- Calculation order: base copper → sell rate → bartering → coin standard → round down. *(my call)*
- Items with no cost (`-`, e.g. Unarmed) show no price and are unaffected.
- Per-unit costs (`200/day`, `10/km`, `500/shift or more`): store the per-unit copper value plus the unit suffix; apply the same calculation and display with the suffix (and "or more" where present). *(my call)*
- Sell mode does not apply to Services (they cannot be resold); those rows show "—" in Sell mode. *(my call)*
- **Mastercrafted** variants of weapons (melee and ranged): cost ×10, STR requirement −3 (minimum: none), Durability +3. Shown as a toggle/expander on each weapon row and used by treasure results. Rule text: "A mastercrafted version costs 10 times normal, reduces STR requirement by 3 and increases Durability by 3." This sentence is in the source (`Dragonbane_Equipment_Tables.md`, under Melee weapons); display it from there. The ×10 / −3 / +3 numbers live in the front-end calculation.
- Buy/Sell mode, sell rate and bartering are **Equipment-only** controls held in that section's state. Treasure results show **base** prices (and base mastercrafted prices) in the current coin standard; found coins and gemstones are never affected by Buy/Sell or bartering. *(my call)*

### Treasure
- Show the full 40-row table.
- **Roll Treasure** button: rolls D40 to pick a row, then resolves its effect.
- Each row can also be rolled individually.
- Results show the dice transparently, e.g. `2D6 → 3 + 4 = 7 × 10 = 70 silver`.
- Effect types to support (from the actual data):
  - **Coins**: `xD6 [x m] <coin>` → dice total × multiplier, converted to copper, shown in the current coin standard. `D6` means 1D6.
  - **Pick list**: `D6: a, b, c, d, e, f` → roll, pick the nth item. Item results link to their Equipment entry (with price).
  - **Pick list with values**: Gemstone (`D6: glass 2 copper; crystal 10 silver; …`) — semicolon-separated, each option has its own value.
  - **Mastercrafted weapon**: pick list whose result shows the mastercrafted variant and price.
  - **Nested rolls**: e.g. Bottle → healing potion `2D6 HP`; Poison dagger → `D3 type`; Grimoire → `D4` school, `D4-1` rank (0 = tricks), `D4` number of spells (GM chooses spells — results may link to a pre-filtered Spells view).
  - **Damage**: Rat (`D4`), Rusty nail (`D6`) — roll and show the number with the text.
  - **Text only**: Book — show text, nothing to roll.
- Treasure roll structure is **stored as structured data**, not parsed from the effect text at runtime. *(my call: the importer reads display text from the markdown; dice specs/outcomes come from a hand-curated structured seed keyed by roll number, because the effect text is too inconsistent to parse reliably)*
- No roll history. *(my call)*

### Front end
- Laptop-first; must remain usable on a phone (responsive), but mobile is not the focus.
- Visual style: the Dragonbane "parchment scroll" look (use the `anthropic-skills:dragonbane-parchment-style` skill) — green bands, torn-edge parchment, Cinzel Decorative / Colus display titles, Crimson Pro body, dragon-red flourishes.

## Architecture decisions made with the user

- **Angular front end + ASP.NET Web API back end**, latest stable versions at build time (.NET 10 LTS; current Angular with standalone components and signals).
- **Business logic lives in the front end**: pricing, coin conversion, bartering, mastercrafted variants, dice rolling and treasure resolution are pure TypeScript services with unit tests.
- **The API is as generic as possible**: it serves data only. Same pattern per section, e.g. `GET /api/{section}?search=&filter=…` and `GET /api/{section}/{id}`, plus an endpoint for the currency exchange rates. Responses are typed per section (not untyped rows) and the TypeScript models are generated from the API's OpenAPI description. *(my call, reconciling "generic" with typed models)*: one generic registration helper (e.g. `MapSection<TEntity, TDto>("skills")`) produces each section's concrete, typed routes, so OpenAPI describes every section cleanly while there is no per-section controller code. Adding a section = markdown file + entity/DTO + importer mapping + one `MapSection` line.
- **Database: SQLite** via EF Core. Data is small (~900 rows), read-only, and rarely changes; SQLite needs no server. *(my recommendation; user was open to SQLite or Postgres)*
- **Schema shape: normalised, designed for the data, not for the front end.** Where one table would hold several kinds of thing, use a **supertype + subtypes** mapped with EF Core **table-per-type (TPT)** inheritance. Subtype tables share the supertype's primary key (PK and FK, 1:1), so the structure itself prevents a row having attributes that don't apply to its kind. Not a generic table/row/cell model, no JSON property bags.

  **Magic**
  ```
  MagicSchool       (Id, Name, Description)
  Spell             (Id, SchoolId FK, Name, Rank, Kind, CastingTime, Description)  -- supertype: tricks, spells, recipes
  RankedSpell       (SpellId PK/FK, Prerequisite, Range, Duration)                 -- spells + recipes (rank ≥ 1)
  Recipe            (SpellId PK/FK → RankedSpell, CostPerDoseCopper, SupplyId FK)  -- Alchemy recipes
  Requirement       (Id, Name)                      -- Word, Gesture, Focus, ingredient, …
  SpellRequirement  (SpellId, RequirementId)        -- multi-valued "Word, gesture" → junction
  ```
  - `Kind` is the discriminator: Trick / Spell / Recipe. Tricks are rank 0 and have no `RankedSpell` row.
  - **Magic tricks: casting time is 1 action and they require a gesture.** This rule is supplied by the user (not in the source files); the importer applies it to every trick.
  - `Prerequisite`, `Range` and `Duration` stay as text. Prerequisites mix spells, skills and "any school" with OR logic; range/duration vary by power level ("Shift; week at PL 2; year at PL 3"). Each is still a single value, so normal form holds; modelling them further is not worth it. Record this in `DECISIONS.md`.
  - Alchemy cost per dose is parsed out of the recipe description into `Recipe.CostPerDoseCopper` (stored, not priced in the UI; see non-goals).

  **Equipment**
  ```
  EquipmentCategory (Id, Name, SortOrder)
  Supply            (Id, Name, Description)        -- Common/Uncommon/Rare/Unique, from the Supply and Weapon Terms glossary
  EquipmentItem     (Id, CategoryId FK, Name, CostCopper?, CostUnit?, CostOrMore, CostText, SupplyId FK?, Weight?, Effect?)  -- supertype
  Weapon            (ItemId PK/FK, Grip, StrRequirement?, Range, Damage, Durability?, IsRanged)
  Armour            (ItemId PK/FK, Rating, IsHelmet)            -- helmets show rating as "+N"
  WeaponFeature     (Id, Name, Description)        -- Subtle, Long, Toppling, Piercing, …, from the Weapon Features glossary
  WeaponWeaponFeature (WeaponId, FeatureId)        -- "Piercing, slashing" → junction
  ```
  - Weapon notes that aren't glossary features ("requires quiver", "no damage bonus", "tiny item") are kept in `Effect` text. *(my call)*
  - `Weight` and `Effect` stay nullable on the supertype: they're common to most categories and absent from a few, which doesn't justify a subtype. *(my call)*
  - Columns named differently per source table ("Musician effect", "Capacity/effect", "Effect/capacity", "Capacity") map to `Effect`; the original header is kept per category for display. *(my call)*

  **Other sections:** `Skill` (with `Attribute` and skill-type lookups), `HeroicAbility`, `TreasureEntry` with child `TreasureOutcome` rows holding dice specs, `CurrencyRate`.

## Non-goals
- NPC table (reversed 2026-10-27: see `2026-10-27-npc-manager-and-feedback-design.md`).
- Demon bartering result.
- Search across all sections at once.
- Offline use / PWA / service worker — a network connection can be assumed.
- Treasure roll history.
- Editing data in the app; user accounts / auth.
- Pricing Alchemy recipe "cost per dose" (left as description text).
- Hosting/deployment — will be decided later. Keep configuration environment-driven so hosting is not blocked, but build nothing hosting-specific now.

## Anti-goals (would be failures even if it "works")
- Rounding before the final display step, or showing fractions of a copper.
- Displaying the Currency Exchange table.
- Parsing treasure effect text at runtime with fragile string logic.
- Duplicating data by hand outside the markdown sources (other than the curated treasure roll specs and the user-supplied magic trick rule).
- Showcase quality gaps: untested calculation logic, undocumented decisions.

## Left to the builder
- Exact Angular and .NET project structure, state management approach, UI component library (if any) consistent with the parchment style.
- Search implementation (e.g. SQLite FTS5 vs simple case-insensitive matching).
- ~~When the importer runs~~ — decided by the user (2026-10-22): an explicit import command builds the SQLite file locally; the API serves it read-only and the file is deployed to servers. No change detection.
- Random number source for dice (must be injectable/seedable for tests).
- Testing tools and depth beyond: unit tests for all pricing/coin/dice/treasure logic, API tests for the endpoints.
- Folder layout for the solution, as long as `DECISIONS.md` sits at `C:\Projects\Dragonbane\`.
