import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";

import { getColor } from "../../../../design-system/utils";
import { Colors } from "../../../../design-system/enums";
import Notifications from "./Notifications";
import UserMenu from "./UserMenu";
import HideValues from "./HideValues";

const NavBar = () => (
  <AppBar position="fixed" sx={{ background: getColor(Colors.neutral900) }}>
    <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
      <Box sx={{ width: "33%" }} />
      <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "center" }}>
        <HideValues />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", width: "33%" }}>
        <Notifications />
        <UserMenu />
      </Box>
    </Toolbar>
  </AppBar>
);

export default NavBar;
