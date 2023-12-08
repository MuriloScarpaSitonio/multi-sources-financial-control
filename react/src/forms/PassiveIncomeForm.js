import { useEffect, useState } from "react";

import { useForm, Controller } from "react-hook-form";
import NumberFormat from "react-number-format";
import * as yup from "yup";

import DateFnsUtils from "@date-io/date-fns";
import {
  MuiPickersUtilsProvider,
  KeyboardDatePicker,
} from "@material-ui/pickers";

import Autocomplete from "@material-ui/lab/Autocomplete";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import DialogActions from "@material-ui/core/DialogActions";
import FormControl from "@material-ui/core/FormControl";
import FormGroup from "@material-ui/core/FormGroup";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";

import { yupResolver } from "@hookform/resolvers/yup";

import { AssetsApi, PassiveIncomesApi } from "../api";
import { getChoiceByLabel } from "../helpers";
import { FormFeedback } from "../components/FormFeedback";
import {
  PassiveIncomeTypesMapping,
  PassiveIncomeEventTypesMapping,
} from "../consts.js";

function NumberFormatCustom(props) {
  const { inputRef, onChange, ...other } = props;

  return (
    <NumberFormat
      {...other}
      getInputRef={inputRef}
      onValueChange={(values) =>
        onChange({
          target: {
            value: values.floatValue,
          },
        })
      }
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={2}
      allowNegative={false}
      isNumericString
    />
  );
}

const schema = yup.object().shape({
  asset: yup
    .object()
    .shape({
      label: yup.string().required("O ativo é obrigatório"),
      value: yup.string().required("O ativo é obrigatório"),
    })
    .required("O ativo é obrigatório")
    .nullable(),
  type: yup
    .object()
    .shape({
      label: yup.string().required("O tipo é obrigatório"),
      value: yup.string().required("O tipo é obrigatório"),
    })
    .required("O tipo é obrigatório")
    .nullable(),
  event_type: yup
    .object()
    .shape({
      label: yup.string().required("O tipo de evento é obrigatório"),
      value: yup
        .string()
        .required("O tipo de evento é obrigatório")
        .matches(
          /(PROVISIONED|CREDITED)/,
          "Apenas 'creditado' e 'provisionado' são tipos de eventos válidos"
        ),
    })
    .required("O tipo de evento é obrigatório")
    .nullable(),
  amount: yup
    .number()
    .required("O montante é obrigatório")
    .positive("Apenas números positivos"),
  operation_date: yup
    .date()
    .required("A data é obrigatória")
    .typeError("Data inválida"),
  current_currency_conversion_rate: yup.number().nullable(),
});

export const PassiveIncomeForm = ({
  initialData,
  handleClose,
  reloadTable,
}) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [codes, setCodes] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});
  let initialEventType =
    getChoiceByLabel(initialData.event_type, PassiveIncomeEventTypesMapping)
      ?.value || "PROVISIONED";
  const [isCreditedIncome, setIsCreditedIncome] = useState(
    initialEventType === "CREDITED"
  );

  useEffect(
    () =>
      new AssetsApi().getMinimalData().then((response) => {
        setCodes(
          response.data.map((asset) => ({
            label: asset.code,
            value: asset.pk,
            currency: asset.currency,
          }))
        );
      }),
    // .catch((error) => {})
    []
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
  } = useForm({
    mode: "all",
    resolver: yupResolver(schema),
  });
  const isCreateForm = Object.keys(initialData).length === 0;
  const onSubmit = (data) => {
    const method = isCreateForm ? "post" : "put";
    const actionVerb = isCreateForm ? "criado" : "editado";
    if (isDirty) {
      setIsLoaded(false);
      if (!isCreditedIncome) {
        delete data.current_currency_conversion_rate;
      } else {
        data.current_currency_conversion_rate =
          data.current_currency_conversion_rate || 1;
      }
      new PassiveIncomesApi(initialData.id)
        [method]({
          ...data,
          asset_pk: data.asset.value,
          type: data.type.value,
          event_type: data.event_type.value,
          operation_date: data.operation_date.toLocaleDateString("pt-br"),
        })
        .then(() => {
          setAlertInfos({
            message: `Rendimento ${actionVerb} com sucesso!`,
            severity: "success",
          });
          setShowAlert(true);
          reloadTable();
          handleClose();
        })
        .catch((error) => {
          setAlertInfos({
            message: JSON.stringify(error.response.data),
            severity: "error",
          });
          setShowAlert(true);
        })
        .finally(() => {
          setIsLoaded(true);
        });

      return;
    }
    setAlertInfos({
      message: "Você precisa alterar pelo menos um campo!",
      severity: "error",
    });
    setShowAlert(true);
  };

  let assetData = watch("asset");
  return (
    <>
      <form>
        <FormGroup row>
          <FormControl
            style={{ width: "49%", marginRight: "2%" }}
            error={!!errors.asset}
          >
            <Controller
              name="asset"
              control={control}
              defaultValue={
                initialData.asset
                  ? {
                      value: initialData.asset.pk,
                      label: initialData.asset.code,
                      currency: initialData.asset.currency,
                    }
                  : null
              }
              render={({ field: { onChange, value } }) => (
                <>
                  <Autocomplete
                    onChange={(_, asset) => onChange(asset)}
                    value={value}
                    clearText="Limpar"
                    closeText="Fechar"
                    options={codes}
                    getOptionLabel={(option) => option.label}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        error={!!errors.asset}
                        required
                        label="Ativo"
                      />
                    )}
                  />
                  {(errors.asset?.message || errors.asset?.value?.message) && (
                    <FormHelperText>
                      {errors.asset?.message || errors.asset?.value?.message}
                    </FormHelperText>
                  )}
                </>
              )}
            />
          </FormControl>
          <FormControl style={{ width: "49%" }} error={!!errors.type}>
            <Controller
              name="type"
              control={control}
              defaultValue={
                getChoiceByLabel(initialData.type, PassiveIncomeTypesMapping) ||
                PassiveIncomeTypesMapping[0]
              }
              render={({ field: { onChange, value } }) => (
                <>
                  <Autocomplete
                    onChange={(_, type) => onChange(type)}
                    value={value}
                    clearText="Limpar"
                    closeText="Fechar"
                    options={PassiveIncomeTypesMapping}
                    getOptionLabel={(option) => option.label}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        error={!!errors.type}
                        required
                        label="Tipo"
                      />
                    )}
                  />
                  {(errors.type?.message || errors.type?.value?.message) && (
                    <FormHelperText>
                      {errors.type?.message || errors.type?.value?.message}
                    </FormHelperText>
                  )}
                </>
              )}
            />
          </FormControl>
        </FormGroup>
        <FormGroup row style={{ marginTop: "10px" }}>
          <FormControl
            style={{ width: "32%", marginRight: "2%" }}
            error={!!errors.amount}
          >
            <Controller
              name="amount"
              control={control}
              defaultValue={initialData.amount}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  label="Montante"
                  InputProps={{
                    inputComponent: NumberFormatCustom,
                    inputProps: {
                      prefix: assetData?.currency === "BRL" ? "R$ " : "US$ ",
                    },
                  }}
                  error={!!errors.amount}
                  helperText={errors.amount?.message}
                />
              )}
            />
          </FormControl>
          <FormControl
            style={{ width: "32%", marginRight: "2%" }}
            error={!!errors.event_type}
          >
            <Controller
              name="event_type"
              control={control}
              defaultValue={
                getChoiceByLabel(
                  initialData.event_type,
                  PassiveIncomeEventTypesMapping
                ) || PassiveIncomeEventTypesMapping[1]
              }
              render={({ field: { onChange, value } }) => (
                <>
                  <Autocomplete
                    onChange={(_, eventType) => {
                      setIsCreditedIncome(eventType.value === "CREDITED");
                      onChange(eventType);
                    }}
                    value={value}
                    clearText="Limpar"
                    closeText="Fechar"
                    options={PassiveIncomeEventTypesMapping}
                    getOptionLabel={(option) => option.label}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        error={!!errors.event_type}
                        required
                        label="Tipo"
                      />
                    )}
                  />
                  {(errors.event_type?.message ||
                    errors.event_type?.value?.message) && (
                    <FormHelperText>
                      {errors.event_type?.message ||
                        errors.event_type?.value?.message}
                    </FormHelperText>
                  )}
                </>
              )}
            />
          </FormControl>
          <MuiPickersUtilsProvider utils={DateFnsUtils}>
            <Controller
              name="operation_date"
              control={control}
              defaultValue={
                initialData.operation_date
                  ? // make sure to include hours and minutes to adjust timezone
                    new Date(initialData.operation_date + "T00:00")
                  : new Date()
              }
              render={({ field: { onChange, value } }) => (
                <KeyboardDatePicker
                  onChange={onChange}
                  value={value}
                  label="Quando?"
                  showTodayButton
                  todayLabel={"Hoje"}
                  cancelLabel={"Cancelar"}
                  clearable
                  clearLabel={"Limpar"}
                  autoOk
                  required
                  format="dd/MM/yyyy"
                  style={{ width: "32%" }}
                  error={!!errors.operation_date}
                  helperText={errors.operation_date?.message}
                />
              )}
            />
          </MuiPickersUtilsProvider>
        </FormGroup>
        <FormGroup row style={{ marginTop: "10px" }}>
          <Controller
            name="current_currency_conversion_rate"
            control={control}
            defaultValue={initialData.current_currency_conversion_rate}
            render={({ field }) => (
              <TextField
                {...field}
                required
                label="Fator de conversão entre moedas"
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  inputProps: {
                    prefix: "R$ ",
                  },
                }}
                style={{
                  display:
                    isCreditedIncome && assetData?.currency !== "BRL"
                      ? ""
                      : "none",
                }}
                error={!!errors.current_currency_conversion_rate}
                helperText={
                  errors.current_currency_conversion_rate?.message ||
                  `O valor de 1 ${assetData?.currency}, em reais, no dia que o rendimento foi creditado`
                }
              />
            )}
          />
        </FormGroup>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit(onSubmit)} color="primary">
            {!isLoaded ? (
              <CircularProgress size={24} />
            ) : isCreateForm ? (
              "Adicionar"
            ) : (
              "Editar"
            )}
          </Button>
        </DialogActions>
      </form>
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertInfos.message}
        severity={alertInfos.severity}
      />
    </>
  );
};
