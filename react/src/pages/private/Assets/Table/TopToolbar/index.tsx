import {
  useState,
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
} from "react";

import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import AddIcon from "@mui/icons-material/Add";
import FilterListIcon from "@mui/icons-material/FilterList";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SearchIcon from "@mui/icons-material/Search";

import {
  type MRT_PaginationState as PaginationState,
  type MRT_TableInstance as DataTable,
  type MRT_RowData as Row,
} from "material-react-table";

import { Colors, getColor } from "../../../../../design-system";
import FiltersMenu from "./FiltersMenu";
import {
  ShowHideColumnsMenuItem,
  ToggleDensityMenuItem,
  ToggleFullScreenMenuItem,
} from "../../../../Datatable/components";
import {
  SimulateTransactionMenuItem,
  SimulateTransactionDrawer,
} from "./SimulateTransactionMenuItem";
import { Filters } from "../types";
import NewTransactionDrawer from "./NewTransactionDrawer";
import NewIncomeDrawer from "./NewIncomeDrawer";

const TopToolBarExtraActionsMenu = ({ table }: { table: DataTable<Row> }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openDrawer, setOpenDrawer] = useState(false);

  const open = Boolean(anchorEl);

  const onClose = () => setAnchorEl(null);
  return (
    <>
      <IconButton
        onClick={(event: MouseEvent<HTMLElement>) =>
          setAnchorEl(event.currentTarget)
        }
      >
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
        <SimulateTransactionMenuItem
          onClick={() => {
            setOpenDrawer(true);
            onClose();
          }}
        />
        <ShowHideColumnsMenuItem table={table} />
        <ToggleDensityMenuItem table={table} />
        <ToggleFullScreenMenuItem table={table} />
      </Menu>
      <SimulateTransactionDrawer
        open={openDrawer}
        onClose={() => setOpenDrawer(false)}
      />
    </>
  );
};

const TopToolBar = ({
  table,
  setSearch,
  setPagination,
  setFilters,
}: {
  table: DataTable<Row>;
  setSearch: Dispatch<SetStateAction<string>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  setFilters: Dispatch<SetStateAction<Filters>>;
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openTransactionDrawer, setOpenTransactionDrawer] = useState(false);
  const [openIncomeDrawer, setOpenIncomeDrawer] = useState(false);

  return (
    <>
      <Grid
        container
        spacing={2}
        padding={2}
        sx={{
          backgroundColor: getColor(Colors.neutral900),
        }}
      >
        <Grid item xs={6}>
          <OutlinedInput
            size="small"
            fullWidth
            placeholder="Pesquisar"
            onChange={(e) => {
              setTimeout(() => {
                setSearch(e.target.value);
                setPagination((prevPagination) => ({
                  ...prevPagination,
                  pageIndex: 0,
                }));
              }, 600);
            }}
            endAdornment={
              <SearchIcon sx={{ color: getColor(Colors.neutral200) }} />
            }
            sx={{
              "&.MuiOutlinedInput-root": {
                border: "none",
                borderRadius: "5px",
                backgroundColor: getColor(Colors.neutral400),
              },
              "&.MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
                border: "none",
              },
              "&.MuiOutlinedInput-root .MuiOutlinedInput-input::placeholder": {
                color: getColor(Colors.neutral0),
              },
            }}
          />
        </Grid>
        <Grid container item xs={6} justifyContent="flex-end">
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<AddIcon />}
              size="large"
              variant="brand"
              onClick={() => setOpenIncomeDrawer(true)}
            >
              Rendimento
            </Button>
            <Button
              startIcon={<AddIcon />}
              size="large"
              variant="brand"
              onClick={() => setOpenTransactionDrawer(true)}
            >
              Transação
            </Button>
            <Button
              variant="neutral"
              startIcon={<FilterListIcon />}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              Filtrar
            </Button>
            <TopToolBarExtraActionsMenu table={table} />
          </Stack>
        </Grid>
      </Grid>
      <FiltersMenu
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorEl={anchorEl}
        setFilters={setFilters}
      />
      <NewTransactionDrawer
        open={openTransactionDrawer}
        onClose={() => setOpenTransactionDrawer(false)}
      />
      <NewIncomeDrawer
        open={openIncomeDrawer}
        onClose={() => setOpenIncomeDrawer(false)}
      />
    </>
  );
};

export default TopToolBar;
