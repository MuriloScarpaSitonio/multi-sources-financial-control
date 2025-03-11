import { endOfMonth } from "date-fns";

export const customEndOfMonth = (date: Date) => {
  const result = endOfMonth(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const roundDown = (value: number) => {
  if (value < 100_000) return Math.floor(value / 10_000) * 10_000;
  else if (value < 1_000_000) return Math.floor(value / 100_000) * 100_000;
  else return Math.floor(value / 500_000) * 500_000;
};

export const roundUp = (value: number) => {
  if (value < 100_000) return Math.ceil(value / 10_000) * 10_000;
  else if (value < 1_000_000) return Math.ceil(value / 100_000) * 100_000;
  else return Math.ceil(value / 100_000) * 100_000;
};

export const numberTickFormatter = (value: number) => {
  if (Math.abs(value) >= 1_000_000)
    return "R$ " + (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  else if (Math.abs(value) >= 1000)
    return "R$ " + (value / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  else return "R$ " + value.toString();
};

export const monthTickerFormatter = (value: string, index: number) => {
  if (!index) return "";
  if (value === "agora") return value;
  const [, month, year] = value.split("/");
  return `${month}/${year}`;
};
