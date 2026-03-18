# Fix: Reports component includes closed assets in total invested / percentage views

## Problem

`react/src/pages/private/Assets/Reports/AssetAggregationReports/index.tsx` — the `Content` component has `opened` and `closed` state both defaulting to `true`. These are passed to `useAssetsReports` for **every** kind, including `TOTAL_INVESTED` and `TOTAL_INVESTED_PERCENTAGE`.

Closed assets have `quantity_balance <= 0`, so their `normalized_current_total` is 0. Including them:
- Adds zero-value entries to total invested reports (noise)
- Dilutes percentages in percentage reports (e.g., a closed STOCK type shows 0 total, making other types appear to have a smaller share than they actually do among open positions)

The `opened`/`closed` toggles are only relevant for `ROI` reports where closed assets have meaningful `normalized_closed_roi` values.

## Fix

For `TOTAL_INVESTED` and `TOTAL_INVESTED_PERCENTAGE` kinds, always pass `opened: true, closed: false` to `useAssetsReports` (or don't pass those params at all and let the backend default to opened-only).

Only expose the opened/closed checkboxes in the `RoiContent` branch.

## Files

- `react/src/pages/private/Assets/Reports/AssetAggregationReports/index.tsx` — lines 137-181
