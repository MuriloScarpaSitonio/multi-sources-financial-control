import type { Control } from "react-hook-form";

export type ReactHookFormsInputCustomProps = {
  control: Control;
  isFieldInvalid: (field: { name: string }) => boolean;
  getFieldHasError: (name: string) => boolean;
  getErrorMessage: (name: string, propName?: string) => string;
};
