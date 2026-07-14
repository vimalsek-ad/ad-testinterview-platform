# Metrics & ROI Report — ADHire
*Before/after projections · assumptions · data sources · confidence levels*

---

## Executive summary
Replacing Alter Domus's 4–5 external assessment vendors with an in-house platform (**ADHire**) is projected to deliver **€475K+ in annual value** against a small marginal run-cost, for a **~15× return** and **break-even by Month 3**. Value comes from two sources: eliminating **€115K/yr** of SaaS licences and reclaiming **~€380K/yr** of manual evaluation time — plus non-cash gains in integrity, compliance, and candidate experience.

## Before / After projections

| Category | Before (external) | After (ADHire) | Annual value | Type |
|---|---|---|---|---|
| SaaS licence fees | €115K/yr | €0 marginal (unlimited) | €115K | Hard cost |
| Evaluation time | 2–3 hrs/candidate | ~15 min/candidate | €380K | Soft (time) |
| Proctoring | None | Built-in + audit trail | Integrity | Risk/quality |
| Data portability | 0% | 100% on AD infrastructure | Compliance | Risk |
| Candidate experience | 4 fragmented tools | 1 branded portal | Brand | Qualitative |
| Total quantified | | | €475K+/yr | |

**Headline:** €475K+ annual value · ~15× return · break-even Month 3 · 100% AD-owned data.

**How the two numbers are built**

- **SaaS savings (€115K):** current combined annual licences (HackerRank · Codility · HireVue · SHL/Criteria · ad-hoc) → €0 marginal on owned infra.
- **Evaluation-time savings (€380K):** today ≈ 767 hrs/month (2–3 hrs × ~256 candidates/mo) ≈ €460K/yr at €50/hr. Cutting per-candidate effort from ~2.5 hrs to ~15 min removes ~90% of that time → ≈ €380K/yr reclaimed (residual ~€80K is human-in-the-loop review that remains).

## Assumptions

| # | Assumption | Basis |
|---|---|---|
| A1 | Volume: 6,000+ assessments/yr (500+/mo) | Current hiring throughput |
| A2 | Loaded people cost = €50/hr | Stated planning rate |
| A3 | Current effort = 2–3 hrs/candidate | Existing recruiter workflow |
| A4 | Future effort = ~15 min/candidate | Automated scoring + AI-assisted review |
| A5 | SaaS licences fully retired = €115K/yr | Vendor consolidation to ADHire |
| A6 | Infra/run cost is marginal (unlimited) | Runs on existing AD cloud (AWS) |
| A7 | Time saved is redeployed to higher-value work | Needed for it to be cash-releasing |
| A8 | Build + maintenance investment modest vs €475K value (implied ~€30K for 15×) | Not specified in source — must confirm |

## Data sources

| Metric | Source | Quality |
|---|---|---|
| Volume, roles, teams, offices | AD hiring-ops current-state | Internal, reliable |
| SaaS licence cost (€115K) | Vendor contracts / renewals | Internal, reliable |
| Manual hours (767/mo) & per-candidate time | Recruiter estimate (2–3 hrs) | Estimate — validate with time study |
| €50/hr loaded rate | Finance planning assumption | Planning figure |
| After-state time (15 min) | ADHire target / MVP behavior | Projection — validate in pilot |
| Break-even Month 3, 15× | Derived from value ÷ investment | Depends on unconfirmed build cost (A8) |

## Confidence levels

| Projection | Confidence | Why |
|---|---|---|
| SaaS savings €115K/yr | High | Contractual, directly removable once vendors retired |
| Data portability 0→100%, on-AD residency | High | Architectural fact of building in-house |
| Proctoring + audit trail | High | Delivered as a platform capability |
| Evaluation-time savings ~€380K/yr | Medium | Depends on true baseline hours (A3), realized 15-min target (A4), and time redeployment (A7) |
| Candidate / brand experience | Medium (qualitative) | Real but not directly monetized here |
| ~15× return / break-even Month 3 | Low–Medium | Sensitive to the unconfirmed build & run investment (A8) |

**Overall confidence: Medium-High** on the ~€475K value envelope — the hard €115K is high-confidence, the €380K time value is the main variable, and the ROI multiple/break-even need the investment figure locked down.

## Sensitivity (what moves the number)

- **Baseline hours:** at 2 hrs (not 2.5) the time value drops ~€75K; at 3 hrs it rises ~€75K.
- **Adoption:** value scales with % of the 6,000 assessments actually run on ADHire.
- **Time redeployment:** if saved recruiter time isn't reallocated, ~€380K is capacity/quality gain, not hard savings.

## Recommended validation before external quoting

1. **Time study** on 20–30 real assessments → firm up the 2–3 hr baseline and the 15-min target.
2. **Lock the investment** (build + annual run/infra) → makes the 15× / Month-3 break-even defensible.
3. **Pilot one team** (e.g., Data Engineering) → measure adoption %, actual per-candidate time, candidate NPS.

## Bottom line
**€475K+ annual value · ~15× return · break-even Month 3 · 100% AD-owned data.** The savings case is anchored by a high-confidence €115K hard cost and a medium-confidence ~€380K time reclaim; confirm the baseline hours and the build investment to move the ROI from "planning estimate" to "board-ready."

*Figures are planning estimates scaled to Alter Domus (~5,000+ employees, 40+ offices). Loaded people-cost assumed at €50/hr.*
