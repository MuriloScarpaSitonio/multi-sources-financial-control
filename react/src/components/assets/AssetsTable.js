import { useState } from "react";

import MUIDataTable from "mui-datatables";

import Container from "@material-ui/core/Container";

import { AssetsApi } from "../../api";
import { Loader } from "../Loaders";

export const AssetsTable = () => {
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [ordering, setOrdering] = useState("");
  const [search, setSearch] = useState("");

  let url =
    `page=${page}&page_size=${pageSize}&ordering=${ordering}` +
    `&code=${search}&${typeFilter}`;

  let api = new AssetsApi();
  const [data, isLoaded] = api.query(url);

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
    onFilterChange: (_, filterList, __, changedColumnIndex) => {
      let filters = new URLSearchParams();
      filterList[changedColumnIndex].map((type) =>
        filters.append("type", type)
      );
      setTypeFilter(filters.toString());
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
          names: ["STOCK", "STOCK_USA", "CRIPTO", "FII"],
        },
        customFilterListOptions: {
          render: (v) => `Tipo: ${v}`,
        },
      },
    },
    {
      name: "adjusted_avg_price",
      label: "Preço médio ajustado",
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
      label: "Total investido ajustado",
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
