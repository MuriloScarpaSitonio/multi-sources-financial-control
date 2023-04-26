import { useState } from "react";

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
import FormLabel from "@material-ui/core/FormLabel";
import Grid from "@material-ui/core/Grid";
import Switch from "@material-ui/core/Switch";
import TextField from "@material-ui/core/TextField";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import { yupResolver } from "@hookform/resolvers/yup";

import {
  ExpensesCategoriesMapping,
  ExpensesSourcesMapping,
} from "../consts.js";
import { getChoiceByLabel } from "../helpers";
import { ExpensesApi } from "../api";
import { FormFeedback } from "../components/FormFeedback";

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
      prefix="R$ "
    />
  );
}

const schema = yup.object().shape({
  description: yup.string().required("A descrição é obrigatória"),
  price: yup
    .number()
    .required("O preço é obrigatório")
    .positive("Apenas números positivos"),
  created_at: yup
    .date()
    .required("A data é obrigatória")
    .typeError("Data inválida"),
  is_fixed: yup.boolean().default(false),
  category: yup
    .object()
    .shape({
      label: yup.string().required("A categoria é obrigatória"),
      value: yup.string().required("A categoria é obrigatória"),
    })
    .required("A categoria é obrigatória")
    .nullable(),
  source: yup
    .object()
    .shape({
      label: yup.string().required("A fonte é obrigatória"),
      value: yup.string().required("A fonte é obrigatória"),
    })
    .required("A fonte é obrigatória")
    .nullable(),
  installments: yup.number().when("is_fixed", {
    is: true,
    then: yup
      .number()
      .positive("Apenas números positivos")
      .min(1, "Despesas fixas não podem ser parceladas")
      .max(1, "Despesas fixas não podem ser parceladas")
      .typeError("Por favor, inclua um valor"),
    otherwise: yup
      .number()
      .positive("Apenas números positivos")
      .typeError("Por favor, inclua um valor"),
  }),
});

export const ExpenseForm = ({ initialData, handleClose, reloadTable }) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

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
    let api = new ExpensesApi(initialData.id);
    const method = isCreateForm ? "post" : "put";
    const actionVerb = isCreateForm ? "criada" : "editada";
    if (isDirty) {
      setIsLoaded(false);
      api[method]({
        ...data,
        created_at: data.created_at.toLocaleDateString("pt-br"),
        category: data.category.value,
        source: data.source.value,
      })
        .then(() => {
          setAlertInfos({
            message: `Despesa ${actionVerb} com sucesso!`,
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
          <Controller
            name="description"
            control={control}
            defaultValue={initialData.description}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Descrição"
                required
                style={{ width: "100%" }}
                error={!!errors.description}
                helperText={errors.description?.message}
              />
            )}
          />
        </FormGroup>
        <FormGroup row style={{ marginTop: "10px" }}>
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
                }}
                style={{ width: "30%", marginRight: "2%" }}
                error={!!errors.price}
                helperText={errors.price?.message}
              />
            )}
          />
          <MuiPickersUtilsProvider utils={DateFnsUtils}>
            <Controller
              name="created_at"
              control={control}
              defaultValue={initialData.date || new Date()}
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
                  style={{ width: "30%", marginRight: "2%" }}
                  error={!!errors.created_at}
                  helperText={errors.created_at?.message}
                />
              )}
            />
          </MuiPickersUtilsProvider>
          <FormControl required style={{ width: "30%", marginLeft: "6%" }}>
            <Typography component="div">
              <FormLabel style={{ marginLeft: "28%" }}>Fixo?</FormLabel>
              <Grid component="label" container alignItems="center" spacing={1}>
                <Grid item>Não</Grid>
                <Grid item>
                  <Controller
                    name="is_fixed"
                    control={control}
                    defaultValue={initialData.isFixed}
                    render={({ field: { value, onChange } }) => (
                      <Switch
                        color="primary"
                        checked={value}
                        onChange={(_, data) => onChange(data)}
                      />
                    )}
                  />
                </Grid>
                <Grid item>Sim</Grid>
              </Grid>
            </Typography>
          </FormControl>
        </FormGroup>
        <FormGroup row style={{ marginTop: "5px" }}>
          <FormControl
            style={{ width: "30%", marginRight: "2%" }}
            error={!!errors.category}
          >
            <Controller
              name="category"
              control={control}
              defaultValue={getChoiceByLabel(
                initialData.category,
                ExpensesCategoriesMapping
              )}
              render={({ field: { onChange, value } }) => (
                <>
                  <Autocomplete
                    onChange={(_, category) => onChange(category)}
                    value={value}
                    clearText="Limpar"
                    closeText="Fechar"
                    options={ExpensesCategoriesMapping}
                    getOptionLabel={(option) => option.label}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        error={!!errors.category}
                        required
                        label="Categoria"
                      />
                    )}
                  />
                  {(errors.category?.message ||
                    errors.category?.value?.message) && (
                    <FormHelperText>
                      {errors.category?.message ||
                        errors.category?.value?.message}
                    </FormHelperText>
                  )}
                </>
              )}
            />
          </FormControl>
          <FormControl
            required
            style={{ width: "42%", marginRight: "2%" }}
            error={!!errors.source}
          >
            <Controller
              name="source"
              control={control}
              defaultValue={getChoiceByLabel(
                initialData.source,
                ExpensesSourcesMapping
              )}
              render={({ field: { onChange, value } }) => (
                <>
                  <Autocomplete
                    onChange={(_, source) => onChange(source)}
                    value={value}
                    clearText="Limpar"
                    closeText="Fechar"
                    options={ExpensesSourcesMapping}
                    getOptionLabel={(option) => option.label}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        required
                        error={!!errors.source}
                        label="Fonte"
                      />
                    )}
                  />
                  {(errors.source?.message ||
                    errors.source?.value?.message) && (
                    <FormHelperText>
                      {errors.source?.message || errors.source?.value?.message}
                    </FormHelperText>
                  )}
                </>
              )}
            />
          </FormControl>
          <Tooltip title="Se for uma despesa parcelada, coloque o valor completo da compra (e não da parcela)">
            <FormControl style={{ width: "18%" }}>
              <Controller
                name="installments"
                control={control}
                defaultValue={1}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Parcelas"
                    type="number"
                    InputProps={{ inputProps: { min: 1 } }}
                    error={!!errors.installments}
                    helperText={errors.installments?.message}
                  />
                )}
              />
            </FormControl>
          </Tooltip>
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
