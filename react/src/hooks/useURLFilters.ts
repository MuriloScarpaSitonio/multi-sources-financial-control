import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  deserializeFilters,
  FilterSchema,
  formatDateForURL,
  parseDateFromURL,
  serializeFilters,
} from "../urlParams";

interface DateConfig {
  startDate: Date;
  endDate: Date;
}

interface UseURLFiltersConfig<T> {
  schema: FilterSchema;
  defaults: T;
  defaultDates?: DateConfig;
  scope?: string;
}

interface UseURLFiltersReturn<T> {
  filters: T;
  setFilters: (filters: T | ((prev: T) => T)) => void;
  dates: DateConfig | undefined;
  setDates: (dates: DateConfig | ((prev: DateConfig) => DateConfig)) => void;
  isReady: boolean;
}

// Helper to create a comparable string from URL params for a given scope
const getParamsFingerprint = (
  params: URLSearchParams,
  schema: FilterSchema,
  scope?: string,
  hasDates?: boolean
): string => {
  const prefix = scope ? `${scope}_` : "";
  const relevantParams: string[] = [];

  // Collect filter params
  for (const key of Object.keys(schema)) {
    const paramKey = `${prefix}${key}`;
    const values = params.getAll(paramKey);
    if (values.length > 0) {
      relevantParams.push(`${paramKey}=${values.sort().join(",")}`);
    }
  }

  // Collect date params
  if (hasDates) {
    const startKey = `${prefix}startDate`;
    const endKey = `${prefix}endDate`;
    const startDate = params.get(startKey);
    const endDate = params.get(endKey);
    if (startDate) relevantParams.push(`${startKey}=${startDate}`);
    if (endDate) relevantParams.push(`${endKey}=${endDate}`);
  }

  return relevantParams.sort().join("&");
};

export function useURLFilters<T extends Record<string, any>>({
  schema,
  defaults,
  defaultDates,
  scope,
}: UseURLFiltersConfig<T>): UseURLFiltersReturn<T> {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isReady, setIsReady] = useState(false);
  const isInitializing = useRef(true);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedFingerprint = useRef<string>("");
  const pendingSyncRef = useRef(false);

  // Generate scoped keys for dates
  const startDateKey = scope ? `${scope}_startDate` : "startDate";
  const endDateKey = scope ? `${scope}_endDate` : "endDate";

  // Initialize filters from URL or defaults
  const initialFilters = useMemo(() => {
    return deserializeFilters(searchParams, schema, defaults, scope);
  }, []);

  // Initialize dates from URL or defaults
  const initialDates = useMemo(() => {
    if (!defaultDates) return undefined;

    const startDateStr = searchParams.get(startDateKey);
    const endDateStr = searchParams.get(endDateKey);

    const startDate = startDateStr
      ? parseDateFromURL(startDateStr) ?? defaultDates.startDate
      : defaultDates.startDate;

    const endDate = endDateStr
      ? parseDateFromURL(endDateStr) ?? defaultDates.endDate
      : defaultDates.endDate;

    return { startDate, endDate };
  }, []);

  const [filters, setFiltersState] = useState<T>(initialFilters);
  const [dates, setDatesState] = useState<DateConfig | undefined>(initialDates);

  // Use refs to track latest values for URL sync
  const filtersRef = useRef(filters);
  const datesRef = useRef(dates);

  // Keep refs in sync with state
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    datesRef.current = dates;
  }, [dates]);

  // Sync state to URL - uses refs to get latest values
  const syncToURL = useCallback(() => {
    const currentFilters = filtersRef.current;
    const currentDates = datesRef.current;

    const serialized = serializeFilters(currentFilters, schema, scope);

    // Add dates if configured
    if (currentDates && defaultDates) {
      serialized[startDateKey] = formatDateForURL(currentDates.startDate);
      serialized[endDateKey] = formatDateForURL(currentDates.endDate);
    }

    // Read CURRENT URL directly to ensure we have the latest state
    // This prevents race conditions when multiple hooks sync concurrently
    const currentURLParams = new URLSearchParams(window.location.search);

    // Build new params, preserving unrelated params from current URL
    const newParams = new URLSearchParams();

    // Copy params that don't belong to this filter scope
    const prefix = scope ? `${scope}_` : "";
    currentURLParams.forEach((value, key) => {
      let isOwnParam: boolean;
      if (scope) {
        // For scoped hooks, own params are those with the scope prefix
        isOwnParam = key.startsWith(prefix);
      } else {
        // For unscoped hooks, own params are schema keys and date keys
        isOwnParam =
          Object.keys(schema).includes(key) ||
          key === "startDate" ||
          key === "endDate";
      }
      if (!isOwnParam) {
        newParams.append(key, value);
      }
    });

    // Add serialized filter values
    for (const [key, value] of Object.entries(serialized)) {
      if (Array.isArray(value)) {
        value.forEach((v) => newParams.append(key, v));
      } else if (value !== undefined && value !== null && value !== "") {
        newParams.set(key, value);
      }
    }

    // Store fingerprint of what we're writing
    lastSyncedFingerprint.current = getParamsFingerprint(
      newParams,
      schema,
      scope,
      !!defaultDates
    );

    // Clear pending sync flag - URL is now in sync with state
    pendingSyncRef.current = false;

    setSearchParams(newParams, { replace: true });
  }, [schema, scope, defaultDates, startDateKey, endDateKey, setSearchParams]);

  // Schedule sync to URL - uses a small delay to batch rapid changes
  // and ensure proper ordering when multiple hooks sync
  const scheduleSyncToURL = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Use a minimal delay to batch rapid changes, but keep it short
    // so that multiple hooks' syncs can see each other's URL changes
    syncTimeoutRef.current = setTimeout(() => {
      syncToURL();
    }, 5);
  }, [syncToURL]);

  // Set filters with URL sync
  const setFilters = useCallback(
    (filtersOrUpdater: T | ((prev: T) => T)) => {
      setFiltersState((prev) => {
        const newFilters =
          typeof filtersOrUpdater === "function"
            ? filtersOrUpdater(prev)
            : filtersOrUpdater;

        // Update ref immediately for sync
        filtersRef.current = newFilters;

        // Mark that we have a pending sync - this prevents the effect from
        // reading stale values from URL before our sync completes
        pendingSyncRef.current = true;

        // Schedule URL sync
        scheduleSyncToURL();

        return newFilters;
      });
    },
    [scheduleSyncToURL]
  );

  // Set dates with URL sync
  const setDates = useCallback(
    (datesOrUpdater: DateConfig | ((prev: DateConfig) => DateConfig)) => {
      setDatesState((prev) => {
        if (!prev) return prev;
        const newDates =
          typeof datesOrUpdater === "function"
            ? datesOrUpdater(prev)
            : datesOrUpdater;

        // Update ref immediately for sync
        datesRef.current = newDates;

        // Mark that we have a pending sync - this prevents the effect from
        // reading stale values from URL before our sync completes
        pendingSyncRef.current = true;

        // Schedule URL sync
        scheduleSyncToURL();

        return newDates;
      });
    },
    [scheduleSyncToURL]
  );

  // Check if we have anything meaningful to sync on mount
  const hasInitialContent = useMemo(() => {
    // If we have dates, we always need to sync
    if (defaultDates) return true;

    // Check if initial filters have any non-empty values
    const serialized = serializeFilters(initialFilters, schema, scope);
    return Object.keys(serialized).length > 0;
  }, []);

  // Initial sync to URL on mount
  useEffect(() => {
    if (isInitializing.current) {
      isInitializing.current = false;

      // Only sync on mount if we have dates or initial filters to write
      // This prevents scoped hooks without dates from racing with hooks that have dates
      if (hasInitialContent) {
        syncToURL();
      } else {
        // Still set the initial fingerprint for browser navigation detection
        lastSyncedFingerprint.current = getParamsFingerprint(
          searchParams,
          schema,
          scope,
          !!defaultDates
        );
      }

      setIsReady(true);
    }
  }, [syncToURL, hasInitialContent]);

  // Handle browser back/forward navigation
  useEffect(() => {
    // Skip during initialization
    if (isInitializing.current) return;

    // Skip if we have a pending sync - URL hasn't caught up with state yet
    // This prevents reading stale values when another hook's sync triggers this effect
    if (pendingSyncRef.current) return;

    // Get fingerprint of current URL params
    const currentFingerprint = getParamsFingerprint(
      searchParams,
      schema,
      scope,
      !!defaultDates
    );

    // If fingerprint matches what we last synced, this is our own change - skip
    if (currentFingerprint === lastSyncedFingerprint.current) {
      return;
    }

    // Deserialize URL to see what filters are there
    const urlFilters = deserializeFilters(searchParams, schema, defaults, scope);

    // Additional safety check: if current state already matches URL, skip
    // This prevents unnecessary state updates when fingerprint comparison fails
    // due to race conditions between multiple hooks
    const currentFiltersJson = JSON.stringify(filtersRef.current);
    const urlFiltersJson = JSON.stringify(urlFilters);
    if (currentFiltersJson === urlFiltersJson) {
      // State already matches URL - just update fingerprint and skip
      lastSyncedFingerprint.current = currentFingerprint;
      return;
    }

    // This is a browser navigation or external change - update state from URL
    let newDates: DateConfig | undefined;
    if (defaultDates) {
      const startDateStr = searchParams.get(startDateKey);
      const endDateStr = searchParams.get(endDateKey);

      newDates = {
        startDate: startDateStr
          ? parseDateFromURL(startDateStr) ?? defaultDates.startDate
          : defaultDates.startDate,
        endDate: endDateStr
          ? parseDateFromURL(endDateStr) ?? defaultDates.endDate
          : defaultDates.endDate,
      };

      // Also check dates match
      if (datesRef.current && newDates) {
        const currentDatesMatch =
          datesRef.current.startDate.getTime() === newDates.startDate.getTime() &&
          datesRef.current.endDate.getTime() === newDates.endDate.getTime();
        if (currentFiltersJson === urlFiltersJson && currentDatesMatch) {
          lastSyncedFingerprint.current = currentFingerprint;
          return;
        }
      }
    }

    // Update state and refs without triggering URL sync
    filtersRef.current = urlFilters;
    setFiltersState(urlFilters);
    if (newDates) {
      datesRef.current = newDates;
      setDatesState(newDates);
    }

    // Update fingerprint to match current URL
    lastSyncedFingerprint.current = currentFingerprint;
  }, [searchParams, schema, defaults, scope, defaultDates, startDateKey, endDateKey]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    filters,
    setFilters,
    dates,
    setDates,
    isReady,
  };
}

export default useURLFilters;
