import {
  type ReactNode,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import type { MRT_PaginationState as PaginationState } from "material-react-table";

import IconButton from "@mui/material/IconButton";
import OutlinedInput from "@mui/material/OutlinedInput";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";

import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import SvgIcon from "@mui/material/SvgIcon";

import { InfoIconTooltip, Text } from "../../design-system/components";
import * as enums from "../../design-system/enums";
import { getColor } from "../../design-system/utils";
import { SxProps } from "@mui/material";
import { useHideValues } from "../../hooks/useHideValues";

const ErrorFeedback = () => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <ErrorOutlineOutlinedIcon
      sx={{ color: getColor(enums.Colors.danger200) }}
    />
    <Text weight={enums.FontWeights.LIGHT} size={enums.FontSizes.EXTRA_SMALL}>
      Falha ao carregar. Por favor, tente novamente mais tarde.
    </Text>
  </Stack>
);

export const Indicator = ({
  title,
  tooltipText,
  Icon,
  value,
  extra,
  secondaryIndicator,
  variant,
  isLoading,
  isError,
  sx,
}: {
  title: string;
  tooltipText?: string;
  Icon: typeof SvgIcon;
  value?: number;
  extra?: ReactNode;
  secondaryIndicator: ReactNode;
  variant: "success" | "danger";
  isLoading: boolean;
  isError: boolean;
  sx?: SxProps;
}) => {
  const { hideValues } = useHideValues();

  const valueContent = extra ? (
    <Stack spacing={0.5}>
      <Text size={enums.FontSizes.REGULAR}>
        {`R$ ${value?.toLocaleString("pt-br", {
          minimumFractionDigits: 2,
        })}`}
      </Text>
      {extra}
    </Stack>
  ) : (
    <Text size={enums.FontSizes.REGULAR}>
      {`R$ ${value?.toLocaleString("pt-br", {
        minimumFractionDigits: 2,
      })}`}
    </Text>
  );

  const content = (
    <Stack spacing={1.5}>
      {isLoading || hideValues ? (
        <Skeleton
          sx={{ bgcolor: getColor(enums.Colors.neutral300), width: "75%" }}
          animation={hideValues ? false : "pulse"}
        />
      ) : (
        valueContent
      )}
      {secondaryIndicator}
    </Stack>
  );
  const titleContent = tooltipText ? (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Text weight={enums.FontWeights.LIGHT} size={enums.FontSizes.SMALL}>
        {title}
      </Text>
      {tooltipText && <InfoIconTooltip text={tooltipText} />}
    </Stack>
  ) : (
    <Text weight={enums.FontWeights.LIGHT} size={enums.FontSizes.SMALL}>
      {title}
    </Text>
  );
  return (
    <Stack
      sx={{
        background: getColor(enums.Colors.neutral900),
        py: 2,
        px: 5,
        height: 140,
        borderRadius: 3,
        ...sx,
      }}
      spacing={1}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={8}
      >
        {titleContent}
        <Icon
          fontSize="medium"
          sx={{
            color: getColor(
              variant === "success"
                ? enums.Colors.brand
                : enums.Colors.danger200,
            ),
          }}
        />
      </Stack>
      {isError ? <ErrorFeedback /> : content}
    </Stack>
  );
};

export const SearchBar = ({
  search,
  setSearch,
  setPagination,
  placeholder,
}: {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  placeholder: string;
}) => {
  const [innerSearch, setInnerSearch] = useState(search);

  const changeSearch = useCallback(
    (value: string) => {
      setSearch(value);
      setPagination((prevPagination) => ({
        ...prevPagination,
        pageIndex: 0,
      }));
    },
    [setPagination, setSearch],
  );

  return (
    <OutlinedInput
      size="small"
      value={innerSearch}
      fullWidth
      placeholder={placeholder}
      onChange={(e) => {
        setInnerSearch(e.target.value);
        setTimeout(() => {
          changeSearch(e.target.value);
        }, 600);
      }}
      endAdornment={
        search ? (
          <IconButton
            onClick={() => {
              setInnerSearch("");
              setTimeout(() => {
                changeSearch("");
              }, 600);
            }}
          >
            <ClearIcon sx={{ color: getColor(enums.Colors.neutral200) }} />
          </IconButton>
        ) : (
          <SearchIcon sx={{ color: getColor(enums.Colors.neutral200) }} />
        )
      }
      sx={{
        "&.MuiOutlinedInput-root": {
          border: "none",
          borderRadius: "5px",
          backgroundColor: getColor(enums.Colors.neutral400),
        },
        "&.MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
          border: "none",
        },
        "&.MuiOutlinedInput-root .MuiOutlinedInput-input::placeholder": {
          color: getColor(enums.Colors.neutral0),
        },
      }}
    />
  );
};
