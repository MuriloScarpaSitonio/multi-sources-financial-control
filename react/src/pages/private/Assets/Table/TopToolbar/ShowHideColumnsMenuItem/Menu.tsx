import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import {
  default as MuiMenu,
  type MenuProps as MuiMenuProps,
} from "@mui/material/Menu";
import {
  MRT_ShowHideColumnsMenuItems as ShowHideColumnsMenuItems,
  getDefaultColumnOrderIds,
  type MRT_Column as Column,
  type MRT_RowData as Row,
  type MRT_TableInstance as DataTable,
} from "material-react-table";

// https://github.com/KevinVandy/material-react-table/blob/v2/packages/material-react-table/src/components/menus/MRT_ShowHideColumnsMenu.tsx

export interface MenuProps<TData extends Row> extends Partial<MuiMenuProps> {
  anchorEl: HTMLElement | null;
  isSubMenu?: boolean;
  setAnchorEl: (anchorEl: HTMLElement | null) => void;
  table: DataTable<TData>;
}

export const Menu = <TData extends Row>({
  anchorEl,
  setAnchorEl,
  table,
  ...rest
}: MenuProps<TData>) => {
  const [hoveredColumn, setHoveredColumn] = useState<Column<TData> | null>(
    null,
  );

  const {
    getAllColumns,
    getAllLeafColumns,
    getCenterLeafColumns,
    getIsAllColumnsVisible,
    getIsSomeColumnsVisible,
    getState,
    options: {
      enableColumnOrdering,
      enableHiding,
      mrtTheme: { menuBackgroundColor },
    },
  } = table;
  const { columnOrder, density } = getState();

  const handleToggleAllColumns = (value?: boolean) => {
    getAllLeafColumns()
      .filter((col) => col.columnDef.enableHiding !== false)
      .forEach((col) => col.toggleVisibility(value));
  };

  const allColumns = useMemo(() => {
    const columns = getAllColumns();
    if (
      columnOrder.length > 0 &&
      !columns.some((col) => col.columnDef.columnDefType === "group")
    ) {
      return [
        ...Array.from(new Set(columnOrder)).map((colId) =>
          getCenterLeafColumns().find((col) => col?.id === colId),
        ),
      ].filter(Boolean);
    }
    return columns;
  }, [columnOrder, getAllColumns, getCenterLeafColumns]) as Column<TData>[];

  return (
    <MuiMenu
      MenuListProps={{
        dense: density === "compact",
        sx: { backgroundColor: menuBackgroundColor },
      }}
      anchorEl={anchorEl}
      disableScrollLock
      onClose={() => setAnchorEl(null)}
      open={!!anchorEl}
      {...rest}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          p: 0.5,
          pt: 0,
        }}
      >
        {enableHiding && (
          <Button
            variant="brand-text"
            disabled={!getIsSomeColumnsVisible()}
            onClick={() => handleToggleAllColumns(false)}
          >
            Ocultar tudo
          </Button>
        )}
        {enableColumnOrdering && (
          <Button
            variant="brand-text"
            onClick={() =>
              table.setColumnOrder(
                getDefaultColumnOrderIds(table.options, true),
              )
            }
          >
            Restaurar ordem
          </Button>
        )}
        {enableHiding && (
          <Button
            variant="brand-text"
            disabled={getIsAllColumnsVisible()}
            onClick={() => handleToggleAllColumns(true)}
          >
            Mostrar tudo
          </Button>
        )}
      </Box>
      <Divider />
      {allColumns.map((column, index) => (
        <ShowHideColumnsMenuItems
          allColumns={allColumns}
          column={column}
          hoveredColumn={hoveredColumn}
          isNestedColumns={false}
          key={`${index}-${column.id}`}
          setHoveredColumn={setHoveredColumn}
          table={table}
        />
      ))}
    </MuiMenu>
  );
};

export default Menu;
