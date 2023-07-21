import { useState } from "react";

import { useForm, Controller } from "react-hook-form";
import * as yup from "yup";

import Autocomplete from "@material-ui/lab/Autocomplete";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControl from "@material-ui/core/FormControl";
import FormGroup from "@material-ui/core/FormGroup";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import { yupResolver } from "@hookform/resolvers/yup";

import {
  AssetsObjectivesMapping,
  AssetsTypesMapping,
  CurrenciesAssetTypesMapping,
  CurrenciesMapping,
} from "../consts.js";
import { getChoiceByLabel, getChoiceByValue } from "../helpers";
import { AssetsApi } from "../api";
import { FormFeedback } from "../components/FormFeedback";

const schema = yup.object().shape({
  code: yup.string().required("O código é obrigatório"),
  type: yup
    .object()
    .shape({
      label: yup.string().required("O tipo é obrigatório"),
      value: yup.string().required("O tipo é obrigatório"),
    })
    .required("O tipo é obrigatório")
    .nullable(),
  objective: yup
    .object()
    .shape({
      label: yup.string().required("O objetivo é obrigatório"),
      value: yup.string().required("O objetivo é obrigatório"),
    })
    .required("O objetivo é obrigatório")
    .nullable(),
  currency: yup
    .object()
    .shape({
      label: yup.string().required("A moeda é obrigatória"),
      value: yup
        .string()
        .required("A moeda é obrigatória")
        .matches(/(BRL|USD)/, "Apenas real e dólar são moedas válidas"),
    })
    .required("A moeda é obrigatória")
    .nullable(),
});

const AssetDeleteDialog = ({ initialData, open, onClose, onSuccess }) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const onDelete = () => {
    setIsLoaded(false);
    new AssetsApi(initialData.id)
      .delete()
      .then(() => {
        setAlertInfos({
          message: "Ativo deletado com sucesso!",
          severity: "success",
        });
        setShowAlert(true);
        onSuccess();
        onClose();
      })
      .catch((error) => {
        setAlertInfos({
          message: JSON.stringify(error.response.data),
          severity: "error",
        });
        setShowAlert(true);
      })
      .finally(() => setIsLoaded(true));
  };
  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        aria-labelledby="expense-delete-form-dialog-title"
      >
        <DialogTitle id="expense-delete-form-dialog-title">
          {`Tem certeza que deseja deletar o ativo ${initialData.code}?`}
        </DialogTitle>
        <DialogContent>
          <b>
            ATENÇÃO: TODAS AS TRANSFERÊNCIAS E RENDIMENTOS TAMBÉM SERÃO
            EXCLUÍDOS!
          </b>
          <DialogActions>
            <Button onClick={onClose}>Cancelar</Button>
            <Button color="secondary" onClick={onDelete}>
              {!isLoaded ? <CircularProgress size={24} /> : "Deletar"}
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertInfos.message}
        severity={alertInfos.severity}
      />
    </>
  );
};

export const AssetsForm = ({ initialData, onClose, onSuccess }) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const [deleteDialogIsOpened, setDeleteDialogIsOpened] = useState(false);

  let initialType = getChoiceByLabel(
    initialData.type,
    AssetsTypesMapping
  )?.value;
  const [isCrypto, setIsCrypto] = useState(initialType === "CRYPTO" || false);

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
    const actionVerb = isCreateForm ? "criado" : "editado";
    if (isDirty) {
      let c = isCrypto
        ? data.currency.value
        : CurrenciesAssetTypesMapping[data.type.value];

      setIsLoaded(false);
      new AssetsApi(initialData.id)
        [method]({
          ...data,
          objective: data.objective.value,
          type: data.type.value,
          currency: c,
        })
        .then(() => {
          setAlertInfos({
            message: `Ativo ${actionVerb} com sucesso!`,
            severity: "success",
          });
          setShowAlert(true);
          onSuccess();
        })
        .catch((error) => {
          setAlertInfos({
            message: JSON.stringify(error.response.data),
            severity: "error",
          });
          setShowAlert(true);
        })
        .finally(() => setIsLoaded(true));
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
                style={{ width: "35%", marginRight: "2%" }}
                error={!!errors.code}
                helperText={errors.code?.message}
                inputProps={{ style: { textTransform: "uppercase" } }}
              />
            )}
          />
          <FormControl
            required
            style={{ width: "55%" }}
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
        <FormGroup row style={{ marginTop: "10px" }}>
          <FormControl
            style={{ width: "92%", marginTop: "5px" }}
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
                    onChange={(_, type) => {
                      setIsCrypto(type.value === "CRYPTO");
                      onChange(type);
                    }}
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
        </FormGroup>
        <FormGroup row style={{ marginTop: "10px" }}>
          <FormControl
            style={{ width: "35%", marginRight: "2%" }}
            error={!!errors.currency}
          >
            <Controller
              name="currency"
              control={control}
              defaultValue={
                getChoiceByValue(initialData.currency, CurrenciesMapping) ||
                CurrenciesMapping[0]
              }
              render={({ field: { onChange, value } }) => (
                <>
                  <Autocomplete
                    onChange={(_, currency) => onChange(currency)}
                    value={value}
                    clearText="Limpar"
                    closeText="Fechar"
                    options={CurrenciesMapping}
                    getOptionLabel={(option) => option.label}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        error={!!errors.currency}
                        required
                        label="Moeda"
                        style={{
                          display: isCrypto ? "" : "none",
                        }}
                      />
                    )}
                  />
                  {(errors.currency?.message ||
                    errors.currency?.value?.message) && (
                    <FormHelperText>
                      {errors.currency?.message ||
                        errors.currency?.value?.message}
                    </FormHelperText>
                  )}
                </>
              )}
            />
          </FormControl>
        </FormGroup>
        <DialogActions>
          {isCreateForm ? (
            <Button onClick={onClose}>Cancelar</Button>
          ) : (
            <Button
              onClick={() => setDeleteDialogIsOpened(true)}
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
      <AssetDeleteDialog
        initialData={initialData}
        open={deleteDialogIsOpened}
        onClose={() => setDeleteDialogIsOpened(false)}
        onSuccess={onSuccess}
      />
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertInfos.message}
        severity={alertInfos.severity}
      />
    </>
  );
};
