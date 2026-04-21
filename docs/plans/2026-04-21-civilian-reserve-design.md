# Plan: Civilian Reserve (CR) — `rational-reserve` extension

## Context

The `multimodal-agent-builder` (MAB) repo was shelved once market-ready agent stacks (Claude Agent SDK, LangGraph, CrewAI) matured. The user wants to revive the intent of MAB by building **project-specialized agents for each project under `~/Projects`** — but doing so inside `rational-reserve` (RR) rather than MAB, because RR already has the daemon, MCP surface, SQLite event log, C2 router, and doctrine loader we would otherwise rebuild.

The new agent class is **Civilian Reserve (CR)**: domain-expert "contractors" that military-rank MOS agents hire for per-project expertise. Some civilians are **firms** (umbrella entities with internal specialists, e.g. CR-Return42 owns Morphlex/Jasterish/Custom-LLM); others are **flat** single-scope civilians. Military agents contract the *firm*; the firm routes to its specialist. Cross-firm contracting is out of scope.

MAB's distinctive IP (MOA reasoning, Recursive Loop Closure, multimodal adapters) survives as CR-MAB doctrine; the MAB codebase itself is not being revived.

## Locked decisions (from brainstorm)

- **Absorb into RR.** Civilians are first-class RR entities; they ship in the `rational-reserve` repo (primary work dir: `~/Projects/rational-reserve`).
- **Civilians are a separate `AgentClass`**, not a rank inside `RankEnum`. Keeps `authority()`/`outranks()`/`Ord` semantics intact for military.
- **Firms with specialists, firm-level contracting.** Contracts address firms; specialists are invisible to the contracting military agent.
- **Dropped:** cross-firm contracting, Go supervisor/TUI, B-class in-product agents, MAB code revival.

## Civilian roster

**Firms** (5):

| Firm | Specialists | Source |
|---|---|---|
| CR-Pitchfork | Settlement-Contract, ZK-KYC, VPS-Isolation, BTC-Custody | `~/Projects/pitchfork` |
| CR-DeveloperPortal | Backstage, Gitea, k3d, OpenChoreo-M3-Prep | `~/Projects/developer-portal` |
| CR-KnockoutEDA | EDA, Hypothesis-Testing, Missing-Data, Prediction, Classification, Time-Series, Data-Cleaning, Bayesian, Full-Stack | `~/Projects/knockout-eda` |
| CR-Return42 | Morphlex, Jasterish, Custom-LLM | `~/Projects/apps` (brand: return42.net) |
| CR-MAB | Multimodal-IO, MOA-Reasoning, Recursive-Loop-Closure, Multi-LLM-Adapter | `~/Projects/multimodal-agent-builder` (IP-only, no revival) |

**Flat civilians** (4):

| Civilian | Source | Notes |
|---|---|---|
| CR-Arena | `~/Projects/arena` | Rust, multi-model consensus / drift detection |
| CR-BTCWallet | `~/Projects/btcwallet` | Go, upstream btcsuite; upstream-etiquette-aware |
| CR-OpenChoreo | `~/Projects/openchoreo` | upstream platform |

## Data model changes (`src/models.rs`)

Add:

```rust
pub enum AgentClass { Military, Civilian }          // snake_case serde
pub enum CivilianTier { Firm, Specialist, Independent }
```

Add a **sibling** DTO `CivilianRecord` — do NOT widen `AgentRecord` (would pollute every `is_officer()` / `authority()` call site and every SQL serializer in `persistence.rs`):

```rust
pub struct CivilianRecord {
    id: String, name: String,
    tier: CivilianTier,
    firm_id: Option<String>,        // Specialist -> parent firm; None for Firm/Independent
    specialists: Vec<String>,       // populated on Firm only
    specialty_slug: String,         // e.g. "morphlex", "btc-custody"
    project_path: Option<String>,
    upstream_url: Option<String>,
    status: StatusEnum,             // reuse existing
    active_contracts: Vec<String>,
    performance_score: f64,
    created_at: DateTime<Utc>,
    metadata: HashMap<String,Value>,
}
```

Civilians have **no `commander_id`** and do not join the military chain of command.

Add `AnyAgent { Mil(AgentRecord), Civ(CivilianRecord) }` for call sites needing "either." Rename `tier_for_rank` → `tier_for(&AnyAgent)` with civilian defaults:
- `Firm` → `"tactical"` (firm dispatches internally)
- `Specialist` / `Independent` → `"execution_guidance"`
- Override via doctrine frontmatter `tier_override` (e.g. CR-MAB MOA-Reasoning → `"strategic"`).

## Event log + projection tables (`src/persistence.rs`)

**Reuse** the existing `events` table (append-only, no schema migration).

**Add** two projection tables:

```sql
CREATE TABLE civilians (
    id TEXT PRIMARY KEY, name TEXT, tier TEXT, firm_id TEXT,
    specialty_slug TEXT, project_path TEXT, upstream_url TEXT,
    status TEXT, performance_score REAL, created_at TEXT, metadata TEXT
);

CREATE TABLE contracts (
    id TEXT PRIMARY KEY, contracting_agent TEXT, firm_id TEXT,
    routed_specialist_id TEXT, state TEXT,    -- requested|accepted|in_progress|closed|rejected
    brief TEXT, mission_id TEXT,
    created_at TEXT, closed_at TEXT, metadata TEXT
);
```

**New event types:**

- `CONTRACT_REQUESTED` — `{contract_id, from_agent, firm_id, brief, mission_id?, priority}`
- `CONTRACT_ACCEPTED` — `{contract_id, firm_id, routed_specialist_id, eta?}`
- `CONTRACT_REJECTED` — `{contract_id, firm_id, reason}`
- `CONTRACT_SITREP` — `{contract_id, from_agent, status, progress, message, blockers}` (payload mirrors existing `SITREP_ROUTED` shape so unions work)
- `CONTRACT_CLOSEOUT` — `{contract_id, outcome, deliverables, aar_ref?}`
- `CIVILIAN_REGISTERED` / `FIRM_REGISTERED` — bootstrap

Do NOT reuse `ORDER_ROUTED`: contracts are negotiated scope, not ordered authority. Keep AAR narrative honest.

## C2 router changes (`src/c2_router.rs`)

Civilians are outside the chain of command. `validate_command_relationship` currently lets higher rank override onto any subordinate — this must **refuse** civilians outright:

```rust
if subordinate.class() == AgentClass::Civilian { return Err(CommandAuthority(...)) }
```

Add `C2Router::route_contract_request(ContractRequest)`:
1. Verify `from_agent` is military and `firm_id` resolves.
2. Append `CONTRACT_REQUESTED` event; insert contracts row.
3. Invoke new `ContractBroker` for firm-internal routing.

`route_casrep` needs a civilian branch: CASREPs on a contract escalate to the **contracting military agent**, not to a nonexistent civilian commander.

Pre-existing dead branch at `c2_router.rs:171-173` (`walk_chain_upward` — `subordinates.iter().any(|_| false)`) should be flagged in the PR but not fixed in this change.

## Doctrine layout + template (`src/doctrine.rs`, `doctrine/`)

Filesystem:

```
doctrine/civilian/
  VERSION                                       # independent of military VERSION
  firms/
    return42/
      firm.md
      specialist-morphlex.md
      specialist-jasterish.md
      specialist-custom-llm.md
    pitchfork/ ...
    developer-portal/ ...
    knockout-eda/ ...
    mab/ ...
  flat/
    arena.md
    btcwallet.md
    openchoreo.md
    toad.md
```

Extend `DoctrineLoader` with three methods (military API untouched):

```rust
fn firm_doctrine(&self, firm: &str) -> Result<FirmDoctrine>;
fn specialist_doctrine(&self, firm: &str, spec: &str) -> Result<SpecialistDoctrine>;
fn civilian_doctrine(&self, civ: &str) -> Result<CivilianDoctrine>;
```

`SqliteStateStore`'s `doctrine_version` provider becomes `mil-<x.y.z>+civ-<a.b.c>` — no schema change, fully parseable.

Add sibling prompt assembler `assemble_contract_prompt(firm, specialist?, brief)` — don't overload the military `assemble_task_prompt`.

**Doctrine file template** (frontmatter-driven for deterministic hydration):

```yaml
---
slug: morphlex
kind: specialist               # firm | specialist | independent
firm: return42                 # required iff kind=specialist
project_path: ~/Projects/apps
upstream_url: https://return42.net
languages: [rust]
tier_override: null            # or: strategic|tactical|supervision|execution_guidance|execution
contract_scope: [api-design, rust-implementation]
---

# CR-Return42 :: Morphlex

## Scope
## Core competencies
## When to contract this specialist
## Out of scope
## Deliverables
## Execution guidance
```

Firm `firm.md` additionally carries `specialists: [...]` and a `routing_rules` section.

## MCP tool additions (pure Rust — `src/daemon.rs` + `src/bin/rr_mcp.rs`)

RR is pure Rust. The legacy Python at `src/rr/`, `src/rr_runtime/`, `src/rr_mcp/` is disregarded. MCP surface is the stdio shim binary `src/bin/rr_mcp.rs` talking to the singleton daemon (`src/bin/rr_daemon.rs` → `src/daemon.rs`) over unix socket JSON-RPC.

Add the following as:
1. New JSON-RPC methods on the daemon (`daemon.rs` dispatch + handler fns).
2. Matching MCP tool descriptors in `rr_mcp.rs`.

Methods/tools:

- `cr_list_firms` / `cr_list_civilians`
- `cr_firm_detail {firm_id}` — doctrine + specialists + open contracts
- `cr_contract_request {from_agent, firm_id, brief, mission_id?, priority?}`
- `cr_contract_accept {contract_id, specialist_id}` (firm-side)
- `cr_contract_sitrep {contract_id, status, progress, message, blockers?}`
- `cr_contract_closeout {contract_id, outcome, deliverables}`
- `cr_register_civilian` / `cr_register_firm`

All flow through the existing unix socket at `~/.rational-reserve/run/rr.sock`. Merge existing `roster` handler output to return military + civilian with a class filter.

## Vertical slice plan

**Slice A — schema + flat path (1-2 days):**
1. Land `AgentClass`, `CivilianTier`, `CivilianRecord`, `AnyAgent` in `models.rs`.
2. Add `civilians` + `contracts` tables, event types, projection writers.
3. Extend `FileSystemDoctrineLoader` with `civilian_doctrine`.
4. Add `route_contract_request` + civilian refusal in C2 router.
5. Author **CR-Arena (slice-A proof civilian)** doctrine (`doctrine/civilian/flat/toad.md`).
6. Ship MCP tools: `cr_list_civilians`, `cr_contract_request`, `cr_contract_sitrep`, `cr_contract_closeout`.
7. End-to-end test: a military agent contracts CR-Arena (slice-A proof civilian) for a TUI-UX question and gets a closeout.

**Slice B — firm + broker:**
1. Add `FirmDoctrine` / `SpecialistDoctrine` types and loader methods.
2. Implement `ContractBroker` for firm-internal specialist routing.
3. Land `cr_firm_detail`, `cr_contract_accept`.
4. Author CR-Return42 firm + Morphlex specialist doctrine only.
5. End-to-end test: military contracts CR-Return42, firm routes to Morphlex specialist, closeout lands.

**Slice C — doctrine-only rollout (no Rust changes):**
Author the remaining civilians as doctrine files: CR-Arena, CR-BTCWallet, CR-OpenChoreo (flat); CR-Pitchfork, CR-DeveloperPortal, CR-KnockoutEDA, CR-MAB and the remaining CR-Return42 specialists (firms).

**Slice D — polish:**
AAR integration (include contract timelines in mission disband AARs), civilian CASREP path in `route_casrep`, roster merge, integration tests for projection consistency.

## Critical files to modify

Primary repo: `~/Projects/rational-reserve`

- `src/models.rs` — enums + `CivilianRecord` + `AnyAgent` + `tier_for`
- `src/persistence.rs` — new tables, event writers
- `src/c2_router.rs` — civilian refusal, `route_contract_request`, `route_casrep` civilian branch
- `src/doctrine.rs` — loader trait extensions, typed doctrine records, `assemble_contract_prompt`
- `src/agent.rs` — replace `tier_for_rank` call site with `tier_for(AnyAgent)`
- `src/daemon.rs` — new JSON-RPC methods + handler fns for contracts lifecycle, civilian/firm registration, list/detail
- `src/bin/rr_mcp.rs` — new MCP tool descriptors that RPC into the daemon
- `src/bin/rr_daemon.rs` — wire any new dependencies if needed (likely no change)
- `doctrine/civilian/VERSION` + the doctrine tree above

Reference (read-only for doctrine authors): each `~/Projects/<slug>/README.md`, `AGENTS.md`, `CLAUDE.md`, relevant design docs (e.g. `apps/CUSTOM_LLM_PLAN.md`, `apps/Jasterish-plan.md`).

## Scope boundary

**No code lands in `~/Projects/multimodal-agent-builder`.** This repo is the brainstorm host only; the MAB codebase is not revived. All implementation lands in `~/Projects/rational-reserve`. Doctrine authors read (but do not modify) `~/Projects/<slug>/` for each civilian's source material.

## Open design questions (resolve during execution)

1. **Firm-internal authority.** When firm accepts, does specialist get a transient `commander_id = firm_id`, or is the link kept purely on the `contracts` row? Recommend: contracts-row-only, decide before Slice B.
2. **`in_progress` state transition.** The `accepted` → `in_progress` transition has no dedicated event in the current design. Two options: (a) derive it implicitly on first `CONTRACT_SITREP`, (b) add an explicit `CONTRACT_STARTED` event. Recommend (a) for minimum event surface; confirm in Slice A test.
3. **ContractBroker routing policy.** When a firm accepts a contract, how is the specialist chosen? Options: (a) deterministic rule in firm doctrine's `routing_rules` section (keyword → specialist mapping), (b) LLM prompt using firm doctrine as context. Recommend (a) first with (b) as fallback for ambiguous briefs; decide before Slice B.
4. **CR-MAB absorption depth.** Doctrine-only per current default. Reconsider if any civilian needs MAB's actual multimodal runtime (image/audio I/O) — none obvious in Slice A-C.
5. **Doctrine versioning.** `mil-X.Y.Z+civ-A.B.C` format is recommended; confirm before Slice A lands events.
6. **Contract reentrancy invariant.** "One open contract per (firm, mission_id)" is the default. Confirm in Slice A test.

## Verification

**Build:**
```
cd ~/Projects/rational-reserve
cargo build --release
cargo test
```

**Slice A end-to-end:**
1. `cargo run --bin rrd` (start daemon).
2. Invoke `cr_register_civilian` via MCP for CR-Arena (slice-A proof civilian) (reads `doctrine/civilian/flat/toad.md`).
3. From a military agent context (e.g. 18B Special Forces Engineer), call `cr_contract_request` with `firm_id=toad`, `brief="review Textual reactive-attribute pattern"`.
4. Verify `contracts` row written with `state=requested`, event log contains `CONTRACT_REQUESTED`.
5. Call `cr_contract_sitrep` and `cr_contract_closeout`. Verify `state=closed`, event log contains full lifecycle.
6. Confirm a military agent attempting to `issue_order` against CR-Arena (slice-A proof civilian) receives `CommandAuthority` error.

**Slice B end-to-end:**
Same as A but with CR-Return42 / Morphlex; verify `cr_firm_detail` returns specialists and `cr_contract_accept` transitions `state=accepted` with `routed_specialist_id` set.

**Regression:**
- All existing military MOS tests pass without modification.
- `tier_for(AnyAgent::Mil(...))` returns the same value as the old `tier_for_rank(rank)` for every existing rank.

**Doctrine lint (Slice A onward):**
- Each civilian doctrine file passes frontmatter schema validation (propose a `scripts/lint_doctrine.py` that checks required fields and firm/specialist consistency).
