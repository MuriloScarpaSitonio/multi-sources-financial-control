import FullHistorySearchTotal from "../../../Expenses/FullHistorySearchTotal";
import {
  FullHistorySearchBar,
  FullHistoryFilterIndicators,
} from "../../../Expenses/FullHistorySearchControls";
import { type SearchDateControls } from "../../../Expenses/fullHistorySearch";
import Alert from "@mui/material/Alert";
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
import FilterIndicators, {
  type DateFilterProps,
} from "../../../../../components/FilterIndicators";
import {
  ShowHideColumnsMenuItem,
  ToggleDensityMenuItem,
  ToggleFullScreenMenuItem,
} from "../../../../Datatable/components";

import RevenueDrawer from "../RevenueDrawer";
import FiltersMenu from "./FiltersMenu";
import {
  ManageRelatedEntitiesMenuItem,
  ManageRelatedEntitiesDrawer,
} from "./ManageRelatedEntitiesMenuItem";
import {
  revenuesFilterConfig,
  revenuesSearchFilterConfig,
} from "../../filterConfig";
import { Filters } from "../../types";
import { SearchBar } from "../../../components";

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
            Pesquisar todas as receitas
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
              Receita
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
        <FullHistorySearchTotal resource="revenues" filters={filters} />
      )}
      {isSearch && table.getState().showAlertBanner && (
        <Alert severity="error">Não foi possível carregar receitas.</Alert>
      )}
      {isSearch ? (
        <FullHistoryFilterIndicators
          filters={filters}
          setFilters={setFilters}
          fieldConfigs={revenuesSearchFilterConfig}
        />
      ) : (
        <FilterIndicators
          filters={filters}
          setFilters={setFilters}
          defaultFilters={defaultFilters}
          fieldConfigs={revenuesFilterConfig}
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
      <RevenueDrawer open={openDrawer} onClose={() => setOpenDrawer(false)} />
    </>
  );
};

export default TopToolBar;
