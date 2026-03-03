export type FilterFieldType = "string" | "array" | "boolean";

export interface FilterFieldSchema {
  type: FilterFieldType;
}

export type FilterSchema = Record<string, FilterFieldSchema>;

export const formatDateForURL = (date: Date): string =>
  date.toLocaleDateString("pt-BR");

export const parseDateFromURL = (str: string): Date | null => {
  const [day, month, year] = str.split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

export const serializeFilters = (
  filters: Record<string, any>,
  schema: FilterSchema,
  scope?: string
): Record<string, string | string[]> => {
  const result: Record<string, string | string[]> = {};
  const prefix = scope ? `${scope}_` : "";

  for (const [key, fieldSchema] of Object.entries(schema)) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") continue;

    const paramKey = `${prefix}${key}`;

    switch (fieldSchema.type) {
      case "array":
        if (Array.isArray(value) && value.length > 0) {
          result[paramKey] = value;
        }
        break;
      case "boolean":
        if (typeof value === "boolean") {
          result[paramKey] = value.toString();
        }
        break;
      case "string":
      default:
        if (value) {
          result[paramKey] = String(value);
        }
        break;
    }
  }

  return result;
};

export const deserializeFilters = <T extends Record<string, any>>(
  params: URLSearchParams,
  schema: FilterSchema,
  defaults: T,
  scope?: string
): T => {
  const result = { ...defaults };
  const prefix = scope ? `${scope}_` : "";

  for (const [key, fieldSchema] of Object.entries(schema)) {
    const paramKey = `${prefix}${key}`;

    switch (fieldSchema.type) {
      case "array": {
        const values = params.getAll(paramKey);
        if (values.length > 0) {
          (result as Record<string, any>)[key] = values;
        }
        break;
      }
      case "boolean": {
        const value = params.get(paramKey);
        if (value === "true") {
          (result as Record<string, any>)[key] = true;
        } else if (value === "false") {
          (result as Record<string, any>)[key] = false;
        }
        break;
      }
      case "string":
      default: {
        const value = params.get(paramKey);
        if (value !== null) {
          (result as Record<string, any>)[key] = value;
        }
        break;
      }
    }
  }

  return result;
};

export const buildURLSearchParams = (
  filters: Record<string, string | string[]>,
  existingParams?: URLSearchParams
): URLSearchParams => {
  const params = new URLSearchParams();

  // Preserve existing params that are not in filters
  if (existingParams) {
    const filterKeys = new Set(Object.keys(filters));
    existingParams.forEach((value, key) => {
      if (!filterKeys.has(key)) {
        params.append(key, value);
      }
    });
  }

  // Add new filter values
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  }

  return params;
};

export const clearScopedParams = (
  params: URLSearchParams,
  scope: string
): URLSearchParams => {
  const newParams = new URLSearchParams();
  const prefix = `${scope}_`;

  params.forEach((value, key) => {
    if (!key.startsWith(prefix)) {
      newParams.append(key, value);
    }
  });

  return newParams;
};
