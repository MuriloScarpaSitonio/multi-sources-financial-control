import type { Dispatch, SetStateAction } from "react";
import type { MRT_SortingState } from "material-react-table";
import { formatDateForURL, parseDateFromURL } from "../../../urlParams";

export type SearchFields = {
  description?: string;
  startDate?: string;
  endDate?: string;
};
export type BoundFilters<T> = {
  filters: T;
  setFilters: Dispatch<SetStateAction<T>>;
};
export type FullHistoryTableProps<T> =
  | {
      mode?: "overview";
      externalFilters: BoundFilters<T>;
      initialSearch?: string;
      onOpenSearch?: (overviewDescription: string) => void;
    }
  | {
      mode: "search";
      externalFilters: BoundFilters<T & SearchFields>;
      onBackToOverview: () => void;
    };
export type SearchDateControls = {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
};

export function getFullHistoryOrdering(sorting: MRT_SortingState): string {
  const sort = sorting.find((item) =>
    ["created_at", "value"].includes(item.id),
  );
  return sort ? `${sort.desc ? "-" : ""}${sort.id},-id` : "-created_at,-id";
}

export function getSearchDateControls<T>(
  filters: T & SearchFields,
  setFilters: Dispatch<SetStateAction<T & SearchFields>>,
): SearchDateControls {
  return {
    startDate: filters.startDate ? parseDateFromURL(filters.startDate) : null,
    endDate: filters.endDate ? parseDateFromURL(filters.endDate) : null,
    onStartDateChange: (date) =>
      setFilters((prev) => ({
        ...prev,
        startDate: date ? formatDateForURL(date) : undefined,
      })),
    onEndDateChange: (date) =>
      setFilters((prev) => ({
        ...prev,
        endDate: date ? formatDateForURL(date) : undefined,
      })),
  };
}
