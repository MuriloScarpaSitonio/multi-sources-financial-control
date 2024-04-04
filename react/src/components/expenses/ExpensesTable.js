import { useState } from "react";

import MUIDataTable from "mui-datatables";

import DateFnsUtils from "@date-io/date-fns";

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import DatePicker from '@mui/lab/DatePicker';

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import IconButton from "@mui/material/IconButton";
import Container from "@mui/material/Container";

import { ExpenseForm } from "../../forms/ExpenseForm";
import { FormFeedback } from "../FormFeedback";
import { ExpensesApi } from "../../api";
import { Loader } from "../Loaders";
import { getChoiceByLabel } from "../../helpers.js";
import {
  ExpensesCategoriesMapping,
  ExpensesSourcesMapping,
} from "../../consts.js";

import PlusOneIcon from "@mui/icons-material/PlusOne";
import Tooltip from "@mui/material/Tooltip";

const ExpenseCreateEditDialog = ({ data, open, onClose, reloadTable }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="expense-form-dialog-title"
    >
      <DialogTitle id="expsense-form-dialog-title">
        {data && Object.keys(data).length > 0
          ? "Editar despesa"
          : "Criar despesa"}
      </DialogTitle>
      <DialogContent>
        <ExpenseForm
          initialData={data}
          handleClose={onClose}
          reloadTable={reloadTable}
        />
      </DialogContent>
    </Dialog>
  );
};

const ExpenseDeleteDialog = ({ id, open, onClose, reloadTable }) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const handleClick = () => {
    let api = new ExpensesApi(id);
    api
      .delete()
      .then(() => {
        setAlertInfos({
          message: "Despesa deletada com sucesso!",
          severity: "success",
        });
        setShowAlert(true);
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
        aria-labelledby="expense-delete-form-dialog-title"
      >
        <DialogTitle id="expense-delete-form-dialog-title">
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
  let now = new Date();
  const [pageSize, setPageSize] = useState(5);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
  );
  const [filters, setFilters] = useState({
    page: 1,
    ordering: "",
    description: "",
    is_fixed: "",
  });
  const [expenseIdToDelete, setExpenseIdToDelete] = useState(0);

  const [expenseEditData, setExpenseEditData] = useState({});
  const [editCreateExpenseDialogIsOpened, setEditCreateExpenseDialogIsOpened] =
    useState(false);

  const [deleteExpenseDialogIsOpened, setDeleteExpenseDialogIsOpened] =
    useState(false);

  const getAdjustedFilters = () => {
    let multipleChoiceFilters = {
      category: filters.category || [],
      source: filters.source || [],
    };

    let _filters = new URLSearchParams({
      page: filters.page,
      ordering: filters.ordering,
      description: filters.description,
      is_fixed: filters.is_fixed,
      page_size: pageSize,
      start_date:
        startDate !== null ? startDate.toLocaleDateString("fr-CA") : "",
      end_date: endDate !== null ? endDate.toLocaleDateString("fr-CA") : "",
    });

    Object.entries(multipleChoiceFilters).forEach(([key, value]) =>
      value.map((v) => _filters.append(key, v))
    );

    return _filters.toString();
  };

  let api = new ExpensesApi();
  const [data, isLoaded] = api.query(getAdjustedFilters());

  const reload = () =>
    setFilters({ ...filters, description: filters.description + " " });

  const handleDelete = (id) => {
    setExpenseIdToDelete(id);
    setDeleteExpenseDialogIsOpened(true);
  };

  const handleCreateEdit = (expenseData) => {
    if (expenseData && Object.keys(expenseData).length > 0) {
      let [id, _, value, created_at, category, source, isFixed, description] =
        expenseData;
      setExpenseEditData({
        id,
        description,
        value,
        created_at,
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
    jumpToPage: true,
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
        jumpToPage: "Pular para a página",
      },
    },
    download: false,
    print: false,
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
      setFilters({
        ...filters,
        page: 1,
        description: Boolean(text) ? text : "",
      });
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
      setFilters({ ...filters, [column]: _filters, page: 1 });
    },
    customToolbar: () => {
      return (
        <>
          <Tooltip title="Adicionar despesa">
            <IconButton onClick={() => handleCreateEdit({})}>
              <PlusOneIcon />
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
      name: "full_description",
      label: "Descrição",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "value",
      label: "Preço",
      options: {
        filter: false,
        sort: true,
        customBodyRender: (v) =>
          `R$ ${v?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          })}`,
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
            <LocalizationProvider utils={DateFnsUtils}>
              <FormLabel>Quando</FormLabel>
              <FormGroup row>
                <DatePicker
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
                <DatePicker
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
            </LocalizationProvider>
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
          names: ExpensesCategoriesMapping.map((v) => v.label),
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
          names: ExpensesSourcesMapping.map((v) => v.label),
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
      name: "description",
      label: "",
      options: {
        filter: false,
        sort: true,
        display: false,
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
        reloadTable={reload}
      />
      <ExpenseDeleteDialog
        id={expenseIdToDelete}
        open={deleteExpenseDialogIsOpened}
        onClose={() => setDeleteExpenseDialogIsOpened(false)}
        reloadTable={reload}
      />
    </Container>
  );
};
