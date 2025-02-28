import type { Control } from "react-hook-form";

import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";

import { Controller } from "react-hook-form";

import { EventTypes, EventTypeLabels } from "../../consts";

const EventTypesRadios = ({ control }: { control: Control }) => (
  <Controller
    name="event_type"
    control={control}
    render={({ field }) => (
      <RadioGroup {...field} row>
        <FormControlLabel
          value={EventTypes.CREDITED}
          control={<Radio />}
          label={EventTypeLabels.CREDITED}
          defaultChecked
        />
        <FormControlLabel
          value={EventTypes.PROVISIONED}
          control={<Radio />}
          label={EventTypeLabels.PROVISIONED}
        />
      </RadioGroup>
    )}
  />
);

export default EventTypesRadios;
