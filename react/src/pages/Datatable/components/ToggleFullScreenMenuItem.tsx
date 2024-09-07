import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";

import {
  type MRT_TableInstance as DataTable,
  type MRT_RowData as Row,
} from "material-react-table";

const ToggleFullScreenMenuItem = ({ table }: { table: DataTable<Row> }) => {
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
