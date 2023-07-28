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
import { PassiveIncomesApi } from "../../api";
import { getChoiceByLabel } from "../../helpers";
import {
  AssetsTypesMapping,
  PassiveIncomeEventTypesMapping,
  PassiveIncomeTypesMapping,
} from "../../consts";
import { PassiveIncomeForm } from "../../forms/PassiveIncomeForm";

const PassiveIncomeCreateEditDialog = ({
  data,
  open,
  onClose,
  reloadTable,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="passive-income-form-dialog-title"
    >
      <DialogTitle id="passive-income-form-dialog-title">
        {data && Object.keys(data).length > 0
          ? "Editar rendimento passivo"
          : "Criar rendimento passivo"}
      </DialogTitle>
      <DialogContent>
        <PassiveIncomeForm
          initialData={data}
          handleClose={onClose}
          reloadTable={reloadTable}
        />
      </DialogContent>
    </Dialog>
  );
};

const PassiveIncomeDeleteDialog = ({ id, open, onClose, reloadTable }) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const handleClick = () => {
    let api = new PassiveIncomesApi(id);
    api
      .delete()
      .then(() => {
        setAlertInfos({
          message: "Rendimento deletado com sucesso!",
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
        aria-labelledby="passive-income-delete-form-dialog-title"
      >
        <DialogTitle id="passive-income-delete-form-dialog-title">
          Tem certeza que deseja deletar esse rendimento passivo?
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

export const PassiveIncomesTable = () => {
  const [pageSize, setPageSize] = useState(5);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    ordering: "",
    asset_code: "",
  });

  const [passiveIncomeEditData, setPassiveIncomeEditData] = useState({});
  const [
    editCreatePassiveIncomeDialogIsOpened,
    setEditCreatePassiveIncomeDialogIsOpened,
  ] = useState(false);
  const [
    deletePassiveIncomeDialogIsOpened,
    setDeletePassiveIncomeDialogIsOpened,
  ] = useState(false);
  const [passiveIncomeIdToDelete, setPassiveIncomeIdToDelete] = useState(null);

  function getAdjustedFilters() {
    let multipleChoiceFilters = {
      type: filters.type || [],
      event_type: filters.event_type || [],
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

  const [data, isLoaded] = new PassiveIncomesApi().query(getAdjustedFilters());

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
    enableNestedDataAccess: ".",
    textLabels: {
      body: {
        noMatch: "Nenhum rendimento passivo encontrado",
        toolTip: "Ordenar",
      },
      toolbar: {
        search: "Pesquisar",
        viewColumns: "Selecionar colunas",
        filterTable: "Filtrar",
      },
      pagination: {
        next: "Próxima página",
        previous: "Página anterior",
        rowsPerPage: "Rendimentos passivos por página",
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
      let _column = column === "asset.type" ? "asset_type" : column;
      if (_column === "operation_date") return;
      let _filters = filterList[changedColumnIndex].map(
        (f) =>
          getChoiceByLabel(f, [
            ...PassiveIncomeEventTypesMapping,
            ...PassiveIncomeTypesMapping,
            ...AssetsTypesMapping,
          ]).value
      );
      setFilters({ ...filters, [_column]: _filters, page: 1 });
    },
    customToolbar: () => {
      return (
        <>
          <Tooltip title="Adicionar rendimento passivo">
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
      name: "asset.code",
      label: "Código",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "asset.type",
      label: "Classe",
      options: {
        filter: true,
        sort: false,
        filterOptions: {
          names: AssetsTypesMapping.map((v) => v.label),
        },
        customFilterListOptions: {
          render: (v) => `Classe: ${v}`,
        },
      },
    },
    {
      name: "type",
      label: "Tipo",
      options: {
        filter: true,
        sort: false,
        filterOptions: {
          names: ["Dividendo", "Juros sobre capital próprio", "Rendimento"],
        },
        customFilterListOptions: {
          render: (v) => `Tipo: ${v}`,
        },
      },
    },
    {
      name: "amount",
      label: "Valor líquido",
      options: {
        filter: false,
        sort: true,
        customBodyRender: (v, tableMeta) =>
          `${
            tableMeta.rowData[6] === "Real" ? "R$" : "US$"
          } ${v?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })}`,
      },
    },
    {
      name: "event_type",
      label: "Evento",
      options: {
        filter: true,
        sort: false,
        filterOptions: {
          names: ["Provisionado", "Creditado"],
        },
        customFilterListOptions: {
          render: (v) => `Evento: ${v}`,
        },
      },
    },
    {
      name: "operation_date",
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
      name: "asset.currency",
      options: {
        display: false,
        filter: false,
        viewColumns: false,
      },
    },
    {
      name: "asset.pk",
      options: {
        display: false,
        filter: false,
        viewColumns: false,
      },
    },
    {
      name: "current_currency_conversion_rate",
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
              <Tooltip title="Deletar rendimento passivo">
                <IconButton
                  onClick={() => {
                    handleDelete(tableMeta.rowData[0]);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Editar rendimento passivo">
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

  const handleCreateEdit = (passiveIncomeData) => {
    if (passiveIncomeData && Object.keys(passiveIncomeData).length > 0) {
      let [
        id,
        asset_code,
        type,
        amount,
        event_type,
        operation_date,
        currency,
        asset_pk,
        current_currency_conversion_rate,
      ] = passiveIncomeData;
      setPassiveIncomeEditData({
        id,
        type,
        amount,
        event_type,
        operation_date,
        current_currency_conversion_rate,
        asset: {
          pk: asset_pk,
          code: asset_code,
          currency: currency === "Real" ? "BRL" : "USD",
        },
      });
    }
    setEditCreatePassiveIncomeDialogIsOpened(true);
  };

  const handleDelete = (id) => {
    setPassiveIncomeIdToDelete(id);
    setDeletePassiveIncomeDialogIsOpened(true);
  };

  const reload = () =>
    setFilters({ ...filters, asset_code: filters.asset_code + " " });

  return (
    <Container
      style={{ position: "relative", marginTop: "15px" }}
      maxWidth="lg"
    >
      {!isLoaded && <Loader />}
      <MUIDataTable data={data.results} columns={columns} options={options} />
      <PassiveIncomeCreateEditDialog
        data={passiveIncomeEditData}
        open={editCreatePassiveIncomeDialogIsOpened}
        onClose={() => {
          setEditCreatePassiveIncomeDialogIsOpened(false);
          setPassiveIncomeEditData({});
        }}
        reloadTable={reload}
      />

      <PassiveIncomeDeleteDialog
        id={passiveIncomeIdToDelete}
        open={deletePassiveIncomeDialogIsOpened}
        onClose={() => setDeletePassiveIncomeDialogIsOpened(false)}
        reloadTable={reload}
      />
    </Container>
  );
};
