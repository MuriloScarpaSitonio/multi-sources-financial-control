import { useState } from "react";

import { ptBR } from "date-fns/locale/pt-BR";
import { useForm, Controller } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import * as yup from "yup";

import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import DialogActions from "@mui/material/DialogActions";
import FormGroup from "@mui/material/FormGroup";
import TextField from "@mui/material/TextField";
import { yupResolver } from "@hookform/resolvers/yup";

import { RevenuesApi } from "../api";
import { FormFeedback } from "../components/FormFeedback";

function NumberFormatCustom(props) {
  const { inputRef, onChange, ...other } = props;

  return (
    <NumericFormat
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
      valueIsNumericString
      prefix="R$ "
    />
  );
}

const schema = yup.object().shape({
  description: yup.string().required("A descrição é obrigatória"),
  value: yup
    .number()
    .required("O valor é obrigatório")
    .positive("Apenas números positivos"),
  created_at: yup
    .date()
    .required("A data é obrigatória")
    .typeError("Data inválida"),
});

export const RevenuesForm = ({ initialData, handleClose, reloadTable }) => {
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
    let api = new RevenuesApi(initialData.id);
    const method = isCreateForm ? "post" : "put";
    const actionVerb = isCreateForm ? "criada" : "editada";
    if (isDirty) {
      setIsLoaded(false);
      api[method]({
        ...data,
        created_at: data.created_at.toLocaleDateString("pt-br"),
      })
        .then(() => {
          setAlertInfos({
            message: `Receita ${actionVerb} com sucesso!`,
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
            name="value"
            control={control}
            defaultValue={initialData.value}
            render={({ field }) => (
              <TextField
                {...field}
                required
                label="Valor"
                InputProps={{
                  inputComponent: NumberFormatCustom,
                }}
                style={{ width: "48%", marginRight: "2%" }}
                error={!!errors.value}
                helperText={errors.value?.message}
              />
            )}
          />
          <LocalizationProvider
            dateAdapter={AdapterDateFns}
            adapterLocale={ptBR}
          >
            <Controller
              name="created_at"
              control={control}
              defaultValue={
                initialData.created_at
                  ? // make sure to include hours and minutes to adjust timezone
                    new Date(initialData.created_at + "T00:00")
                  : new Date()
              }
              render={({ field: { onChange, value } }) => (
                <DatePicker
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
                  style={{ width: "50%" }}
                  error={!!errors.created_at}
                  helperText={errors.created_at?.message}
                />
              )}
            />
          </LocalizationProvider>
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
