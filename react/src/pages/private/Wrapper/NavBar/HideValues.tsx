import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useHideValues } from "../../../../hooks/useHideValues";

const HideValues = () => {
  const { hideValues, toggle } = useHideValues();

  return (
    <Tooltip title={hideValues ? "Exibir valores " : "Ocultar valores"}>
      <IconButton size="large" color="inherit" onClick={toggle}>
        {hideValues ? <VisibilityOffIcon /> : <VisibilityIcon />}
      </IconButton>
    </Tooltip>
  );
};

export default HideValues;
