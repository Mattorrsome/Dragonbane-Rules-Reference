# Decisions

One entry per significant technical decision. Template:

```
## <Title> (YYYY-MM-DD)
- Context:
- Decision:
- Alternatives:
- Why:
```

## Minimal APIs over controllers (2026-10-22)
- Context: Five read-only sections with identical list/detail shapes.
- Decision: ASP.NET Core minimal APIs; one generic `MapSection` helper maps every section.
- Alternatives: MVC controllers per section; a single generic controller.
- Why: Per-section controllers duplicate the same two actions five times. Minimal APIs keep each section to one line and give typed OpenAPI output without attribute plumbing.

## SQLite (2026-10-22)
- Context: Small, read-only reference data rebuilt from markdown on startup.
- Decision: SQLite through EF Core.
- Alternatives: SQL Server/PostgreSQL; in-memory collections; EF in-memory provider.
- Why: No server to host, file-based, real relational constraints for the normalised TPT schema. The in-memory provider would skip relational behaviour such as `LIKE` escaping.

## Monorepo layout (2026-10-22)
- Context: One API, one Angular app, generated TypeScript types flowing from API to web.
- Decision: Single repo: `src/` and `tests/` for .NET, `web/` for Angular, `Source Material/` shared.
- Alternatives: Separate repos for API and front end.
- Why: The OpenAPI document is written into `web/openapi/` at API build; one repo keeps the contract and both consumers in the same commit.

## TPT for spells and equipment (2026-10-22)
- Context: Tricks, spells and recipes share most columns; recipes add cost/supply, tricks lack prerequisite/range/duration. Weapons and armour likewise extend generic items.
- Decision: EF Core table-per-type: `Spell` -> `RankedSpell` -> `Recipe`; `EquipmentItem` -> `Weapon`/`Armour`. Subtype tables share the supertype key.
- Alternatives: Table-per-hierarchy with nullable columns; table-per-concrete-type; JSON property bags.
- Why: The table structure itself stops a trick having a range or a lantern having a damage die. TPH would allow that; JSON bags are an anti-goal.

## Damage types split from weapon features (2026-10-22)
- Context: The Weapon Features glossary has one row "Piercing, slashing, bludgeoning", but weapons list each type separately.
- Decision: A `DamageType` lookup with a `WeaponDamageType` junction, separate from `WeaponFeature`/`WeaponWeaponFeature`.
- Alternatives: Explode the glossary row into three features; keep damage types as text.
- Why: Filtering by damage type needs one row per type, and the glossary row stays one glossary entry as the source has it.

## Prerequisite, Range and Duration kept as text (2026-10-22)
- Context: Prerequisites mix spells, skills and "any school" with OR logic; range and duration vary by power level.
- Decision: Single text columns on `RankedSpell`.
- Alternatives: Prerequisite junction tables; structured range/duration per power level.
- Why: Each is still a single value, so normal form holds; nothing in the app computes with them.

## Raw source text kept beside parsed values (2026-10-22)
- Context: `FeaturesText`, `RequirementText` and `CostText` are parsed into junctions or copper values.
- Decision: Keep the original text column as well.
- Alternatives: Rebuild display text from the parsed parts.
- Why: The table shows the source as written ("Word, gesture", "500/shift or more"); rebuilding it would lose wording and ordering.

## Category and school notes (2026-10-22)
- Context: Some source sections carry prose under the table, such as the mastercrafted rule under Melee weapons.
- Decision: Nullable `Note` on `EquipmentCategory` and `MagicSchool`, filled from the section prose.
- Alternatives: Hard-code the rules in the front end.
- Why: Display text stays sourced from the markdown, never hand-copied.

## Recipe supply nullable (2026-10-22)
- Context: One alchemy recipe lists cost "—" with no supply.
- Decision: `Recipe.SupplyId` (and `CostPerDoseCopper`) are nullable.
- Alternatives: Invent a placeholder supply row.
- Why: A placeholder would be made-up data; null says "not given" truthfully.

## Cost unit stored as verbatim suffix (2026-10-22)
- Context: Costs carry units and qualifiers: "200/day", "500/shift or more", "200 x potency", "2500, varies".
- Decision: Store integer copper, the suffix exactly as written in `CostUnit`, and an `CostOrMore` flag.
- Alternatives: A unit enum (day/km/shift/potency); keep the whole cost as text.
- Why: The front end needs exact copper to price and the suffix only to re-attach after calculation. An enum would add a mapping for every new suffix the source invents.

## Hand-written table parser instead of Markdig (2026-10-22)
- Context: The sources are simple pipe tables under `#` headings with a little prose.
- Decision: A small line-by-line parser (`MarkdownDocument`).
- Alternatives: Markdig with its pipe-table extension.
- Why: About 50 lines, no dependency, and it hands back exactly the heading/columns/rows/note shape the importers need instead of an AST to walk.

## Skill type "Secondary" kept from source (2026-10-22)
- Context: The design spec calls the third skill type "Magic"; `Dragonbane_Skills_Table.md` says "Secondary".
- Decision: Import skill types exactly as written: Core, Weapon, Secondary.
- Alternatives: Rename to "Magic" in the importer.
- Why: The markdown is the source of truth for display data; renaming would be hand-edited data in a second place. Flagged to the user.

## Requirement split rule (2026-10-22)
- Context: Spell requirements read "Word, gesture" but recipes read "Alchemical laboratory; ingredients: general herbs, wolf blood", where the commas list ingredients inside one requirement.
- Decision: Split on `;` when present, otherwise on `,`. Trim, upper-case the first letter, and share `Requirement` rows case-insensitively.
- Alternatives: Always split on commas; keep requirements as text only.
- Why: Splitting on commas would turn each ingredient into a separate requirement; one rule covers both shapes without per-school special cases.

## Trick casting time stored as "Action" (2026-10-22)
- Context: The user's trick rule is "casting time is 1 action and every trick needs a gesture"; the source has no casting-time column for tricks.
- Decision: Store `CastingTime = "Action"` and requirement `Gesture` on every trick.
- Alternatives: "1 action"; null with a front-end default.
- Why: "Action" matches the vocabulary of the spells' Casting Time column, so tricks and spells read the same in one table.

## Treasure seed in C# (2026-10-22)
- Context: Treasure effects mix dice, picks, nested rolls and coin values in free text; the spec forbids parsing that text at runtime.
- Decision: A hand-curated `TreasureSeed` dictionary in C#, keyed by roll number. The importer validates it against the markdown (every key has a row, every row but 37 has a key, picks have one outcome per face, item/school/coin names exist) and fails the import otherwise.
- Alternatives: A JSON/YAML seed file; a text parser run once at import.
- Why: Compile-checked records with named arguments catch typos at build time, and validation catches drift between the seed and the markdown on every start. A parser would be the fragile string logic the spec rules out, just moved earlier.

## Roll/outcome tree schema (2026-10-22)
- Context: Entries roll dice; a pick outcome may roll again (bottle: healing potion 3D6 HP).
- Decision: `TreasureRoll` belongs to either an entry or an outcome, enforced by check constraint `CK_TreasureRoll_OneParent`; outcomes hang off rolls. Depth is capped at two by the importer.
- Alternatives: Separate entry-roll and outcome-roll tables; a JSON dice spec.
- Why: One roll shape serves both levels, the constraint keeps every roll owned exactly once, and JSON columns are an anti-goal.

## Explicit import command; API serves a prebuilt read-only database (2026-10-22)
- Context: The markdown is the only source of truth and changes only deliberately. Rebuilding on every API start (the first approach) did work nobody asked for and made servers depend on the markdown files.
- Decision (user's call): `dotnet run --project src/Dragonbane.Api -- import` deletes and rebuilds `dragonbane.db` from `Source Material/`, then exits. The importer leaves one self-contained file (journal mode DELETE, vacuumed, no -wal/-shm). The API opens it with `Mode=ReadOnly`, never imports, and refuses to start when the file is missing. The built file is committed to git and deployment copies it to dev/prod.
- Alternatives: Rebuild on every start; rebuild when markdown hashes change; EF migrations; a separate importer console project.
- Why: Servers serve exactly the data that was built and checked locally, and read-only mode enforces "data is never edited in two places". The import stays a full rebuild (well under a second), so no migrations or change detection. A command in the API project reuses its config and importers without a second project.

## MapSection takes a third type parameter for typed filters (2026-10-22)
- Context: The spec sketched `MapSection<TEntity, TDto>`, but sections filter on different fields (skill type, school/rank/kind, category).
- Decision: `MapSection<TEntity, TDto, TFilter>` where `TFilter` is an `[AsParameters]` record implementing `ISectionFilter<TEntity>`. DTOs supply their EF projection through a static abstract `Projection`.
- Alternatives: A loose `IDictionary<string,string>` of filters; per-section endpoints.
- Why: Typed filters give 400s for bad values and named, typed query parameters in OpenAPI, so the generated TypeScript knows each section's filters. Still one line per section.

## LIKE with escaping instead of FTS5 (2026-10-22)
- Context: Search covers a few hundred rows at most, on name plus description/effect.
- Decision: `EF.Functions.Like(column, SearchPattern.Contains(term), "\\")`, escaping `\`, `%` and `_` so user text matches literally. SQLite LIKE is case-insensitive for ASCII.
- Alternatives: SQLite FTS5; client-side filtering.
- Why: FTS5 needs virtual tables and its own query syntax, which makes characters such as `'` and `-` special. Scanning a few hundred rows is instant.

## Build-time OpenAPI document (2026-10-22)
- Context: The front end's TypeScript types are generated from the API description.
- Decision: `Microsoft.Extensions.ApiDescription.Server` writes `web/openapi/Dragonbane.Api.json` on every API build. Startup skips the import when the entry assembly is `GetDocument.Insider`, so a build never touches the database.
- Alternatives: Fetch `/openapi/v1.json` from a running API when generating types.
- Why: Type generation then needs no running server, and the contract is committed beside the code that consumes it.

## No paging (2026-10-22)
- Context: The largest section is spells, with 316 rows.
- Decision: List routes return every matching row.
- Alternatives: Skip/take or cursor paging.
- Why: 316 small rows is one fast response; paging would add UI and API complexity for no gain at the table.

## Generic GlossaryDto<TEntity> for glossaries (2026-10-22)
- Context: Supplies, weapon terms and weapon features share the shape (Id, Name, Description).
- Decision: One `GlossaryDto<TEntity>` constrained to a new `IGlossaryEntity` interface, which compiles cleanly with the static abstract `Projection`.
- Alternatives: Three identical DTO records.
- Why: One definition instead of three copies. OpenAPI names them `GlossaryDtoOfSupply` and so on.

## Zoneless Angular with signals and httpResource (2026-10-22)
- Context: Angular 22 defaults to zoneless change detection; the app is read-mostly lookup screens.
- Decision: Standalone components, `OnPush`, signals for state, `httpResource` for API reads, lazy-loaded routes per section.
- Alternatives: Zone.js with RxJS services and the async pipe; NgRx.
- Why: Current Angular practice, less runtime, and `httpResource` gives loading/error/value signals without hand-written subscriptions. Five read-only pages need no store library.

## openapi-typescript types only, no generated client (2026-10-22)
- Context: TypeScript models must come from the API's OpenAPI description.
- Decision: `npm run gen:api` runs `openapi-typescript` over `web/openapi/Dragonbane.Api.json` into `schema.d.ts`; `api/models.ts` re-exports friendly aliases. Calls use `httpResource`/`HttpClient` directly. `openapi-typescript` declares a TypeScript 5 peer; an npm `overrides` entry lets it use the project's TypeScript 6 (it only runs at codegen time).
- Alternatives: NSwag or openapi-generator Angular clients; hand-written interfaces.
- Why: Types catch contract drift at compile time; a generated client would add services and code for GETs that are one line each. The API also sets strict JSON number handling so OpenAPI types ints as `number`, not `number | string`.

## Dev proxy instead of CORS (2026-10-22)
- Context: In development the Angular dev server (4200) and API (5080) run on different ports.
- Decision: `npm start` serves with `proxy.conf.json`, forwarding `/api` to `http://localhost:5080`. The API has no CORS policy.
- Alternatives: Enable CORS on the API for localhost:4200.
- Why: The front end always calls relative `/api/...`, exactly as it will when served from the same origin in production, and the API stays free of dev-only configuration.

## Coin standard in localStorage with safe fallback (2026-10-22)
- Context: The chosen coin standard should survive a reload, but storage may be blocked (private mode, policies).
- Decision: `CoinStandardStore` keeps a signal, reads/writes `dragonbane.coinStandard` inside try/catch, ignores unknown stored values and defaults to `gold`.
- Alternatives: No persistence; a cookie; server-side preference.
- Why: One small store covers it; when storage throws the app keeps working for the session instead of breaking.

## Business logic as pure functions (2026-10-22)
- Context: Pricing, coins and mastercrafting are rules, not state.
- Decision: Plain exported functions in `web/src/app/money/` (`quote`, `formatPrice`, `formatCoins`, `toDisplayCopper`, `mastercraft`), unit-tested directly. Angular DI is used only where there is state (coin standard) or randomness (dice).
- Alternatives: Injectable services for every rule.
- Why: Pure functions need no TestBed, can't hide state, and compose freely in `computed()` signals.

## Exact copper, one rounding at display (2026-10-22)
- Context: Selling at 10% and bartering can produce fractions of a copper; the spec forbids rounding before display or showing fractions.
- Decision: `quote` multiplies the integer base by the sell-rate and barter percentages and divides once by 10 000, returning exact copper. `toDisplayCopper` is the only rounding: floor, minimum 1. Buying always uses rate 100.
- Alternatives: Round after each step; decimal library.
- Why: Integer products are exact in doubles at these sizes, so one division keeps full precision and the "round down once, never below 1 copper" rule lives in one function.
