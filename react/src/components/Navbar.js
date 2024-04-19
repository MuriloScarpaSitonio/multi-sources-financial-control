import { useCallback, useEffect, useRef, useState } from "react";

import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import { makeStyles } from "@mui/styles";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountCircle from "@mui/icons-material/AccountCircle";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PersonIcon from "@mui/icons-material/Person";
import ReceiptIcon from "@mui/icons-material/Receipt";
import TimelineIcon from "@mui/icons-material/Timeline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import HomeIcon from "@mui/icons-material/Home";
import { useNavigate } from "react-router-dom";

import { TasksApi } from "../api";
import { logout } from "../api/instances";
import { stringToBoolean, getDateDiffString } from "../helpers.js";

const useStyles = makeStyles({
  root: {
    backgroundColor: "#f0f0f0",
    "&:hover": {
      backgroundColor: "#e8e8e8",
    },
  },
  nested: {
    paddingLeft: "4 px",
  },
});

const Notifications = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [totalTasksUnnotified, setTotalTasksUnnotified] = useState(0);
  const [page, setPage] = useState(1);

  let api = new TasksApi();
  const menuId = "navbar-menu";
  const observer = useRef();
  const classes = useStyles();

  const [data, isLoaded, hasMore] = api.infiniteScroll(
    new URLSearchParams({ page_size: 10, page: page }).toString(),
  );

  const lastTaskRef = useCallback(
    (node) => {
      if (!isLoaded) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [isLoaded, hasMore],
  );

  const bulkUpdateNotifiedAt = (tasks) => {
    let tasksIds = tasks
      .filter((task) => new Date(task.updated_at) > new Date(task.notified_at))
      .map((task) => task.id);
    if (tasksIds.length > 0) {
      api.bulkUpdateNotifiedAt(tasksIds).then(() => getTotalTasksUnnotified());
    }
  };

  const getTotalTasksUnnotified = () => {
    api.count({ notified: false }).then((response) => {
      setTotalTasksUnnotified(response.data.total);
    });
  };
  useEffect(() => getTotalTasksUnnotified(), []);

  useEffect(() => {
    if (anchorEl !== null) bulkUpdateNotifiedAt(data);
  }, [data]);

  const handleClick = (e) => {
    setAnchorEl(e.currentTarget);
    bulkUpdateNotifiedAt(data);
  };

  let now = new Date();
  return (
    <>
      <Tooltip title="Notificações">
        <IconButton
          size="large"
          color="black"
          aria-controls={menuId}
          onClick={handleClick}
        >
          <Badge badgeContent={totalTasksUnnotified} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        id={menuId}
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {data.map((task, index) => (
          <>
            <MenuItem
              onClick={() => setAnchorEl(null)}
              ref={data.length === index + 1 ? lastTaskRef : undefined}
              divider
              classes={{ root: classes.root }}
            >
              <ListItemText
                primary={task.notification_display_title}
                secondary={task.notification_display_text}
              />
              <p style={{ fontSize: "11px" }}>
                há ± {getDateDiffString(new Date(task.updated_at), now)}
              </p>
            </MenuItem>
          </>
        ))}
        {!hasMore && (
          <MenuItem>
            <ListItemText
              secondary="Não há mais notificações para carregar"
              secondaryTypographyProps={{ align: "center" }}
            />
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

const AssetsMenu = () => {
  const [anchorEl, setAnchorEl] = useState(null);

  const open = Boolean(anchorEl);

  return (
    <>
      <Button
        id="assets-menu-button"
        aria-controls={open ? "assets-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="true"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={open ? <ExpandLess /> : <ExpandMore />}
      >
        Investimentos
      </Button>
      <Menu
        id="assets-menu"
        MenuListProps={{
          "aria-labelledby": "assets-menu-button",
        }}
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
      >
        <MenuList
          autoFocusItem={open}
          id="assets-menu"
          aria-labelledby="assets-menu-button"
        >
          <Link href="/assets" color="inherit" underline="none">
            <MenuItem>
              <ListItemIcon>
                <AssessmentIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Ativos" />
            </MenuItem>
          </Link>
          <Link href="/assets/transactions" color="inherit" underline="none">
            <MenuItem>
              <ListItemIcon>
                <TimelineIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Transações" />
            </MenuItem>
          </Link>
          <Link href="/assets/incomes" color="inherit" underline="none">
            <MenuItem>
              <ListItemIcon>
                <ReceiptIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Rendimentos" />
            </MenuItem>
          </Link>
        </MenuList>
      </Menu>
    </>
  );
};

const FinancesMenu = () => {
  const [anchorEl, setAnchorEl] = useState(null);

  const open = Boolean(anchorEl);

  return (
    <>
      <Button
        id="finances-menu-button"
        aria-controls={open ? "finances-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="true"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={open ? <ExpandLess /> : <ExpandMore />}
      >
        Finanças pessoais
      </Button>
      <Menu
        id="finances-menu"
        MenuListProps={{
          "aria-labelledby": "finances-menu-button",
        }}
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
      >
        <MenuList
          autoFocusItem={open}
          id="finances-menu"
          aria-labelledby="finances-menu-button"
        >
          <Link href="/expenses" color="inherit" underline="none">
            <MenuItem>
              <ListItemIcon>
                <MonetizationOnIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Despesas" />
            </MenuItem>
          </Link>
          <Link href="/revenues" color="inherit" underline="none">
            <MenuItem>
              <ListItemIcon>
                <AccountBalanceIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Receitas" />
            </MenuItem>
          </Link>
        </MenuList>
      </Menu>
    </>
  );
};

const UserMenu = ({ navigate }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Meu perfil">
        <IconButton
          id="user-menu-button"
          aria-controls={open ? "user-menu" : undefined}
          aria-expanded={open ? "true" : undefined}
          aria-haspopup="true"
          size="large"
          color="black"
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <PersonIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="user-menu"
        MenuListProps={{
          "aria-labelledby": "user-menu-button",
        }}
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
      >
        <MenuList
          autoFocusItem={open}
          id="user-menu"
          aria-labelledby="user-menu-button"
        >
          <Link href="/me" color="inherit" underline="none">
            <MenuItem>
              <ListItemIcon>
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Configurações" />
            </MenuItem>
          </Link>
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

export const Navbar = ({ hideValuesToggler }) => {
  const [hideValues, setHideValues] = useState(
    Boolean(localStorage.getItem("hideValues")),
  );
  const navigate = useNavigate();

  const isPersonalFinancesModuleEnabled = stringToBoolean(
    localStorage.getItem("user_is_personal_finances_module_enabled"),
  );
  const isInvestmentsModuleEnabled = stringToBoolean(
    localStorage.getItem("user_is_investments_module_enabled"),
  );
  const isSubscriptionCancelled =
    localStorage.getItem("user_subscription_status") === "CANCELED";
  return (
    <AppBar position="static" style={{ backgroundColor: "transparent" }}>
      <Toolbar variant="dense">
        {isPersonalFinancesModuleEnabled && <FinancesMenu />}
        {isInvestmentsModuleEnabled && <AssetsMenu />}
        <Box sx={{ flexGrow: 1, textAlign: "center", marginLeft: "85px" }}>
          {isSubscriptionCancelled ? (
            <Button href="/subscription">Renovar assinatura</Button>
          ) : (
            <IconButton
              size="large"
              color="black"
              onClick={() => navigate("/home")}
            >
              <HomeIcon />
            </IconButton>
          )}
          {!isSubscriptionCancelled && (
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
          )}
        </Box>
        <Box sx={{ flexGrow: 1, textAlign: "end" }}>
          {!isSubscriptionCancelled && <Notifications />}
          <UserMenu navigate={navigate} />
        </Box>
      </Toolbar>
    </AppBar>
  );
};
