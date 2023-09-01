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

import { RevenuesForm } from "../../forms/RevenuesForm";
import { FormFeedback } from "../FormFeedback";
import { RevenuesApi } from "../../api";
import { Loader } from "../Loaders";

const RevenueCreateEditDialog = ({ data, open, onClose, reloadTable }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="revenue-form-dialog-title"
    >
      <DialogTitle id="revenue-form-dialog-title">
        {data && Object.keys(data).length > 0
          ? "Editar receita"
          : "Criar receita"}
      </DialogTitle>
      <DialogContent>
        <RevenuesForm
          initialData={data}
          handleClose={onClose}
          reloadTable={reloadTable}
        />
      </DialogContent>
    </Dialog>
  );
};

const RevenueDeleteDialog = ({ id, open, onClose, reloadTable }) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const handleClick = () => {
    let api = new RevenuesApi(id);
    api
      .delete()
      .then(() => {
        setAlertInfos({
          message: "Receita deletada com sucesso!",
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
        aria-labelledby="revenue-delete-form-dialog-title"
      >
        <DialogTitle id="revenue-delete-form-dialog-title">
          Tem certeza que deseja deletar essa receita?
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

export const RevenuesTable = () => {
  const [pageSize, setPageSize] = useState(5);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    ordering: "",
    description: "",
  });
  const [revenueIdToDelete, setRevenueIdToDelete] = useState(null);

  const [revenueEditData, setRevenueEditData] = useState({});
  const [editCreateRevenueDialogIsOpened, setEditCreateRevenueDialogIsOpened] =
    useState(false);

  const [deleteRevenueDialogIsOpened, setDeleteRevenueDialogIsOpened] =
    useState(false);

  const getAdjustedFilters = () => {
    return new URLSearchParams({
      page: filters.page,
      ordering: filters.ordering,
      description: filters.description,
      size: pageSize,
      start_date:
        startDate !== null ? startDate.toLocaleDateString("fr-CA") : "",
      end_date: endDate !== null ? endDate.toLocaleDateString("fr-CA") : "",
    }).toString();
  };

  let api = new RevenuesApi();
  const [data, isLoaded] = api.query(getAdjustedFilters());

  const reload = () =>
    setFilters({ ...filters, description: filters.description + " " });

  const handleDelete = (id) => {
    setRevenueIdToDelete(id);
    setDeleteRevenueDialogIsOpened(true);
  };

  const handleCreateEdit = (revenueData) => {
    if (revenueData && Object.keys(revenueData).length > 0) {
      let [id, _, value, created_at, description] = revenueData;
      setRevenueEditData({
        id,
        description,
        value,
        created_at,
      });
    }
    setEditCreateRevenueDialogIsOpened(true);
  };

  const options = {
    filterType: "multiselect",
    serverSide: true,
    jumpToPage: true,
    count: data.total,
    rowsPerPage: pageSize,
    rowsPerPageOptions: [5, 10, 20, 50, 100],
    selectableRows: "none",
    textLabels: {
      body: { noMatch: "Nenhuma receita encontrada", toolTip: "Ordenar" },
      toolbar: {
        search: "Pesquisar",
        viewColumns: "Selecionar colunas",
        filterTable: "Filtrar",
      },
      pagination: {
        next: "Próxima página",
        previous: "Página anterior",
        rowsPerPage: "Receitas por página",
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

      setFilters({ ...filters, page: 1 });
    },
    customToolbar: () => {
      return (
        <>
          <Tooltip title="Adicionar receita">
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
      label: "Valor",
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
              <Tooltip title="Deletar receita">
                <IconButton
                  onClick={() => {
                    handleDelete(tableMeta.rowData[0]);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Editar receita">
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
      <RevenueCreateEditDialog
        data={revenueEditData}
        open={editCreateRevenueDialogIsOpened}
        onClose={() => {
          setEditCreateRevenueDialogIsOpened(false);
          setRevenueEditData({});
        }}
        reloadTable={reload}
      />
      <RevenueDeleteDialog
        id={revenueIdToDelete}
        open={deleteRevenueDialogIsOpened}
        onClose={() => setDeleteRevenueDialogIsOpened(false)}
        reloadTable={reload}
      />
    </Container>
  );
};
