import { useState } from "react";

import MUIDataTable from "mui-datatables";

import Container from "@material-ui/core/Container";
import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";

import { AssetsApi } from "../../api";
import { Loader } from "../Loaders";

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
            let currency =
              tableMeta.tableData[0].currency === "BRL" ? "R$" : "$";
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

export const AssetsTable = () => {
  const [pageSize, setPageSize] = useState(5);
  const [filters, setFilters] = useState({
    page: 1,
    ordering: "",
    code: "",
  });

  function getAdjustedFilters() {
    let multipleChoiceFilters = {
      type: filters.type || [],
    };

    let _filters = new URLSearchParams({
      page: filters.page,
      ordering: filters.ordering,
      description: filters.code,
      page_size: pageSize,
    });

    Object.entries(multipleChoiceFilters).forEach(([key, value]) =>
      value.map((v) => _filters.append(key, v))
    );

    return _filters.toString();
  }

  let api = new AssetsApi();
  const [data, isLoaded] = api.query(getAdjustedFilters());

  const options = {
    filterType: "multiselect",
    serverSide: true,
    count: data.count,
    rowsPerPage: pageSize,
    rowsPerPageOptions: [5, 10, 20, 50, 100],
    selectableRows: "none",
    setRowProps: (row) => {
      if (row[7].includes("-")) {
        // negative values
        return {
          style: { background: "rgba(255, 5, 5, 0.2)" },
        };
      }
      if (!row[7].includes("undefined")) {
        // positive values
        return {
          style: { background: "rgba(0, 201, 20, 0.2)" },
        };
      }
    },
    textLabels: {
      body: { noMatch: "Nenhum ativo encontrada", toolTip: "Ordenar" },
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
    onFilterChange: (_, filterList, __, changedColumnIndex) => {
      setFilters({ ...filters, type: filterList[changedColumnIndex], page: 1 });
    },
    expandableRows: true,
    expandableRowsHeader: false,
    expandableRowsOnClick: true,
    renderExpandableRow: (rowData, _) => {
      const colSpan = rowData.length + 1;
      const [transactions] = rowData.slice(-1);

      return (
        <TableRow>
          <TableCell sx={{ paddingLeft: "20px" }} colSpan={colSpan}>
            <TransactionsTable code={rowData[1]} data={transactions} />
          </TableCell>
        </TableRow>
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
          names: ["STOCK", "STOCK_USA", "CRYPTO", "FII"],
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
        customBodyRender: (v) =>
          `R$ ${v?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })}`,
      },
    },
    {
      name: "current_price",
      label: "Preço atual",
      options: {
        filter: false,
        sort: false,
        customBodyRender: (v) =>
          `R$ ${v?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })}`,
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
