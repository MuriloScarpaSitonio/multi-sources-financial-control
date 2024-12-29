import type { SyntheticEvent } from "react";
import type {
  AutocompleteChangeReason,
  AutocompleteChangeDetails,
} from "@mui/material/Autocomplete";

import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import Paper from "@mui/material/Paper";

import { getColor } from "../utils";
import { Colors } from "../enums";

type Option = { value: string; label: string };
type CustomOption = Option & { inputValue?: string };

const filter = createFilterOptions<CustomOption>();

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

function CustomPaper({ children }: { children?: React.ReactNode }) {
  return (
    <Paper
      sx={{
        "& .MuiAutocomplete-listbox": {
          "& .MuiAutocomplete-option[aria-selected='true']": {
            bgcolor: getColor(Colors.brand900),
            "&.Mui-focused": {
              bgcolor: getColor(Colors.brand900),
            },
          },
        },
        "& .MuiAutocomplete-listbox .MuiAutocomplete-option.Mui-focused": {
          bgcolor: getColor(Colors.neutral400),
        },
      }}
    >
      {children}
    </Paper>
  );
}

const AutoCompleteMultiInput = ({
  options,
  id,
  label,
  placeholder,
  value,
  onChange,
  selected,
  creatable = false,
  renderInputError = false,
  loading = false,
  noOptionsText = "",
  loadingText = "",
}: {
  options: ReadonlyArray<Option>;
  label: string;
  id?: string;
  placeholder?: string;
  value: any[];
  onChange: (
    event: SyntheticEvent,
    value: Option[] | CustomOption[] | undefined,
    reason: AutocompleteChangeReason,
    details?: AutocompleteChangeDetails<Option>,
  ) => void;
  selected: string[];
  creatable?: boolean;
  renderInputError?: boolean;
  loading?: boolean;
  noOptionsText?: string;
  loadingText?: string;
}) => (
  <Autocomplete
    value={value}
    clearText="Limpar"
    noOptionsText={noOptionsText}
    loadingText={loadingText}
    loading={loading}
    id={id}
    options={options}
    disableCloseOnSelect
    PaperComponent={CustomPaper}
    multiple
    onChange={(event, input, reason, details) => {
      if (!creatable || reason === "clear" || reason === "removeOption")
        return onChange(event, input, reason, details);

      const { label, value, inputValue } = input.slice(-1)[0];
      onChange(
        event,
        [
          ...input.slice(0, -1),
          {
            label: inputValue ?? label,
            value: inputValue ?? value,
          },
        ],
        reason,
        details,
      );
    }}
    renderOption={(props, option) => {
      const checked = selected.includes(option.value);
      return (
        // eslint-disable-next-line jsx-a11y/role-supports-aria-props
        <li {...props} aria-selected={checked}>
          <Checkbox
            icon={icon}
            checkedIcon={checkedIcon}
            style={{ marginRight: 8 }}
            checked={checked}
          />
          {option.label}
        </li>
      );
    }}
    renderInput={(params) => (
      <TextField
        {...params}
        label={label}
        placeholder={placeholder}
        error={renderInputError}
        variant="standard"
      />
    )}
    filterOptions={
      !creatable
        ? undefined
        : (options, params) => {
            const filtered = filter(options, params);

            const { inputValue } = params;
            const isExisting = options.some(
              (option) => inputValue === option.label,
            );
            if (inputValue && !isExisting) {
              filtered.push({
                inputValue: inputValue,
                label: `Adicionar "${inputValue}"`,
                value: "",
              });
            }

            return filtered;
          }
    }
  />
);

export default AutoCompleteMultiInput;
