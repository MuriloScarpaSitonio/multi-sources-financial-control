import { useEffect, useMemo, useState, type SyntheticEvent } from "react";

import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";

import {
  MaterialReactTable,
  type MRT_ColumnDef as Column,
  type MRT_Row as Row,
} from "material-react-table";

import { Colors, getColor } from "../../../../design-system";
import { StatusDot } from "../../../../design-system/icons";
import useTable from "../../../../hooks/useTable";
import { getAssets } from "../api";
import { Asset } from "../api/models";
import { AssetCurrencyMap } from "../consts";
import AssetsForm from "./AssetForm";
import AssetUpdatePriceDrawer from "./AssetUpdatePriceDrawer";
import { ASSETS_QUERY_KEY } from "./consts";
import IncomesTable from "./IncomesTable";
import TopToolBar from "./TopToolbar";
import TransactionTable from "./TransactionTable";

const DetailPanel = ({
  row,
  tabValue,
  onTabChange,
}: {
  row: Row<Asset>;
  tabValue: number;
  onTabChange: (event: SyntheticEvent, value: number) => void;
}) => {
  return (
    <>
      <Tabs
        value={tabValue}
        onChange={onTabChange}
        TabIndicatorProps={{
          sx: { background: getColor(Colors.neutral0), height: "1.5px" },
        }}
        textColor="inherit"
        visibleScrollbar
      >
        <Tab label="Transações" />
        <Tab label="Rendimentos" />
        <Tab label="Configurações" />
      </Tabs>
      {tabValue === 0 && (
        <Box sx={{ p: 2 }}>
          <TransactionTable
            assetId={row.original.write_model_pk}
            currencySymbol={AssetCurrencyMap[row.original.currency].symbol}
          />
        </Box>
      )}
      {tabValue === 1 && (
        <Box sx={{ p: 2 }}>
          <IncomesTable
            assetId={row.original.write_model_pk}
            currencySymbol={AssetCurrencyMap[row.original.currency].symbol}
          />
        </Box>
      )}
      {tabValue === 2 && <AssetsForm asset={row.original} />}
    </>
  );
};

const Table = () => {
  const [tabValues, setTabValues] = useState<Record<string, number>>({});
  const [columnVisibility, setColumnVisibility] = useState({});
  const [assetToUpdatePrice, setAssetToUpdatePrice] = useState<Asset>();

  const columns = useMemo<Column<Asset>[]>(
    () => [
      {
        header: "Código",
        accessorKey: "code",
        size: 50,
        Cell: ({ row: { original } }) => (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusDot
                variant={original.normalized_roi > 0 ? "success" : "danger"}
              />
              <span>{original.code}</span>
            </Stack>
            {!!original.description && (
              <span style={{ marginLeft: "20px" }}>{original.description}</span>
            )}
          </Stack>
        ),
      },
      {
        header: "Categoria",
        accessorKey: "type",
        enableSorting: false,
        size: 40,
      },
      {
        header: "Preço médio",
        accessorKey: "adjusted_avg_price",
        enableSorting: false,
        size: 50,
        Cell: ({ row: { original } }) => {
          const price = original.adjusted_avg_price.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          });
          return `${AssetCurrencyMap[original.currency].symbol} ${price}`;
        },
      },
      {
        header: "Preço atual",
        accessorKey: "current_price",
        enableSorting: false,
        size: 50,
        Cell: ({ row: { original } }) => {
          const price = original.current_price.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          });
          const currentPriceUpdatedAt = new Date(
            original.current_price_updated_at,
          ).toLocaleString("pt-br");
          return original.is_held_in_self_custody ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title={`Atualizado às ${currentPriceUpdatedAt}`}>
                <span>{`${AssetCurrencyMap[original.currency].symbol} ${price}`}</span>
              </Tooltip>
              <IconButton
                sx={{ color: getColor(Colors.neutral300) }}
                onClick={() => setAssetToUpdatePrice(original)}
              >
                <EditIcon />
              </IconButton>
            </Stack>
          ) : (
            <Tooltip title={`Atualizado às ${currentPriceUpdatedAt}`}>
              <span>{`${AssetCurrencyMap[original.currency].symbol} ${price}`}</span>
            </Tooltip>
          );
        },
      },
      {
        header: "Quantidade",
        accessorKey: "quantity_balance",
        enableSorting: false,
        size: 40,
        Cell: ({ row: { original } }) =>
          original.is_held_in_self_custody
            ? "-"
            : original.quantity_balance.toLocaleString("pt-br"),
      },
      {
        header: "Total investido",
        accessorKey: "normalized_total_invested",
        Cell: ({ cell }) => {
          const price = cell.getValue<number>().toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return `R$ ${price}`;
        },
      },
      {
        header: "ROI",
        accessorKey: "normalized_roi",
        size: 150,
        Cell: ({ cell }) => {
          const roi = cell.getValue<number>();
          const price = roi.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return (
            <span
              style={{
                color:
                  roi > 0 ? getColor(Colors.brand) : getColor(Colors.danger200),
              }}
            >
              {`R$ ${price}`}
            </span>
          );
        },
      },
      {
        header: "ROI %",
        accessorKey: "roi_percentage",
        size: 80,
        Cell: ({ cell }) => {
          const percentage = cell.getValue<number>();
          const roi = percentage.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          });
          return (
            <span
              style={{
                color:
                  percentage > 0
                    ? getColor(Colors.brand)
                    : getColor(Colors.danger200),
              }}
            >
              {`${roi}%`}
            </span>
          );
        },
      },
      {
        header: "% investido",
        accessorKey: "percentage_invested",
        enableSorting: false,
        size: 40,
        Cell: ({ row: { original } }) => {
          const roi = original.percentage_invested.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          });
          return `${roi}%`;
        },
      },
    ],
    [],
  );

  const {
    table,
    search,
    setSearch,
    pagination,
    setPagination,
    sorting,
    filters,
    setFilters,
  } = useTable({
    columns: columns as Column<any>[],
    queryKey: [ASSETS_QUERY_KEY],
    defaultFilters: { status: "OPENED" },
    localization: { noRecordsToDisplay: "Nenhum ativo encontrado", rowsPerPage: "Ativos por página" },
    enableExpanding: true,
    defaultPageSize: 20,
    columnVisibility,
    onColumnVisibilityChange: setColumnVisibility,
    queryFn: () =>
      getAssets({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        ordering: sorting.map((s) => (s.desc ? `-${s.id}` : s.id))[0] ?? "",
        code: search,
        ...filters,
      }),
    getRowId: (row: Asset) => row.write_model_pk?.toString(),
    getRowCanExpand: () => true,
    renderTopToolbar: ({ table }) => (
      <TopToolBar
        table={table}
        search={search}
        setSearch={setSearch}
        setPagination={setPagination}
        setFilters={setFilters}
      />
    ),
    renderDetailPanel: ({ row }) => (
      <DetailPanel
        row={row as Row<Asset>}
        tabValue={tabValues[row.id] ?? 0}
        onTabChange={(_, value) =>
          setTabValues((prevTabValues) => ({
            ...prevTabValues,
            [row.id]: value,
          }))
        }
      />
    ),
  });

  useEffect(() => {
    const isOpenedAssetsFiltered = filters.status === "OPENED";
    setColumnVisibility({
      adjusted_avg_price: isOpenedAssetsFiltered,
      current_price: isOpenedAssetsFiltered,
      quantity_balance: isOpenedAssetsFiltered,
      normalized_total_invested: isOpenedAssetsFiltered,
      roi_percentage: isOpenedAssetsFiltered,
      percentage_invested: isOpenedAssetsFiltered,
    });
  }, [filters.status]);

  return (
    <>
      <MaterialReactTable table={table} />
      {assetToUpdatePrice && (
        <AssetUpdatePriceDrawer
          asset={assetToUpdatePrice}
          open={!!assetToUpdatePrice}
          onClose={() => setAssetToUpdatePrice(undefined)}
        />
      )}
    </>
  );
};

export default Table;
