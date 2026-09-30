# VPW review decisions

Status: review decisions recorded; implementation in progress in the main worktree; all changes remain uncommitted.
Scope: the current VPW planning implementation, with FIRE PR #45 as context.
Source: interactive review with the product owner.

These are approved decisions, not a record of completed implementation. Implementation evidence and remaining work are tracked separately; historical growth uses compounded real portfolio returns; pension support was explicitly excluded by the owner.

## Approved strategy and product changes

1. **Use asset-specific historical returns.** Replace VPW's legacy IBOV/IFIX/CDI buckets with the asset-specific return modeling introduced for FIRE. Apply this to both accumulation and retirement simulations. Brazilian, US, and global equities and crypto must not all inherit IBOV returns; fixed-income modeling should likewise use the relevant asset classification.

2. **Derive the VPW growth assumption from historical data.** Use the same historical dataset and asset-specific return infrastructure as FIRE to derive the inflation-adjusted growth assumption used by VPW's withdrawal formula. Remove the manual stock-return and bond-return sliders. Preserve VPW's recalculation of the withdrawal allowance from portfolio balance and remaining retirement years. This does not convert VPW into FIRE's constant-spending rule.

3. **Disclose accumulation success alongside conditional timing, matching FIRE.** Keep time-to-target percentiles calculated among simulations that reach the target, and display the percentage that reached it. Do not introduce the separately proposed 90% threshold for displaying a retirement date: the owner chose to match FIRE instead. Reaching an accumulation target and sustaining retirement spending are distinct outcomes.

4. **Suppress accumulation timing when monthly savings are not positive.** Match FIRE: ask for positive savings before presenting a retirement-date forecast. Preserve the target and current coverage. Do not assume that a spending deficit is funded by selling retirement investments.

5. **Describe initial coverage accurately.** Replace claims such as "you can retire today" based solely on initial withdrawal coverage with wording such as "your initial withdrawal covers your expenses." Initial coverage does not establish coverage throughout retirement.

6. **Pensions excluded (supersedes earlier approval).** The owner explicitly said "leave it out" after confirming INSS is not measured in the app and a shared FIRE/VPW pension feature would be separate scope. The monthly input means the amount requested from investments.

7. **Use the user's monthly spending input as the withdrawal ceiling.** If VPW allows R$8,000/month and the user enters R$5,000, simulate withdrawing R$5,000 and retain the difference in the portfolio. If the allowance falls to R$4,000, withdraw R$4,000. This is the required behavior, not an optional mode. The earlier proposal to keep full withdrawals as the default was superseded. Actual withdrawals must also respect available balance. A cap can leave capital unspent at the selected end age; do not assume the previous forced-depletion result remains valid.

## Approved calculation and implementation changes

8. **Offer FIRE's sampling choices.** Support independent aligned historical months and consecutive 12-month historical blocks. The owner approved giving VPW the same choice already available in FIRE.

9. **Calculate minimum income within each simulated retirement first.** Find each trial's lowest annual withdrawal expressed as a monthly average, then calculate pessimistic, median, and optimistic percentiles across those trial minima. Do not substitute the minimum of each year-by-year percentile line. Illustrative distinction: three retirements can each fall to R$2,000 in different years while every year's median remains R$6,000. Exclude the artificial terminal chart point from retirement-income observations.

10. **Use consistent withdrawal calculations and limits throughout the page.** The headline and simulation must agree about withdrawal ceilings and available capital. The existing formula can advertise R$1,050/month from R$12,000 with one year remaining and a 5% growth assumption while the simulation caps payment at R$1,000/month. Correct this inconsistency alongside the spending ceiling.

11. **Report the period actually simulated when the target is not reached.** The existing accumulation horizon is capped at `min(80, yearsRemaining - 1)`. Do not claim "more than 80 years" when, for example, only 19 years were simulated. State that the target was not reached within the actual simulated period.

12. **Run expensive VPW simulations in the background.** Reuse the approach employed by FIRE so recalculation does not block page interaction. A local Node timing check of the current functions for age 40, target age 99, 1,500 trials, and a 50% equity / 10% FII / 40% fixed-income allocation took approximately 0.9 seconds for accumulation and retirement combined. This was a calculation benchmark, not a browser responsiveness measurement.

13. **Correct the zero-growth withdrawal formula.** R$120,000 over ten years at zero growth should allow R$1,000/month, not negative R$1,000/month. The current positive-only sliders hide the sign error in the zero-rate branch. Fix this before replacing those sliders with a historically derived assumption.

14. **Align the withdrawal formula with monthly payment timing.** The current formula assumes end-of-year payments, while the simulation withdraws at the beginning of each month. Correct the formula and the resulting retirement target to use the actual monthly timing. In a controlled case with R$100,000, twenty years, and a constant 5% effective annual real return, the current initial allowance is approximately R$668.69/month; the corresponding beginning-of-month payment is approximately R$651.18/month. The owner approved this after clarification that money withdrawn during the year cannot earn returns through December.

15. **Preserve monthly withdrawal timing in the final year.** Remove the annual shortcut that immediately empties the portfolio when the planned annual withdrawal equals or exceeds the starting balance. Process withdrawals monthly, capped by the remaining balance at each withdrawal, and apply returns to the money still invested. This refines decision 10: the limits must agree across the page, but the entire year's withdrawal should not be capped by forcibly liquidating the starting balance before monthly growth can occur.

16. **Keep target-age controls usable after invalid input.** Prevent selecting a target age at or below the current age. If an existing saved preference is invalid, keep the controls available so it can be corrected; do not replace the entire indicator with an error that hides the control.

17. **Recalculate the VPW allowance monthly.** Adjust the allowance using the current portfolio balance and remaining duration each month, rather than fixing twelve monthly payments from a calculation performed once per year. Keep the user's monthly spending input as the ceiling. This supersedes the annual recalculation cadence described in decision 2. Annual chart values may summarize monthly results; they must not drive an annual-only withdrawal decision.

## Implementation requirements clarified during review

- **Preserve runtime performance, including inside a worker.** When approving monthly recalculation, the owner explicitly cited an earlier FIRE change that reportedly made simulations about 100 times slower despite use of a worker. Moving work off the main thread is not sufficient. Capture comparable before-and-after calculation timings for the same trial counts, portfolios, horizons, and sampling modes. Precompute the balance-independent monthly withdrawal-rate schedule and reuse it across trials; likewise reuse historical return preparation and sampling-window preparation. Check total calculation latency as well as UI responsiveness. Investigate and resolve substantial runtime regressions rather than reducing trial counts or treating the worker as proof of adequate performance. No numerical slowdown tolerance was agreed.
- **Follow FIRE's UI format.** Reuse FIRE's layout and presentation conventions while explaining VPW's actual calculations. Updating VPW's embedded explanation so it no longer teaches FIRE's fixed withdrawals and safe-rate search is a routine implementation detail, not a separate product decision requiring another approval.
- **Review interaction.** Present one substantive critique at a time, using a short concrete example followed by the proposed change. Keep implementation bugs and missing options until after strategy critiques. Record a decision before moving to the next item; do not treat an unresolved question as approval.

## Preserved behavior and rejected proposals

- **Preserve separate meanings for actual and simulated wealth.** The wealth simulator changes the retire-today withdrawal scenario; accumulation timing continues from actual current wealth. The owner explicitly accepted this separation after confirming regular FIRE currently does the same. An earlier assistant claim that regular FIRE used simulated wealth for both was incorrect.
- **Do not add a separate essential-spending input.** The existing monthly expense control lets the user test a lower budget. The proposal for an additional minimum acceptable spending field was withdrawn.
- **Keep one monthly spending amount.** The proposal for age-dependent expense schedules, such as R$6,000 until age 60 and R$4,000 afterward, was rejected.
- **Do not automatically add withdrawal taxes.** Taxes may already be recorded as expenses, so another charge could double-count them. The proposal was withdrawn. Future retirement taxes may differ from observed expenses, but no additional tax model was approved.
- **No new 90% accumulation gate.** The owner's decision was to match FIRE's conditional timing plus disclosed reach percentage, not the earlier proposal to require 90% of all trials to reach the target by a displayed age.
- **Withdrawn liquidity proposal.** The reviewer introduced a hypothetical concern about investments locked until maturity without establishing its applicability. It was withdrawn and is not approved implementation scope.

## Resolved implementation details

- Use annualized compounded real returns of the selected, monthly rebalanced portfolio over its aligned historical months, including chosen fallback histories. This measures the actual compounded growth, not the arithmetic average. Zero and negative growth use the tested monthly annuity formula. The owner regarded this as basic correctness, not a separate feature decision.
- Historical-data preferences are configured independently for VPW as an implementation choice consistent with existing per-strategy preference ownership. The datasets and controls are shared; editing VPW must not change saved FIRE settings.
- No pension fields, payment schedule, or target adjustment in this change.
- Label the formula amount as the VPW allowance and the capped amount as the actual initial withdrawal. Reuse FIRE scenario inputs and manual Recalculate snapshots.

## Reference files inspected

- `react/src/pages/private/Home/VPWIndicator.tsx`
- `react/src/pages/private/Home/VPWSimulationResults.tsx`
- `react/src/pages/private/Home/fireBootstrap.ts`
- `react/src/pages/private/Home/firePortfolio.ts`
- `react/src/pages/private/Home/ConstantDollarIndicator.tsx`
- `react/src/pages/private/Home/fireSimulation.ts`
- `react/src/pages/private/Home/fireResultPresentation.ts`
- `react/src/pages/private/Planning/strategies/VPWDetail.tsx`
- `react/src/pages/private/Planning/strategyContent.tsx`
- `react/src/pages/private/Planning/api.ts`
- `django/authentication/serializers.py`
- `docs/specs/fire-model-review-decisions.md`
- `.claude/skills/vpw-methodology/SKILL.md` (contains descriptions that do not all match current code)

FIRE context: https://github.com/MuriloScarpaSitonio/multi-sources-financial-control/pull/45

Original VPW references consulted:

- https://www.bogleheads.org/wiki/Variable_percentage_withdrawal
- https://www.bogleheads.org/forum/viewtopic.php?start=2000&t=120430
- https://www.bogleheads.org/forum/viewtopic.php?p=4835777

## Approved UI and accumulation correction — 2026-09-27

The user's latest approval supersedes the old RV override decision: add FIRE's extra accumulation years (after target crossing, keep contributing, then retire until the unchanged target age); remove the allocation/cash sentence; replace the custom coverage banner with FIRE's results layout adapted to VPW income; remove the RV control and ignore saved allocation overrides. All work stays uncommitted in the main worktree.

Implementation: extra years default to zero, preserving current outputs. With extra years, each trial keeps its own accumulated balance and target-crossing time; only trials starting retirement before target age contribute retirement observations. Bands use calendar age and disclose conditional participation. Actual-wealth accumulation remains separate from scenario-wealth retirement, matching FIRE. Retain the existing explicit empty-portfolio reference. No pensions or tax assumptions are added.

## Approved retirement target correction — 2026-09-28

The owner chose **95%** as the success threshold for Meta VPW. The target now means enough capital to cover the requested monthly spending in every retirement month through the ending age in at least 95% of sampled retirements. This supersedes using the first-withdrawal annuity amount as the retirement target. Initial coverage remains a separately named concept in the compact indicator.

Calculate the current target and each future age's target with the same historical sampling and monthly VPW cash flows used for retirement. Use these targets consistently for the target card, progress, accumulation crossing, and estimated retirement age. This changes the capital required to retire; it does not introduce a minimum accumulation-reach probability for showing conditional timing. Extra accumulation still follows each trial's own balance and start time, with participation disclosed.

Estimated safe spending retains its separately approved 90% threshold. FIRE's target methodology is unchanged. Success percentages display at most two decimal places without trailing zeros: 100%, 99,9%, 99,95%.
