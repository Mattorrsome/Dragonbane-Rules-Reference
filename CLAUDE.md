# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

API done (`Dragonbane.slnx`: `src/Dragonbane.Api`, `tests/Dragonbane.Api.Tests`). Angular app (`web/`) not yet scaffolded.

- Build: `dotnet build` (also writes `web/openapi/Dragonbane.Api.json`; use `--no-incremental` to force regeneration)
- Test: `dotnet test` (one class: `dotnet test --filter <ClassName>`)
- Run: `dotnet run --project src/Dragonbane.Api` (rebuilds `src/Dragonbane.Api/dragonbane.db` from `Source Material/` on every start; OpenAPI at `/openapi/v1.json`)

- `Initial_Brainstorming.md`: the user's original requirements.
- `docs/superpowers/specs/2026-10-22-dragonbane-reference-design.md`: the agreed design. **Read it before any build work.** It is the source of truth for goals, non-goals, anti-goals and the schema.
- `Source Material/*.md`: the Dragonbane source tables. They are the source of truth for display data.
- `DECISIONS.md` (to be created at the repo root): one entry per significant technical decision covering context, decision, alternatives considered and why. Update it whenever you make a decision.

## What it is

A Dragonbane RPG lookup app used at the gaming table, plus a showcase of current Angular and ASP.NET best practices. It has five sections: Skills, Heroic Abilities, Spells, Equipment and Treasure. `Dragonbane_NPC_Table.md` is deliberately excluded.

## Architecture (from the design)

- **Stack:** Angular (latest, standalone components, signals) with an ASP.NET Web API on .NET 10 LTS, and SQLite through EF Core.
- **The API serves data only.** It is generic per section: one helper, `MapSection<TEntity, TDto>("skills")`, produces each section's typed routes (`GET /api/{section}?search=&filter=…`, `GET /api/{section}/{id}`), plus a currency-rates endpoint. No per-section controllers. TypeScript models are generated from the OpenAPI description.
- **All business logic lives in front-end TypeScript services with unit tests.** This covers pricing, coin conversion, bartering, mastercrafted variants, dice and treasure resolution. The dice RNG must be injectable and seedable.
- **An importer loads the markdown into the DB.** The data is never edited in two places. The only hand-curated data is the treasure roll specs, a structured seed keyed by roll number, and the magic trick rule: casting time is 1 action and every trick requires a gesture.
- **Schema:** the schema is normalised and uses EF Core TPT supertype/subtype tables, such as Spell → RankedSpell → Recipe and EquipmentItem → Weapon/Armour, with junction tables for multi-valued fields. Never use JSON property bags or a generic table/row/cell model.
- **Adding a section:** add the markdown file, the entity and DTO, the importer mapping and one `MapSection` line.

## Hard rules (anti-goals)

- **Money is stored as integer copper,** alongside the original cost text. Calculate in copper and round only once, at display time. Always round down, and never show less than 1 copper.
- **Never display the Currency Exchange table.** The front end uses it only for conversion.
- **Never parse treasure effect text at runtime.** Dice specs come from the structured seed.
- **Pricing order:** base copper → sell rate (100/50/20/10%) → bartering (Success ±20%, Dragon ½ or ×2) → coin standard → round down.
- **UI:** use the parchment style from the `anthropic-skills:dragonbane-parchment-style` skill. The layout is laptop-first and responsive.


## Superpowers step gating (MANDATORY)

Never move from one Superpowers skill or phase to the next on your own.
At the end of every skill/phase (brainstorming, writing-plans, worktree setup,
each task or batch in execution, code review, finishing-a-branch):

1. STOP. Do not call the next skill. Do not start the next task.
2. Report exactly in this format:

   ✅ Done: <skill/phase just finished> — <one-line summary>
   ⏭️ Next: <exact skill name> — <exactly what it will do, which files/tasks>
   ❓ Proceed? (yes / change / stop)

3. Wait for my reply. Only "yes" (or "go", "proceed") counts as approval.
   Silence, questions, or feedback are NOT approval.

This applies even if a skill says to continue automatically.

## Plan execution mode (MANDATORY)

When a plan is ready, STOP and ask exactly:

   ⏭️ Next: plan execution — choose a mode:
   1. executing-plans (recommended — pauses after every task)
   2. subagent-driven-development (faster — runs tasks without pausing)
   ❓ Pick 1 or 2

If I reply with anything other than "2", use executing-plans with batch size = 1.
## CodeGraph (applies to every agent, including BMad agents and subagents)

`.codegraph/` exists (initialised 2026-10-22), but the index is empty: the repo holds only
markdown, which CodeGraph doesn't index. Until source code exists, use Read/Grep/Glob.

Once there is code, use `codegraph_explore` (or the `codegraph explore` shell command)
BEFORE grep/find/reading files to locate code, and always pass
`projectPath: "C:\Projects\Dragonbane"` explicitly. If results come back empty after
scaffolding, the index may need refreshing; ask the user rather than re-indexing yourself.

## Agent modes (applies to every agent, including subagents)

Hook-injected modes (`SessionStart` / `SubagentStart`) can silently time out under
subagent fan-out. These rules are the fallback — they apply whether or not the hook fired.

### Caveman — response style

Terse. Drop articles, filler (just/really/basically/simply), pleasantries, hedging.
Fragments fine. Short synonyms. No tool-call narration, no decorative tables or emoji,
no long raw log dumps — quote the shortest decisive line.
Never invent abbreviations (`cfg`, `impl`, `req`) — same token count, worse to read.
Never name or announce the style.
Preserve the user's language; compress the style, not the language.

Verbatim zones — never shortened or paraphrased: code, commands, file paths,
identifiers, diffs, error text. Commit messages and PR bodies: write normal.

Write normal prose for: security warnings, irreversible-action confirmations,
multi-step sequences where fragment order risks misreading, and when the user
asks you to clarify or repeats a question.

Subagents: this applies to the final report returned to the parent, not just narration.

### Ponytail — what you build

Stop at the first rung that holds:
1. Does this need to exist at all? Speculative need = skip it, say so in one line.
2. Already in this repo? Reuse the helper/util/type/pattern. Look before you write.
3. Stdlib or Angular built-in does it? Use it.
4. Native platform feature covers it? CSS over JS, `input()`/`computed()` over hand-rolled state.
5. Already-installed dependency solves it? Use it. Never add a new one for a few lines of code.
6. Can it be one line? One line.
7. Only then: the minimum code that works.

No unrequested abstractions, no scaffolding "for later". Deletion over addition.
Shortest working diff wins — but only after you understand the problem. Bug fix =
root cause in the shared function, not a guard in the one caller the ticket names.

Never simplify away: input validation at trust boundaries, error handling that
prevents data loss, security measures, accessibility (this repo requires AXE-clean
and WCAG AA), or anything explicitly requested.

Mark deliberate shortcuts with a `ponytail:` comment naming the ceiling and the upgrade path.

Output: code first, then at most three short lines — what was skipped, when to add it.
Explanation the user explicitly asked for is not debt; give it in full.

### RTK — shell output

`rtk` proxies CLI commands and strips up to 90% of output tokens. A `PreToolUse` hook
rewrites Bash commands automatically (`git status` → `rtk git status`), so call commands
normally. Use `rtk` directly only for its own meta commands: `rtk gain`, `rtk discover`,
`rtk proxy <cmd>` (unfiltered, for debugging).
