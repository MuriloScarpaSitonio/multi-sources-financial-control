import { type Dispatch, type SetStateAction, useMemo } from "react";

import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { Controller } from "react-hook-form";

import {
  FormFeedbackError,
  DateInput,
  Colors,
  Text,
  getColor,
  FontWeights,
  FontSizes,
  NumberFormat,
} from "../../../../design-system";
import {
  AssetCurrencyMap,
  AssetsObjectivesMapping,
  AssetsTypesMapping,
  LiquidityTypesOptions,
  FixedIncomeIndexers,
} from "../consts";
import {
  AssetCodeAutoCompleteProps,
  CreatableAssetCodeAutoCompleteProps,
  ReactHookFormsInputCustomProps,
} from "./types";
import { useAssetsMinimalData } from "./hooks";

const filter = createFilterOptions<{
  label: string;
  value: string;
  currency?: string;
  inputValue?: string;
}>();

export const AssetCodeAutoComplete = ({
  control,
  creatable,
  filters,
  newCode,
  setNewCode,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
  isNewAssetHeldInSelfCustody = false,
}: AssetCodeAutoCompleteProps | CreatableAssetCodeAutoCompleteProps) => {
  const { data: assets, isPending: isFetchingAssets } =
    useAssetsMinimalData(filters);

  const options = useMemo(
    () =>
      assets?.map((asset) => ({
        label: asset.code,
        value: asset.pk,
        currency: asset.currency,
        type: asset.type,
        is_held_in_self_custody: asset.is_held_in_self_custody,
        quantity_balance: asset.quantity_balance,
      })) ?? [],
    [assets],
  );

  return (
    <Stack spacing={1}>
      <Stack spacing={1} direction="row">
        <Controller
          name="asset"
          control={control}
          render={({ field }) => (
            <Stack spacing={0.5} sx={{ width: creatable ? "40%" : "100%" }}>
              <Autocomplete
                {...field}
                clearText="Limpar"
                noOptionsText="Nenhum ativo encontrado"
                loadingText="Carregando ativos..."
                loading={isFetchingAssets}
                options={options}
                disabled={isNewAssetHeldInSelfCustody}
                getOptionLabel={(option) => option.label}
                onChange={(_, asset, reason) => {
                  if (!creatable) return field.onChange(asset);
                  if (reason === "clear") {
                    field.onChange(asset);
                    setNewCode("");
                    return;
                  }
                  const {
                    label,
                    value,
                    currency,
                    type,
                    is_held_in_self_custody,
                    quantity_balance,
                    inputValue,
                  } = asset;
                  setNewCode(inputValue);
                  field.onChange({
                    label: inputValue ?? label,
                    value: inputValue ? 0 : value,
                    currency,
                    type,
                    is_held_in_self_custody,
                    quantity_balance,
                  });
                }}
                filterOptions={
                  !creatable
                    ? undefined
                    : (options, params) => {
                        const filtered = filter(options, params);

                        const { inputValue } = params;
                        const isExisting = options.some(
                          (option) => inputValue === option.label,
                        );
                        if (inputValue && !isExisting) {
                          filtered.push({
                            inputValue: inputValue,
                            label: `Adicionar "${inputValue}"`,
                            value: "",
                          });
                        }

                        return filtered;
                      }
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    error={isFieldInvalid(field)}
                    required
                    label="Ativo"
                    variant="standard"
                  />
                )}
              />
              {getFieldHasError("asset") && (
                <FormFeedbackError message={getErrorMessage("asset")} />
              )}
            </Stack>
          )}
        />
        <Stack
          spacing={1}
          direction="row"
          alignItems="center"
          sx={{
            p: 0.5,
            borderRadius: "5px",
            backgroundColor: getColor(Colors.neutral400),
            width: "50%",
            display: newCode ? "" : "none",
          }}
        >
          <InfoOutlinedIcon sx={{ color: "#CCC86C" }} />
          <Text weight={FontWeights.LIGHT} size={FontSizes.EXTRA_SMALL}>
            Este é um novo ativo na sua carteira.
          </Text>
        </Stack>
      </Stack>
      {isNewAssetHeldInSelfCustody && (
        <FormHelperText>
          Ativos custodiados fora da b3 não apresentam código específico
        </FormHelperText>
      )}
    </Stack>
  );
};

export const AssetTypeAutoComplete = ({
  control,
  setIsCrypto,
  setIsFixedBR,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
}: ReactHookFormsInputCustomProps & {
  setIsCrypto: Dispatch<SetStateAction<boolean>>;
  setIsFixedBR?: Dispatch<SetStateAction<boolean>>;
}) => (
  <Controller
    name="type"
    control={control}
    render={({ field: { onChange, value } }) => (
      <>
        <Autocomplete
          onChange={(_, type) => {
            if (!type) return;
            setIsCrypto(type.value === AssetsTypesMapping.Cripto.value);
            setIsFixedBR?.(
              type.value === AssetsTypesMapping["Renda fixa BR"].value,
            );
            onChange(type);
          }}
          value={value}
          disableClearable
          options={Object.entries(AssetsTypesMapping).map(
            ([label, { value }]) => ({ label, value }),
          )}
          getOptionLabel={(option) => option.label}
          renderInput={(params) => (
            <TextField
              {...params}
              error={isFieldInvalid({ name: "type" })}
              required
              label="Categoria"
              variant="standard"
            />
          )}
        />
        {getFieldHasError("type") && (
          <FormFeedbackError message={getErrorMessage("type.value")} />
        )}
      </>
    )}
  />
);

export const AssetCurrenciesInput = ({
  prefix,
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
}: ReactHookFormsInputCustomProps & { prefix: string }) => (
  <FormControl>
    <FormLabel error={isFieldInvalid({ name: "currency" })} required>
      Moeda
    </FormLabel>
    <Controller
      name="currency"
      control={control}
      render={({ field }) => (
        <>
          <RadioGroup {...field} row>
            {Object.entries(AssetCurrencyMap).map(([value, { label }]) => (
              <FormControlLabel
                key={`${prefix}-asset-currency-radio-${value}`}
                value={value}
                control={<Radio />}
                label={label}
              />
            ))}
          </RadioGroup>
          {getFieldHasError("currency") && (
            <FormFeedbackError message={getErrorMessage("currency")} />
          )}
        </>
      )}
    />
  </FormControl>
);

export const AssetObjectives = ({
  prefix,
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
}: ReactHookFormsInputCustomProps & { prefix: string }) => (
  <FormControl>
    <FormLabel required error={isFieldInvalid({ name: "objective" })}>
      Objetivo
    </FormLabel>
    <Controller
      name="objective"
      control={control}
      render={({ field }) => (
        <>
          <RadioGroup {...field} row>
            {Object.entries(AssetsObjectivesMapping)
              .filter(([key, _]) => key !== "Desconhecido")
              .map(([label, { value }]) => (
                <FormControlLabel
                  key={`${prefix}-asset-objective-radio-${label}`}
                  value={value}
                  control={<Radio />}
                  label={label}
                />
              ))}
          </RadioGroup>
          {getFieldHasError("objective") && (
            <FormFeedbackError message={getErrorMessage("objective")} />
          )}
        </>
      )}
    />
  </FormControl>
);

export const TransactionQuantity = ({
  required,
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
  isHeldInSelfCustody = false,
  onSellAll,
}: ReactHookFormsInputCustomProps & {
  required?: boolean;
  isHeldInSelfCustody?: boolean;
  onSellAll?: () => void;
}) => (
  <Controller
    name="quantity"
    control={control}
    render={({ field }) => (
      <Stack spacing={0.5}>
        <TextField
          {...field}
          required={required}
          disabled={isHeldInSelfCustody}
          label="Quantidade"
          InputProps={{
            inputComponent: NumberFormat,
          }}
          InputLabelProps={{ shrink: true }}
          error={isFieldInvalid(field)}
          variant="standard"
        />
        {getFieldHasError("quantity") && (
          <FormFeedbackError message={getErrorMessage("quantity")} />
        )}
        {onSellAll && (
          <Button
            size="small"
            variant="danger-text"
            onClick={onSellAll}
            sx={{ alignSelf: "flex-end", p: 0, minWidth: 0 }}
          >
            Vender tudo
          </Button>
        )}
        {isHeldInSelfCustody && (
          <Stack>
            <FormHelperText>
              Ativos custodiados fora da b3 não apresentam
            </FormHelperText>
            <FormHelperText>
              transações com quantidade específica
            </FormHelperText>
          </Stack>
        )}
      </Stack>
    )}
  />
);

export const AssetCodeTextField = ({
  control,
}: {
  control: AssetCodeAutoCompleteProps["control"];
}) => (
  <Controller
    name="asset"
    control={control}
    disabled
    render={({ field }) => (
      <TextField
        {...field}
        label="Ativo"
        variant="standard"
        disabled
        value={field.value?.label}
      />
    )}
  />
);

export const LiquidityTypeInput = ({
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
}: ReactHookFormsInputCustomProps) => (
  <FormControl>
    <FormLabel error={isFieldInvalid({ name: "liquidity_type" })} required>
      Tipo de Liquidez
    </FormLabel>
    <Controller
      name="liquidity_type"
      control={control}
      render={({ field }) => (
        <>
          <RadioGroup {...field} row>
            {LiquidityTypesOptions.map(({ label, value }) => (
              <FormControlLabel
                key={`liquidity-type-radio-${value}`}
                value={value}
                control={<Radio />}
                label={label}
              />
            ))}
          </RadioGroup>
          {getFieldHasError("liquidity_type") && (
            <FormFeedbackError message={getErrorMessage("liquidity_type")} />
          )}
        </>
      )}
    />
  </FormControl>
);

export const MaturityDateInput = ({
  control,
  isFieldInvalid,
  getErrorMessage,
}: ReactHookFormsInputCustomProps) => (
  <DateInput
    name="maturity_date"
    label="Data de Vencimento"
    control={control}
    required={false}
    dateOnly
    error={isFieldInvalid({ name: "maturity_date" })}
    helperText={getErrorMessage("maturity_date")}
  />
);

export const FixedIncomeIndexerInput = ({
  control,
  isFieldInvalid,
  getErrorMessage,
}: ReactHookFormsInputCustomProps) => (
  <Controller
    name="indexer"
    control={control}
    render={({ field }) => (
      <TextField
        {...field}
        value={field.value ?? ""}
        select
        required
        label="Indexador"
        variant="standard"
        error={isFieldInvalid(field)}
        helperText={getErrorMessage(field.name)}
      >
        {Object.entries(FixedIncomeIndexers).map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>
    )}
  />
);
