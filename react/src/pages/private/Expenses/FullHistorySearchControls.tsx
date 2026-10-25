import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import FilterIndicators, {
  type FilterFieldConfigs,
} from "../../../components/FilterIndicators";
import { SearchInput } from "../components";
import type { SearchFields } from "./fullHistorySearch";

export function FullHistorySearchBar({
  search,
  setSearch,
}: {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
}) {
  const [text, setText] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const previousSearch = useRef(search);
  const previousLocation = useRef(useLocation().key);
  const { key } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (
      previousSearch.current !== search ||
      (previousLocation.current !== key && navigationType === "POP")
    ) {
      clearTimeout(timer.current);
      setText(search);
    }
    previousSearch.current = search;
    previousLocation.current = key;
  }, [search, key, navigationType]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSearch(value), 600);
  };
  return (
    <SearchInput
      value={text}
      showClear={Boolean(search)}
      placeholder="Pesquisar por descrição"
      onChange={(event) => change(event.target.value)}
      onClear={() => change("")}
      clearLabel="Limpar pesquisa"
    />
  );
}

export function FullHistoryFilterIndicators<
  T extends SearchFields & Record<string, unknown>,
>({
  filters,
  setFilters,
  fieldConfigs,
}: {
  filters: T;
  setFilters: Dispatch<SetStateAction<T>>;
  fieldConfigs: FilterFieldConfigs;
}) {
  const { description: _description, ...visibleFilters } = filters;
  return (
    <FilterIndicators<Partial<Omit<T, "description">>>
      filters={visibleFilters}
      defaultFilters={{}}
      fieldConfigs={fieldConfigs}
      setFilters={(value) =>
        setFilters((previous) => {
          const { description, ...visible } = previous;
          const next = typeof value === "function" ? value(visible) : value;
          return { ...next, description } as T;
        })
      }
    />
  );
}
