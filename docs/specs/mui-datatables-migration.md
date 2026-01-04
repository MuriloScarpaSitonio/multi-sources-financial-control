# mui-datatables Migration

## Problem

We have a peer dependency conflict between `mui-datatables@4.3.0` and our MUI 6 packages:

```
@mui/icons-material@^6.x (our project)
@mui/icons-material@^5.11.0 (required by mui-datatables)
```

Currently we're using `--legacy-peer-deps` in `react/Dockerfile.local` as a workaround. This is not ideal as it may cause runtime issues.

## Why This Matters

- `mui-datatables` is no longer actively maintained (last release: 2023)
- It's stuck on MUI v5 and unlikely to support MUI v6
- We're carrying technical debt by forcing incompatible versions together

## Current Usage

`mui-datatables` is used for all data tables in the application. It's our most complex component - any migration is high-risk.

## Options

### 1. Keep mui-datatables + downgrade MUI (not recommended)
- Downgrade all MUI packages to v5
- Lose MUI v6 features and improvements
- Kicks the can down the road

### 2. Replace with MUI X Data Grid
- Official MUI solution, actively maintained
- Free tier (MIT) covers most use cases
- Pro tier needed for advanced features (grouping, aggregation, Excel export)
- Better TypeScript support
- More complex API than mui-datatables

### 3. Replace with TanStack Table + custom UI
- Headless, highly flexible
- Full control over rendering
- More work to implement but maximum flexibility
- No vendor lock-in

### 4. Replace with AG Grid
- Most feature-rich option
- Free community version available
- Heavier bundle size
- Different styling approach

## Recommendation

**MUI X Data Grid** seems like the best path forward:
- Same ecosystem (MUI)
- Active maintenance
- Good migration path from mui-datatables
- Free tier sufficient for our current needs

## Migration Strategy (when ready)

1. Create a wrapper component that abstracts the table implementation
2. Migrate one table at a time, starting with the simplest
3. Keep both implementations during transition
4. Remove mui-datatables once all tables are migrated

## Priority

**Medium** - Not blocking anything currently, but should be addressed before:
- Major MUI upgrades
- Adding new complex table features
- The `--legacy-peer-deps` workaround causes actual runtime issues

