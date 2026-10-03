# Javis Adaptive Core

Javis is the single controller. Apps and websites request capabilities through Javis rather than owning isolated bots.

## Worker routing

The backend worker catalogue defines specialist workers, their domains, capabilities and risk class. Javis can select the workers needed for a domain and can add Security & Quality verification for high-risk work.

Core commercial build streams now under Javis cloud coordination:
- Kids adaptive learning
- Adult learning, job readiness, RPL and continuing professional development
- Allergy and product safety
- Career, resume and document evidence

## Adult learning expansion

The adult platform must support:
- voice-first interactive interviewing and spoken responses
- occupation and career-goal discovery
- country/jurisdiction aware occupation, qualification and provider records
- official Australian training-package, unit and RTO mapping as the first jurisdiction
- international qualification/provider adapters rather than assuming the Australian RTO model worldwide
- RPL pre-assessment that maps experience and evidence to requirements without claiming the formal assessor decision
- evidence-gap identification and document gathering
- regulated trade/profession pathways including applicable legislation, regulations, licensing requirements and source/effective dates
- adaptive knowledge assessment from beginner through advanced
- true/false, scenario, multiple-choice, matching and missing-word/drop-in exercises
- progressive hints, corrective teaching, alternate-question retesting and delayed retention checks
- continuing professional development and change training when verified rules or requirements change
- links to the verified career evidence record, with user permission

## Allergy and product-safety expansion

The allergy platform must support a voice-first interactive assistant plus specialist workers for product research, ingredient identity, medicines, food, cosmetics, medical-document extraction and independent safety verification.

Research sources may include retailer/manufacturer catalogues and discovery databases such as EWG Skin Deep, but discovery data is not medical clearance. Ingredient identity and medically important relationships must be independently verified against appropriate authoritative chemical, regulatory and clinical sources before trusted use.

The product database should track market/country, formulation/source/version/date, ingredients, allergens, identifiers and formulation conflicts. It must support alternative-product searching against an individual's profile while avoiding unsupported claims that a product is medically safe.

## Accessibility

Voice is a shared capability across public products. Users should be able to explain experience, goals, reactions or questions naturally without being forced to type. This is an accessibility requirement, including support for people who find written interaction difficult.

## Continuous learning gate

New information enters `javis_knowledge_candidates` as evidence, not truth.

Lifecycle:
`candidate -> verifying -> verified | disputed | rejected -> superseded`

A candidate records its domain, subject, source type/reference/date, confidence, risk class, evidence and verification history. New evidence must not silently overwrite conflicting or older evidence.

High-risk health, medicine, legal/compliance, regulated-profession and vehicle-safety changes require independent verification before trusted use.

## Worker audit and security

Every specialist assignment can be recorded in `javis_worker_runs`, linked to the originating command. Runs record why a worker was selected, status, result and independent verification state.

Javis security workers protect controller integrity, worker isolation, approval gates, audit integrity, privacy and data-exfiltration boundaries. Security findings must be independently verified and security workers cannot self-approve findings.

## Human approval boundary

Adaptive learning, research, private development and internal testing do not grant authority for consequential external actions. Public launch, spending, customer activity, agreements, monetisation and other approval-gated actions continue through Javis approvals.

## Cloud build handoff

Javis cloud is the build coordinator for these commercial streams. New ideas are converted into scoped build requirements, routed to appropriate specialist workers, researched and verified, security checked, tested and recorded before release. Public/live deployment remains approval-gated. Development changes stay off the live branch until tested and explicitly approved.
