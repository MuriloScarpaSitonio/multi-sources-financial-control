import { useEffect, useState } from "react";

import AppBar from "@material-ui/core/AppBar";
import Box from "@material-ui/core/Box";
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

import { AssetsApi, TasksApi } from "../api";
import { FormFeedback } from "./FormFeedback";

const NOTIFICATION_STATE_MAP = {
  STARTED: "iniciada",
  SUCCESS: "finalizada",
  FAILURE: "falhou",
};

const NOTIFICATION_TASK_NAME_MAP = {
  sync_cei_transactions_task: "Transações do CEI",
  sync_cei_passive_incomes_task: "Renda passiva do CEI",
  sync_kucoin_transactions_task: "Transações da KuCoin",
  sync_binance_transactions_task: "Transações da Binance",
  fetch_current_assets_prices: "Atualização de preços",
};

function getNotificationTitle(state, name) {
  console.log(state);
  return `Integração '${NOTIFICATION_TASK_NAME_MAP[name]}' ${
    NOTIFICATION_STATE_MAP[state] || "em estado desconhecido"
  }`;
}

function getNotificationInfos(title, transactionsCount, incomesCount) {
  if (title.includes("falhou")) {
    return "Por favor, clique para visitar a página da tarefa e ver o erro completo.";
  }
  if (title.includes("iniciada")) {
    return "";
  }
  if (title.includes("Transações")) {
    return `${transactionsCount} transações encontradas!`;
  }
  if (title.includes("Renda passiva")) {
    return `${incomesCount} rendimentos passivos encontrados!`;
  }
  if (title.includes("preços")) {
    return `Preços atualizados!`;
  }
}

const Notification = ({ task, handleClose }) => {
  let title = getNotificationTitle(task.state, task.name);
  let infos = getNotificationInfos(
    title,
    task.transactions.length,
    task.incomes.length
  );
  return (
    <MenuItem onClick={handleClose}>
      {title} + {infos}
    </MenuItem>
  );
};

const Notifications = ({ id, anchorEl, tasks, handleClose }) => (
  <Menu
    anchorEl={anchorEl}
    anchorOrigin={{
      vertical: "top",
      horizontal: "right",
    }}
    id={id}
    keepMounted
    transformOrigin={{
      vertical: "top",
      horizontal: "right",
    }}
    open={Boolean(anchorEl)}
    onClose={handleClose}
  >
    {tasks.map((task) => (
      <Notification task={task} handleClose={handleClose} />
    ))}
  </Menu>
);

export const Navbar = ({ hideValuesToggler }) => {
  const [hideValues, setHideValues] = useState(
    Boolean(window.localStorage.getItem("hideValues"))
  );
  const [anchorEl, setAnchorEl] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [totalTasksUnseen, setTotalTasksUnseen] = useState(0);
  const [tasks, setTasks] = useState([]);

  const handleNotificationsClose = () => {
    setAnchorEl(null);
  };

  const menuId = "primary-search-account-menu";

  let api = new TasksApi();
  useEffect(
    () =>
      api.list().then((response) => {
        setTasks(response.data.results);
        setTotalTasksUnseen(response.data.count);
      }),
    []
  );
  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
    api.bulkUpdateNotifiedAt(tasks.map((task) => task.id));
  };

  const syncAll = () =>
    new AssetsApi().syncAll().then(() => setShowAlert(true));

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
          <Typography style={{ flexGrow: 1, textAlign: "center" }}>
            <Tooltip title="Sincronizar preços, transferências e renda passiva">
              <IconButton size="large" color="black">
                <SyncIcon onClick={() => syncAll()} />
              </IconButton>
            </Tooltip>
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
            <IconButton
              size="large"
              color="black"
              aria-controls={menuId}
              onClick={handleProfileMenuOpen}
            >
              <Badge badgeContent={totalTasksUnseen} color="error">
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
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message="Yes"
        severity="success"
      />
      <Notifications
        id={menuId}
        anchorEl={anchorEl}
        tasks={tasks}
        handleClose={handleNotificationsClose}
      />
    </Box>
  );
};
