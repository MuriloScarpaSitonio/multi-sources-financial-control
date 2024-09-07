import { useState } from "react";

import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";

import {
  type MRT_TableInstance as DataTable,
  type MRT_RowData as Row,
} from "material-react-table";

import Menu from "./Menu";

const ShowHideColumnsMenuItem = ({ table }: { table: DataTable<Row> }) => {
  const {
    options: {
      icons: { ViewColumnIcon },
    },
  } = table;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <MenuItem onClick={(event) => setAnchorEl(event.currentTarget)}>
        <ListItemIcon>
          <ViewColumnIcon />
        </ListItemIcon>
        <ListItemText>Mostrar ou ocultar colunas</ListItemText>
      </MenuItem>
      {anchorEl && (
        <Menu anchorEl={anchorEl} setAnchorEl={setAnchorEl} table={table} />
      )}
    </>
  );
};

export default ShowHideColumnsMenuItem;
