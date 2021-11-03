import { useState } from "react";

import MUIDataTable from "mui-datatables";

import DateFnsUtils from "@date-io/date-fns";
import {
  MuiPickersUtilsProvider,
  KeyboardDatePicker,
} from "@material-ui/pickers";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormGroup from "@material-ui/core/FormGroup";
import FormLabel from "@material-ui/core/FormLabel";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

import AddIcon from "@material-ui/icons/Add";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import IconButton from "@material-ui/core/IconButton";
import Container from "@material-ui/core/Container";

import { ExpenseForm } from "../../forms/ExpenseForm";
import { FormFeedback } from "../FormFeedback";
import { ExpenseApi } from "../../api";
import { Loader } from "../Loaders";
import { getChoiceByLabel } from "../../helpers.js";
import {
  ExpensesCategoriesMapping,
  ExpensesSourcesMapping,
} from "../../consts.js";

import PlusOneIcon from "@material-ui/icons/PlusOne";
import Tooltip from "@material-ui/core/Tooltip";

const ExpenseCreateEditDialog = ({
  data,
  open,
  onClose,
  showSuccessFeedbackForm,
  reloadTable,
}) => {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="form-dialog-title">
      <DialogTitle id="form-dialog-title">
        {data && Object.keys(data).length > 0
          ? "Editar despesa"
          : "Criar despesa"}
      </DialogTitle>
      <DialogContent>
        <ExpenseForm
          initialData={data}
          handleClose={onClose}
          showSuccessFeedbackForm={showSuccessFeedbackForm}
          reloadTable={reloadTable}
        />
      </DialogContent>
    </Dialog>
  );
};

const ExpenseDeleteDialog = ({
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
    let api = new ExpenseApi(id);
    api
      .delete()
      .then(() => {
        showSuccessFeedbackForm("Despesa deletada com sucesso!");
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
      <Dialog open={open} onClose={onClose} aria-labelledby="form-dialog-title">
        <DialogTitle id="form-dialog-title">
          Tem certeza que deseja deletar essa despesa?
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

export const ExpensesTable = () => {
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [ordering, setOrdering] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [expenseIdToDelete, setExpenseIdToDelete] = useState({});

  const [expenseEditData, setExpenseEditData] = useState({});
  const [editCreateExpenseDialogIsOpened, setEditCreateExpenseDialogIsOpened] =
    useState(false);

  const [deleteExpenseDialogIsOpened, setDeleteExpenseDialogIsOpened] =
    useState(false);

  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const getAdjustedFilters = () => {
    let _filters = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) =>
      value.map((v) => _filters.append(key, v))
    );
    return _filters.toString();
  };

  let url =
    `page=${page}&page_size=${pageSize}&ordering=${ordering}&description=${search}` +
    `&start_date=${
      startDate !== null ? startDate.toLocaleDateString("fr-CA") : ""
    }` +
    `&end_date=${endDate !== null ? endDate.toLocaleDateString("fr-CA") : ""}` +
    `&${getAdjustedFilters()}`;
  let api = new ExpenseApi();
  const [data, isLoaded] = api.query(url);

  const reload = () => {
    if (Object.keys(filters).length === 0) setFilters({ description: [""] });
    else setFilters({});
  };

  const showSuccessFeedbackForm = (message) => {
    setAlertInfos({ message: message, severity: "success" });
    setShowAlert(true);
  };

  const handleDelete = (id) => {
    setExpenseIdToDelete(id);
    setDeleteExpenseDialogIsOpened(true);
  };

  const handleCreateEdit = (expenseData) => {
    if (expenseData && Object.keys(expenseData).length > 0) {
      let [id, description, price, date, category, source, isFixed] =
        expenseData;
      setExpenseEditData({
        id,
        description,
        price,
        date,
        category,
        source,
        isFixed,
      });
    }
    setEditCreateExpenseDialogIsOpened(true);
  };

  const options = {
    filterType: "multiselect",
    serverSide: true,
    count: data.count,
    rowsPerPage: pageSize,
    rowsPerPageOptions: [5, 10, 20, 50, 100],
    selectableRows: "none",
    textLabels: {
      body: { noMatch: "Nenhuma despesa encontrada", toolTip: "Ordenar" },
      toolbar: {
        search: "Pesquisar",
        viewColumns: "Selecionar colunas",
        filterTable: "Filtrar",
      },
      pagination: {
        next: "Próxima página",
        previous: "Página anterior",
        rowsPerPage: "Despesas por página",
        displayRows: "de",
      },
    },
    download: false,
    print: false,
    onChangePage: (p) => setPage(p + 1),
    onChangeRowsPerPage: (p) => setPageSize(p),
    onColumnSortChange: (column, direction) => {
      let orderingDirectionMapping = { asc: "", desc: "-" };
      setOrdering(orderingDirectionMapping[direction] + column);
    },
    onSearchChange: (text) => {
      if (text) setSearch(text);
      else setSearch("");
    },
    onFilterChange: (column, filterList, _, changedColumnIndex) => {
      if (column === "created_at") return;
      const isFixedMapping = [
        { label: "Sim", value: true },
        { label: "Não", value: false },
      ];
      const mapping =
        column === "is_fixed"
          ? isFixedMapping
          : [...ExpensesCategoriesMapping, ...ExpensesSourcesMapping];

      let _filters = filterList[changedColumnIndex].map(
        (f) => getChoiceByLabel(f, mapping).value
      );
      setFilters({ ...filters, [column]: _filters });
      setPage(1);
    },
    customToolbar: () => {
      return (
        <>
          <Tooltip title="Adicionar despesa">
            <IconButton onClick={() => handleCreateEdit({})}>
              <PlusOneIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Adicionar gastos fixos do mês">
            <IconButton onClick={() => handleCreateEdit({})}>
              <AddIcon />
            </IconButton>
          </Tooltip>
        </>
      );
    },
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
      name: "description",
      label: "Descrição",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "price",
      label: "Preço",
      options: {
        filter: false,
        sort: true,
        customBodyRender: (v) =>
          `R$ ${v.toFixed(2).toString().replace(".", ",")}`,
      },
    },
    {
      name: "created_at",
      label: "Quando",
      options: {
        filter: true,
        filterType: "custom",
        sort: true,
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
                  disableFuture
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
                  disableFuture
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
      name: "category",
      label: "Categoria",
      options: {
        filter: true,
        sort: true,
        filterOptions: {
          names: [
            "Casa",
            "CNPJ",
            "Lazer",
            "Transporte",
            "Supermercado",
            "Alimentação",
            "Roupas",
            "Presentes",
            "Saúde",
            "Viagem",
            "Outros",
          ],
        },
        customFilterListOptions: {
          render: (v) => `Categoria: ${v}`,
        },
      },
    },
    {
      name: "source",
      label: "Fonte",
      options: {
        filter: true,
        sort: true,
        filterOptions: {
          names: [
            "Cartão de crédito",
            "Cartão de débito",
            "Transferência bancária",
            "Dinheiro",
            "Boleto",
            "Settle Up",
          ],
        },
        customFilterListOptions: {
          render: (v) => `Fonte: ${v}`,
        },
      },
    },
    {
      name: "is_fixed",
      label: "Fixo?",
      options: {
        filter: true,
        sort: false,
        filterType: "checkbox",
        filterOptions: { names: ["Sim", "Não"] },
        customBodyRender: (v) => (v ? "Sim" : "Não"),
        customFilterListOptions: {
          render: (v) => `Fixo: ${v}`,
        },
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
              <Tooltip title="Deletar despesa">
                <IconButton onClick={() => handleDelete(tableMeta.rowData[0])}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Editar despesa">
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

  return (
    <Container
      style={{ position: "relative", marginTop: "15px" }}
      maxWidth="lg"
    >
      {!isLoaded && <Loader />}
      <MUIDataTable data={data.results} columns={columns} options={options} />
      <ExpenseCreateEditDialog
        data={expenseEditData}
        open={editCreateExpenseDialogIsOpened}
        onClose={() => {
          setEditCreateExpenseDialogIsOpened(false);
          setExpenseEditData({});
        }}
        showSuccessFeedbackForm={showSuccessFeedbackForm}
        reloadTable={reload}
      />
      <ExpenseDeleteDialog
        id={expenseIdToDelete}
        open={deleteExpenseDialogIsOpened}
        onClose={() => setDeleteExpenseDialogIsOpened(false)}
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
