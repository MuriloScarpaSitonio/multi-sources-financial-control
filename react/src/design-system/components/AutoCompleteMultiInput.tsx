import { type SyntheticEvent } from "react";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import Autocomplete, {
  type AutocompleteChangeReason,
  type AutocompleteChangeDetails,
} from "@mui/material/Autocomplete";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import Paper from "@mui/material/Paper";

import { getColor } from "../utils";
import { Colors } from "../enums";

type Option = { value: string; label: string };

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
}: {
  options: ReadonlyArray<Option>;
  label: string;
  id?: string;
  placeholder?: string;
  value: any[];
  onChange?: (
    event: SyntheticEvent,
    value: Option[] | undefined,
    reason: AutocompleteChangeReason,
    details?: AutocompleteChangeDetails<Option>,
  ) => void;
  selected: string[];
}) => (
  <Autocomplete
    value={value}
    onChange={onChange}
    multiple
    id={id}
    options={options}
    disableCloseOnSelect
    PaperComponent={CustomPaper}
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
        variant="standard"
      />
    )}
  />
);

export default AutoCompleteMultiInput;
