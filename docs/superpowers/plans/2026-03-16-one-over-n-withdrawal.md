# 1/N Withdrawal Indicator — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 1/N (planned depletion) withdrawal strategy indicator with `date_of_birth` support on the backend and a new indicator component + Planning card on the frontend.

**Architecture:** Backend adds `date_of_birth` field to `CustomUser` and `"one_over_n"` to planning preferences choices. Frontend adds a new `OneOverNIndicator` component following the existing `FIREProgressBar`/`ConstantDollarIndicator` pattern, integrated into both Home and Planning pages.

**Tech Stack:** Django/DRF (backend), React/TypeScript/MUI (frontend), TanStack Query (data fetching)

---

## Chunk 1: Backend Changes

### Task 1: Add `date_of_birth` to `CustomUser` model

**Files:**
- Modify: `django/authentication/models.py:76` (after `planning_preferences` field)
- Create: `django/authentication/migrations/0017_customuser_date_of_birth.py` (auto-generated)

- [ ] **Step 1: Add the field**

In `django/authentication/models.py`, add after line 76 (`planning_preferences = models.JSONField(...)`):

```python
date_of_birth = models.DateField(null=True, blank=True)
```

- [ ] **Step 2: Generate migration**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python manage.py makemigrations authentication`
Expected: Creates `0017_customuser_date_of_birth.py`

- [ ] **Step 3: Run migration**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python manage.py migrate authentication`
Expected: `Applying authentication.0017_customuser_date_of_birth... OK`

- [ ] **Step 4: Commit**

```bash
git add django/authentication/models.py django/authentication/migrations/0017_customuser_date_of_birth.py
git commit -m "feat: add date_of_birth field to CustomUser model"
```

### Task 2: Expose `date_of_birth` in serializer and add `one_over_n` to planning preferences

**Files:**
- Modify: `django/authentication/serializers.py:109-114` (PlanningPreferencesSerializer)
- Modify: `django/authentication/serializers.py:125-143` (UserSerializer.Meta.fields)
- Modify: `django/authentication/serializers.py:223` (show_galeno validation)

- [ ] **Step 1: Write failing tests**

In `django/authentication/tests/test__user__views.py`, add these tests at the end of the file:

```python
def test__partial_update__planning_preferences__one_over_n(client, user):
    # GIVEN
    data = {"planning_preferences": {"selected_method": "one_over_n"}}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    user.refresh_from_db()
    assert user.planning_preferences["selected_method"] == "one_over_n"


def test__partial_update__planning_preferences__one_over_n_with_galeno(client, user):
    # GIVEN
    user.planning_preferences = {"selected_method": "one_over_n"}
    user.save()
    data = {"planning_preferences": {"show_galeno": True}}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    user.refresh_from_db()
    assert user.planning_preferences["show_galeno"] is True


def test__partial_update__date_of_birth(client, user):
    # GIVEN
    data = {"date_of_birth": "1990-06-15"}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    user.refresh_from_db()
    assert str(user.date_of_birth) == "1990-06-15"


def test__retrieve__includes_date_of_birth(client, user):
    # GIVEN
    user.subscription_ends_at = timezone.localtime() + timedelta(days=1)
    user.save()

    # WHEN
    response = client.get(f"{URL}/{user.pk}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert "date_of_birth" in response.json()
    assert response.json()["date_of_birth"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python -m pytest authentication/tests/test__user__views.py::test__partial_update__planning_preferences__one_over_n authentication/tests/test__user__views.py::test__partial_update__planning_preferences__one_over_n_with_galeno authentication/tests/test__user__views.py::test__partial_update__date_of_birth authentication/tests/test__user__views.py::test__retrieve__includes_date_of_birth -v`
Expected: FAIL — `one_over_n` is not a valid choice, `date_of_birth` not in serializer fields

- [ ] **Step 3: Update PlanningPreferencesSerializer**

In `django/authentication/serializers.py`, line 111, change:

```python
choices=["fire", "dividends_only", "constant_withdrawal"],
```

to:

```python
choices=["fire", "dividends_only", "constant_withdrawal", "one_over_n"],
```

- [ ] **Step 4: Update show_galeno validation and error message**

In `django/authentication/serializers.py`, line 223, change:

```python
if merged.get("show_galeno") and merged.get("selected_method") not in ("fire", "constant_withdrawal"):
```

to:

```python
if merged.get("show_galeno") and merged.get("selected_method") not in ("fire", "constant_withdrawal", "one_over_n"):
```

Also update the error message on line 225:

```python
{"planning_preferences": {"show_galeno": "Galeno só pode ser ativado com FIRE, Retirada constante ou Retirada 1/N."}}
```

- [ ] **Step 5: Add `date_of_birth` to UserSerializer.Meta.fields**

In `django/authentication/serializers.py`, add `"date_of_birth"` to the `fields` tuple in `UserSerializer.Meta` (after `"planning_preferences"` on line 142):

```python
fields = (
    "id",
    "password",
    "password2",
    "username",
    "email",
    "has_cei_integration",
    "has_kucoin_integration",
    "has_binance_integration",
    "secrets",
    "trial_will_end_message",
    "is_personal_finances_module_enabled",
    "is_investments_module_enabled",
    "is_investments_integrations_module_enabled",
    "subscription_status",
    "stripe_subscription_updated_at",
    "credit_card_bill_day",
    "planning_preferences",
    "date_of_birth",
)
```

- [ ] **Step 6: Update existing retrieve test**

The `test__retrieve` test at line 364 asserts the exact response JSON. It will now fail because `date_of_birth` and `planning_preferences` are included in the response. Add these two entries to the expected dict:

```python
"planning_preferences": {"show_galeno": False},
"date_of_birth": None,
```

Note: `show_galeno` appears as `False` (not `{}`) because `PlanningPreferencesSerializer` declares `show_galeno = BooleanField(required=False, default=False)`, which always includes the default in serialized output.

- [ ] **Step 7: Run all tests to verify they pass**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python -m pytest authentication/tests/test__user__views.py -v`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add django/authentication/serializers.py django/authentication/tests/test__user__views.py
git commit -m "feat: add date_of_birth to user serializer and one_over_n to planning preferences"
```

---

## Chunk 2: Frontend — Types, API, Hooks, and Consts

### Task 3: Add `one_over_n` to types and API

**Files:**
- Modify: `react/src/pages/private/Planning/api.ts:3` (WithdrawalMethodKey type)
- Modify: `react/src/pages/private/Planning/api.ts:14-16` (getPlanningPreferences return type)

- [ ] **Step 1: Add `one_over_n` to WithdrawalMethodKey**

In `react/src/pages/private/Planning/api.ts`, line 3, change:

```typescript
export type WithdrawalMethodKey = "fire" | "dividends_only" | "constant_withdrawal";
```

to:

```typescript
export type WithdrawalMethodKey = "fire" | "dividends_only" | "constant_withdrawal" | "one_over_n";
```

- [ ] **Step 2: Add `dateOfBirth` to API response type and function**

In `react/src/pages/private/Planning/api.ts`, add a new return type and update `getPlanningPreferences`:

```typescript
export type PlanningData = {
  preferences: PlanningPreferences;
  dateOfBirth: string | null;
};

export const getPlanningPreferences = async (): Promise<PlanningData> => {
  const { data } = await apiProvider.get(`${RESOURCE}/${getUserId()}`);
  return {
    preferences: data.planning_preferences ?? {},
    dateOfBirth: data.date_of_birth ?? null,
  };
};
```

**Note:** Do NOT commit yet — adding `one_over_n` to `WithdrawalMethodKey` will break TypeScript until all `Record<WithdrawalMethodKey, ...>` consumers are updated (Tasks 7 and 8). All frontend changes are committed together at the end of Chunk 4.

### Task 4: Update hooks for new type and data shape

**Files:**
- Modify: `react/src/pages/private/Planning/hooks.ts:11-15` (usePlanningPreferences)
- Modify: `react/src/pages/private/Planning/hooks.ts:17` (VALID_METHODS)
- Modify: `react/src/pages/private/Planning/hooks.ts:23-28` (useSelectedMethod)

- [ ] **Step 1: Update VALID_METHODS and hooks**

Replace the entire file `react/src/pages/private/Planning/hooks.ts` with:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getPlanningPreferences,
  updatePlanningPreferences,
  type WithdrawalMethodKey,
} from "./api";

const QUERY_KEY = "planning-preferences";

export const usePlanningPreferences = () =>
  useQuery({
    queryKey: [QUERY_KEY],
    queryFn: getPlanningPreferences,
  });

const VALID_METHODS: WithdrawalMethodKey[] = ["fire", "dividends_only", "constant_withdrawal", "one_over_n"];

export const useSelectedMethod = (): {
  selectedMethod: WithdrawalMethodKey;
  isLoading: boolean;
} => {
  const { data, isPending } = usePlanningPreferences();
  const saved = data?.preferences.selected_method;
  const selectedMethod = saved && VALID_METHODS.includes(saved as WithdrawalMethodKey)
    ? (saved as WithdrawalMethodKey)
    : "fire";
  return { selectedMethod, isLoading: isPending };
};

export const useUpdatePlanningPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePlanningPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};
```

Key change: `data?.selected_method` → `data?.preferences.selected_method` because `getPlanningPreferences` now returns `PlanningData` instead of `PlanningPreferences` directly.

### Task 5: Add 1/N method config to consts

**Files:**
- Modify: `react/src/pages/private/Planning/consts.ts:92` (end of METHODS array)

- [ ] **Step 1: Add method config**

In `react/src/pages/private/Planning/consts.ts`, add a new entry to the `METHODS` array before the closing `];` on line 92:

```typescript
  {
    key: "one_over_n",
    title: "Retirada 1/N (Esgotamento planejado)",
    subtitle:
      "Divida o patrimônio pelo número de anos restantes até a idade alvo.",
    rationale:
      "A cada ano, você retira 1/N do patrimônio, onde N é o número de anos restantes " +
      "até a idade alvo. A porcentagem de retirada aumenta a cada ano: aos 35 anos com " +
      "meta de 90, retira-se 1/55 (1,8%); aos 70, retira-se 1/20 (5%). O patrimônio é " +
      "totalmente consumido na idade alvo — ideal para quem não pretende deixar herança.",
    pros: [
      { text: "Cronograma previsível — você sabe exatamente quando o patrimônio acaba" },
      { text: "Renda cresce ao longo do tempo conforme N diminui" },
      { text: "Simples de calcular: basta dividir pelo número de anos restantes" },
    ],
    cons: [
      { text: "Patrimônio chega a zero — não sobra herança" },
      { text: "Risco de viver além da idade alvo sem recursos" },
      { text: "Retiradas nos primeiros anos podem ser muito baixas" },
    ],
  },
```

---

## Chunk 3: Frontend — OneOverNIndicator Component

### Task 6: Create OneOverNIndicator component

**Files:**
- Create: `react/src/pages/private/Home/OneOverNIndicator.tsx`

- [ ] **Step 1: Create the component**

Create `react/src/pages/private/Home/OneOverNIndicator.tsx`:

```typescript
import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, { linearProgressClasses } from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";

const ProgressBar = styled(LinearProgress)(({ value }) => ({
  height: 24,
  borderRadius: 10,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: getColor(Colors.neutral600),
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 10,
    backgroundColor:
      value && value >= 100 ? getColor(Colors.brand) : getColor(Colors.danger200),
  },
}));

const sliderSx = {
  width: 100,
  "& .MuiSlider-thumb": {
    width: 14,
    height: 14,
    backgroundColor: getColor(Colors.brand500),
    "&:hover, &.Mui-focusVisible": {
      boxShadow: `0 0 0 8px ${getColor(Colors.brand500)}33`,
    },
  },
  "& .MuiSlider-track": {
    backgroundColor: getColor(Colors.brand500),
    border: "none",
  },
  "& .MuiSlider-rail": {
    backgroundColor: getColor(Colors.brand500),
  },
};

const computeAge = (dateOfBirth: string): number => {
  const birth = new Date(dateOfBirth + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const OneOverNIndicator = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  dateOfBirth,
  targetDepletionAge,
  onTargetDepletionAgeChange,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  dateOfBirth: string | null;
  targetDepletionAge: number;
  onTargetDepletionAgeChange: (value: number) => void;
}) => {
  const { hideValues } = useHideValues();

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  if (!dateOfBirth) {
    return (
      <Stack
        sx={{
          height: 24,
          borderRadius: "10px",
          backgroundColor: getColor(Colors.neutral600),
          justifyContent: "center",
          px: 1.5,
        }}
      >
        <Text
          color={Colors.neutral300}
          size={FontSizes.SEMI_SMALL}
          weight={FontWeights.MEDIUM}
        >
          Retirada 1/N — configure sua data de nascimento no perfil
        </Text>
      </Stack>
    );
  }

  const currentAge = computeAge(dateOfBirth);
  const yearsRemaining = targetDepletionAge - currentAge;

  if (yearsRemaining <= 0) {
    return (
      <Stack
        sx={{
          height: 24,
          borderRadius: "10px",
          backgroundColor: getColor(Colors.danger200),
          justifyContent: "center",
          px: 1.5,
        }}
      >
        <Text
          color={Colors.neutral0}
          size={FontSizes.SEMI_SMALL}
          weight={FontWeights.MEDIUM}
        >
          Retirada 1/N — idade alvo deve ser maior que sua idade atual ({currentAge})
        </Text>
      </Stack>
    );
  }

  const withdrawalPct = (1 / yearsRemaining) * 100;
  const annualWithdrawal = patrimonyTotal / yearsRemaining;
  const monthlyWithdrawal = annualWithdrawal / 12;
  const coverage = avgExpenses > 0 ? (monthlyWithdrawal / avgExpenses) * 100 : 0;

  const monthlyFormatted = hideValues ? "***" : formatCurrency(monthlyWithdrawal);
  const tooltipTitle =
    `Retirada 1/N: divida o patrimônio pelos anos restantes. ` +
    `Idade: ${currentAge}, meta: ${targetDepletionAge}, anos restantes: ${yearsRemaining}. ` +
    `Retirada: ${withdrawalPct.toFixed(1)}% a.a. (${monthlyFormatted}/mês). ` +
    `O patrimônio será totalmente consumido até a idade alvo.`;

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div style={{ position: "relative" }}>
          <ProgressBar
            variant="determinate"
            value={Math.min(coverage, 100)}
          />
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              transform: "translateY(-50%)",
              px: 1.5,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
            }}
          >
            <Text
              color={Colors.neutral0}
              weight={FontWeights.MEDIUM}
              size={FontSizes.SEMI_SMALL}
            >
              Retirada 1/N
            </Text>
            {hideValues ? (
              <Skeleton
                sx={{
                  bgcolor: getColor(Colors.neutral300),
                  width: "60px",
                }}
                animation={false}
              />
            ) : (
              <Text
                color={Colors.neutral0}
                weight={FontWeights.SEMI_BOLD}
                size={FontSizes.SEMI_SMALL}
              >
                {coverage.toFixed(1)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          1/{yearsRemaining} ({withdrawalPct.toFixed(1)}%) ·{" "}
          {hideValues ? "***" : formatCurrency(monthlyWithdrawal)}/mês
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Idade alvo: {targetDepletionAge} anos
        </Text>
        <Slider
          value={targetDepletionAge}
          onChange={(_, value) => onTargetDepletionAgeChange(value as number)}
          min={70}
          max={105}
          step={1}
          size="medium"
          sx={sliderSx}
        />
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {targetDepletionAge <= 80
            ? "Agressivo — horizonte curto, retiradas altas."
            : targetDepletionAge <= 90
              ? "Moderado — expectativa de vida média."
              : "Conservador — margem de segurança para longevidade."}
        </Text>
      </Stack>
    </Stack>
  );
};

export default OneOverNIndicator;
```

---

## Chunk 4: Frontend — Integration into Home and Planning pages

### Task 7: Integrate into Home page Indicators

**Files:**
- Modify: `react/src/pages/private/Home/Indicators.tsx`

- [ ] **Step 1: Add import**

Add after line 34 (the GalenoIndicator import):

```typescript
import OneOverNIndicator from "./OneOverNIndicator";
```

- [ ] **Step 2: Add state and extract dateOfBirth**

In `Indicators.tsx`, after line 42 (`const [galenoTargetBufferYears, setGalenoTargetBufferYears] = useState(7);`), add:

```typescript
const [targetDepletionAge, setTargetDepletionAge] = useState(90);
```

Change line 44 (`const { data: preferences } = usePlanningPreferences();`) to:

```typescript
const { data: planningData } = usePlanningPreferences();
const preferences = planningData?.preferences;
const dateOfBirth = planningData?.dateOfBirth ?? null;
```

- [ ] **Step 3: Add `one_over_n` to the indicators record**

In `Indicators.tsx`, add the `one_over_n` entry to the record (before the closing `}[selectedMethod]` on line 214):

```typescript
one_over_n: (
  <>
    <OneOverNIndicator
      patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
      avgExpenses={expensesIndicators?.fire_avg ?? 0}
      isLoading={isLoading || isExpensesIndicatorsLoading}
      dateOfBirth={dateOfBirth}
      targetDepletionAge={targetDepletionAge}
      onTargetDepletionAgeChange={setTargetDepletionAge}
    />
    {showGaleno && (
      <GalenoIndicator
        reportData={(assetsReportData ?? []) as ReportAggregatedByTypeDataItem[]}
        bankAmount={bankAmount}
        avgExpenses={expensesIndicators?.fire_avg ?? 0}
        isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
        transferRate={galenoTransferRate}
        onTransferRateChange={setGalenoTransferRate}
        targetBufferYears={galenoTargetBufferYears}
        onTargetBufferYearsChange={setGalenoTargetBufferYears}
      />
    )}
  </>
),
```

### Task 8: Integrate into Planning page

**Files:**
- Modify: `react/src/pages/private/Planning/index.tsx`

- [ ] **Step 1: Add import**

Add after line 18 (the GalenoIndicator import):

```typescript
import OneOverNIndicator from "../Home/OneOverNIndicator";
```

- [ ] **Step 2: Add state variables**

After line 31 (`const [localGalenoConstant, setLocalGalenoConstant] = useState(false);`), add:

```typescript
const [targetDepletionAge, setTargetDepletionAge] = useState(90);
const [localGalenoOneOverN, setLocalGalenoOneOverN] = useState(false);
```

- [ ] **Step 3: Extract dateOfBirth from planning data**

Change line 33 (`const { data: preferences } = usePlanningPreferences();`) to:

```typescript
const { data: planningData } = usePlanningPreferences();
const preferences = planningData?.preferences;
const dateOfBirth = planningData?.dateOfBirth ?? null;
```

- [ ] **Step 4: Update validMethods**

Change line 63:

```typescript
const validMethods: WithdrawalMethodKey[] = ["fire", "dividends_only", "constant_withdrawal"];
```

to:

```typescript
const validMethods: WithdrawalMethodKey[] = ["fire", "dividends_only", "constant_withdrawal", "one_over_n"];
```

- [ ] **Step 5: Update Galeno toggle functions**

In `isGalenoChecked` (line 84-89), add before `return false;`:

```typescript
if (method === "one_over_n") return localGalenoOneOverN;
```

In `handleGalenoChange` (line 91-99), add before the closing `}`:

```typescript
else if (method === "one_over_n") {
  setLocalGalenoOneOverN(checked);
}
```

- [ ] **Step 6: Add `one_over_n` to indicators record**

In the `indicators` record (after the `constant_withdrawal` entry, before line 167's closing `};`), add:

```typescript
one_over_n: (
  <>
    <OneOverNIndicator
      patrimonyTotal={patrimonyTotal}
      avgExpenses={avgExpenses}
      isLoading={isDataLoading}
      dateOfBirth={dateOfBirth}
      targetDepletionAge={targetDepletionAge}
      onTargetDepletionAgeChange={setTargetDepletionAge}
    />
    {galenoToggle("one_over_n")}
  </>
),
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: No errors (the `satisfies Record<WithdrawalMethodKey, ...>` constraint ensures completeness)

- [ ] **Step 8: Commit all frontend changes**

All frontend changes are committed together to keep TypeScript valid at every commit (adding `one_over_n` to `WithdrawalMethodKey` requires all `Record<WithdrawalMethodKey, ...>` consumers to be updated simultaneously).

```bash
git add react/src/pages/private/Planning/api.ts react/src/pages/private/Planning/hooks.ts react/src/pages/private/Planning/consts.ts react/src/pages/private/Home/OneOverNIndicator.tsx react/src/pages/private/Home/Indicators.tsx react/src/pages/private/Planning/index.tsx
git commit -m "feat: add 1/N withdrawal indicator to frontend"
```

---

## Chunk 5: Verification

### Task 9: Run full backend test suite

- [ ] **Step 1: Run all auth tests**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python -m pytest authentication/tests/ -v`
Expected: ALL PASS

### Task 10: Build frontend and verify

- [ ] **Step 1: Run TypeScript check**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && yarn build`
Expected: Build succeeds
