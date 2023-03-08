import { useState } from "react";

import MUIDataTable from "mui-datatables";

import Container from "@material-ui/core/Container";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import Tooltip from "@material-ui/core/Tooltip";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";

import MergeTypeIcon from "@material-ui/icons/MergeType";
import PlusOneIcon from "@material-ui/icons/PlusOne";

import { AssetsApi } from "../../api";
import { SimulateTransactionForm } from "../../forms/SimulateTransactionForm";
import { AssetsForm } from "../../forms/AssetsForm";
import { FormFeedback } from "../FormFeedback";
import { Loader } from "../Loaders";
import {
  AssetsObjectivesMapping,
  AssetsSectorsMapping,
  AssetsTypesMapping,
} from "../../consts.js";
import { getChoiceByLabel } from "../../helpers.js";

const SimulateTransactionDialog = ({
  open,
  onClose,
  showSuccessFeedbackForm,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="simulate-transaction-form-dialog-title"
    >
      <DialogTitle id="simulate-transaction-form-dialog-title">
        Simular Transação
      </DialogTitle>
      <DialogContent>
        <SimulateTransactionForm
          handleClose={onClose}
          showSuccessFeedbackForm={showSuccessFeedbackForm}
        />
      </DialogContent>
    </Dialog>
  );
};
const AssetCreateDialog = ({ open, onClose, showFeedbackForm }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="asset-form-dialog-title"
    >
      <DialogTitle id="asset-form-dialog-title">Criar ativo</DialogTitle>
      <DialogContent>
        <AssetsForm
          initialData={{}}
          handleClose={onClose}
          showFeedbackForm={showFeedbackForm}
        />
      </DialogContent>
    </Dialog>
  );
};
const TransactionsTable = ({ code, data }) => (
  <MUIDataTable
    title={`Últimas 5 transações de ${code}`}
    data={data}
    columns={[
      {
        name: "action",
        label: "Ação",
        options: {
          filter: false,
          sort: false,
          customBodyRender: (v) => (v === "BUY" ? "Compra" : "Venda"),
        },
      },
      {
        name: "price",
        label: "Preço",
        options: {
          filter: false,
          sort: false,
          customBodyRender: (v, tableMeta) => {
            let tableCurrency = tableMeta.tableData[0].currency;
            var currency;
            if (tableCurrency) {
              currency = tableCurrency === "BRL" ? "R$" : "$";
            } else {
              currency = "?";
            }
            return `${currency} ${v?.toLocaleString("pt-br", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })}`;
          },
        },
      },
      {
        name: "quantity",
        label: "Quantidade",
        options: {
          filter: false,
          sort: false,
          customBodyRender: (v) => v?.toLocaleString("pt-br"),
        },
      },
      {
        name: "created_at",
        label: "Quando",
        options: {
          filter: false,
          sort: false,
          customBodyRender: (v) => {
            let [year, month, day] = v.split("-");
            return `${day}/${month}/${year}`;
          },
        },
      },
    ]}
    options={{
      filter: false,
      selectableRows: "none",
      search: false,
      download: false,
      print: false,
      pagination: false,
      sort: false,
      sortFilterList: false,
      viewColumns: false,
    }}
  />
);

const PassiveIncomeTable = ({ code, data }) => (
  <MUIDataTable
    title={`Últimos 5 rendimentos de ${code}`}
    data={data}
    columns={[
      {
        name: "type",
        label: "Tipo",
        options: {
          filter: false,
          sort: false,
          customBodyRender: (v) => v,
        },
      },
      {
        name: "event_type",
        label: "Evento",
        options: {
          filter: false,
          sort: false,
          customBodyRender: (v) => v,
        },
      },
      {
        name: "amount",
        label: "Valor líquido",
        options: {
          filter: false,
          sort: false,
          customBodyRender: (v) => {
            return `R$ ${v?.toLocaleString("pt-br", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })}`;
          },
        },
      },
      {
        name: "operation_date",
        label: "Quando",
        options: {
          filter: false,
          sort: false,
          customBodyRender: (v) => {
            let [year, month, day] = v.split("-");
            return `${day}/${month}/${year}`;
          },
        },
      },
    ]}
    options={{
      textLabels: {
        body: { noMatch: "Nenhum rendimento encontrado" },
      },
      filter: false,
      selectableRows: "none",
      search: false,
      download: false,
      print: false,
      pagination: false,
      sort: false,
      sortFilterList: false,
      viewColumns: false,
    }}
  />
);

export const AssetsTable = () => {
  const [pageSize, setPageSize] = useState(5);
  const [filters, setFilters] = useState({
    page: 1,
    ordering: "",
    code: "",
  });
  const [
    simulateTransactionDialogIsOpened,
    setSimulateTransactionDialogIsOpened,
  ] = useState(false);
  const [createAssetDialogIsOpened, setCreateAssetDialogIsOpened] =
    useState(false);

  const [data, isLoaded] = new AssetsApi().query(getAdjustedFilters());
  const [tabValue, setTabValue] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const showFeedbackForm = (message, severity = "success") => {
    setAlertInfos({ message, severity });
    setShowAlert(true);
  };

  function getAdjustedFilters() {
    let multipleChoiceFilters = {
      type: filters.type || [],
      objective: filters.objective || [],
      sector: filters.sector || [],
    };

    let _filters = new URLSearchParams({
      page: filters.page,
      ordering: filters.ordering,
      code: filters.code,
      page_size: pageSize,
    });

    Object.entries(multipleChoiceFilters).forEach(([key, value]) =>
      value.map((v) => _filters.append(key, v))
    );

    return _filters.toString();
  }

  const options = {
    filterType: "multiselect",
    serverSide: true,
    count: data.count,
    rowsPerPage: pageSize,
    rowsPerPageOptions: [5, 10, 20, 50, 100],
    selectableRows: "none",
    setRowProps: (row) => {
      if (row[10].includes("-")) {
        // negative values
        return {
          style: { background: "rgba(255, 5, 5, 0.2)" },
        };
      }
      // if (!row[10].includes("undefined")) {
      //   // positive values
      //   return {
      //     style: { background: "rgba(0, 201, 20, 0.2)" },
      //   };
      // }
      return {
        style: { background: "rgba(0, 201, 20, 0.2)" },
      };
    },
    textLabels: {
      body: { noMatch: "Nenhum ativo encontrado", toolTip: "Ordenar" },
      toolbar: {
        search: "Pesquisar",
        viewColumns: "Selecionar colunas",
        filterTable: "Filtrar",
      },
      pagination: {
        next: "Próxima página",
        previous: "Página anterior",
        rowsPerPage: "Ativos por página",
        displayRows: "de",
      },
    },
    download: true,
    print: true,
    onChangeRowsPerPage: (p) => setPageSize(p),
    onChangePage: (p) => setFilters({ ...filters, page: p + 1 }),
    onColumnSortChange: (column, direction) => {
      let orderingDirectionMapping = { asc: "", desc: "-" };
      setFilters({
        ...filters,
        ordering: orderingDirectionMapping[direction] + column,
      });
    },
    onSearchChange: (text) => {
      setFilters({ ...filters, code: Boolean(text) ? text : "" });
    },
    onFilterChange: (column, filterList, __, changedColumnIndex) => {
      let _filters = filterList[changedColumnIndex].map(
        (f) =>
          getChoiceByLabel(f, [
            ...AssetsObjectivesMapping,
            ...AssetsSectorsMapping,
            ...AssetsTypesMapping,
          ]).value
      );
      setFilters({ ...filters, [column]: _filters, page: 1 });
    },
    expandableRows: true,
    expandableRowsHeader: false,
    expandableRowsOnClick: true,
    renderExpandableRow: (rowData) => {
      const colSpan = rowData.length + 1;
      const [transactions, incomes] = rowData.slice(-2);

      const [
        id,
        sector,
        objective,
        code,
        type,
        avg_price,
        current_price,
        current_price_updated_at,
      ] = rowData;
      console.log(rowData);
      console.log(current_price);
      return (
        <>
          <TableRow>
            <TableCell sx={{ paddingLeft: "20px" }} colSpan={colSpan}>
              <Tabs
                value={tabValue}
                onChange={(_, newTabValue) => setTabValue(newTabValue)}
                TabIndicatorProps={{ style: { background: "#cfcfcf" } }}
              >
                <Tab label="Configurações" />
                <Tab label="Transações" />
                <Tab label="Rendimentos" />
              </Tabs>
            </TableCell>
          </TableRow>
          {tabValue === 0 && (
            <TableRow>
              <TableCell sx={{ paddingLeft: "20px" }} colSpan={colSpan}>
                <Paper elevation={3}>
                  <AssetsForm
                    initialData={{
                      id,
                      sector,
                      objective,
                      code,
                      type,
                      current_price: current_price.key,
                      current_price_updated_at: new Date(
                        current_price_updated_at
                      ).toLocaleString("pt-br"),
                      currencySymbol: avg_price.includes("R")
                        ? avg_price.slice(0, 3)
                        : avg_price.slice(0, 2),
                    }}
                    handleClose={() => {}}
                    showFeedbackForm={showFeedbackForm}
                  />
                </Paper>
              </TableCell>
            </TableRow>
          )}
          {tabValue === 1 && (
            <TableRow>
              <TableCell sx={{ paddingLeft: "20px" }} colSpan={colSpan}>
                <TransactionsTable code={rowData[3].key} data={transactions} />
              </TableCell>
            </TableRow>
          )}
          {tabValue === 2 && (
            <TableRow>
              <TableCell sx={{ paddingLeft: "20px" }} colSpan={colSpan}>
                <PassiveIncomeTable code={rowData[3].key} data={incomes} />
              </TableCell>
            </TableRow>
          )}
        </>
      );
    },
    customToolbar: () => (
      <>
        <Tooltip title="Simular transação">
          <IconButton
            onClick={() => setSimulateTransactionDialogIsOpened(true)}
          >
            <MergeTypeIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Adicionar ativo">
          <IconButton onClick={() => setCreateAssetDialogIsOpened(true)}>
            <PlusOneIcon />
          </IconButton>
        </Tooltip>
      </>
    ),
  };

  const columns = [
    {
      name: "id",
      options: {
        display: false,
        filter: false,
        viewColumns: false,
      },
    },
    {
      name: "sector",
      label: "Setor",
      options: {
        display: false,
        filter: true,
        viewColumns: false,
        filterOptions: {
          names: AssetsSectorsMapping.map((v) => v.label),
        },
        customFilterListOptions: {
          render: (v) => `Setor: ${v}`,
        },
      },
    },
    {
      name: "objective",
      label: "Objetivo",
      options: {
        display: false,
        filter: true,
        viewColumns: false,
        filterOptions: {
          names: AssetsObjectivesMapping.map((v) => v.label),
        },
        customFilterListOptions: {
          render: (v) => `Objetivo: ${v}`,
        },
      },
    },
    {
      name: "code",
      label: "Código",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "type",
      label: "Tipo",
      options: {
        filter: true,
        sort: true,
        filterOptions: {
          names: AssetsTypesMapping.map((v) => v.label),
        },
        customFilterListOptions: {
          render: (v) => `Tipo: ${v}`,
        },
      },
    },
    {
      name: "adjusted_avg_price",
      label: "Preço médio aj.",
      options: {
        filter: false,
        sort: false,
        customBodyRender: (v, tableMeta) => {
          let tableCurrency = tableMeta.tableData[tableMeta.rowIndex].currency;
          var currency;
          if (tableCurrency) {
            currency = tableCurrency === "BRL" ? "R$" : "$";
          } else {
            currency = "";
          }
          return `${currency} ${v?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })}`;
        },
      },
    },
    {
      name: "current_price",
      label: "Preço atual",
      options: {
        filter: false,
        sort: false,
        customBodyRender: (v, tableMeta) => {
          let tableCurrency = tableMeta.tableData[tableMeta.rowIndex].currency;
          var currency;
          if (tableCurrency) {
            currency = tableCurrency === "BRL" ? "R$" : "$";
          } else {
            currency = "";
          }
          return (
            <Tooltip
              key={v}
              title={`Atualizado pela última vez às ${new Date(
                tableMeta.rowData[7]
              ).toLocaleString("pt-br")}`}
            >
              <p>{`${currency} ${v?.toLocaleString("pt-br", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}`}</p>
            </Tooltip>
          );
        },
      },
    },
    {
      name: "current_price_updated_at",
      options: {
        display: false,
        filter: false,
        viewColumns: false,
      },
    },
    {
      name: "quantity_balance",
      label: "Quantidade",
      options: {
        filter: false,
        sort: false,
        customBodyRender: (v) => v?.toLocaleString("pt-br"),
      },
    },
    {
      name: "total_invested",
      label: "Total investido aj.",
      options: {
        filter: false,
        sort: true,
        customBodyRender: (v) =>
          `R$ ${v?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
      },
    },
    {
      name: "roi",
      label: "ROI",
      options: {
        filter: false,
        sort: true,
        customBodyRender: (v) =>
          `R$ ${v?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
      },
    },
    {
      name: "roi_percentage",
      label: "ROI %",
      options: {
        filter: false,
        sort: true,
        customBodyRender: (v) =>
          `${v?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          })}%`,
      },
    },
    {
      name: "percentage_invested",
      label: "% real",
      options: {
        filter: false,
        sort: false,
        customBodyRender: (v) =>
          `${v?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          })}%`,
      },
    },
    {
      name: "current_percentage",
      label: "% atual",
      options: {
        filter: false,
        sort: false,
        customBodyRender: (v) =>
          `${v?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          })}%`,
      },
    },
    {
      name: "transactions",
      options: {
        display: false,
        filter: false,
        viewColumns: false,
      },
    },
    {
      name: "passive_incomes",
      options: {
        display: false,
        filter: false,
        viewColumns: false,
      },
    },
  ];

  console.log(data.results);
  return (
    <Container
      style={{ position: "relative", marginTop: "15px" }}
      maxWidth="lg"
    >
      {!isLoaded && <Loader />}
      <MUIDataTable data={data.results} columns={columns} options={options} />
      <SimulateTransactionDialog
        open={simulateTransactionDialogIsOpened}
        onClose={() => setSimulateTransactionDialogIsOpened(false)}
      />
      <AssetCreateDialog
        open={createAssetDialogIsOpened}
        onClose={() => {
          setCreateAssetDialogIsOpened(false);
        }}
        showFeedbackForm={showFeedbackForm}
      />
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertInfos.message}
        severity={alertInfos.severity}
      />
    </Container>
  );
};
