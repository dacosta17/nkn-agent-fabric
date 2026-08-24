# Crypto-Architect Evaluation

## Thesis

NKN is the transport and addressability layer. The application protocol is a **verifiable execution layer**: agents advertise capabilities, negotiate tasks, execute independently, return signed attestations, and are accepted only when a deterministic domain policy is satisfied.

## Domain model

The protocol has one common envelope and five policy modules:

1. **Intelligence** — evidence-backed research and fact verification.
2. **Security** — independent security assessments with critical-finding veto.
3. **Infrastructure** — distributed health and latency observation.
4. **DeFi** — independent risk evaluation before any financial action; no execution in the current POC.
5. **Automation** — policy-version-bound approval before an operational action.

Each domain emits a deterministic result and evidence object. LLMs may propose or summarize tasks, but they are not allowed to override deterministic acceptance rules.

## Trust boundaries

- **NKN transport** authenticates and encrypts communication.
- **Application identity** signs capability manifests, quotes, and attestations.
- **Evidence** binds task/result digests, timestamps and source provenance.
- **Domain validator** decides acceptance deterministically.
- **Quorum engine** rejects insufficient independent evidence and explicit Byzantine/outlier cases.
- **Reputation** tracks outcomes but is not yet a security primitive because it is local/in-memory.

## Strict review

### Strengths

1. Real NKN traffic is used instead of an in-memory transport mock.
2. Application truth is separated from transport identity: a valid signature proves who made a claim, while domain validators decide whether that claim satisfies policy.
3. The five use cases reuse one protocol rather than five unrelated demos.
4. Negative assertions are first-class: weak evidence, critical security findings, stale policy, unsafe DeFi risk, and insufficient quorum are rejected.
5. The architecture can later support economic settlement without making payment part of the current safety proof.

### Remaining weaknesses

1. **Coordinator trust** — the current POC still has a centralized orchestration point.
2. **Sybil/collusion resistance** — signatures do not prove that operators are independent. Production requires operator diversity, stake, or another Sybil-cost mechanism.
3. **Evidence correlation** — multiple agents reading the same upstream source can agree while being jointly wrong.
4. **Persistent reputation** — local reputation is resettable and not portable between coordinators.
5. **Economic security** — no escrow, stake, slashing or settlement is currently implemented.
6. **WAN benchmark fairness** — localhost HTTP is only a lower bound; a fair comparison requires equivalent multi-region centralized infrastructure.
7. **Permissionless discovery** — the POC still knows agent addresses out of band; discovery must become a protocol feature.

## Product direction

The stronger public product is not an NKN agent marketplace. Mature marketplaces already exist elsewhere. The differentiator is **verifiable agent execution**: independent agents can be used as a trust layer for intelligence, security, infrastructure, DeFi risk, and automation.

The next milestones are permissionless capability discovery, portable signed reputation, multi-region deployments, collusion/Sybil testing, and NKN-denominated settlement/escrow after the verification layer is validated.
