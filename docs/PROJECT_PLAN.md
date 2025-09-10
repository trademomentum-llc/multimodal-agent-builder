# Project Plan: Multimodal Agent Builder

## Objectives

- OSI-layer security posture across stack
- Self-stabilizing agent execution with loop-closure grounding
- Strong CI with type checks, tests, and security scans

## Milestones

- M1: Baseline app hardening (CORS, rate limit, upload validation) — Done
- M2: Recursive Loop Closure integrated into agent cycles — Done
- M3: Grounding hook (ethics framework loader) — Done
- M4: Redis limiter + CI security workflows — Done
- M5: Production hardening (CSP/helmet, Origin pinning, WAF rules) — Pending
- M6: Observability (metrics, traces, SIEM integration) — Pending

## Timeline (suggested)

- Week 1: M1–M3 (implemented), plan infra and SIEM integration
- Week 2: M5 (helmet/CSP in Node, origin allowlist per env), IaC firewalls
- Week 3: M6 (Prometheus/OpenTelemetry), incident runbooks

## GitHub Project Setup

1. Create a GitHub Project (beta) board named "MAB Roadmap".
2. Columns: Backlog, In Progress, Review, Done.
3. Auto-add issues/PRs; enable draft PR previews.
4. Link this repo and set workflows to update project on PR/Issue events.

## Issues to Create

- Harden CORS rules in production (origin allowlist)
- Add helmet/CSP to Node server
- Add SIEM forwarding and structured audit logs
- Add OpenTelemetry tracing for FastAPI + Node
- Add WAF rules (e.g., path/method allowlist)
