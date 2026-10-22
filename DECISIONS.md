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
