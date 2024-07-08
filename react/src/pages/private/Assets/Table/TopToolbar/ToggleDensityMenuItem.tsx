import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";

import { type MRT_TableInstance as DataTable } from "material-react-table";

import { Asset } from "../../api/models";

const ToggleDensityMenuItem = ({ table }: { table: DataTable<Asset> }) => {
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
