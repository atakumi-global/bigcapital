# Project Constitution — Bigcapital

> Governing principles for this project, in the GitHub Spec-Driven Development
> sense: a short, stable set of rules that every specification, plan, task and
> commit must comply with. Where this constitution conflicts with any other
> instruction — chat, ticket, habit — **this document wins**. Amend it
> deliberately; never silently.

Version: 1.0.0 · Ratified: 2026-09-28

---

## Article I — Approval authority (NON-NEGOTIABLE)

A human owns approval. An agent may create, move, comment on, and provide
evidence for work; it must never approve its own work or anyone else's, and must
never move an item past **In Review** without a recorded human approval.

- Design approval and lifecycle approval are separate acts.
- Every approval records who approved, when, and — for designs — the exact
  version approved.
- Approving one version never implies approval of the next.

## Article II — Specification before implementation

Thinking happens before code. Every non-trivial piece of work has a written
problem, scope, and testable acceptance criteria before implementation begins.

- Acceptance criteria are numbered and pass/fail verifiable. "Fast", "clean"
  and "user-friendly" are not criteria.
- If the specification and reality conflict mid-build, the specification is
  updated first, then re-checked.
- A task no one can verify is not ready to be started.

## Article III — Plane is the source of truth

Lifecycle, estimates and approval live in Plane for the project named in
`.plane.json` — workspace `atakumi`, project `BIG`. Documents describe how to
work; Plane records where work stands.

- Work-item identifiers are assigned automatically by Plane. Never choose,
  invent or reuse one. Branches are named after their item (`BIG-163-…`).
- Estimates use the Fibonacci scale (`1, 2, 3, 5, 8, 13, 21`) and are recorded
  in the work item's `point` field. Anything at 21 or above is split.
- The lifecycle is: Backlog → Prepare → Todo → In Progress → Blocked →
  In Review → Approved → Deployed to stage → Approved by client →
  In production → Done / Cancelled.
- This Plane build has no custom fields or relations: approvals are the
  `needs-approval` / `approved` labels plus a fixed-form comment, and a design
  links to its feature as a **child** item.

## Article IV — Security and secrets

- Secrets are never committed. Keys live in environment variables (root `.env`,
  gitignored) or a secret manager, never in source, config, comments, tickets or
  documents.
- Any leaked secret is rotated, not merely removed. Wise credentials are
  env-only and must be **read-only**.
- Input is validated before it reaches a database.
- Authorisation is enforced at the API boundary, not only in the interface.

## Article V — Quality gates

No work is called done until its gate has been run and its evidence recorded.
Degrees of "should pass" are failures.

- A regression test is only proven when it has been seen to fail against the
  old behaviour.
- An agent's success report is a claim, not evidence.
- **Build before migrate:** the server CLI depends on built output —
  `pnpm run build:server` must run before any migration command.

## Article VI — Surgical change and simplicity

The minimum change that satisfies the criteria, nothing speculative.

- No unrequested abstractions, dependencies or features.
- Match the codebase's existing style, naming and structure. This is a fork of a
  large upstream project — keep our diff small and reviewable.
- Every changed line traces to the work being done. Unrelated improvements are
  raised as their own item, not smuggled into a diff.

## Article VII — Design precedes build

Any design outcome — new or changed UI, layout, styling, user-visible copy,
interaction, email or PDF template — is designed, reviewed and approved before
it is implemented.

- UI follows the existing BlueprintJS-based patterns in `packages/webapp`;
  reuse the established components rather than inventing new ones.
- Designs are versioned records under `prototypes/<work-item-id>/v1`, `v2`, …
  A previous version is never overwritten or edited.
- Accessibility is part of the design, not a later pass.

## Article VIII — Version control discipline

- Conventional Commits; one focused commit per task; each message references the
  work-item identifier.
- **Remotes:** `atakumi` is our fork and the only place we push; `origin` is
  upstream (`bigcapitalhq/bigcapital`) and is never pushed to. `dev` tracks
  `atakumi/dev`.
- History is readable: no force-push to shared branches, no rewriting published
  history.

---

## Governance

- **Supremacy.** This constitution supersedes conflicting instructions, however
  they arrive.
- **Compliance.** Every specification, plan, task and commit checks against these
  articles. A violation blocks the gate.
- **Amendment.** Changes are proposed as a work item, reviewed, and ratified as a
  version bump with a note of what changed and why.
- **Versioning.** MAJOR for removing or redefining a principle, MINOR for adding
  one, PATCH for clarifications.
