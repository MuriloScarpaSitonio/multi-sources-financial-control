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
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormGroup from "@material-ui/core/FormGroup";
import FormHelperText from "@material-ui/core/FormHelperText";
import Radio from "@material-ui/core/Radio";
import RadioGroup from "@material-ui/core/RadioGroup";
import TextField from "@material-ui/core/TextField";

import { yupResolver } from "@hookform/resolvers/yup";

import { AssetsApi, TransactionsApi } from "../api";
import { getChoiceByLabel } from "../helpers";
import { FormFeedback } from "../components/FormFeedback";
import { TransactionsActionsMapping } from "../consts.js";

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
      decimalScale={4}
      allowNegative={false}
      isNumericString
    />
  );
}

const schema = yup.object().shape({
  asset_code: yup
    .object()
    .shape({
      label: yup.string().required("O ativo é obrigatório"),
      value: yup.string().required("O ativo é obrigatório"),
    })
    .required("O ativo é obrigatório")
    .nullable(),
  action: yup
    .string()
    .required("A ação é obrigatória")
    .matches(/(BUY|SELL)/, "Apenas compra e venda são ações válidas"),
  price: yup
    .number()
    .required("O preço é obrigatório")
    .positive("Apenas números positivos"),
  initial_price: yup.number().positive("Apenas números positivos"),
  quantity: yup
    .number()
    .required("A quantidade é obrigatória")
    .positive("Apenas números positivos"),
  operation_date: yup
    .date()
    .required("A data é obrigatória")
    .typeError("Data inválida"),
});

export const TransactionForm = ({
  initialData,
  handleClose,
  reloadTable,
  assetCurrency,
}) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [codes, setCodes] = useState([]);
  const [showAlert, setShowAlert] = useState(false);

  let initialAction =
    getChoiceByLabel(initialData.action, TransactionsActionsMapping)?.value ||
    "BUY";
  const [isSellTransaction, setIsSellTransaction] = useState(
    initialAction === "SELL" || false
  );
  const [alertInfos, setAlertInfos] = useState({});

  let api = new AssetsApi();

  useEffect(
    () =>
      api.getCodesAndCurrencies().then((response) => {
        setCodes(
          response.data.map((asset) => ({
            label: asset.code,
            value: asset.code,
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
  } = useForm({
    mode: "all",
    resolver: yupResolver(schema),
  });
  const isCreateForm = Object.keys(initialData).length === 0;
  const onSubmit = (data) => {
    const method = isCreateForm ? "post" : "put";
    const actionVerb = isCreateForm ? "criada" : "editada";
    if (isDirty) {
      setIsLoaded(false);
      new TransactionsApi(initialData.id)
        [method]({
          ...data,
          asset_code: data.asset_code.value,
          operation_date: data.operation_date.toLocaleDateString("pt-br"),
        })
        .then(() => {
          setAlertInfos({
            message: `Transação ${actionVerb} com sucesso!`,
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

  return (
    <>
      <form>
        <FormGroup row>
          <FormControl
            style={{ width: "47%", marginRight: "2%" }}
            error={!!errors.asset_code}
          >
            <Controller
              name="asset_code"
              control={control}
              defaultValue={
                initialData.asset_code
                  ? {
                      value: initialData.asset_code,
                      label: initialData.asset_code,
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
                        error={!!errors.asset_code}
                        required
                        label="Ativo"
                      />
                    )}
                  />
                  {(errors.asset_code?.message ||
                    errors.asset_code?.value?.message) && (
                    <FormHelperText>
                      {errors.asset_code?.message ||
                        errors.asset_code?.value?.message}
                    </FormHelperText>
                  )}
                </>
              )}
            />
          </FormControl>
          <FormControl style={{ width: "40%" }} error={!!errors.action}>
            <Controller
              name="action"
              control={control}
              defaultValue={initialAction}
              render={({ field: { onChange, value } }) => (
                <>
                  <RadioGroup
                    value={value}
                    required
                    row
                    onChange={(_, v) => {
                      setIsSellTransaction(v === "SELL");
                      onChange(v);
                    }}
                  >
                    <FormControlLabel
                      value="BUY"
                      control={<Radio color="default" size="small" />}
                      label="Compra"
                    />
                    <FormControlLabel
                      value="SELL"
                      control={<Radio color="default" size="small" />}
                      label="Venda"
                    />
                  </RadioGroup>
                  {errors.action?.message && (
                    <FormHelperText>{errors.action?.message}</FormHelperText>
                  )}
                </>
              )}
            />
          </FormControl>
        </FormGroup>
        <FormGroup row style={{ marginTop: "10px" }}>
          <Controller
            name="quantity"
            control={control}
            defaultValue={initialData.quantity}
            render={({ field }) => (
              <TextField
                {...field}
                required
                label="Quantidade"
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  inputProps: { prefix: "" },
                }}
                style={{ width: "32%", marginRight: "2%" }}
                error={!!errors.quantity}
                helperText={errors.quantity?.message}
              />
            )}
          />
          <Controller
            name="price"
            control={control}
            defaultValue={initialData.price}
            render={({ field }) => (
              <TextField
                {...field}
                required
                label="Preço"
                InputProps={{
                  inputComponent: NumberFormatCustom,
                  inputProps: {
                    prefix: assetCurrency === "BRL" ? "R$ " : "$ ",
                  },
                }}
                style={{ width: "32%" }}
                error={!!errors.price}
                helperText={errors.price?.message}
              />
            )}
          />
        </FormGroup>
        <FormGroup row style={{ marginTop: "15px" }}>
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
                  style={{ width: "32%", marginRight: "2%" }}
                  error={!!errors.operation_date}
                  helperText={errors.operation_date?.message}
                />
              )}
            />
          </MuiPickersUtilsProvider>
          <Controller
            name="initial_price"
            control={control}
            defaultValue={initialData.initial_price}
            render={({ field }) => (
              <>
                <TextField
                  {...field}
                  label="Preço inicial"
                  InputProps={{
                    inputComponent: NumberFormatCustom,
                    inputProps: {
                      prefix: assetCurrency === "BRL" ? "R$ " : "$ ",
                    },
                  }}
                  style={{
                    width: "32%",
                    marginRight: "2%",
                    display: isSellTransaction ? "" : "none",
                  }}
                  error={!!errors.initial_price}
                  helperText={
                    errors.initial_price?.message ||
                    "Se não informado, será usado o preço médio do ativo"
                  }
                />
              </>
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
