import { RawDateString } from "../../../types";

export type Revenue = {
  id: number;
  value: number;
  description: string;
  created_at: RawDateString;
  is_fixed: boolean;
  full_description: string;
};
