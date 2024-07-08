import { getColor, Colors } from "../../../../design-system";

export const getExpandedRowSubTableLayoutProps = () => ({
  defaultPageSize: 5,
  enableExpanding: false,
  enableTopToolbar: false,
  muiTableHeadCellProps: {
    sx: {
      backgroundColor: getColor(Colors.neutral600),
      borderBottomColor: getColor(Colors.neutral0),
    },
  },
  mrtTheme: {
    baseBackgroundColor: getColor(Colors.neutral600),
  },
  muiTablePaperProps: { elevation: 0, sx: { borderRadius: "10px" } },
});
