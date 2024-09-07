import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";

import {
  type MRT_TableInstance as DataTable,
  type MRT_RowData as Row,
} from "material-react-table";

const ToggleDensityMenuItem = ({ table }: { table: DataTable<Row> }) => {
  const {
    getState,
    options: {
      icons: { DensityLargeIcon, DensityMediumIcon, DensitySmallIcon },
    },
    setDensity,
  } = table;
  const { density } = getState();

  const handleToggleDensePadding = () => {
    const nextDensity =
      density === "comfortable"
        ? "compact"
        : density === "compact"
          ? "spacious"
          : "comfortable";
    setDensity(nextDensity);
  };

  return (
    <MenuItem onClick={handleToggleDensePadding}>
      <ListItemIcon>
        {density === "compact" ? (
          <DensitySmallIcon />
        ) : density === "comfortable" ? (
          <DensityMediumIcon />
        ) : (
          <DensityLargeIcon />
        )}
      </ListItemIcon>
      <ListItemText>Alternar densidade</ListItemText>
    </MenuItem>
  );
};

export default ToggleDensityMenuItem;
