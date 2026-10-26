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

## Injectable RANDOM token with mulberry32 seeding (2026-10-22)
- Context: Dice must be random at the table but reproducible in tests, per the spec's "injectable and seedable RNG".
- Decision: An Angular `InjectionToken<() => number>` named `RANDOM` defaults to `Math.random`; `seededRandom(seed)` (mulberry32) can be provided instead. `DiceRoller` maps it to faces 1..sides. Treasure resolution is pure functions over a `DiceRoller`, so tests pass a queued fake.
- Alternatives: `crypto.getRandomValues`; a seedable RNG library.
- Why: A five-line PRNG is enough for tabletop dice and adds no dependency; the token keeps production code free of test switches.

## Wider parchment scroll on laptops (2026-10-22)
- Context: The parchment style caps the scroll at 640px, which suits prose pages. At 1280px the skills table wrapped descriptions every few words and left most of the screen empty; the spec is laptop-first.
- Decision (user's call after a browser preview): from 768px wide, `.page-scroll` grows fluidly up to the style's own `--max-width` (1100px). Below that it keeps 640px.
- Alternatives: Keep 640px and rely on horizontal table scroll; drop the scroll texture on wide screens.
- Why: The texture is drawn at `background-size: 100% auto` and held up in the preview; tables become readable without losing the rulebook look.

## Seamless parchment scroll (2026-10-22)
- Context: `scroll.webp` (600×1682) has torn, darkened top and bottom edges, so `repeat-y` drew a brown band every texture height on long pages.
- Decision (user request): split it once into `scroll-top.webp` (rows 0–240), `scroll-tile.webp` (rows 240–1442, last 120 rows cross-faded into rows 120–240 so the tile wraps onto its own start) and `scroll-bottom.webp` (rows 1442–1682, alpha faded in over its first 80 rows). `.page-scroll` draws the top cap as its background, the tile on `::before` and the bottom cap on `::after`, both behind content. Offsets are percentage margins (relative to width), so the pieces stay aligned at any width. The original `scroll.webp` was removed.
- Alternatives: Stretch one image to the page height; keep the seams; generate the pieces at build time.
- Why: Torn edges stay at the real top and bottom of the scroll, the middle repeats without a visible join, and the three files are smaller than the original. It was a one-off split with sharp in a scratch folder, so the app gains no image dependency.

## Stacked table rows on narrow screens (2026-10-22)
- Context: Below 768px the scroll is at most 640px wide. 8–10 column tables (spells, weapons) overflowed their wrapper, and Windows' hidden overlay scrollbars made the cut-off look like a bug.
- Decision (user's call): tables with class `stack` turn each row into a card under 768px. The first cell (`.row-title`) is the heading; every other cell shows its column name from a `data-label` attribute. The header row stays in the DOM but is visually hidden. Used by Skills, Heroic Abilities, Spells and Equipment.
- Alternatives: Horizontal scrolling with visible scrollbars or fade hints; hiding low-priority columns; a separate card component per page.
- Why: Nothing is hidden or cut off, there is one shared CSS rule, and the markup stays a real table. The ceiling: some older browsers drop table semantics under `display: block`, and explicit ARIA roles are the upgrade path (marked with `ponytail:` in styles.scss).

## Table typography: whole words, sentence-case spell names, no table fill (2026-10-22)
- Context: User review. Breaking words mid-word to fit columns split single-word cells; spell names are ALL CAPS in the source while other tables use sentence case; the table's parchment-dark fill hid the scroll texture.
- Decision: Cells wrap only at spaces. Spell names display in sentence case ("MAGIC SEAL" → "Magic seal") via `sentenceCase()` at render time; descriptions and prerequisites stay as written and the database keeps the source text. `.data-table` has no background; the header band and row borders remain. Wide tables (8-column spells, 10-column weapons) need ~770px of unbreakable words, so they stack as cards below 1024px; other tables stack below 768px.
- Alternatives: CSS `text-transform` for names (screen readers may spell out the all-caps DOM text); changing the import (display data would no longer match the source).
- Why: Whole words read better, display casing matches the other sections without touching source data, and the two stacking breakpoints leave no table overflowing at any width (measured at 375–1280px).

## Filters live in the URL (2026-10-22)
- Context: Lookups at the table get shared, bookmarked and reloaded.
- Decision: Every filter (search, type, school, rank, kind, category) is a query parameter bound to component `input()`s via `withComponentInputBinding`; changes call `router.navigate` with `replaceUrl`. Data comes from `httpResource` keyed on those inputs. Price options and the treasure result stay in page signals.
- Alternatives: Component-local signals; a shared filter store.
- Why: Reload and links reproduce the view with no extra code; `replaceUrl` keeps typing from flooding history.

## Treasure results show every die (2026-10-22)
- Context: Players should trust the roll; the spec bans parsing effect text.
- Decision: A result lists the entry's effect text, then every die with its arithmetic ("2D6 → 3 + 4 = 7 × 10 = 70 silver (7 gold)"), item links with base or mastercrafted prices, and for a grimoire a link to the matching spells. Only the latest result is kept, in one `aria-live="polite"` region. Found coins and gems ignore the equipment price controls. Inside the parchment scroll the style's buttons use inverse colours, because the originals are drawn for the green hero and were illegible on parchment.
- Alternatives: Show totals only; keep a roll history.
- Why: Transparent arithmetic is what makes a digital roll acceptable at the table; history was a non-goal.

## Playwright + axe as the accessibility gate (2026-10-22)
- Context: The repo must be AXE-clean and WCAG AA, laptop-first but usable at 375px.
- Decision: `npm run e2e` runs Playwright with `@axe-core/playwright` (WCAG 2.0/2.1 A and AA tags) on all five sections at 1280×800 and 375×812, plus keyboard and live-region checks. The overflow check also counts table boxes that scroll and elements reaching past the scroll's edge, because `.page-scroll` clips with `overflow: hidden` and a page-width check alone missed clipped content (proved with an injected probe). Playwright starts the API (serving the committed database) and the dev server, or reuses running ones.
- Alternatives: Lighthouse CI; axe in jsdom unit tests; manual audits.
- Why: Real browser layout is needed for contrast and overflow; jsdom has neither. One command gates every page at both target widths.

## Safe import and a guard against a stale committed database (2026-10-22)
- Context: Final review. An import that failed part-way left a half-built `dragonbane.db` that the API would serve; and with the database committed, a markdown edit without `-- import` would ship stale data silently.
- Decision: `SourceImporter.ImportToFileAsync` builds into `dragonbane.db.building` and moves it over the real file only on success. `CommittedDatabaseTests` compares every table of the committed file with a fresh import and fails with the import command when they differ.
- Alternatives: One transaction around the importers (they save as they go so later importers can look up generated ids); a pre-commit hook.
- Why: A temp-file swap gives all-or-nothing without restructuring the importers, and the test runs wherever `dotnet test` runs, so "data is never edited in two places" stays enforced.

## Wider scroll cap, fluid body text and one page background (2026-10-23)
- Context: Table feedback: much wasted space left and right, small text, and the device toolbar did not show it. Measured in Chrome on the user's machine: the window was 2160 CSS px wide with `devicePixelRatio` 0.73, so the tab is zoomed out (about 67–75%) and the 1100px scroll left wide bare margins. The device toolbar emulates its own pixel ratio and width, which hides both effects.
- Decision: `--max-width` is 1500px (scroll, nav and footer content), set by the user against the 2160px-wide zoomed-out view; narrower laptops (1280–1440px) fill their width minus the page gutter, as before. Body text is `clamp(1.15rem, 0.9rem + 0.45vw, 1.45rem)`, and table headers, link buttons and small buttons use `em` so they scale with it. The body is a plain `#403f3e` with no texture; the old dark-mode variant (a darker textured table) is removed so every viewer gets the same background. The header is larger (brand 1.75rem, links 1.15rem, `--spacing-md` padding) and the footer slimmer (0.85rem, small padding, no rule under the disclaimer). The default coin standard is "As written".
- Alternatives: Fill the full window width (the user chose a bigger cap); a separate wide-screen breakpoint instead of `clamp()`.
- Why: A bigger cap keeps line lengths readable on huge monitors while using a laptop's width; `clamp()` scales smoothly with no breakpoints. Browser zoom stays the user's own setting.

## Healing potion HP shown as dice, not rolled (2026-10-23)
- Context: Table feedback: for a bottle that holds a healing potion, the GM wants "2D6" or "3D6", not a rolled number; the HP is rolled when the potion is drunk.
- Decision: In `TreasureSeed`, roll 36's potion outcomes are labelled "healing potion 2D6 HP" and "healing potion 3D6 HP" and no longer nest an HP roll. The grimoire's count roll is labelled "spells" so a result reads "3 spells". The resolver keeps its generic nested-roll support.
- Alternatives: Keep the nested roll in the seed and teach the view to show `Number` specs under picks as unrolled dice.
- Why: The seed is the only hand-curated treasure data, so the change lives there and the display needs no special case. Effect text is still never parsed.

## Treasure result in a native dialog, outcomes only (2026-10-23)
- Context: Table feedback: the GM wants the outcome at a glance, not the dice arithmetic, in a popup with a close button top left. Supersedes "Treasure results show every die".
- Decision: Rolling the table or a row opens a native `<dialog>` with `showModal()`, titled "N - Treasure" (`aria-labelledby`). The title sits top left on one line; Close is a round X icon (an SVG drawn like the radio buttons, `aria-label="Close"`) floating in the top right corner; "Re-roll" sits at the bottom centre. Re-roll repeats the last roll (a new D40 after a table roll, the same entry after a row roll) and replaces the content in place. A click on the backdrop closes the dialog: such a click lands on the `<dialog>` element itself outside its box, which a click handler checks, because the `closedby="any"` attribute is not yet in every browser (Safari). The dialog is anchored 8vh from the top, 46rem wide, with `min-height: 24.5em`: the tallest result plus the Re-roll row (a bottle, measured at 24.2em) fits, so the size is the same for every roll and Re-roll never moves; measured over 150 table re-rolls at 1280×720, 1366×768, 1536×864, 1746×818 and 1920×1080, one height and one Re-roll position each, no scrollbar. It scrolls only when the window is too short for it. The body is the effect text, then one line per outcome: coins ("70 silver", plus the conversion under a coin standard), numbers ("4 damage", "3 spells"), rank ("Rank 2" / "Tricks"), gems ("Sapphire — 15 gold"), other picks ("Type: lethal"). Equipment picks link to Equipment and show the item's table row through the shared `columnsFor`, without the `listOnly` columns (Supply, Weight), and with mastercrafted values for mastercrafted weapons; short stats share a line and `wide` columns (effects, weapon features) take a full row instead of wrapping in a narrow one. A grimoire lists `suggestSpells` picks (distinct, seedable roller) on one line, linked to the Spells page; `grimoireRolls` reads its school, rank and count for both the suggestions and the "Show matching spells" link. The resolver still returns every die, so tests stay deterministic; `describeDice` was deleted.
- Alternatives: A custom overlay with a hand-rolled focus trap; keeping the inline live region; a fixed height with an inner scrollbar (tried, rejected by the user); sizing per entry by rendering all its outcomes off screen (exact for a row re-roll, still jumps between D40 entries, more code).
- Why: The native modal gives the focus trap, Esc, inert background and focus return for free, and axe covers it in the e2e test. A top-anchored box of one size keeps the corner Close and the bottom Re-roll still at the table.

## Mastercrafted shown in the row, melee only, with a global override (2026-10-23)
- Context: Table feedback: the mastercrafted sub-row was hard to compare; the GM wants the row itself to change, a visible cue, the button on its own line, and a switch that shows every melee weapon mastercrafted. The price controls also took too much height.
- Decision: The row's Mastercrafted button (`aria-pressed`, always on its own line) swaps STR, Durability and Cost for `mastercraftedItem` values and tints the row; a ✦ before the pressed button's label means colour is not the only cue. Only priced melee weapons (`weapon.isRanged === false`, `costCopper !== null`) get it, because the rule is in the Melee weapons note; ranged weapons lost the button. The row button is not underlined; dark green text in tinted rows keeps it AA (an e2e check measures it against the tint over the sandiest parchment). "Mastercraft all", a flat toggle button (`aria-pressed`, outlined off, filled on) right-aligned on the Melee weapons heading row, overrides the rows (their buttons show pressed and disabled); turning it off restores each row's own choice. Neither is saved. The mastercrafted cost still runs the full pricing order. Price and Sell rate (a radio group like Price) share a line that wraps as the width shrinks; Bartering sits on the line below as "Roll:" None / Success / Dragon, always shown, None by default (no checkbox). Links inside treasure results are underlined (axe `link-in-text-block`).
- Alternatives: Keep the sub-row; hide the row buttons while the global toggle is on.
- Why: Values in place are what the table needs; showing the buttons pressed keeps the override visible.

## Star radios and checkboxes, and filter rows aligned on their labels (2026-10-23)
- Context: Table feedback: radios and checkboxes should carry the Mastercrafted button's green ✦ when selected, centred, with a green ring; the search label and box sat higher than the selects' labels on every page.
- Decision: Radios and checkboxes use `appearance: none` with an inline SVG background: a demon-green (#227262) ring or box on bone white, plus a four-point star exactly centred when `:checked`. Filter rows use `align-items: flex-start`, so every label shares a top; the search box and selects get the same line height and an explicit height (`calc(1.3em + 0.6rem + 4px)`), and an unlabelled button in the row (Roll treasure) aligns to the bottom. An e2e check per section asserts one label top and one control height.
- Alternatives: A font glyph in `::before` (tried: hard to centre across fonts and sizes); bottom-aligning the row (the cause: the search box was taller than the selects).
- Why: SVG centres the star at any size; equal control heights plus top alignment keep labels level whatever mix of controls a page has.
