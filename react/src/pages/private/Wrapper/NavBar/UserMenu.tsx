import { useState } from "react";

import { useNavigate } from "react-router-dom";

import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";

import AccountCircle from "@mui/icons-material/AccountCircle";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import PersonIcon from "@mui/icons-material/Person";

import { logout } from "../../../../api/instances";

const UserMenu = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLAnchorElement | null>(null);

  const navigate = useNavigate();

  return (
    <>
      <IconButton
        id="user-menu-button"
        aria-haspopup="true"
        size="large"
        color="inherit"
        onClick={(e) =>
          setAnchorEl(e.currentTarget as unknown as HTMLAnchorElement)
        }
      >
        <PersonIcon />
      </IconButton>
      <Menu
        id="user-menu"
        MenuListProps={{
          "aria-labelledby": "user-menu-button",
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuList id="user-menu" aria-labelledby="user-menu-button">
          <MenuItem component={Link} href="/me">
            <ListItemIcon>
              <AccountCircle fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Configurações" />
          </MenuItem>
          <MenuItem
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            <ListItemIcon>
              <ExitToAppIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Sair" />
          </MenuItem>
        </MenuList>
      </Menu>
    </>
  );
};

export default UserMenu;
