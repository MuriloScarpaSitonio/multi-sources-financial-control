# Future Features & Ideas

## 1. Maturity Warning System

**Context:** Emergency Fund Assets feature (MVP skipped this)

**Description:** Warn users about FIXED_BR assets that are approaching maturity (e.g., next 30 days).

**Possible implementations:**
- Warning icon on assets maturing soon in the asset list
- Dashboard notification/banner
- Email notification before maturity date

**Why skipped:** Not critical for MVP, user can track maturity dates manually for now.

---

## 2. Carência (Grace Period) Support for LCI/LCA

**Context:** Emergency Fund Assets feature (MVP uses manual approach)

**Problem:** Brazilian fixed income products like LCI/LCA have grace periods where no withdrawals are allowed:

| Product | Carência (as of 2025) |
|---------|----------------------|
| LCI/LCA indexed to CDI | 6 months |
| LCA indexed to IPCA | 12 months |
| LCI indexed to IPCA | 36 months |

After carência ends, the asset gains daily liquidity.

**Current MVP:** User manually updates `liquidity_type` when carência ends.

**Future Options:**

### Option A: Add `carencia_end_date` field (Recommended)
```python
carencia_end_date = models.DateField(null=True, blank=True)
# Asset auto-treated as DAILY liquidity after this date
```

### Option B: Smart calculation from purchase date
```python
carencia_duration = get_carencia_for_product_type(asset)
carencia_ends = purchase_date + carencia_duration
effective_liquidity = 'DAILY' if today >= carencia_ends else 'NO_LIQUIDITY'
```

### Option C: Three-state liquidity
```python
liquidity_type = ['DAILY', 'IN_CARENCIA', 'AT_MATURITY']
```

**Recommendation:** Implement Option A when user demand requires it.

**Sources:**
- [LCA e LCI: invista com isenção de IR | Portal BB](https://www.bb.com.br/site/investimentos/novidades-lca-lci/)
- [LCAs e LCIs com liquidez diária voltam em 2025?](https://investidor10.com.br/noticias/lcas-e-lcis-com-liquidez-diaria-voltam-em-2025-cmn-encurta-prazo-de-carencia-a-renda-fixa-isenta-113081/)
