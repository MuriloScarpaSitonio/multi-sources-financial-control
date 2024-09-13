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
import {
  ShowHideColumnsMenuItem,
  ToggleDensityMenuItem,
  ToggleFullScreenMenuItem,
} from "../../../../Datatable/components";

import FiltersMenu from "./FiltersMenu";
import { Filters } from "../../types";
//   import ExpenseDrawer from "./ExpenseDrawer";

const TopToolBarExtraActionsMenu = ({ table }: { table: DataTable<Row> }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        onClick={(event: MouseEvent<HTMLElement>) =>
          setAnchorEl(event.currentTarget)
        }
      >
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        <ShowHideColumnsMenuItem table={table} />
        <ToggleDensityMenuItem table={table} />
        <ToggleFullScreenMenuItem table={table} />
      </Menu>
    </>
  );
};

const TopToolBar = ({
  table,
  setSearch,
  setPagination,
  filters,
  setFilters,
}: {
  table: DataTable<Row>;
  setSearch: Dispatch<SetStateAction<string>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openDrawer, setOpenDrawer] = useState(false);

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
              onClick={() => setOpenDrawer(true)}
            >
              Despesa
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
        filters={filters}
        setFilters={setFilters}
      />
      {/* <ExpenseDrawer
          open={openDrawer}
          onClose={() => setOpenDrawer(false)}
        /> */}
    </>
  );
};

export default TopToolBar;
