import { useState } from "react";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";

import {
  Colors,
  FontSizes,
  getColor,
  Text,
} from "../../../../design-system";
import { IndicatorBox } from "./components";
import { useHideValues } from "../../../../hooks/useHideValues";
import BankAccountsDrawer from "./BankAccountsDrawer";

const BankAccountAmountText = ({ amount }: { amount: number }) => {
  const { hideValues } = useHideValues();
  return hideValues ? (
    <Skeleton
      sx={{ bgcolor: getColor(Colors.neutral300), width: "50%" }}
      animation={false}
    />
  ) : (
    <Text size={FontSizes.SMALL}>
      R${" "}
      {amount.toLocaleString("pt-br", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </Text>
  );
};

const BankAccountIndicator = ({
  total,
}: {
  total: number;
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <IndicatorBox variant={total >= 0 ? "success" : "danger"} width="50%">
        <Box
          onClick={() => setIsDrawerOpen(true)}
          sx={{
            cursor: "pointer",
            "&:hover": {
              opacity: 0.8,
            },
            width: "100%",
          }}
        >
          <Stack gap={0.5}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Text size={FontSizes.SMALL}>Saldo em conta:</Text>
            </Stack>
            <Text size={FontSizes.SEMI_SMALL} color={Colors.neutral300}>
              Total de todas as contas
            </Text>
            <BankAccountAmountText amount={total} />
          </Stack>
        </Box>
      </IndicatorBox>
      <BankAccountsDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
};

export default BankAccountIndicator;
