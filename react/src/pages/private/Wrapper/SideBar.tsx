import { useState } from "react";

import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";

import { getColor } from "../../../design-system/utils";
import { LogoIcon } from "../../../design-system/icons";
import { Colors } from "../../../design-system/enums";

const drawerWidth = 240;

const FinancesMenus = () => {
  const [open, setOpen] = useState<boolean>(true);

  const gap = 3; // 24px (8 * 3)
  return (
    <>
      <ListItemButton
        sx={{ pl: gap }}
        disableGutters
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ExpandLess sx={{ color: getColor(Colors.neutral0) }} />
        ) : (
          <ExpandMore sx={{ color: getColor(Colors.neutral0) }} />
        )}
        <ListItemText
          primary="Finanças Pessoais"
          sx={{ color: getColor(Colors.neutral0) }}
        />
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          <ListItemButton
            disableGutters
            sx={{ pl: gap + 1.5 }}
            href="/expenses"
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <MonetizationOnOutlinedIcon
                sx={{ color: getColor(Colors.danger200) }}
              />
            </ListItemIcon>
            <ListItemText
              primary="Despesas"
              sx={{ color: getColor(Colors.neutral300) }}
            />
          </ListItemButton>
          <ListItemButton
            disableGutters
            sx={{ pl: gap + 1.5 }}
            href="/revenues"
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <MonetizationOnOutlinedIcon
                sx={{ color: getColor(Colors.brand) }}
              />
            </ListItemIcon>
            <ListItemText
              primary="Receitas"
              sx={{ color: getColor(Colors.neutral300) }}
            />
          </ListItemButton>
        </List>
      </Collapse>
    </>
  );
};

const InvestmentsMenu = () => {
  const [open, setOpen] = useState<boolean>(true);

  const iconColor = getColor(Colors.neutral300);
  const gap = 3; // 24px (8 * 3)
  return (
    <>
      <ListItemButton
        sx={{ pl: gap }}
        disableGutters
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ExpandLess sx={{ color: getColor(Colors.neutral0) }} />
        ) : (
          <ExpandMore sx={{ color: getColor(Colors.neutral0) }} />
        )}
        <ListItemText
          primary="Investimentos"
          sx={{ color: getColor(Colors.neutral0) }}
        />
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          <ListItemButton disableGutters sx={{ pl: gap + 1.5 }} href="/assets">
            <ListItemIcon sx={{ color: iconColor, minWidth: 32 }}>
              <AssessmentOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary="Ativos"
              sx={{ color: getColor(Colors.neutral300) }}
            />
          </ListItemButton>
          <ListItemButton
            disableGutters
            sx={{ pl: gap + 1.5 }}
            href="/assets/transactions"
          >
            <ListItemIcon sx={{ color: iconColor, minWidth: 32 }}>
              <ShowChartOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary="Transações"
              sx={{ color: getColor(Colors.neutral300) }}
            />
          </ListItemButton>
          <ListItemButton
            disableGutters
            sx={{ pl: gap + 1.5 }}
            href="/assets/incomes"
          >
            <ListItemIcon sx={{ color: iconColor, minWidth: 32 }}>
              <ReceiptOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary="Rendimentos"
              sx={{ color: getColor(Colors.neutral300) }}
            />
          </ListItemButton>
        </List>
      </Collapse>
    </>
  );
};

const SideBar = () => (
  <Drawer
    variant="permanent"
    sx={{
      [`& .MuiDrawer-paper`]: {
        width: drawerWidth,
        boxSizing: "border-box",
        background: getColor(Colors.neutral900),
      },
    }}
  >
    <Toolbar>
      <IconButton href="/">
        <LogoIcon />
      </IconButton>
    </Toolbar>
    <Box>
      <List>
        <FinancesMenus />
        <InvestmentsMenu />
      </List>
    </Box>
  </Drawer>
);

export default SideBar;
