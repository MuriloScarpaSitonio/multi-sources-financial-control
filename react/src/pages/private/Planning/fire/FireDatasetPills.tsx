import { useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import {
  Colors,
  FontSizes,
  FontWeights,
  Text,
  getColor,
  getFontSize,
} from "../../../../design-system";
import type { FireReturnSeriesKey } from "../../Home/fireReturnTypes";
import {
  DATASET_GROUPS,
  DATASET_KEYS,
  DATASET_LABELS,
  datasetPeriodLabel,
} from "./fireHistoricalDatasets";

const FireDatasetPills = ({
  label,
  value,
  onChange,
  datasets = DATASET_KEYS,
  lockSubgroup = false,
}: {
  lockSubgroup?: boolean;
  datasets?: readonly FireReturnSeriesKey[];
  label: string;
  value: FireReturnSeriesKey | "";
  onChange?: (value: FireReturnSeriesKey) => void;
}) => {
  const [selection, setSelection] = useState(() => {
    const group = DATASET_GROUPS.find((item) =>
      item.subgroups.some(
        (subgroup) => value && subgroup.datasets.includes(value),
      ),
    );
    return {
      group: group?.label ?? null,
      subgroup:
        group?.subgroups.find((item) => value && item.datasets.includes(value))
          ?.label ?? null,
    };
  });
  const groups = DATASET_GROUPS.map((item) => ({
    ...item,
    subgroups: item.subgroups
      .map((subgroup) => ({
        ...subgroup,
        datasets: subgroup.datasets.filter((dataset) =>
          datasets.includes(dataset),
        ),
      }))
      .filter((subgroup) => subgroup.datasets.length > 0),
  })).filter((item) => item.subgroups.length > 0);
  const group = groups.find((item) => item.label === selection.group);
  const subgroup = group?.subgroups.find(
    (item) => item.label === selection.subgroup,
  );
  const pillStyle = {
    borderRadius: 999,
    px: 1.25,
    py: 0.5,
    minWidth: 0,
    fontSize: getFontSize(FontSizes.EXTRA_SMALL),
    '&.Mui-disabled[aria-pressed="true"]': {
      backgroundColor: getColor(Colors.brand),
      color: getColor(Colors.neutral900),
      opacity: 1,
    },
  };
  return (
    <Stack role="group" aria-label={label} gap={1.5} sx={{ minWidth: 0 }}>
      {!lockSubgroup && (
        <>
          <Text
            size={FontSizes.EXTRA_SMALL}
            color={Colors.neutral300}
            weight={FontWeights.MEDIUM}
            extraStyle={{ textAlign: "center" }}
          >
            Selecione o tipo de histórico anterior
          </Text>
          <Stack
            role="group"
            aria-label="Tipos de históricos"
            direction="row"
            justifyContent="center"
            flexWrap="wrap"
            gap={0.75}
          >
            {groups.map((item) => (
              <Button
                key={item.label}
                size="small"
                variant={group?.label === item.label ? "brand" : "brand-text"}
                aria-pressed={group?.label === item.label}
                sx={pillStyle}
                onClick={() => {
                  const onlySubgroup =
                    item.subgroups.length === 1 ? item.subgroups[0] : null;
                  setSelection({
                    group: item.label,
                    subgroup: onlySubgroup?.label ?? null,
                  });
                  if (onlySubgroup?.datasets.length === 1)
                    onChange?.(onlySubgroup.datasets[0]);
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
        </>
      )}
      <Stack gap={lockSubgroup ? 0.75 : 1.5} sx={{ minWidth: 0 }}>
        {group && (
          <>
            {!lockSubgroup && (
              <ArrowDownwardIcon
                aria-hidden
                sx={{
                  alignSelf: "center",
                  fontSize: getFontSize(FontSizes.SMALL),
                  color: getColor(Colors.neutral400),
                }}
              />
            )}
            <Text
              size={FontSizes.EXTRA_SMALL}
              color={Colors.neutral300}
              weight={FontWeights.MEDIUM}
              extraStyle={{ textAlign: "center" }}
            >
              {lockSubgroup ? "Subgrupo" : "Selecione o subgrupo"}
            </Text>
          </>
        )}
        {group && (
          <Stack
            direction="row"
            justifyContent="center"
            flexWrap="wrap"
            gap={0.75}
          >
            {group.subgroups.map((item) => (
              <Button
                key={item.label}
                disabled={lockSubgroup}
                size="small"
                variant={
                  subgroup?.label === item.label ? "brand" : "brand-text"
                }
                aria-pressed={subgroup?.label === item.label}
                sx={pillStyle}
                onClick={() => {
                  setSelection({ group: group.label, subgroup: item.label });
                  if (item.datasets.length === 1) onChange?.(item.datasets[0]);
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
        )}
        {subgroup && (
          <Stack alignItems="center" gap={lockSubgroup ? 0.75 : 1.5}>
            <ArrowDownwardIcon
              aria-hidden
              sx={{
                fontSize: getFontSize(FontSizes.SMALL),
                color: getColor(Colors.neutral400),
              }}
            />
            <Text
              size={FontSizes.EXTRA_SMALL}
              color={Colors.neutral300}
              weight={FontWeights.MEDIUM}
              extraStyle={{ textAlign: "center" }}
            >
              {lockSubgroup ? "Índice" : "Selecione o índice"}
            </Text>
            <Stack
              direction="row"
              justifyContent="center"
              flexWrap="wrap"
              gap={0.75}
              aria-label={`Índices de ${subgroup.label}`}
            >
              {subgroup.datasets.map((dataset) => (
                <Button
                  key={dataset}
                  disabled={lockSubgroup && subgroup.datasets.length === 1}
                  size="small"
                  variant={value === dataset ? "brand" : "brand-text"}
                  startIcon={value === dataset ? <CheckIcon /> : undefined}
                  aria-pressed={value === dataset}
                  title={datasetPeriodLabel(dataset)}
                  sx={pillStyle}
                  onClick={() => onChange?.(dataset)}
                >
                  {DATASET_LABELS[dataset]}
                </Button>
              ))}
            </Stack>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
};
export default FireDatasetPills;
