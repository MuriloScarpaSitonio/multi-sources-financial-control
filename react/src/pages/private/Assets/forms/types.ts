import type { Dispatch, SetStateAction } from "react";

import type { Control } from "react-hook-form";

export type ReactHookFormsInputCustomProps = {
  control: Control;
  isFieldInvalid: (field: { name: string }) => boolean;
  getFieldHasError: (name: string) => boolean;
  getErrorMessage: (name: string, propName?: string) => string;
};

type AssetsMinimalDataQueryFilters = {
  filters?: { status?: "OPENED" | "CLOSED" };
};

export type AssetCodeAutoCompleteProps = ReactHookFormsInputCustomProps &
  AssetsMinimalDataQueryFilters & {
    creatable: false;
    newCode?: unknown;
    setNewCode?: unknown;
    isHeldInSelfCustody?: boolean;
  };
export type CreatableAssetCodeAutoCompleteProps =
  ReactHookFormsInputCustomProps &
    AssetsMinimalDataQueryFilters & {
      creatable: true;
      newCode: string | undefined;
      setNewCode: Dispatch<SetStateAction<string | undefined>>;
      isHeldInSelfCustody?: boolean;
    };
