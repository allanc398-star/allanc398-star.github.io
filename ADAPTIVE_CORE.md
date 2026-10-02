# Javis Adaptive Core

Javis is the single controller. Apps and websites request capabilities through Javis rather than owning isolated bots.

## Worker routing

The backend worker catalogue defines specialist workers, their domains, capabilities and risk class. Javis can select the workers needed for a domain and can add a Security & Quality verification worker for high-risk work.

Initial worker roles:
- Research & Verification
- Health & Product Safety
- Vision & Product Identification
- Vehicle & Load Planning
- MONEY OPS
- Learning Lab
- Security & Quality

## Continuous learning gate

New information enters `javis_knowledge_candidates` as evidence, not truth.

Lifecycle:
`candidate -> verifying -> verified | disputed | rejected -> superseded`

A candidate records its domain, subject, source type/reference/date, confidence, risk class, evidence and verification history. New evidence must not silently overwrite conflicting or older evidence.

High-risk health, medicine, legal/compliance and vehicle-safety changes require a second verification path before trusted use.

## Worker audit

Every specialist assignment can be recorded in `javis_worker_runs`, linked to the originating command. The run records why the worker was selected, status, result and independent verification state.

## Human approval boundary

Adaptive learning and internal testing do not grant authority for consequential external actions. Public launch, spending, customer activity, agreements, monetisation and other approval-gated actions continue through Javis approvals.

## Database implementation

Migration `javis_adaptive_worker_and_learning_core` added:
- `javis_worker_catalog`
- `javis_worker_runs`
- `javis_knowledge_candidates`
- `javis_select_workers(domain, risk_class)`

Migration `harden_javis_adaptive_core` added foreign-key indexes and changed worker selection to SECURITY INVOKER with authenticated-only execution.

All new tables use RLS and the existing Allan-only owner policy pattern.
