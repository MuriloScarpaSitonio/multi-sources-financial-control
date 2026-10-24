import FullHistorySearchTotal from "../../FullHistorySearchTotal";
import {
  FullHistorySearchBar,
  FullHistoryFilterIndicators,
} from "../../FullHistorySearchControls";
import { type SearchDateControls } from "../../fullHistorySearch";
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
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import FilterListIcon from "@mui/icons-material/FilterList";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

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

import FilterIndicators, {
  type DateFilterProps,
} from "../../../../../components/FilterIndicators";
import FiltersMenu from "./FiltersMenu";
import {
  ManageRelatedEntitiesMenuItem,
  ManageRelatedEntitiesDrawer,
} from "./ManageRelatedEntitiesMenuItem";
import { Filters } from "../../types";
import {
  expensesFilterConfig,
  expensesSearchFilterConfig,
} from "../../filterConfig";
import { SearchBar } from "../../../components";
import ExpenseDrawer from "../ExpenseDrawer";

const TopToolBarExtraActionsMenu = ({
  table,
  onOpenSearch,
}: {
  table: DataTable<Row>;
  onOpenSearch?: () => void;
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openDrawer, setOpenDrawer] = useState(false);

  const onClose = () => setAnchorEl(null);
  return (
    <>
      <IconButton
        aria-label="Mais ações"
        onClick={(event: MouseEvent<HTMLElement>) =>
          setAnchorEl(event.currentTarget)
        }
      >
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
        {onOpenSearch && (
          <MenuItem
            onClick={() => {
              onClose();
              onOpenSearch();
            }}
          >
            <ListItemIcon>
              <SearchIcon fontSize="small" />
            </ListItemIcon>
            Pesquisar todas as despesas
          </MenuItem>
        )}
        <ManageRelatedEntitiesMenuItem
          onClick={() => {
            setOpenDrawer(true);
            onClose();
          }}
        />
        <ShowHideColumnsMenuItem table={table} />
        <ToggleDensityMenuItem table={table} />
        <ToggleFullScreenMenuItem table={table} />
      </Menu>
      <ManageRelatedEntitiesDrawer
        open={openDrawer}
        onClose={() => setOpenDrawer(false)}
      />
    </>
  );
};

const TopToolBar = ({
  table,
  search,
  setSearch,
  setPagination,
  filters,
  setFilters,
  defaultFilters,
  dateFilters,
  isSearch = false,
  onOpenSearch,
  onBackToOverview,
  searchDateControls,
}: {
  table: DataTable<Row>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  defaultFilters: Filters;
  dateFilters: DateFilterProps;
  isSearch?: boolean;
  onOpenSearch?: () => void;
  onBackToOverview?: () => void;
  searchDateControls?: SearchDateControls;
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
          {isSearch ? (
            <FullHistorySearchBar search={search} setSearch={setSearch} />
          ) : (
            <SearchBar
              search={search}
              placeholder="Pesquisar por descrição"
              setSearch={setSearch}
              setPagination={setPagination}
            />
          )}
        </Grid>
        <Grid container item xs={6} justifyContent="flex-end">
          <Stack direction="row" spacing={1}>
            {onBackToOverview && (
              <Tooltip title="Voltar à visão geral">
                <IconButton
                  aria-label="Voltar à visão geral"
                  onClick={onBackToOverview}
                  sx={{
                    gap: 0.5,
                    "&:hover": { backgroundColor: "transparent" },
                  }}
                >
                  <ArrowBackIcon />
                  <Typography component="span" variant="body2">
                    Voltar
                  </Typography>
                </IconButton>
              </Tooltip>
            )}
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
            <TopToolBarExtraActionsMenu
              table={table}
              onOpenSearch={onOpenSearch}
            />
          </Stack>
        </Grid>
      </Grid>
      {isSearch && (
        <FullHistorySearchTotal resource="expenses" filters={filters} />
      )}
      {isSearch ? (
        <FullHistoryFilterIndicators
          filters={filters}
          setFilters={setFilters}
          fieldConfigs={expensesSearchFilterConfig}
        />
      ) : (
        <FilterIndicators
          filters={filters}
          setFilters={setFilters}
          defaultFilters={defaultFilters}
          fieldConfigs={expensesFilterConfig}
          dateFilters={dateFilters}
        />
      )}
      <FiltersMenu
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorEl={anchorEl}
        filters={filters}
        setFilters={setFilters}
        searchDateControls={searchDateControls}
      />
      <ExpenseDrawer open={openDrawer} onClose={() => setOpenDrawer(false)} />
    </>
  );
};

export default TopToolBar;
