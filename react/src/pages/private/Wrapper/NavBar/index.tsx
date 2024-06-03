import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";

import { getColor } from "../../../../design-system/utils";
import { Colors } from "../../../../design-system/enums";
import Notifications from "./Notifications";
import UserMenu from "./UserMenu";

const NavBar = () => (
  <AppBar position="fixed" sx={{ background: getColor(Colors.neutral900) }}>
    <Toolbar sx={{ justifyContent: "end" }}>
      <Notifications />
      <UserMenu />
    </Toolbar>
  </AppBar>
);

export default NavBar;
