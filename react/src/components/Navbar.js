import { useState } from "react";

import AppBar from "@material-ui/core/AppBar";
import Box from "@material-ui/core/Box";
import Toolbar from "@material-ui/core/Toolbar";
import IconButton from "@material-ui/core/IconButton";
import Badge from "@material-ui/core/Badge";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";

import AccountCircle from "@material-ui/icons/AccountCircle";
import NotificationsIcon from "@material-ui/icons/Notifications";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import MonetizationOnIcon from "@material-ui/icons/MonetizationOn";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";

export default function Navbar({ hideValuesToggler }) {
  const [hideValues, setHideValues] = useState(
    Boolean(window.localStorage.getItem("hideValues"))
  );

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" style={{ backgroundColor: "transparent" }}>
        <Toolbar variant="dense">
          <Tooltip title="Minhas despesas">
            <IconButton edge="start" size="large" color="black">
              <AccountBalanceIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Minhas receitas">
            <IconButton size="large" color="black">
              <MonetizationOnIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Meus ativos">
            <IconButton size="large" color="black">
              <TrendingUpIcon />
            </IconButton>
          </Tooltip>
          <Typography
            variant="h6"
            style={{ color: "black", flexGrow: 1, textAlign: "center" }}
          >
            ?
          </Typography>
          <Box>
            <Tooltip title={hideValues ? "Ocultar valores " : "Exibir valores"}>
              <IconButton
                size="large"
                color="black"
                onClick={() => {
                  hideValuesToggler();
                  setHideValues(!hideValues);
                }}
              >
                {hideValues ? <VisibilityIcon /> : <VisibilityOffIcon />}
              </IconButton>
            </Tooltip>
            <IconButton size="large" color="black">
              <Badge badgeContent={0} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <Tooltip title="Meu perfil">
              <IconButton size="large" edge="end" color="black">
                <AccountCircle />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>
    </Box>
  );
}
