import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";

import { type MRT_TableInstance as DataTable } from "material-react-table";

import { Asset } from "../../api/models";

const ToggleFullScreenMenuItem = ({ table }: { table: DataTable<Asset> }) => {
  const {
    getState,
    options: {
      icons: { FullscreenExitIcon, FullscreenIcon },
    },
    setIsFullScreen,
  } = table;

  const { isFullScreen } = getState();

  return (
    <MenuItem onClick={() => setIsFullScreen(!isFullScreen)}>
      <ListItemIcon>
        {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
      </ListItemIcon>
      <ListItemText>{`${isFullScreen ? "Fechar" : "Abrir"} tela cheia`}</ListItemText>
    </MenuItem>
  );
};

export default ToggleFullScreenMenuItem;
