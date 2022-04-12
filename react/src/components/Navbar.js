import { useCallback, useEffect, useRef, useState } from "react";

import AppBar from "@material-ui/core/AppBar";
import Box from "@material-ui/core/Box";
import ListItemText from "@material-ui/core/ListItemText";
import Toolbar from "@material-ui/core/Toolbar";
import IconButton from "@material-ui/core/IconButton";
import Badge from "@material-ui/core/Badge";
import MenuItem from "@material-ui/core/MenuItem";
import Menu from "@material-ui/core/Menu";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";

import AccountCircle from "@material-ui/icons/AccountCircle";
import NotificationsIcon from "@material-ui/icons/Notifications";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import MonetizationOnIcon from "@material-ui/icons/MonetizationOn";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import SyncIcon from "@material-ui/icons/Sync";
import MoreVertIcon from "@material-ui/icons/MoreVert";

import { AssetsApi, TasksApi } from "../api";
import { FormFeedback } from "./FormFeedback";
import { getDateDiffString } from "../helpers.js";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles({
  root: {
    backgroundColor: "#f0f0f0",
    "&:hover": {
      backgroundColor: "#e8e8e8",
    },
  },
  /* Pseudo-class applied to the root element if `selected={true}`. */
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
  const [anchorEl, setAnchorEl] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const open = Boolean(anchorEl);

  let api = new AssetsApi();
  const sync = (method, message, shouldCloseMenu) => {
    api[method]().then(() => {
      setShowAlert(true);
      setFeedbackMessage(message);
    });
    if (shouldCloseMenu) {
      setAnchorEl(null);
    }
  };

  return (
    <>
      <Typography style={{ flexGrow: 1, textAlign: "center" }}>
        <Tooltip title="Sincronizar preços, transferências e renda passiva">
          <IconButton size="large" color="black">
            <SyncIcon
              onClick={() => sync("syncAll", "Sincronizações em antamento!")}
            />
          </IconButton>
        </Tooltip>
        <IconButton
          aria-label="more"
          id="long-button"
          aria-controls={open ? "long-menu" : undefined}
          aria-expanded={open ? "true" : undefined}
          aria-haspopup="true"
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <MoreVertIcon />
        </IconButton>
        <Menu
          id="long-menu"
          MenuListProps={{
            "aria-labelledby": "long-button",
          }}
          anchorEl={anchorEl}
          open={open}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem
            onClick={() =>
              sync("syncPrices", "Sincronização de preços em antamento!", true)
            }
          >
            Atualizar preços
          </MenuItem>
          <MenuItem
            onClick={() =>
              sync(
                "syncCeiTransactions",
                "Sincronização das transações do CEI em andamento!",
                true
              )
            }
          >
            Sincronizar transações do CEI
          </MenuItem>
          <MenuItem
            onClick={() =>
              sync(
                "syncCeiPassiveIncomes",
                "Sincronização da renda passiva do CEI em andamento!",
                true
              )
            }
          >
            Sincronizar renda passiva do CEI
          </MenuItem>
          <MenuItem
            onClick={() =>
              sync(
                "syncKuCoinTransactions",
                "Sincronização das transações da KuCoin em andamento!",
                true
              )
            }
          >
            Sincronizar transações da KuCoin
          </MenuItem>
          <MenuItem
            onClick={() =>
              sync(
                "syncBinanceTransactions",
                "Sincronização das transações da Binance em andamento!",
                true
              )
            }
          >
            Sincronizar transações da Binance
          </MenuItem>
        </Menu>
      </Typography>
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={feedbackMessage}
        severity="success"
      />
    </>
  );
};

export const Navbar = ({ hideValuesToggler }) => {
  const [hideValues, setHideValues] = useState(
    Boolean(window.localStorage.getItem("hideValues"))
  );

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" style={{ backgroundColor: "transparent" }}>
        <Toolbar variant="dense">
          <Tooltip title="Minhas despesas">
            <IconButton
              edge="start"
              size="large"
              color="black"
              href="/expenses"
            >
              <MonetizationOnIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Minhas receitas">
            <IconButton size="large" color="black" href="/revenues">
              <AccountBalanceIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Meus ativos">
            <IconButton size="large" color="black" href="/assets">
              <TrendingUpIcon />
            </IconButton>
          </Tooltip>
          <Sync />
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
            <Notifications />
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
};
