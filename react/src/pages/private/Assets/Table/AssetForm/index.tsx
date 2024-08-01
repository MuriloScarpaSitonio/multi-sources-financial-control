import type { Asset } from "../../api/models";

import { useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { enqueueSnackbar } from "notistack";
import { Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import * as yup from "yup";

import useFormPlus from "../../../../../hooks/useFormPlus";
import { editAsset } from "../../api";
import { ApiListResponse } from "../../api/types";
import {
  AssetsObjectivesMapping,
  AssetsObjectivesValueToLabelMapping,
  AssetsTypesMapping,
} from "../../consts";
import {
  AssetCurrenciesInput,
  AssetObjectives,
  AssetTypeAutoComplete,
} from "../../forms/components";
import { useInvalidateAssetsReportsQueries } from "../../Reports/hooks";
import { ASSETS_QUERY_KEY } from "../consts";
import DeleteAssetDialog from "./DeleteAssetDialog";
import { GroupBy, Kinds } from "../../Reports/types";

type AssetData = Omit<Asset, "type" | "objective"> & {
  type: { value: string; label: string };
  objective: keyof typeof AssetsObjectivesValueToLabelMapping;
};

const schema = yup.object().shape({
  code: yup.string().required("O código é obrigatório"),
  type: yup
    .object()
    .shape({
      label: yup.string(),
      value: yup.string(),
    })
    .required("O tipo é obrigatório"),
  objective: yup.string().required("O objetivo é obrigatório"),
  currency: yup.string().required("A moeda é obrigatória"),
});

const AssetsForm = ({ asset }: { asset: Asset }) => {
  const assetTypeValue = AssetsTypesMapping[asset.type]?.value ?? "";
  const [isCrypto, setIsCrypto] = useState(
    assetTypeValue === AssetsTypesMapping.Cripto.value,
  );
  const [deleteDialogIsOpen, setDeleteDialogIsOpen] = useState(false);

  const parsedValues = {
    ...asset,
    objective: AssetsObjectivesMapping[asset.objective]?.value,
    type: { label: asset.type, value: assetTypeValue },
  };
  const {
    control,
    handleSubmit,
    mutate,
    isPending,
    isFieldInvalid,
    getErrorMessage,
    isDirty,
    getValues,
    reset,
  } = useFormPlus({
    mutationFn: editAsset,
    onSuccess: async () => {
      const data = getValues() as AssetData;
      await maybeInvalidateRelatedReportsQueries(data);
      updateCachedData(data);
      reset(data);
      enqueueSnackbar("Ativo atualizado com sucesso", { variant: "success" });
    },
    schema,
    defaultValues: parsedValues,
  });

  const queryClient = useQueryClient();
  const { invalidate: invalidateAssetsReportsQueries } =
    useInvalidateAssetsReportsQueries();

  const maybeInvalidateRelatedReportsQueries = async (data: AssetData) => {
    if (data.objective !== parsedValues.objective)
      await invalidateAssetsReportsQueries({
        kind: Kinds.TOTAL_INVESTED,
        group_by: GroupBy.OBJECTIVE,
      });
    if (data.type.value !== parsedValues.type.value)
      await invalidateAssetsReportsQueries({
        kind: Kinds.TOTAL_INVESTED,
        group_by: GroupBy.TYPE,
      });
  };

  const updateCachedData = (data: AssetData) => {
    const assetsData = queryClient.getQueriesData({
      queryKey: [ASSETS_QUERY_KEY],
      type: "active",
    });
    assetsData.forEach(([queryKey, cachedData]) => {
      const newCachedData = (cachedData as ApiListResponse<Asset>).results.map(
        (asset) =>
          asset.write_model_pk === data.write_model_pk
            ? {
                ...asset,
                code: data.code,
                type: data.type.label,
                objective: AssetsObjectivesValueToLabelMapping[data.objective],
              }
            : asset,
      );

      queryClient.setQueryData(queryKey, (oldData: ApiListResponse<Asset>) => ({
        ...oldData,
        results: newCachedData,
      }));
    });
  };

  const removeAssetFromCachedData = (assetId: number) => {
    const assetsData = queryClient.getQueriesData({
      queryKey: [ASSETS_QUERY_KEY],
      type: "active",
    });
    assetsData.forEach(([queryKey]) => {
      queryClient.setQueryData(queryKey, (oldData: ApiListResponse<Asset>) => ({
        ...oldData,
        count: oldData.count - 1,
        results: oldData.results.filter(
          (asset) => asset.write_model_pk !== assetId,
        ),
      }));
    });
  };

  return (
    <form>
      <Stack spacing={2} sx={{ width: "30%", p: 2 }}>
        <Controller
          name="code"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Código"
              required
              error={isFieldInvalid(field)}
              helperText={getErrorMessage(field.name)}
              inputProps={{ sx: { textTransform: "uppercase" } }}
              variant="standard"
            />
          )}
        />
        <AssetObjectives
          prefix="edit"
          control={control}
          isFieldInvalid={() => false}
          getFieldHasError={() => false}
          getErrorMessage={() => ""}
        />
        <AssetTypeAutoComplete
          control={control}
          setIsCrypto={setIsCrypto}
          isFieldInvalid={() => false}
          getFieldHasError={() => false}
          getErrorMessage={() => ""}
        />
        {isCrypto && (
          <AssetCurrenciesInput
            prefix="edit"
            control={control}
            isFieldInvalid={() => false}
            getFieldHasError={() => false}
            getErrorMessage={() => ""}
          />
        )}

        <Stack direction="row" justifyContent="flex-end" gap={1}>
          <Button
            variant="danger-text"
            onClick={() => setDeleteDialogIsOpen(true)}
          >
            Deletar
          </Button>
          <Button
            variant={isDirty ? "brand" : "neutral"}
            type="submit"
            disabled={!isDirty}
            onClick={handleSubmit((data: AssetData) => {
              mutate({
                id: data.write_model_pk,
                data: {
                  code: data.code,
                  currency: data.currency,
                  objective: data.objective,
                  type: data.type.value,
                },
              });
            })}
          >
            {isPending ? (
              <CircularProgress color="inherit" size={24} />
            ) : (
              "Salvar"
            )}
          </Button>
        </Stack>
        <DeleteAssetDialog
          id={asset.write_model_pk}
          code={asset.code}
          open={deleteDialogIsOpen}
          onClose={() => setDeleteDialogIsOpen(false)}
          onSuccess={() => removeAssetFromCachedData(asset.write_model_pk)}
        />
      </Stack>
    </form>
  );
};

export default AssetsForm;
