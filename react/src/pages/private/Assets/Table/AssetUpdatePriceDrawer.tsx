import { type Dispatch, type SetStateAction, useEffect } from "react";

import Stack from "@mui/material/Stack";

import { enqueueSnackbar } from "notistack";
import { useQueryClient } from "@tanstack/react-query";
import * as yup from "yup";

import {
  FormDrawer,
  PriceWithCurrencyInput,
  Text,
} from "../../../../design-system";
import useFormPlus from "../../../../hooks/useFormPlus";
import { AssetCurrencyMap } from "../consts";
import { ASSETS_QUERY_KEY } from "./consts";

import { updateAssetPrice } from "../api";
import { Asset } from "../api/models";
import { useInvalidateAssetsReportsQueries } from "../Reports/hooks";
import { useInvalidateAssetsIndicatorsQueries } from "../Indicators/hooks";
import { GroupBy } from "../Reports/types";

const schema = yup.object().shape({
  current_price: yup
    .number()
    .required("O preço é obrigatório")
    .positive("Apenas números positivos")
    .typeError("Preço inválido"),
});

const UpdateAssetForm = ({
  id,
  setIsSubmitting,
  initialData,
  onEditSuccess,
}: {
  id: string;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  initialData?: Asset;
  onEditSuccess?: () => void;
}) => {
  const queryClient = useQueryClient();
  const { invalidate: invalidateAssetsReportsQueries } =
    useInvalidateAssetsReportsQueries();
  const { invalidate: invalidateAssetsIndicatorsQueries } =
    useInvalidateAssetsIndicatorsQueries();

  const {
    current_price,
    write_model_pk: assetId,
    currency,
  } = (initialData ?? {}) as Asset;
  const {
    control,
    handleSubmit,
    mutate,
    isPending,
    isFieldInvalid,
    getFieldHasError,
    getErrorMessage,
  } = useFormPlus({
    mutationFn: updateAssetPrice,
    schema,
    defaultValues: { current_price },
    onSuccess: async () => {
      await invalidateAssetsReportsQueries({
        group_by: GroupBy.TYPE,
      });
      await invalidateAssetsIndicatorsQueries();
      enqueueSnackbar("Preço alterado com sucesso", {
        variant: "success",
      });
      await queryClient.invalidateQueries({
        queryKey: [ASSETS_QUERY_KEY],
      });
      onEditSuccess?.();
    },
  });
  useEffect(() => setIsSubmitting(isPending), [isPending, setIsSubmitting]);

  return (
    <Stack
      spacing={3}
      sx={{ p: 2 }}
      id={id}
      component="form"
      noValidate
      onSubmit={handleSubmit((data: yup.Asserts<typeof schema>) => {
        mutate({ id: assetId, data });
      })}
    >
      <PriceWithCurrencyInput
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
        currencySymbol={AssetCurrencyMap[currency].symbol}
        name="current_price"
      />
    </Stack>
  );
};

const AssetUpdatePriceDrawer = ({
  asset,
  open,
  onClose,
}: {
  asset: Asset;
  open: boolean;
  onClose: () => void;
}) => (
  <FormDrawer
    title={
      <Stack spacing={0.5}>
        <Text>Alterar preço do ativo</Text>
        <Text>{asset.description || asset.code}</Text>
      </Stack>
    }
    formId="asset-update-price-form-id"
    open={open}
    onClose={onClose}
    FormComponent={UpdateAssetForm}
    initialData={asset}
  />
);

export default AssetUpdatePriceDrawer;
