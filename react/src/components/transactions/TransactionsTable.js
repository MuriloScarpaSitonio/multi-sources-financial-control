import { useState } from "react";

import MUIDataTable from "mui-datatables";
import DateFnsUtils from "@date-io/date-fns";

import {
  MuiPickersUtilsProvider,
  KeyboardDatePicker,
} from "@material-ui/pickers";

import Container from "@material-ui/core/Container";
import FormGroup from "@material-ui/core/FormGroup";
import FormLabel from "@material-ui/core/FormLabel";

import { Loader } from "../Loaders";
import { TransactionsApi } from "../../api";
import { getChoiceByLabel } from "../../helpers";
import { TransactionsActionsMapping } from "../../consts";

export const TransactionsTable = () => {
  const [pageSize, setPageSize] = useState(5);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    ordering: "",
    code: "",
  });

  function getAdjustedFilters() {
    let multipleChoiceFilters = {
      action: filters.action || [],
    };

    let _filters = new URLSearchParams({
      page: filters.page,
      ordering: filters.ordering,
      code: filters.code,
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
      setFilters({ ...filters, code: Boolean(text) ? text : "" });
    },
    onColumnSortChange: (column, direction) => {
      let _column = column === "code" ? "asset__code" : column;
      let orderingDirectionMapping = { asc: "", desc: "-" };
      setFilters({
        ...filters,
        ordering: orderingDirectionMapping[direction] + _column,
      });
    },
    onFilterChange: (column, filterList, __, changedColumnIndex) => {
      if (column === "created_at") return;
      let _filters = filterList[changedColumnIndex].map(
        (f) => getChoiceByLabel(f, TransactionsActionsMapping).value
      );
      setFilters({ ...filters, [column]: _filters, page: 1 });
    },
  };
  let columns = [
    {
      name: "code",
      label: "Código",
      options: {
        filter: false,
        sort: true,
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
          let [currency] = tableMeta.rowData.slice(-1);
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
  ];
  return (
    <Container
      style={{ position: "relative", marginTop: "15px" }}
      maxWidth="lg"
    >
      {!isLoaded && <Loader />}
      <MUIDataTable data={data.results} columns={columns} options={options} />
    </Container>
  );
};
