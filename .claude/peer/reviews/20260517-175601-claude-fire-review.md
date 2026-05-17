# PR #29 review — feat/b3-fire-return-data

Branch: `feat/b3-fire-return-data` · Base: `master` · PR: https://github.com/MuriloScarpaSitonio/multi-sources-financial-control/pull/29

Scope: switch FIRE bootstrap data source from NEFIN/SELIC CSV + hardcoded IFIX yearly table to B3 IBOV + B3 IFIX (point-in-time daily levels) + BCB SGS 4391 (CDI) + BCB SGS 433 (IPCA). Regenerated `fireReturns.ts` (now 1995–2025, 31 years) and updated docs/UI labels.

Numerical spot-check (output in `react/src/pages/private/Home/fireReturns.ts`) matches expected reality at the years I tested:
- 1995 equity real `-0.193372`: nominal IBOV ≈ -1.3%, IPCA 22.4% → -19.3% ✓
- 1996 equity real `+0.494634`: nominal IBOV ≈ +63.8%, IPCA 9.6% → +49.5% ✓
- 2008 equity real `-0.444989`: nominal IBOV ≈ -41.2%, IPCA 5.9% → -44.5% ✓
- 2009 equity real `+0.751067`: nominal IBOV ≈ +82.7%, IPCA 4.3% → +75% ✓
- IFIX new vs old hardcoded: 2011 old 16.51% nom → 0.094 real matches new `0.093949`; 2019 old 35.98% nom → 0.304 real matches new `0.303618`; 2024 old -5.89% nom → -0.102 real matches new `-0.102303` ✓

So the new pipeline reproduces the prior IFIX table exactly and the equity/CDI numbers line up with expected real returns. Functionally correct on the years checked.

## Findings (severity-ordered)

### High

1. **`django/variable_income_assets/scripts.py:602-813` — zero test coverage on a fragile new ingest.** Function is `# pragma: no cover` (line 606), and the diff adds ~150 lines of B3 protocol handling (base64-encoded JSON payload at lines 654-659, undocumented `indexStatisticsProxy/IndexCall/GetPortfolioDay` endpoint at line 619, `day × rateValue{month}` matrix parsing at lines 669-684, IBOV split normalization at lines 641-647, year-end-close extraction at lines 686-706) with no automated coverage. The shape of `fireReturns.ts` is load-bearing for every FIRE / VPW / 1-N / age-in-bonds chart in the React app, and a silent regression here (B3 API change, format flip from un-adjusted → adjusted IBOV values, schema rename of `rateValue{N}` / `results` / `day`) would corrupt the generated arrays without raising. The script is `# pragma: no cover`, so neither unit tests nor a fixture-based snapshot exists. At minimum, recommend a fixture-driven snapshot test of `compute_annual_index_returns` against a recorded B3 response (split-boundary + ordinary year) and an assertion that the emitted TS file has matching-length `FIRE_RETURNS_YEARS` / `EQUITY_REAL_RETURNS` / `FIXED_INCOME_REAL_RETURNS` arrays.

2. **`scripts.py:641-652` — IBOV split normalization assumes B3 returns "as-displayed-at-time" values and only handles the 1997-03-03 redenomination.** The `/10 for refdate < date(1997, 3, 3)` branch silently breaks under two scenarios that are not guarded against:
   - If B3 ever flips `GetPortfolioDay` to return modern-scale (back-adjusted) IBOV values, the `/10` would *re-divide* 1995–1996 prices, producing return ratios that look continuous within an era but get mis-divided across the 1997-03-03 boundary. The change would not raise — it would just silently emit corrupted equity returns for those years.
   - If `start_year` is dropped below 1995, the script also needs to handle the 1994-08-22 and 1994-02-10 redenominations (and pre-Real-Plan splits before that). Currently the default `start_year=1995` makes this latent, but the function signature exposes `start_year` as a parameter (line 604) with no docstring constraint. A caller picking `start_year=1993` would silently get wrong values.
   No comment in the code calls out either assumption. Recommend a sanity-check assertion (e.g. `assert annual_ibov[1995] is within plausible bounds`) plus a docstring constraint that `start_year >= 1995`.

### Medium

3. **`scripts.py:608-617` — function docstring is now stale on outputs.** Says "a .ts file with EQUITY_REAL_RETURNS and FIXED_INCOME_REAL_RETURNS" but the file also writes `FIRE_RETURNS_YEARS`, `IFIX_YEARS`, and `IFIX_REAL_RETURNS` (lines 796, 801, 803). And the opening line says "Download B3 IBOV, BCB CDI, and BCB IPCA" but omits B3 IFIX even though IFIX is downloaded at line 764. Cosmetic, but a future reader will misjudge the output contract.

4. **`scripts.py:629-630` — `end_year = timezone.localtime().year - 1` default ignores publication lag for IPCA/CDI.** BCB SGS publishes IPCA early-to-mid of the following month; with today = 2026-05-17 and `end_year` defaulting to 2025, that's fine. But the script will quietly drop years where the `cdi_monthly[y] == 12 and ipca_monthly[y] == 12` filter (line 752) fails — e.g. if you run early-January after a year flip, the previous calendar year might not yet have all 12 IPCA entries published, silently dropping the year and shifting `FIRE_RETURNS_YEARS` without warning. The current filter just makes the year disappear; consider logging dropped years or raising when the most recent year is dropped due to missing data.

5. **`scripts.py:669-684` — silent skip of malformed `day` entries.** When `int(row["day"])` or `date(year, month, day)` raises (Feb 30, missing `day` key, malformed string), the loop swallows the exception and continues. The IPCA/CDI loops at lines 728-731, 741-743 don't have this; they will crash on bad data. Inconsistent error policy across the three downloads. Recommend either uniformly raising or uniformly skipping.

6. **`scripts.py:710` — `range(start_year - 1, end_year + 1)` for IBOV fetches 1994 even though `start_year=1995`.** Necessary because `compute_annual_index_returns` needs a year-end close from year *N-1* to compute year *N*'s return (lines 697-704). Fine in principle. But for IFIX (line 763), the prior-year fetch is 2010, and IFIX was launched 2010-12-30 with base 1000. If B3 returns nothing for year 2010, `compute_annual_index_returns` silently drops 2011 (because `previous_dates` would be empty for year=2011). No assertion catches "first eligible IFIX year was dropped." A sanity check on `ifix_years[0] == ifix_start_year` would close the gap.

7. **`scripts.py:619` — `B3_INDEX_URL` is an undocumented internal B3 endpoint.** No comment flags this. The endpoint is widely known but reverse-engineered, not in B3's public API docs; B3 has rotated similar paths before (the older `indexProxy/IndexCall/...` form). Without a comment, future-you maintaining this won't know it's a "this could break unannounced" surface. Recommend a one-line comment noting the endpoint is reverse-engineered from B3's index statistics web pages.

8. **`fireReturns.ts:13` — first FIXED_INCOME_REAL_RETURNS value is `0.250662` (+25.1% real CDI for 1995).** Plausible given Plano Real–era SELIC was ~50% nominal vs ~22% IPCA — Fisher: (1.50/1.22 - 1) ≈ +23%, close enough. But that single year now anchors the whole bootstrap sample (1995 is sampled with the same probability as 2024), and a 25% real return on cash is wildly outside any modern-Brazil rate environment. The bootstrap is now ~30% more likely to draw an "abnormally great fixed-income year" than the old 2001-start sample was. Worth flagging in the user-facing disclosure ("Amostra histórica: 1995–2025 (31 anos)") that the early years reflect post-Plano-Real abnormal conditions — currently the UI hint in `FireSimulationResults.tsx:583` just says "IBOV/CDI/IPCA 1995-2025" without qualification, and the methodology skill `fire-bootstrap-methodology/SKILL.md:251` says "Brazilian sample is short" but doesn't mention that the extra years (1995–2000) carry post-hyperinflation rate anomalies that no forward planner should expect to repeat. This is a behavioral regression versus the old 2001-onwards sample, not a bug — but the disclosure copy doesn't acknowledge it.

### Low

9. **`scripts.py:686-706` — `compute_annual_index_returns` is O(years × points).** For each year in `range(first_year, last_year + 1)`, it filters the full `sorted_dates` list twice (lines 698, 699). With 31 years × ~7750 daily points, that's ~480k comparisons per index — negligible in practice, but a one-pass alternative (group by year once, then iterate) would be cleaner and easier to test.

10. **`scripts.py:663` — `urllib.request.urlopen(url)` without timeout, retry, or User-Agent.** B3 sometimes 4xx's the default Python User-Agent; the script presumably worked when run for this PR, but a future re-run on a different network may hang indefinitely or get blocked. One-off script so this is a minor maintainability nit, not a runtime hazard for end users.

11. **`scripts.py:46-66` — added `description` field to `_print_assets_portfolio` IRPF output.** Unrelated to the FIRE data change, lumped into the same PR. Functionally fine — `description` exists on the Asset model (`models/write.py:90`, `models/read.py:20`). But mixing an IRPF-printer cosmetic change with a data-pipeline overhaul makes the diff harder to bisect if either side regresses. Recommend a separate commit/PR next time.

12. **`fireBootstrap.ts:82-83` — sample-window comment edited but `MIN_WEIGHT_FOR_RETURN_SERIES` justification weakened.** Old comment cited specific years dropped (2003 +61.5%, 2006 +28.9%, 2007 +36.5%, 2009 +66.9%) as the rationale for not using strict `> 0`. New comment is more generic ("from the full 1995-onwards sample to the shorter IFIX-aligned sample for that"). The specific-years version was more persuasive to a future engineer tempted to drop the threshold. Same trimming applied in `.claude/skills/fire-bootstrap-methodology/SKILL.md:221`. Cosmetic, but the original was better as institutional memory.

13. **`Planning/FireMethodologyWalkthrough.tsx:303-307` — IBOV link points to `b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/ibovespa.htm`.** Confirm this URL still resolves; B3 has rotated content paths in the past. (Out of scope to test from here.)

### Nits / clarity

14. **`fireReturns.ts:12` — comment "CDI accumulated monthly — real annual returns" reads awkwardly.** The data IS annual; the source IS monthly. Suggest: `// CDI (BCB SGS 4391, monthly aggregated to annual) — real annual returns.`

15. **`scripts.py:632-636` — `compound` renamed parameter `daily` → `periodic`, correctly.** Good rename now that CDI/IPCA are monthly and IBOV math doesn't go through compound at all.

16. **`VPWSimulationResults.tsx:503-509` — header text changed from "no cenario atual" → "no cenário simulado".** Mixed accent usage in the rest of the file (`cenario` without accent elsewhere) — minor inconsistency.

## What I verified vs. did not

- Verified: numerical output in `fireReturns.ts` matches known IBOV/IPCA/CDI history for the years I checked, IFIX real values reproduce prior hardcoded table exactly, sample-window predicate logic in `fireBootstrap.ts` unchanged, all `1995–2025` / `31 years` / `IBOV/CDI/IPCA` UI/doc strings consistent with `FIRE_RETURNS_YEARS`'s actual length (31).
- Did not verify: live B3 endpoint reachability, the `compute_annual_index_returns` behavior on pathological B3 payloads (no fixture exists), whether the IBOV pre-1997 normalization correctly handles all of 1994 if `start_year` is changed.

## Residual test gaps

- `generate_fire_returns_ts` has no automated coverage (`pragma: no cover`).
- No snapshot/regression test for `fireReturns.ts` shape (matching array lengths, monotonic `FIRE_RETURNS_YEARS`).
- No unit test for IBOV split normalization at the 1997-03-03 boundary.
- No unit test for `compute_annual_index_returns` on sparse/partial-year data (the `≥ 200 days` filter is untested).

---
*Advisory peer review. Findings are recommendations, not blockers — exercise judgment on which to act on.*
