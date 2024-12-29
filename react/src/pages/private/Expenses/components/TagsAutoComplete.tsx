import type { Dispatch, SetStateAction } from "react";

import { useMemo } from "react";
import Stack from "@mui/material/Stack";
import { Controller } from "react-hook-form";

import {
  AutoCompleteMultiInput,
  FormFeedbackError,
} from "../../../../design-system";
import { ReactHookFormsInputCustomProps } from "../../../../design-system/components/forms/types";
import { useGetTags } from "../hooks";
import { Filters } from "../types";

type Option = { label: string; value: string };
type Options = Option[] | undefined;

const TagsAutoComplete = ({
  control,
  getFieldHasError,
  getErrorMessage,
  isFieldInvalid,
  selectedTags,
  setFilters,
  creatable = true,
}: ReactHookFormsInputCustomProps & {
  selectedTags: (string | Option)[];
  setFilters?: Dispatch<SetStateAction<Filters>>;
  creatable?: boolean;
}) => {
  const { data: tags, isPending: isFetchingTags } = useGetTags();

  const options = useMemo(
    () =>
      tags?.map((tag) => ({
        label: tag,
        value: tag,
      })) ?? [],
    [tags],
  );

  const handleChange = (
    values: Options,
    onFieldChange: (...event: any[]) => void,
  ) => {
    const map = values?.reduce(
      (acc, e) => acc.set(e.value ?? e, (acc.get(e.value ?? e) || 0) + 1),
      new Map(),
    );
    if (!values) return;
    const uniqueValues = values.filter((v) => map?.get(v.value ?? v) === 1);
    onFieldChange(uniqueValues.map((v) => v.value ?? v));
    setFilters?.((prevFilters) => ({
      ...prevFilters,
      tag: uniqueValues.map((v) => v.value ?? v),
    }));
  };

  return (
    <Controller
      name="tags"
      control={control}
      render={({ field: { value, onChange, name } }) => (
        <Stack spacing={0.5}>
          <AutoCompleteMultiInput
            label="Tags"
            noOptionsText="Nenhuma tag encontrada"
            loadingText="Carregando tags..."
            value={value ? value : []}
            selected={selectedTags?.map((v) => (v as Option).value ?? v) ?? []}
            onChange={(_, values: Options) => handleChange(values, onChange)}
            options={options}
            creatable={creatable}
            renderInputError={isFieldInvalid({ name })}
            loading={isFetchingTags}
          />
          {getFieldHasError(name) && (
            <FormFeedbackError message={getErrorMessage(name)} />
          )}
        </Stack>
      )}
    />
  );
};

export default TagsAutoComplete;
