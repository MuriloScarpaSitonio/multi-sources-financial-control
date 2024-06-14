import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";

import { Colors } from "../enums";
import { getColor } from "../utils";

const FormFeedbackError = ({ message }: { message: string }) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <InfoOutlinedIcon sx={{ color: getColor(Colors.danger200) }} />
    <FormHelperText>{message}</FormHelperText>
  </Stack>
);

export default FormFeedbackError;
