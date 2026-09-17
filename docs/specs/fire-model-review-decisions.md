# FIRE Model Review Decisions

Status: review in progress  
Scope: `/planning/fire`, regular FIRE and age-in-bonds variants  
Source: interactive model review with the product owner

This file records decisions from the FIRE modelling review so they are not lost in chat. An accepted item is a product/model decision, not evidence that the implementation is complete. Implementation status must be verified separately.

## Accepted changes

### 1. Make return-sequence sampling selectable and persistent

- Preserve independent aligned-month sampling as the default/current behavior.
- Add a persisted alternative that samples contiguous 12-month blocks.
- Apply the selected method consistently to regular FIRE and age-in-bonds calculations.
- The setting must be persisted because it can change the safe rate, FIRE target, and progress percentage.
- Detailed UI design is parked for a focused design pass.

### 2. Explain the horizon-adjusted FIRE target honestly

- The selected rate is a base input to the target, not necessarily the effective expense-to-target withdrawal rate after the horizon adjustment.
- The UI should eventually distinguish the base rate from the effective rate and expose the target breakdown, for example `25x × horizon factor = effective multiple`.
- Detailed presentation design is parked for a focused design pass.

### 3. Stop mapping materially different risky assets to the same proxy

- Brazilian equities, US equities, and crypto should not all inherit IBOV returns.
- Design separate return proxies for materially different asset classes.
- Treat this as part of a broader asset-proxy redesign rather than a cosmetic relabel.

### 4. Require sufficient expense history for planning

- Do not present a canonical FIRE plan from only a few months of observed expenses.
- Require a meaningful history window or an explicit manual expense estimate.
- The exact minimum-history threshold remains to be designed.

### 5. Withdraw before applying the month's return

- In retirement simulations, model the periodic withdrawal before applying that month's investment return.
- This avoids granting returns during the month on money already spent for that month.

### 6. Do not display unsupported safe-rate precision

- Safe-rate results vary with the finite bootstrap cohort and do not support two-decimal precision.
- Present a rounded value or an appropriately coarse range instead.

### 7. Correct the methodology documentation after the monthly-engine migration

- Internal documentation and the methodology walkthrough must describe monthly sampling and monthly withdrawals.
- Remove stale descriptions of annual sampling and end-of-year withdrawals where they no longer match production.

### 8. Preserve annual target checkpoints, but document them internally

- Accumulation runs monthly but declares the FIRE target reached only at annual checkpoints.
- Preserve this conservative safety margin.
- Document the convention internally; do not expose implementation detail to the end user.

### 9. Model bank balances as cash without removing them from FIRE patrimony

- Bank cash remains part of FIRE patrimony and progress.
- Do not classify it as fixed income or assign CDI returns automatically.
- If cash is assumed to have zero nominal yield, its real return is negative inflation rather than zero real return.
- The exact cash-consumption and rebalancing policy remains for the asset-proxy design pass.

### 10. Use the same bootstrap cohort for the safe rate and its displayed evaluation

- The safe-rate search and the displayed success result must use the same deterministic trial cohort and trial count.
- This prevents the page from calling a rate "90% safe" and then displaying a materially different success percentage for that same rate.

### 11. Restore the documented pre-FIRE/post-FIRE retirement-chart split

- Before FIRE: the retirement preview starts at the projected retirement age with `fireTarget` as its starting balance.
- After FIRE: the retirement chart starts at the current age with current patrimony.
- Do not combine today's balance with a future retirement-age label.
- This restores behavior documented before the May 16, 2026 refactor (`6f61255d`).

### 12. Suppress accumulation timing when savings are non-positive

- When monthly savings are zero or negative, do not show a years-until-FIRE projection.
- Explain that a positive contribution estimate is required for the accumulation timeline.
- Keep the FIRE target and current progress visible.
- Do not automatically deduct the negative cash-flow amount from the FIRE portfolio; the source funding that deficit is unknown.

### 13. Persist the monthly savings override

- Default monthly savings remains average monthly revenues minus average monthly expenses.
- A manual FIRE savings/contribution override must be saved with the FIRE preferences.
- Resetting it removes the override and returns to the automatically derived value.

### 14. Align the aggressive-rate warning with the declared safety standard

- The model defines the safe rate using a 90% success threshold.
- Do not wait until success falls below 85% before warning.
- Trigger the warning when the selected rate exceeds the displayed safe rate, using the shared cohort described in decision 10.

### 15. Give the patrimony simulator one global meaning

- While the patrimony simulator is active, use the simulated patrimony consistently across the progress bar, sustainability calculations, and accumulation timeline.
- Do not let the page simultaneously report that the simulated scenario has reached the target while calculating years-to-target from actual patrimony.
- Keep actual patrimony visible separately for context.
- Resetting the simulator restores actual patrimony across all calculations.
- Align regular FIRE with the already-global behavior documented for the simulator and used by age-in-bonds.

### 16. Align qualitative verdicts with the 90% safety standard

- The main plan verdict must use the same 90% success threshold that defines the safe rate.
- Use `>= 90%` for robust, `80-89%` for caution, and `< 80%` for fragile.
- Do not label a plan that meets the declared safety standard as cautionary merely because it is below 95%.

### 17. Add characterization tests for the simulation engine

- Add direct automated tests around the financial engine before implementing the accepted modelling changes.
- Cover withdrawal timing, deterministic seeded sampling, aligned asset-month sampling, safe-rate calculation, accumulation checkpoints, and the age-in-bonds fixed-point solver.
- Preserve intentional decisions with regression tests so later refactors cannot silently change model semantics.

### 18. Name the horizon as retirement duration

- Replace the ambiguous `Horizonte: N anos` label with `Duração da aposentadoria: N anos`.
- Make clear that the period begins when retirement starts, not today.
- A user aged 40 who reaches FIRE at 55 and selects 60 years is modelling retirement through age 115.

### 19. Derive historical-data disclosures from the generated dataset

- Do not hard-code sample end dates or month counts in FIRE components.
- Derive the IBOV/CDI/IPCA and IFIX ranges and sample sizes from `FIRE_RETURNS_MONTHS` and `IFIX_MONTHS`.
- Regenerating return data must automatically update every user-facing disclosure.

### 20. Store the canonical FIRE methodology in tool-neutral repository documentation

- Move the canonical methodology out of the Claude-specific skill and into `docs/specs/fire-methodology.md`.
- Keep agent-specific skills as thin entry points that direct readers to the canonical document.
- Maintain one methodology source of truth that is discoverable by humans and any coding agent.
- This documentation change does not alter modelling or user-interface behavior.

### 21. Apply the age-in-bonds glide path during accumulation

- When the age-in-bonds alternative is active, use `RF% = age` throughout the accumulation forecast, starting at the user's current age.
- Do not hold today's allocation fixed until retirement while claiming that allocation changes during every simulated year.
- The projected retirement date and the retirement-phase target must therefore use a coherent age-based allocation path.

### 22. Let the persisted FII choice determine the historical sample regime

- Remove the hidden `0.5%` FII-weight cutoff that switches the historical sample window.
- When FII is included in the simulation, use the IFIX-compatible sample beginning in 2011.
- When `Excluir FII da simulação` is enabled, use the full IBOV/CDI/IPCA sample beginning in 1995.
- Avoid materially changing the FIRE target because an economically insignificant transaction crossed an arbitrary exposure threshold.

## Preserved behavior and rejected critiques

### Keep accumulation timing conditional on successful trials

The proposal to treat every failure as infinity in the displayed time-to-target percentile was rejected. It would often replace a useful conditional timing estimate with "not reached." Keep the success percentage beside the timing result. A wording clarification such as "among simulations that reached the target" may be considered, but it is not a priority change.

### Do not automatically deduct a monthly deficit from FIRE patrimony

A negative difference between revenues and expenses does not establish that the deficit is funded from the FIRE portfolio; it may be funded from cash, debt, irregular income, or another source. The accumulation timeline is suppressed instead, as specified in decision 12.

### Keep the 90% safety policy fixed

Do not add another end-user control for the success threshold. The product should not require users to configure every modelling assumption.

### Do not introduce speculative rebalancing behavior

No new rebalancing rule was accepted. A rule without evidence about user behavior would be guesswork.

### Do not remove cash from FIRE patrimony

Cash modelling must improve without reducing the user's measured FIRE patrimony. See decision 9.

### `exclude_ifix_from_sim` is already persisted

The claim that “Excluir FII da simulação” resets on reload was false. It is stored in `planning_preferences.fire.exclude_ifix_from_sim`, included in the save payload, and covered by backend preference tests. No change is required for its persistence.

### Keep the existing derived-savings averages

The proposal to calculate default savings from a single shared set of completed months was rejected. Keep deriving it as average revenues minus average expenses, using the existing indicator averages.

### Keep “never” scoped to the selected simulation horizon

The proposal to replace “never” with “not within N years” was rejected. Outcomes beyond the user-selected horizon are outside the planning question, so the existing shorthand is acceptable in context.

### Keep annual withdrawals expressed as a monthly average in chart tooltips

The proposal to replace the depletion-year monthly average with “months funded” was rejected. Keep displaying the year's actual withdrawals divided by 12 as the monthly-income figure.

### Keep pointwise percentile lines presented as scenarios

The proposal to replace the optimistic, median, and pessimistic scenario lines with percentile-band presentation was rejected. Keep the existing connected p10/p50/p90 lines.

### Do not add FIRE model versioning

The proposal to persist an internal model version for tracing output changes across methodology updates was rejected. Saved inputs continue to be evaluated by the current model without retaining old model-version metadata.

### Keep historical-return refresh manual without an automated freshness alert

The proposal to add an annual automated check for a missing completed data year was rejected. Continue updating the checked-in historical-return dataset deliberately and manually.

### Keep the trailing expense average in recorded nominal values

The proposal to restate each historical expense month into current reais using IPCA before averaging was rejected. Keep the existing nominal trailing-month calculation; manual expense overrides remain available.

### Keep the existing accumulation contribution timing

The proposal to move monthly contributions from the beginning to the end of each simulated month was withdrawn because its long-term effect is immaterial for this product. Keep the existing contribution-then-return convention.

### Keep the existing monthly-savings label

The proposal to append `em valores de hoje` to the monthly-savings label and explicitly disclose that accumulation treats savings as a constant real contribution was rejected. Keep the current label.

## Review protocol

- Continue with one critique at a time.
- Present only critiques that appear worth changing.
- State the practical user-visible consequence before proposing a design.
- Check existing methodology records and git history before treating established behavior as a new design question.
- Do not mark an item accepted merely because it was discussed; record explicit agreement.
