import { useCallback, useEffect, useRef, useState } from "react";

import AppBar from "@material-ui/core/AppBar";
import Badge from "@material-ui/core/Badge";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Collapse from "@material-ui/core/Collapse";
import Divider from "@material-ui/core/Divider";
import IconButton from "@material-ui/core/IconButton";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import MenuList from "@material-ui/core/MenuList";
import Toolbar from "@material-ui/core/Toolbar";
import Tooltip from "@material-ui/core/Tooltip";

import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import AccountCircle from "@material-ui/icons/AccountCircle";
import AssessmentIcon from "@material-ui/icons/Assessment";
import ExpandMore from "@material-ui/icons/ExpandMore";
import ExpandLess from "@material-ui/icons/ExpandLess";
import MonetizationOnIcon from "@material-ui/icons/MonetizationOn";
import NotificationsIcon from "@material-ui/icons/Notifications";
import ReceiptIcon from "@material-ui/icons/Receipt";
import SyncIcon from "@material-ui/icons/Sync";
import TimelineIcon from "@material-ui/icons/Timeline";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import HomeIcon from "@material-ui/icons/Home";

import { AssetsApi, TasksApi } from "../api";
import { FormFeedback } from "./FormFeedback";
import { getDateDiffString } from "../helpers.js";
import { makeStyles } from "@material-ui/core/styles";
import { Link } from "@material-ui/core";

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
    new URLSearchParams({ page_size: 10, page: page }).toString()
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
    [isLoaded, hasMore]
  );

  const bulkUpdateNotifiedAt = (tasks) => {
    let tasksIds = tasks
      .filter((task) => new Date(task.updated_at) > new Date(task.notified_at))
      .map((task) => task.id);
    if (tasksIds.length > 0) {
      api.bulkUpdateNotifiedAt(tasksIds);
      getTotalTasksUnnotified();
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
              classes={task.opened_at === null ? { root: classes.root } : {}}
            >
              <ListItemText
                primary={task.notification_display_title}
                secondary={task.notification_display_text}
              />
              <p style={{ fontSize: "11px" }}>
                há ± {getDateDiffString(new Date(task.updated_at), new Date())}
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

const Sync = () => {
  const [showAlert, setShowAlert] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  let api = new AssetsApi();
  const sync = (method, message) => {
    api[method]().then(() => {
      setShowAlert(true);
      setFeedbackMessage(message);
    });
  };

  return (
    <>
      <Tooltip title="Sincronizar preços, transferências e renda passiva">
        <IconButton size="large" color="black">
          <SyncIcon
            onClick={() => sync("syncAll", "Sincronizações em antamento!")}
          />
        </IconButton>
      </Tooltip>
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={feedbackMessage}
        severity="success"
      />
    </>
  );
};

const AssetsMenu = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [openIntegrationsMenu, setOpenIntegrationsMenu] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  const open = Boolean(anchorEl);

  let api = new AssetsApi();
  const sync = (method, message) => {
    api[method]().then(() => {
      setShowAlert(true);
      setFeedbackMessage(message);
    });
    setAnchorEl(null);
  };

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
          <MenuItem>
            <ListItemIcon>
              <ReceiptIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Rendimentos" />
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => setOpenIntegrationsMenu(!openIntegrationsMenu)}
          >
            <ListItemText primary="Integrações" />
            {openIntegrationsMenu ? <ExpandLess /> : <ExpandMore />}
          </MenuItem>
          <Collapse in={openIntegrationsMenu} timeout="auto" unmountOnExit>
            <MenuList>
              <MenuItem
                onClick={() =>
                  sync("syncPrices", "Sincronização de preços em antamento!")
                }
              >
                Atualizar preços
              </MenuItem>
              <MenuItem
                onClick={() =>
                  sync(
                    "syncCeiTransactions",
                    "Sincronização das transações do CEI em andamento!"
                  )
                }
              >
                Sincronizar transações do CEI
              </MenuItem>
              <MenuItem
                onClick={() =>
                  sync(
                    "syncCeiPassiveIncomes",
                    "Sincronização da renda passiva do CEI em andamento!"
                  )
                }
              >
                Sincronizar renda passiva do CEI
              </MenuItem>
              <MenuItem
                onClick={() =>
                  sync(
                    "syncKuCoinTransactions",
                    "Sincronização das transações da KuCoin em andamento!"
                  )
                }
              >
                Sincronizar transações da KuCoin
              </MenuItem>
              <MenuItem
                sx={{ paddingLeft: 20 }}
                onClick={() =>
                  sync(
                    "syncBinanceTransactions",
                    "Sincronização das transações da Binance em andamento!"
                  )
                }
              >
                Sincronizar transações da Binance
              </MenuItem>
            </MenuList>
          </Collapse>
        </MenuList>
      </Menu>
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={feedbackMessage}
        severity="success"
      />
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
export const Navbar = ({ hideValuesToggler, ...props }) => {
  const [hideValues, setHideValues] = useState(
    Boolean(window.localStorage.getItem("hideValues"))
  );

  return (
    <AppBar position="static" style={{ backgroundColor: "transparent" }}>
      <Toolbar variant="dense">
        <FinancesMenu />
        <AssetsMenu />
        <Box sx={{ flexGrow: 1, textAlign: "center", marginLeft: "85px" }}>
          <Sync />
          <IconButton
            size="large"
            color="black"
            onClick={() => {
              props.history.push("/home");
            }}
          >
            <HomeIcon />
          </IconButton>
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
        </Box>
        <Box sx={{ flexGrow: 1, textAlign: "end" }}>
          <Notifications />
          <Tooltip title="Meu perfil">
            <IconButton size="large" color="black">
              <AccountCircle />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
