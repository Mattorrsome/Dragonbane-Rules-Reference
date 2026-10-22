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
