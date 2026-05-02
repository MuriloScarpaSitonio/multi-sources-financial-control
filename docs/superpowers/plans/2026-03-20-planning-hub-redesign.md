# Planning Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single Planning page with a hub listing all strategies (compact progress bars) + dedicated pages per strategy (expanded rationale, full indicator, references).

**Architecture:** Two flat routes: `/planning` (hub) and `/planning/:method` (detail). Hub shows vertical list with compact indicators. Detail page is one shared component driven by URL param, rendering strategy-specific content from a `strategyContent.ts` const file.

**Tech Stack:** React, TypeScript, MUI, React Router, React Query, Recharts

**Spec:** `docs/superpowers/specs/2026-03-20-planning-hub-redesign-design.md`

---

## Chunk 1: Content and routing infrastructure

### Task 1: Create `strategyContent.ts`

**Files:**
- Create: `react/src/pages/private/Planning/strategyContent.ts`

This file holds all per-strategy content: title, subtitle, expanded rationale (multi-paragraph), defaults explained, references, pros, cons. It replaces the `METHODS` array in `consts.ts`.

- [ ] **Step 1: Create the file with types and content for all 5 strategies**

```typescript
// react/src/pages/private/Planning/strategyContent.ts
import type { WithdrawalMethodKey } from "./api";

export type ProConItem = { text: string; galeno?: boolean; ageInBonds?: boolean };

export type DefaultExplained = {
  label: string;
  explanation: string;
};

export type Reference = {
  title: string;
  url: string;
};

export type StrategyContent = {
  title: string;
  subtitle: string;
  rationale: string[];
  defaultsExplained: DefaultExplained[];
  references: Reference[];
  pros: ProConItem[];
  cons: ProConItem[];
};

export const STRATEGY_CONTENT: Record<WithdrawalMethodKey, StrategyContent> = {
  fire: {
    title: "Regra dos X%",
    subtitle: "Acumule um múltiplo das suas despesas anuais e viva dos rendimentos.",
    rationale: [
      // Multi-paragraph expanded rationale in accessible Portuguese.
      // Cover: Trinity Study context, what the percentage means,
      // year-by-year example, "you might prefer this if..."
      // Content to be written during implementation — placeholder here for structure.
    ],
    defaultsExplained: [
      { label: "Saque padrão: 4%", explanation: "Baseado no Trinity Study..." },
    ],
    references: [
      { title: "Trinity Study (1998)", url: "https://en.wikipedia.org/wiki/Trinity_study" },
    ],
    pros: [
      { text: "Simples de calcular e acompanhar" },
      { text: "Amplamente estudado e validado historicamente (Trinity Study)" },
      { text: "Funciona bem para horizontes de 30+ anos com portfólio diversificado" },
    ],
    cons: [
      { text: "Não considera variações de mercado após a aposentadoria" },
      { text: "A renda mensal varia conforme o desempenho do portfólio" },
      { text: "Pode exigir ajustes se as despesas mudarem significativamente" },
    ],
  },
  // ... same structure for dividends_only, constant_withdrawal, one_over_n, vpw
  // Copy existing pros/cons from current consts.ts, add rationale/defaults/references
};

// Keep shared toggle constants (Galeno, Age-in-bonds) — they get merged at render time
export { GALENO_RATIONALE, GALENO_PROS, GALENO_CONS, AGE_IN_BONDS_RATIONALE, AGE_IN_BONDS_PROS, AGE_IN_BONDS_CONS, AGE_IN_BONDS_TITLES } from "./consts";
```

Note: The actual expanded rationale content (multi-paragraph Portuguese text) should be written during implementation. Use the Constant-dollar example from the spec as a guide for tone and depth. For each strategy, cover: what it is, how it works year by year, historical context if applicable, "you might prefer this if...".

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd react && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add react/src/pages/private/Planning/strategyContent.ts
git commit -m "feat: add strategyContent with expanded rationale structure"
```

---

### Task 2: Add `/planning/:method` route

**Files:**
- Modify: `react/src/App.jsx`

- [ ] **Step 1: Import `StrategyDetailPage` and add route**

Add import at top of `App.jsx`:
```jsx
import { StrategyDetailPage } from "./pages/private";
```

Add route after the existing `/planning` route (around line 261):
```jsx
<Route
  path="/planning/:method"
  element={
    <PrivateRoute path="/planning/:method" v2>
      <StrategyDetailPage />
    </PrivateRoute>
  }
/>
```

- [ ] **Step 2: Export `StrategyDetailPage` from private index**

In `react/src/pages/private/index.tsx`, add:
```typescript
export { default as StrategyDetailPage } from "./Planning/StrategyDetailPage";
```

Note: `StrategyDetailPage.tsx` doesn't exist yet — create a minimal placeholder so TypeScript compiles:
```typescript
// react/src/pages/private/Planning/StrategyDetailPage.tsx
const StrategyDetailPage = () => <div>TODO</div>;
export default StrategyDetailPage;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd react && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add react/src/App.jsx react/src/pages/private/index.tsx react/src/pages/private/Planning/StrategyDetailPage.tsx
git commit -m "feat: add /planning/:method route with placeholder"
```

---

## Chunk 2: Hub page

### Task 3: Create `PlanningHub.tsx`

**Files:**
- Create: `react/src/pages/private/Planning/PlanningHub.tsx`
- Modify: `react/src/pages/private/Planning/index.tsx`

The hub renders a vertical list of all strategies. Each row shows: title, subtitle, compact progress bar, "Estratégia ativa" badge for the selected one. Each row is a `Link` to `/planning/{key}`.

- [ ] **Step 1: Create `PlanningHub.tsx`**

This component:
- Fetches all the same data the current `Planning/index.tsx` fetches (assets, expenses, bank, reports, planning preferences)
- Renders a vertical `Stack` of strategy rows
- Each row renders the **base** compact indicator (never toggle variants)
- Active strategy gets green left border + badge
- Each row wraps in a `Link` to `/planning/{key}`

Use the existing data-fetching pattern from `Planning/index.tsx`. The compact indicators need the same props they receive today (patrimonyTotal, avgExpenses, isLoading, etc.).

Key references:
- Current data fetching: `react/src/pages/private/Planning/index.tsx:46-83`
- Compact indicator usage: `react/src/pages/private/Home/Indicators.tsx:182-340`
- Strategy list: `STRATEGY_CONTENT` from the new `strategyContent.ts`
- Design system: `Text`, `Colors`, `FontSizes`, `FontWeights`, `getColor` from `react/src/design-system`

Use `Paper` from MUI for each row card (consistent with current `MethodCard`). Active strategy: `border-left: 4px solid ${getColor(Colors.brand)}`. Others: `border-left: 4px solid transparent`.

- [ ] **Step 2: Replace `Planning/index.tsx` default export with `PlanningHub`**

Change `Planning/index.tsx` to re-export the hub:
```typescript
export { default } from "./PlanningHub";
```

The old `Planning/index.tsx` content (350+ lines) is no longer the default export. The toggle logic, slider state, and indicator rendering move to `StrategyDetailPage` in the next task.

- [ ] **Step 3: Verify the app compiles and `/planning` renders the hub**

Run: `cd react && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add react/src/pages/private/Planning/PlanningHub.tsx react/src/pages/private/Planning/index.tsx
git commit -m "feat: replace Planning page with hub listing all strategies"
```

---

## Chunk 3: Strategy detail page

### Task 4: Build `StrategyDetailPage.tsx`

**Files:**
- Modify: `react/src/pages/private/Planning/StrategyDetailPage.tsx` (replace placeholder)

This is the largest task. The detail page:
- Reads `:method` from `useParams()`, validates it, redirects to `/planning` if invalid
- Looks up content from `STRATEGY_CONTENT`
- Renders: header with select button, full indicator, toggles, expanded rationale, pros/cons, defaults explained, references
- All slider state is local `useState` (same pattern as current Planning page)
- Toggle logic (Galeno, Age-in-bonds) moves here from the old `Planning/index.tsx`

- [ ] **Step 1: Build the component**

Key references for the implementation:
- URL param: `useParams()` from `react-router-dom`, validate against `Object.keys(STRATEGY_CONTENT)`
- Invalid method: `<Navigate to="/planning" />`
- Select button: `useUpdatePlanningPreferences()` hook, calls `updatePreferences({ selected_method: method })`
- Active badge: read `selectedMethod` from `useSelectedMethod()`, compare with current `:method`
- Indicator rendering: copy the conditional rendering logic from current `Planning/index.tsx:202-299` (the `indicators` record). Remove the `Record<WithdrawalMethodKey, ...>` map — just render the one indicator for the current method.
- Toggles: copy Age-in-bonds and Galeno toggle logic from current `Planning/index.tsx:140-200`. Only show toggles relevant to the current method.
- Expanded rationale: map over `content.rationale` array, render each string as a `<Text>` paragraph
- Pros/Cons: same rendering as current `MethodCard.tsx:96-130`, with Galeno/Age-in-bonds merge logic from current `Planning/index.tsx:308-318`
- Defaults explained: render as a list of label + explanation pairs
- References: render as a list of links (`<a href={ref.url} target="_blank">`)

Data fetching: same hooks as hub (assets, expenses, bank, reports, planning preferences, incomes avg).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd react && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add react/src/pages/private/Planning/StrategyDetailPage.tsx
git commit -m "feat: build strategy detail page with full indicator and expanded content"
```

---

## Chunk 4: Cleanup

### Task 5: Remove old code

**Files:**
- Delete or simplify: `react/src/pages/private/Planning/MethodCard.tsx` (no longer used)
- Simplify: `react/src/pages/private/Planning/consts.ts` (remove `METHODS` array and `MethodConfig` type — keep only shared Galeno/Age-in-bonds constants)
- Move `ProConItem` type to `strategyContent.ts` (already done in Task 1) and remove from `MethodCard.tsx`

- [ ] **Step 1: Delete `MethodCard.tsx`**

- [ ] **Step 2: Clean up `consts.ts`**

Remove `MethodConfig` type and `METHODS` array. Keep `GALENO_RATIONALE`, `GALENO_PROS`, `GALENO_CONS`, `AGE_IN_BONDS_RATIONALE`, `AGE_IN_BONDS_PROS`, `AGE_IN_BONDS_CONS`, `AGE_IN_BONDS_TITLES`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd react && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add -u react/src/pages/private/Planning/
git commit -m "refactor: remove MethodCard and METHODS array, replaced by hub + detail pages"
```

---

### Task 6: Write expanded rationale content

**Files:**
- Modify: `react/src/pages/private/Planning/strategyContent.ts`

All rationale text should be translated to **pt-BR** during implementation. The source content below (from Bogleheads) provides the structure and tone. Each strategy's `rationale` is an array of paragraphs.

- [ ] **Step 1: Write full rationale for each strategy**

**Source material per strategy (translate to pt-BR, adapt to our UI context):**

---

**constant_withdrawal (Retirada constante):**

A constant-dollar withdrawal is the most commonly discussed method. The famous Trinity Study considered what annual rate of retirement withdrawals retirees can sustain. In other words, what is the rate at which the retiree is not likely to run out of money?

When you apply this method, you take your first yearly withdrawal based on a percentage of your investment portfolio value (Trinity says 4%). In the second year your withdrawal amount will not be based on your portfolio's value. Instead, you return to the first year withdrawal amount and adjust it upward at the rate of inflation. For the third and each subsequent year, you go back to the previous year's withdrawal amount and then adjust it upward using the current rate of inflation.

The advantage of this method is that your withdrawals are predictable and constant in "real dollars." This means your annual withdrawal amount maintains the same real spending power after inflation. The disadvantage is if the market starts a prolonged downturn just before or during your first few years of retirement, your assets could be substantially or entirely depleted as you continue to take a larger inflation-adjusted withdrawal each year.

You might prefer this method if you have relatively high fixed expenses, and you want the predictability of a constant 'paycheck.'

---

**fire (Regra dos X%):**

Do you need to ensure you always have some savings left? If so, withdraw the same percentage annually based on your current portfolio balance. Because the value of your portfolio will change annually with the ups and downs of the financial markets, keep in mind the dollar amount you withdraw will also fluctuate from year-to-year.

Annual withdrawals are not automatically increased for inflation; instead, this method counts on long-term portfolio growth to take care of inflation.

The advantage of this method is its simplicity - just multiply your portfolio balance each year by your withdrawal percentage. Your portfolio still might decrease in value, depending on market conditions and the rate of withdrawal you choose, but you will never run out of money. The disadvantage is your withdrawal amounts will always fluctuate with your portfolio's value. You'll have to spend less in years when your portfolio value drops, and unless portfolio returns are good, you may not have enough in later years to keep up with inflation. You might prefer this method if you have lower fixed expenses - that is, year-to-year flexibility in spending.

---

**vpw (VPW - Saque % Variável):**

You would like to spend more but without fear of running out of money? Have a look at Variable percentage withdrawal (VPW). This method lets you withdraw an increasing percentage annually based on your current portfolio balance. Because the value of your portfolio will change annually with the ups and downs of the financial markets, keep in mind the dollar amount you withdraw will also fluctuate from year-to-year.

The Variable percentage withdrawal spreadsheet takes into account the projected maximal length of your retirement and your portfolio's asset allocation (division between stocks and bonds) to compute a table of increasing withdrawal percentages for each projected year of retirement. Each year, multiply your portfolio balance by that year's percentage to get the actual withdrawal dollar amount.

The advantage of this method is its ability to let you spend most of your portfolio, but with the assurance of never running out of money before the end of the selected depletion period. It is also very simple to use: just multiply your portfolio balance each year by that year's withdrawal percentage. The disadvantage is your withdrawal amounts will always fluctuate with your portfolio's value. You'll have to spend less in years when your portfolio value drops. But, as you are spending an increasing percentage of your portfolio each year, you'll have more than if you had selected a constant-percentage withdrawal. You might prefer this method if you have year-to-year flexibility in spending, and you have no bequest motives.

---

**dividends_only (Viver de proventos):**

If you wish to keep your principal investment amount intact, you might consider using a method where you only spend the dividend and interest income from your investments.

The advantage is clear, but like the constant percentage method, it may result in fluctuating income amounts as dividend and interest income rates for your investments change. Also, while having a large bond percentage will increase your interest income with this method, having too few growth investments exposes you to the risk of not keeping up with inflation over the long term. You might prefer this method if your expenses are small in relation to your portfolio size, and if you wish to leave a large amount to your heirs.

---

**one_over_n (Retirada 1/N):**

A common issue when using a typical retirement withdrawal method is that the percentage withdrawn usually assumes the worst-case scenario. That is, the recommended percentage is one that, in the past, would have allowed you to weather the storm of the worst bear market, should it have occurred during your period of retirement. While it is generally considered safe and prudent to assume the worst, what often happens during a retirement period is that the markets perform better than the worst-case scenario, thus increasing your portfolio more than may have been forecast in that worst-case scenario - sometimes much more. If one continues to follow a withdrawal method based on their initial portfolio value at retirement, this unexpected growth may result in their leaving a significant amount of money unspent during their retirement.

One method to allow spending more money from the portfolio during the years you expect to draw from it is to not spend a percentage based on the portfolio's value, but rather spend a percentage based on how long you expect the portfolio to last. 'N' being equal to the number of years you need to draw on the portfolio. Each year the 'N' number is readjusted, resulting in a higher percentage being withdrawn from the portfolio. Normally, withdrawing a higher percentage is considered possibly unsafe, as it may result in the portfolio being eventually depleted. However, using a 1/N withdrawal method typically assumes spending the entire portfolio, so large withdrawal percentages aren't a concern.

The N number is readjusted each year, meaning that for a portfolio that you wish to draw from for 20 years would allow a 1/20th of the total portfolio value to be withdrawn the first year, 1/19th the second, and so on. One potential issue is that the N number (i.e. how long you will live) can't be forecast with perfect accuracy. This can be solved by considering the 1/N withdrawal amount to be a maximum for the particular year. Since the withdrawal amounts can become very large in later years, it is easy to spend less than the full amount, thus preserving a portion of the portfolio for potential years beyond 'N'.

---

**Age-in-bonds toggle rationale (shared, for constant_withdrawal and fire):**

When you take money out of your portfolio, consider your current asset allocation between stocks and bonds, and decide if your allocation will be changed during the withdrawal phase. Many retirees prefer not to keep a static stock/bond allocation throughout retirement. They gradually reduce their stock allocation and increase their bond allocation. One popular method is to adjust the stock/bond allocation each year so that the bond percentage is equal to the owner's age. This means you would make a 1% portfolio allocation adjustment every year.

For constant-dollar + age-in-bonds: your withdrawals remain predictable and constant in real dollar terms. But your overall portfolio value will decline at a faster rate, especially during the later years, because each year you are increasing your withdrawals at the same time you are reducing the growth part of the portfolio.

For constant-percentage + age-in-bonds: the portfolio allocation becomes more conservative each year, so its growth in total value will be less. However, the year-to-year portfolio withdrawal differences are also minimized because the increased bond allocation improved the stability of returns.

---

**Galeno toggle rationale (shared):**

This method is designed to overcome disadvantages of the constant-dollar and constant-percentage methods. For constant-dollar: it takes the market value of your portfolio into account by moving a fixed percentage of your stock allocation over to your bond allocation every year. For constant-percentage: it smooths fluctuations by having yearly withdrawals be an average of 7½ years of bond allocation value.

Using this method, 7½ years worth of withdrawals are held in bonds, the rest of the portfolio in stocks. Each year, a percentage of the stock allocation is sold and moved to the bond allocation. The new yearly withdrawal amount is figured by dividing the total bond amount by 7½. As stocks go up, the bond allocation will gradually be increased and allow higher yearly withdrawals. Conversely, as stocks go down, the bond allocation will gradually be decreased and slowly result in lower yearly withdrawals. However, since there is a 7½ year buffer of withdrawals in bonds, year-to-year withdrawal amounts are smoothed and do not fluctuate greatly.

---

**Defaults explained per strategy (with sources):**

All indicators should use **real returns** (inflation-adjusted). This avoids needing a separate inflation slider and keeps defaults consistent across strategies.

| Slider | Default | Explanation | Source |
|--------|---------|-------------|--------|
| Saque (FIRE) | 4% a.a. | Trinity Study: 4% sustained portfolios for 30+ years with >90% success rate | [Trinity Study - Wikipedia](https://en.wikipedia.org/wiki/Trinity_study), [Bogleheads SWR](https://www.bogleheads.org/wiki/Safe_withdrawal_rates) |
| Retorno real (FIRE, Retirada constante, 1/N) | 5% | Ibovespa real ~3.5-7% depending on period; CDI real ~5.5% (2000-2024). 5% is a moderate middle ground | [CNN Brasil](https://www.cnnbrasil.com.br/economia/financas/desde-o-plano-real-bolsa-rendeu-2524-metade-do-cdi-mas-o-dobro-da-poupanca/), [Economatica](https://insight.economatica.com/desempenho-do-ibovespa-50-anos-de-historia/) |
| Horizonte (Retirada constante) | 30 anos | Trinity Study standard — analyzed 30-year retirement periods | [Trinity Study - Wikipedia](https://en.wikipedia.org/wiki/Trinity_study) |
| Idade alvo (1/N) | 90 | IBGE 2024: quem chega aos 60 vive em média +22.6 anos (→82.6). 90 adiciona margem de segurança | [IBGE Tábuas de Mortalidade 2024](https://www.ibge.gov.br/estatisticas/sociais/populacao/9126-tabuas-completas-de-mortalidade.html) |
| Idade alvo (VPW) | 99 | VPW spreadsheet usa "last withdrawal age of 99" e limita saque a 10% | [Bogleheads VPW](https://www.bogleheads.org/wiki/Variable_percentage_withdrawal) |
| Retorno real RV (VPW, Age-in-bonds) | 5% | Ibovespa nominal ~13.6% a.a. desde Plano Real (CNN Brasil); S&P 500 em BRL ~11.2% a.a. (FIPECAFI/InfoMoney, 20 anos). Descontando inflação ~5-7%, retorno real ~5% é moderado | [CNN Brasil](https://www.cnnbrasil.com.br/economia/financas/desde-o-plano-real-bolsa-rendeu-2524-metade-do-cdi-mas-o-dobro-da-poupanca/), [InfoMoney/FIPECAFI](https://www.infomoney.com.br/onde-investir/sp-500-ibovespa-ou-cdi-veja-quanto-r-10-mil-rendeu-em-5-10-15-e-20-anos/) |
| Retorno real RF (VPW, Age-in-bonds) | 3% | CDI real ~5.5% no Brasil (2000-2024), mas inclui período de juros extremos. Bogleheads VPW usa ~1.8% (dados americanos). 3% é um meio-termo conservador entre a realidade brasileira e benchmarks internacionais | [Bogleheads VPW](https://www.bogleheads.org/wiki/Variable_percentage_withdrawal), [CNN Brasil](https://www.cnnbrasil.com.br/economia/financas/desde-o-plano-real-bolsa-rendeu-2524-metade-do-cdi-mas-o-dobro-da-poupanca/) |
| Yield (Viver de proventos) | 6% | IFIX dividend yield histórico 7-10%. 6% é conservador | [Funds Explorer](https://www.fundsexplorer.com.br/ranking) |

**Implementation note:** The Age-in-bonds and Constant-Dollar-Age-in-bonds indicators currently use nominal returns (Retorno RV 8%, Retorno RF 3%). These must be changed to real returns (Retorno RV 5%, Retorno RF 3%) to be consistent with the other indicators. This also removes the need for a separate inflation slider on the Constant-Dollar-Age-in-bonds indicator. See Task 7 below.

**References per strategy (for the dedicated pages):**

- **Regra dos X%**: [Bogleheads - Withdrawal methods](https://www.bogleheads.org/wiki/Withdrawal_methods), [Trinity Study - Wikipedia](https://en.wikipedia.org/wiki/Trinity_study)
- **Retirada constante**: [Bogleheads - Withdrawal methods](https://www.bogleheads.org/wiki/Withdrawal_methods), [Bogleheads - Safe withdrawal rates](https://www.bogleheads.org/wiki/Safe_withdrawal_rates)
- **VPW**: [Bogleheads - Variable percentage withdrawal](https://www.bogleheads.org/wiki/Variable_percentage_withdrawal)
- **Viver de proventos**: [Bogleheads - Withdrawal methods](https://www.bogleheads.org/wiki/Withdrawal_methods)
- **Retirada 1/N**: [Bogleheads - Withdrawal methods](https://www.bogleheads.org/wiki/Withdrawal_methods)
- **Age-in-bonds (toggle)**: [Bogleheads - Withdrawal methods](https://www.bogleheads.org/wiki/Withdrawal_methods)
- **Galeno (toggle)**: [Bogleheads - Withdrawal methods](https://www.bogleheads.org/wiki/Withdrawal_methods)

- [ ] **Step 2: Commit**

```bash
git add react/src/pages/private/Planning/strategyContent.ts
git commit -m "content: add expanded rationale for all withdrawal strategies"
```

---

### Task 7: Standardize indicator returns to real (inflation-adjusted)

**Files:**
- Modify: `react/src/pages/private/Home/AgeInBondsIndicator.tsx`
- Modify: `react/src/pages/private/Home/ConstantDollarAgeInBondsIndicator.tsx`
- Modify: `react/src/pages/private/Home/Indicators.tsx` (update defaults)
- Modify: `react/src/pages/private/Planning/index.tsx` (update defaults)

Currently, Age-in-bonds indicators use nominal returns (Retorno RV 8%, Retorno RF 3%) while other indicators use real returns. This is inconsistent. All indicators should use real returns.

- [ ] **Step 1: Update AgeInBondsIndicator defaults and labels**

Change slider labels from "Retorno RV" / "Retorno RF" to "Retorno real RV" / "Retorno real RF". No formula changes needed — the math already treats returns as growth rates, works the same for real or nominal.

- [ ] **Step 2: Update ConstantDollarAgeInBondsIndicator**

Same label changes. Also remove the inflation slider — since returns are now real, expenses stay flat (same as 1/N after our earlier fix). Remove the `inflation` prop and the inflation growth logic from `computeProjection`.

- [ ] **Step 3: Update defaults in Indicators.tsx and Planning/index.tsx**

Change Age-in-bonds state defaults:
- `ageInBondsStockReturn`: 8 → 5
- `ageInBondsBondReturn`: 3 → 3 (stays the same)
- `cdAibStockReturn`: 8 → 5
- `cdAibBondReturn`: 3 → 3 (stays the same)
- Remove `cdAibInflation` state and props

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd react && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add react/src/pages/private/Home/AgeInBondsIndicator.tsx react/src/pages/private/Home/ConstantDollarAgeInBondsIndicator.tsx react/src/pages/private/Home/Indicators.tsx react/src/pages/private/Planning/index.tsx
git commit -m "refactor: standardize all indicators to use real returns, remove inflation slider from constant-dollar age-in-bonds"
```
