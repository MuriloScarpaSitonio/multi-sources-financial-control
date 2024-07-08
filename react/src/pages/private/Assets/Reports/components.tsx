import type {
  MouseEvent,
  Dispatch,
  SetStateAction,
  ReactNode,
  ReactElement,
} from "react";
import type { LayoutType, Margin } from "recharts/types/util/types";
import type {
  AssetsObjectivesMapping,
  AssetsSectorsMapping,
  AssetsTypesMapping,
} from "../consts";

import { Children, useState } from "react";

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import { Bar, BarChart as BarReChart, XAxis, YAxis, Tooltip } from "recharts";

import { Colors, getColor } from "../../../../design-system";
import { AssetOptionsProperties } from "../consts";

const ReportCardMenu = ({
  buttonText,
  anchorEl,
  setAnchorEl,
  items,
  handleClick,
  handleClose,
}: {
  buttonText: string;
  anchorEl: HTMLElement | null;
  setAnchorEl: Dispatch<SetStateAction<HTMLElement | null>>;
  items: string[];
  handleClick: (event: MouseEvent<HTMLLIElement>, index: number) => void;
  handleClose: () => void;
}) => {
  return (
    <>
      <Button
        endIcon={<ArrowDropDownIcon />}
        size="small"
        variant="text"
        aria-haspopup="true"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ color: getColor(Colors.neutral0) }}
      >
        {buttonText}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{
          "& .MuiPaper-root": {
            backgroundColor: getColor(Colors.neutral900),
            color: getColor(Colors.neutral0),
          },
          "& .MuiMenuItem-root": {
            "&:hover": {
              backgroundColor: getColor(Colors.neutral700),
            },
          },
        }}
      >
        {items.map((item, index) => (
          <MenuItem key={item} onClick={(e) => handleClick(e, index)}>
            {item}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export const ReportCard = ({
  children,
  menuButtonText,
  menuItems,
  handleMenuClick,
}: {
  children: ReactNode;
  menuButtonText: string;
  menuItems: string[];
  handleMenuClick: (event: MouseEvent<HTMLLIElement>, index: number) => void;
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <Card
      sx={{
        backgroundColor: getColor(Colors.neutral900),
        borderRadius: 6, // 24px
      }}
    >
      <CardHeader
        action={
          <ReportCardMenu
            buttonText={menuButtonText}
            anchorEl={anchorEl}
            setAnchorEl={setAnchorEl}
            items={menuItems}
            handleClick={(event: MouseEvent<HTMLLIElement>, index: number) => {
              handleMenuClick(event, index);
              setAnchorEl(null);
            }}
            handleClose={() => setAnchorEl(null)}
          />
        }
      />
      <CardContent>{children}</CardContent>
    </Card>
  );
};

export const ReportHorizontalBarChartTooltip = ({
  active,
  payload,
  positiveNegativeColor,
}: {
  positiveNegativeColor?: boolean;
  active?: boolean;
  payload?: {
    payload: {
      total: number;
      type: keyof typeof AssetsTypesMapping;
      sector: keyof typeof AssetsSectorsMapping;
      objective: keyof typeof AssetsObjectivesMapping;
    };
  }[];
}) => {
  if (active && payload && payload.length) {
    const { payload: data } = payload[0];
    const color = positiveNegativeColor
      ? data.total > 0
        ? getColor(Colors.brand)
        : getColor(Colors.danger200)
      : AssetOptionsProperties[data.type ?? data.sector ?? data.objective]
          .color;
    return (
      <p style={{ color }}>
        {`R$ ${data.total.toLocaleString("pt-br", { minimumFractionDigits: 2 })}`}
      </p>
    );
  }

  return null;
};

export const BarChart = ({
  children,
  width,
  height,
  barSize,
  data,
  dataKey,
  margin,
  layout = "vertical",
  positiveNegativeTooltipColor = false,
}: {
  children?: ReactNode;
  width: number;
  height: number;
  barSize: number;
  data: any[];
  dataKey: string;
  margin?: Margin;
  layout?: LayoutType;
  positiveNegativeTooltipColor?: boolean;
}) => {
  const cells: ReactElement[] = [];
  const others: ReactElement[] = [];
  Children.forEach(children, (child) => {
    const c = child?.valueOf() as { type?: ReactNode };
    const childName = (c?.type?.valueOf() as { name?: string })?.name;
    if (childName === "Cell") cells.push(child as ReactElement);
    else others.push(child as ReactElement);
  });
  return (
    <BarReChart
      width={width}
      height={height}
      data={data}
      layout={layout}
      margin={margin}
    >
      <XAxis
        type="number"
        tickFormatter={(t) => `R$ ${t.toLocaleString("pt-br")}`}
        stroke={getColor(Colors.neutral0)}
        tickLine={false}
      />
      <YAxis
        type="category"
        dataKey={dataKey}
        tickLine={false}
        stroke={getColor(Colors.neutral0)}
      />
      <Tooltip
        cursor={false}
        content={
          <ReportHorizontalBarChartTooltip
            positiveNegativeColor={positiveNegativeTooltipColor}
          />
        }
      />
      {others}
      <Bar
        dataKey="total"
        barSize={barSize}
        fill={getColor(Colors.brand)}
        radius={[0, 5, 5, 0]}
      >
        {cells}
      </Bar>
    </BarReChart>
  );
};
