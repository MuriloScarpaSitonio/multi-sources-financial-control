import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import { COLORS } from "../maps";
import { FunctionComponent } from "react";
import { Colors } from "../enums";

const FormFeedbackError: FunctionComponent<{ message: string }> = ({
  message,
}) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <InfoOutlinedIcon style={{ color: COLORS[Colors.danger200] }} />
    <FormHelperText>{message}</FormHelperText>
  </Stack>
);

export default FormFeedbackError;
