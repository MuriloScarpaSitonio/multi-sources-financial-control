# FIRE Planning Page Redesign

**Date:** 2026-09-18  
**Status:** Approved  
**Scope:** Presentation and interaction redesign of `/planning/fire`

## Purpose

Replace the current dense single-column FIRE interface with a simulation workspace that keeps scenario controls separate from results, makes recalculation explicit, and preserves the existing interface for direct comparison during rollout.

This redesign does not change FIRE formulas, portfolio classification, historical-return data, preference semantics, or simulation methodology.

## Selected layout

Use the approved **Simulation Studio** layout:

- A left panel contains scenario inputs and advanced assumptions.
- A larger right column contains FIRE status, simulation verdicts, warnings, and charts.
- The left panel remains visible while reviewing results and is collapsible.
- When collapsed, it becomes a narrow rail with an explicit control to reopen it; the results column expands into the released space.

The page header retains the strategy title, active-strategy state, and save action.

## Legacy comparison

Do not delete or rewrite the current FIRE interface.

Add a simple **Legacy / New** switcher in the page header:

- `New` displays the Simulation Studio.
- `Legacy` displays the current UI unchanged.
- Switching views does not persist a preference, change scenario values, or trigger a save.
- Both views consume the same underlying data and planning preferences.
- Manual recalculation applies only to the new interface. The legacy interface retains its current recalculation behavior.
- The legacy implementation is removed only through a later, explicitly approved change.

## Scenario panel

The expanded left panel contains:

- Patrimony.
- Monthly expenses.
- Monthly contribution/savings.
- Withdrawal rate.
- Retirement horizon.
- Historical-sequence sampling control.
- An expandable advanced-assumptions section.
- A primary `Recalculate` button.

Inputs retain the existing distinction between current values, temporary simulations, and persisted planning preferences. The redesign must not silently change which values are saved.

Editing an input does not automatically run the simulation. It updates local draft state and makes the scenario ready to recalculate. `Recalculate` submits the complete draft scenario to the existing simulation worker.

The page-level save action remains separate from recalculation: recalculation previews the draft; save persists the supported preferences through the existing preferences endpoint.

## Advanced assumptions

Advanced assumptions expand inside the left panel and contain:

- Only historical-return categories currently owned by the user.
- Inclusion controls for those categories.
- Proxy selectors for the categories that already support user selection.
- Automatically derived fixed-income proxies as read-only descriptions.
- Each source's available start date.
- The resulting common historical period.
- The age-in-bonds switch.

Changing sources or proxies updates the displayed resulting period immediately, but the results column continues to show the last calculated scenario until the user presses `Recalculate`.

## Results column

The right column presents information in this order:

1. Current FIRE progress, target, and estimated time to target.
2. Sustainability verdict for retirement starting today.
3. Historical-period warning when applicable.
4. Accumulation and retirement charts.
5. Supporting scenario metrics and explanations.

The historical-period warning remains visible in the results flow. Its `Adjust` action opens the left panel, expands advanced assumptions, and focuses the historical-source controls.

Methodology explanations remain collapsed below the primary results and controls. They must not compete with the scenario or verdict for initial attention.

## Recalculation state

Pressing `Recalculate` starts the existing Web Worker simulation.

While it runs:

- The side panel remains visible and responsive.
- The `Recalculate` button is disabled and reads `Recalculating…`.
- Result cards, metrics, warnings, and charts are replaced with layout-matched skeletons.
- No stale result is presented as though it belongs to the new scenario.

When calculation succeeds, skeletons are replaced atomically by the new result. When it fails, skeletons are removed and the results area shows an actionable error while preserving the draft inputs so the user can retry.

## Component design

Keep FIRE calculation functions and worker request/result contracts shared between the two presentations. The new UI must not introduce a second FIRE engine or duplicate financial logic. The legacy presentation retains its existing automatic worker orchestration; the new presentation adds an explicit recalculation boundary around the same worker contract.

Recommended boundaries:

- `FireDetail`: owns loaded preferences, draft scenario state, persistence, and Legacy/New view selection.
- The existing legacy indicator components remain mounted only when `Legacy` is selected and are not rewritten for the redesign.
- `FireSimulationStudio`: owns the two-column layout and collapsed-panel state.
- `FireScenarioPanel`: edits the draft scenario and emits `Recalculate`.
- `FireHistoricalAssumptions`: renders category inclusion, proxies, and historical-period feedback.
- `FireResultsPanel`: renders progress, verdicts, warnings, charts, skeletons, and simulation errors.

Both presentations receive the same loaded data, draft scenario state, and preference mutation functions. Each presentation builds the established worker request from that shared state according to its approved interaction behavior.

## Responsive behavior

On wide screens, use the selected left-panel/right-results layout.

On narrow screens:

- The scenario panel becomes a full-width collapsible section above results.
- The collapsed rail is replaced by a normal `Edit scenario` disclosure control.
- Results remain the primary content after the scenario section.
- The Legacy/New switcher remains in the header without becoming sticky or obscuring page content.

## Rollout

The first release ships both views. `New` is the default comparison view, while `Legacy` remains available through the header switcher.

No preference migration or database change is required for the UI comparison. Removal of the legacy view is explicitly outside this implementation and requires later approval.

## Testing

### Component tests

- Legacy/New switching preserves draft inputs, does not persist anything, and does not change the legacy view's automatic recalculation behavior.
- Collapsing the side panel expands the results column and the rail reopens it.
- Editing inputs does not start the worker.
- `Recalculate` sends one complete draft request to the worker.
- The results column shows skeletons while the worker is pending.
- Successful recalculation replaces all skeletons with the matching result.
- Failure replaces skeletons with an error and keeps the draft scenario.
- Historical-source and proxy changes update the common period before recalculation.
- `Adjust` opens and focuses historical-source controls.
- The narrow-screen disclosure replaces the desktop rail behavior.

### Regression tests

- The legacy UI renders and behaves as it does before the redesign.
- Saving continues to persist only the existing supported preferences.
- Both views use the same FIRE worker request and result contracts.
- FIRE calculations and deterministic fixtures remain unchanged.

## Non-goals

- Changing FIRE formulas or historical-return methodology.
- Moving the simulation to the backend.
- Persisting the Legacy/New comparison switch.
- Automatically recalculating after every input change in the new interface.
- Removing the legacy UI in this change.
- Adding new financial inputs or user-configurable methodology.

## Acceptance criteria

- `/planning/fire` defaults to the new Simulation Studio while allowing instant comparison with the unchanged legacy UI.
- Scenario controls are isolated in a collapsible left panel on desktop.
- Results receive the freed width when the panel is collapsed.
- Simulation runs only after the user presses `Recalculate`.
- The complete results area uses skeleton loading states during calculation.
- Historical-period feedback remains prominent and links directly to source configuration.
- No existing FIRE calculation, preference, or user data changes as a consequence of the redesign.
