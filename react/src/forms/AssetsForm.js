import { useState } from "react";

import { useForm, Controller } from "react-hook-form";
import NumberFormat from "react-number-format";
import * as yup from "yup";

import Autocomplete from "@material-ui/lab/Autocomplete";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import DialogActions from "@material-ui/core/DialogActions";
import FormControl from "@material-ui/core/FormControl";
import FormGroup from "@material-ui/core/FormGroup";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Tooltip from "@material-ui/core/Tooltip";
import { yupResolver } from "@hookform/resolvers/yup";

import {
  AssetsObjectivesMapping,
  AssetsSectorsMapping,
  AssetsTypesMapping,
} from "../consts.js";
import { getChoiceByLabel } from "../helpers";
import { AssetsApi } from "../api";
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
      decimalScale={4}
      allowNegative={false}
      isNumericString
    />
  );
}

const schema = yup.object().shape({
  code: yup.string().required("O código é obrigatório"),
  current_price: yup
    .number()
    .required("O preço atual é obrigatório")
    .positive("Apenas números positivos"),
  type: yup
    .object()
    .shape({
      label: yup.string().required("O tipo é obrigatório"),
      value: yup.string().required("O tipo é obrigatório"),
    })
    .required("O tipo é obrigatório")
    .nullable(),
  sector: yup
    .object()
    .shape({
      label: yup.string().required("O setor é obrigatório"),
      value: yup.string().required("O setor é obrigatório"),
    })
    .required("O setor é obrigatório")
    .nullable(),
  objective: yup
    .object()
    .shape({
      label: yup.string().required("O objetivo é obrigatório"),
      value: yup.string().required("O objetivo é obrigatório"),
    })
    .required("O objetivo é obrigatório")
    .nullable(),
});

export const AssetsForm = ({ initialData, handleClose, showFeedbackForm }) => {
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
    let api = new AssetsApi(initialData.code);
    const method = isCreateForm ? "post" : "put";
    const actionVerb = isCreateForm ? "criado" : "editado";
    if (isDirty) {
      setIsLoaded(false);
      api[method]({
        ...data,
        objective: data.objective.value,
        sector: data.sector.value,
        type: data.type.value,
      })
        .then(() => {
          showFeedbackForm(`Ativo ${actionVerb} com sucesso!`);
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
      <form style={{ marginLeft: "10px", marginTop: "5px" }}>
        <FormGroup row>
          <Controller
            name="code"
            control={control}
            defaultValue={initialData.code}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Código"
                required
                style={{ width: "32%", marginRight: "2%" }}
                error={!!errors.code}
                helperText={errors.code?.message}
              />
            )}
          />
          <FormControl
            style={{ width: "32%", marginRight: "2%" }}
            error={!!errors.type}
          >
            <Controller
              name="type"
              control={control}
              defaultValue={getChoiceByLabel(
                initialData.type,
                AssetsTypesMapping
              )}
              render={({ field: { onChange, value } }) => (
                <>
                  <Autocomplete
                    onChange={(_, type) => onChange(type)}
                    value={value}
                    clearText="Limpar"
                    closeText="Fechar"
                    options={AssetsTypesMapping}
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
          <Controller
            name="current_price"
            control={control}
            defaultValue={initialData.current_price}
            render={({ field }) => (
              <Tooltip
                title={
                  initialData.current_price_updated_at
                    ? `Atualizado pela última vez às ${initialData.current_price_updated_at}`
                    : ""
                }
              >
                <TextField
                  {...field}
                  required
                  label="Preço atual"
                  InputProps={{
                    inputComponent: NumberFormatCustom,
                    inputProps: {
                      prefix: initialData?.curency
                        ? initialData?.curency !== "BRL"
                          ? "$ "
                          : "R$ "
                        : initialData?.currencySymbol,
                    },
                  }}
                  style={{ width: "20%", marginRight: "2%" }}
                  error={!!errors.price}
                  helperText={errors.price?.message}
                />
              </Tooltip>
            )}
          />
        </FormGroup>
        <FormGroup row style={{ marginTop: "5px" }}>
          <FormControl
            required
            style={{ width: "32%", marginRight: "2%" }}
            error={!!errors.sector}
          >
            <Controller
              name="sector"
              control={control}
              defaultValue={getChoiceByLabel(
                initialData.sector,
                AssetsSectorsMapping
              )}
              render={({ field: { onChange, value } }) => (
                <>
                  <Autocomplete
                    onChange={(_, sector) => onChange(sector)}
                    value={value}
                    clearText="Limpar"
                    closeText="Fechar"
                    options={AssetsSectorsMapping}
                    getOptionLabel={(option) => option.label}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        required
                        error={!!errors.sector}
                        label="Setor"
                      />
                    )}
                  />
                  {(errors.sector?.message ||
                    errors.sector?.value?.message) && (
                    <FormHelperText>
                      {errors.sector?.message || errors.sector?.value?.message}
                    </FormHelperText>
                  )}
                </>
              )}
            />
          </FormControl>
          <FormControl
            required
            style={{ width: "32%" }}
            error={!!errors.objective}
          >
            <Controller
              name="objective"
              control={control}
              defaultValue={getChoiceByLabel(
                initialData.objective,
                AssetsObjectivesMapping
              )}
              render={({ field: { onChange, value } }) => (
                <>
                  <Autocomplete
                    onChange={(_, objective) => onChange(objective)}
                    value={value}
                    clearText="Limpar"
                    closeText="Fechar"
                    options={AssetsObjectivesMapping}
                    getOptionLabel={(option) => option.label}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        required
                        error={!!errors.objective}
                        label="Objetivo"
                      />
                    )}
                  />
                  {(errors.objective?.message ||
                    errors.objective?.value?.message) && (
                    <FormHelperText>
                      {errors.objective?.message ||
                        errors.objective?.value?.message}
                    </FormHelperText>
                  )}
                </>
              )}
            />
          </FormControl>
        </FormGroup>
        <DialogActions>
          {isCreateForm ? (
            <Button onClick={handleClose}>Cancelar</Button>
          ) : (
            <Button
              onClick={() =>
                showFeedbackForm("Recurso em desenvolvimento", "warning")
              }
              color="secondary"
            >
              Deletar
            </Button>
          )}
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
