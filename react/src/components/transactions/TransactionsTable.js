import { useState } from "react";

import MUIDataTable from "mui-datatables";
import DateFnsUtils from "@date-io/date-fns";

import {
  MuiPickersUtilsProvider,
  KeyboardDatePicker,
} from "@material-ui/pickers";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Container from "@material-ui/core/Container";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormGroup from "@material-ui/core/FormGroup";
import FormLabel from "@material-ui/core/FormLabel";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";

import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import PlusOneIcon from "@material-ui/icons/PlusOne";

import { FormFeedback } from "../FormFeedback";
import { Loader } from "../Loaders";
import { TransactionsApi } from "../../api";
import { getChoiceByLabel } from "../../helpers";
import { AssetsTypesMapping, TransactionsActionsMapping } from "../../consts";
import { TransactionForm } from "../../forms/TransactionForm";

const TransactionCreateEditDialog = ({
  data,
  open,
  onClose,
  showSuccessFeedbackForm,
  reloadTable,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="transaction-form-dialog-title"
    >
      <DialogTitle id="transaction-form-dialog-title">
        {data && Object.keys(data).length > 0
          ? "Editar transação"
          : "Criar transação"}
      </DialogTitle>
      <DialogContent>
        <TransactionForm
          initialData={data}
          handleClose={onClose}
          showSuccessFeedbackForm={showSuccessFeedbackForm}
          reloadTable={reloadTable}
        />
      </DialogContent>
    </Dialog>
  );
};

const TransactionDeleteDialog = ({
  id,
  open,
  onClose,
  showSuccessFeedbackForm,
  reloadTable,
}) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const handleClick = () => {
    let api = new TransactionsApi(id);
    api
      .delete()
      .then(() => {
        showSuccessFeedbackForm("Transação deletada com sucesso!");
        reloadTable();
        onClose();
      })
      .catch((error) => {
        setAlertInfos({
          message: JSON.stringify(error.response.data),
          severity: "error",
        });
        setShowAlert(true);
      })
      .finally(() => {
        setIsLoaded(true);
      });
  };
  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        aria-labelledby="transaction-delete-form-dialog-title"
      >
        <DialogTitle id="transaction-delete-form-dialog-title">
          Tem certeza que deseja deletar essa transação?
        </DialogTitle>
        <DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancelar</Button>
            <Button color="secondary" onClick={handleClick}>
              {!isLoaded ? <CircularProgress size={24} /> : "Deletar"}
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertInfos.message}
        severity={alertInfos.severity}
      />
    </>
  );
};

export const TransactionsTable = () => {
  const [pageSize, setPageSize] = useState(5);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    ordering: "",
    asset_code: "",
  });

  const [transactionEditData, setTransactionEditData] = useState({});
  const [
    editCreateTransactionDialogIsOpened,
    setEditCreateTransactionDialogIsOpened,
  ] = useState(false);
  const [deleteTransactionDialogIsOpened, setDeleteTransactionDialogIsOpened] =
    useState(false);
  const [transactionIdToDelete, setTransactionIdToDelete] = useState(null);

  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  function getAdjustedFilters() {
    let multipleChoiceFilters = {
      action: filters.action || [],
      asset_type: filters.asset_type || [],
    };
    let _filters = new URLSearchParams({
      page: filters.page,
      ordering: filters.ordering,
      asset_code: filters.asset_code,
      page_size: pageSize,
      start_date:
        startDate !== null ? startDate.toLocaleDateString("fr-CA") : "",
      end_date: endDate !== null ? endDate.toLocaleDateString("fr-CA") : "",
    });

    Object.entries(multipleChoiceFilters).forEach(([key, value]) =>
      value.map((v) => _filters.append(key, v))
    );

    return _filters.toString();
  }

  const [data, isLoaded] = new TransactionsApi().query(getAdjustedFilters());

  let options = {
    rowsPerPage: pageSize,
    rowsPerPageOptions: [5, 10, 20, 50, 100],
    count: data.count,
    serverSide: true,
    filter: true,
    selectableRows: "none",
    search: true,
    download: true,
    print: true,
    pagination: true,
    sort: true,
    textLabels: {
      body: { noMatch: "Nenhuma transação encontrada", toolTip: "Ordenar" },
      toolbar: {
        search: "Pesquisar",
        viewColumns: "Selecionar colunas",
        filterTable: "Filtrar",
      },
      pagination: {
        next: "Próxima página",
        previous: "Página anterior",
        rowsPerPage: "Transações por página",
        displayRows: "de",
      },
    },
    onChangeRowsPerPage: (p) => setPageSize(p),
    onChangePage: (p) => setFilters({ ...filters, page: p + 1 }),
    onSearchChange: (text) => {
      setFilters({ ...filters, asset_code: Boolean(text) ? text : "" });
    },
    onColumnSortChange: (column, direction) => {
      let _column = column === "asset_code" ? "asset__code" : column;
      let orderingDirectionMapping = { asc: "", desc: "-" };
      setFilters({
        ...filters,
        ordering: orderingDirectionMapping[direction] + _column,
      });
    },
    onFilterChange: (column, filterList, __, changedColumnIndex) => {
      if (column === "created_at") return;
      let _filters = filterList[changedColumnIndex].map(
        (f) =>
          getChoiceByLabel(f, [
            ...TransactionsActionsMapping,
            ...AssetsTypesMapping,
          ]).value
      );
      setFilters({ ...filters, [column]: _filters, page: 1 });
    },
    customToolbar: () => {
      return (
        <>
          <Tooltip title="Adicionar transação">
            <IconButton onClick={() => handleCreateEdit({})}>
              <PlusOneIcon />
            </IconButton>
          </Tooltip>
        </>
      );
    },
  };

  let columns = [
    {
      name: "id",
      options: {
        display: false,
        filter: false,
        viewColumns: false,
      },
    },
    {
      name: "asset_code",
      label: "Código",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "asset_type",
      label: "Tipo",
      options: {
        filter: true,
        sort: false,
        filterOptions: {
          names: AssetsTypesMapping.map((v) => v.label),
        },
        customFilterListOptions: {
          render: (v) => `Tipo: ${v}`,
        },
      },
    },
    {
      name: "action",
      label: "Ação",
      options: {
        filter: true,
        sort: false,
        filterOptions: {
          names: ["Compra", "Venda"],
        },
        customFilterListOptions: {
          render: (v) => `Ação: ${v}`,
        },
      },
    },
    {
      name: "price",
      label: "Preço",
      options: {
        filter: false,
        sort: false,
        customBodyRender: (v, tableMeta) => {
          let [currency] = tableMeta.rowData.slice(-2, -1);
          return `${currency === "BRL" ? "R$" : "$"} ${v?.toLocaleString(
            "pt-br",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            }
          )}`;
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
        filter: true,
        sort: true,
        filterType: "custom",
        customBodyRender: (v) => {
          let [year, month, day] = v.split("-");
          return `${day}/${month}/${year}`;
        },
        customFilterListOptions: {
          render: (v) => {
            if (v[0] && v[1]) return [`Início: ${v[0]}`, `Fim: ${v[1]}`];
            else if (v[0]) return `Início: ${v[0]}`;
            else if (v[1]) return `Fim: ${v[1]}`;
            return [];
          },
          update: (filterList, filterPos, index) => {
            if (filterPos === 0) {
              filterList[index].splice(filterPos, 1, "");
              setStartDate(null);
            } else if (filterPos === 1) {
              filterList[index].splice(filterPos, 1);
              setEndDate(null);
            } else if (filterPos === -1) {
              filterList[index] = [];
              // there's no way we can know which filter we have to clear
              // so we clear both just to be sure
              setStartDate(null);
              setEndDate(null);
            }

            return filterList;
          },
        },
        filterOptions: {
          names: [],
          display: (filterList, onChange, index, column) => (
            <MuiPickersUtilsProvider utils={DateFnsUtils}>
              <FormLabel>Quando</FormLabel>
              <FormGroup row>
                <KeyboardDatePicker
                  disableToolbar
                  variant="inline"
                  format="dd/MM/yyyy"
                  label="Início"
                  value={startDate}
                  autoOk
                  onChange={(date) => {
                    if (date instanceof Date && !isNaN(date)) {
                      filterList[index][0] = date.toLocaleDateString("pt-br");
                      onChange(filterList[index], index, column);
                      setStartDate(date);
                    }
                  }}
                  style={{ width: "48%", marginRight: "2%" }}
                />
                <KeyboardDatePicker
                  disableToolbar
                  variant="inline"
                  format="dd/MM/yyyy"
                  label="Fim"
                  value={endDate}
                  autoOk
                  onChange={(date) => {
                    if (date instanceof Date && !isNaN(date)) {
                      filterList[index][1] = date.toLocaleDateString("pt-br");
                      onChange(filterList[index], index, column);
                      setEndDate(date);
                    }
                  }}
                  style={{ width: "48%" }}
                />
              </FormGroup>
            </MuiPickersUtilsProvider>
          ),
        },
      },
    },
    {
      name: "currency",
      label: "",
      options: {
        display: false,
        filter: false,
        viewColumns: false,
      },
    },
    {
      name: "",
      options: {
        filter: false,
        sort: false,
        empty: true,
        viewColumns: false,
        customBodyRender: (_, tableMeta) => {
          return (
            <>
              <Tooltip title="Deletar transação">
                <IconButton
                  onClick={() => {
                    handleDelete(tableMeta.rowData[0]);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Editar transação">
                <IconButton onClick={() => handleCreateEdit(tableMeta.rowData)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          );
        },
      },
    },
  ];

  const handleCreateEdit = (transactionData) => {
    if (transactionData && Object.keys(transactionData).length > 0) {
      let [id, asset_code, action, price, quantity, created_at, currency] =
        transactionData;
      setTransactionEditData({
        id,
        asset_code,
        action,
        price,
        quantity,
        created_at,
        currency,
      });
    }
    setEditCreateTransactionDialogIsOpened(true);
  };

  const handleDelete = (id) => {
    setTransactionIdToDelete(id);
    setDeleteTransactionDialogIsOpened(true);
  };

  const showSuccessFeedbackForm = (message) => {
    setAlertInfos({ message: message, severity: "success" });
    setShowAlert(true);
  };

  const reload = () => {
    if (
      filters.page === 1 &&
      filters.ordering === "" &&
      filters.asset_code === ""
    )
      setFilters({ page: 1, ordering: " ", asset_code: "" });
    else setFilters({ page: 1, ordering: "", asset_code: "" });
  };

  return (
    <Container
      style={{ position: "relative", marginTop: "15px" }}
      maxWidth="lg"
    >
      {!isLoaded && <Loader />}
      <MUIDataTable data={data.results} columns={columns} options={options} />
      <TransactionCreateEditDialog
        data={transactionEditData}
        open={editCreateTransactionDialogIsOpened}
        onClose={() => {
          setEditCreateTransactionDialogIsOpened(false);
          setTransactionEditData({});
        }}
        showSuccessFeedbackForm={showSuccessFeedbackForm}
        reloadTable={reload}
      />

      <TransactionDeleteDialog
        id={transactionIdToDelete}
        open={deleteTransactionDialogIsOpened}
        onClose={() => setDeleteTransactionDialogIsOpened(false)}
        showSuccessFeedbackForm={showSuccessFeedbackForm}
        reloadTable={reload}
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
