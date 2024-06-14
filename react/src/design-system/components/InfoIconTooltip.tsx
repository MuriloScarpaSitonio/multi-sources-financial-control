import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Tooltip from "@mui/material/Tooltip";

import { Colors } from "../enums";
import { getColor } from "../utils";

const InfoIconTooltip = ({ text }: { text: string }) => (
  <Tooltip placement="top-start" title={text}>
    <InfoOutlinedIcon
      sx={{ color: getColor(Colors.neutral300) }}
      fontSize="inherit"
    />
  </Tooltip>
);

export default InfoIconTooltip;
