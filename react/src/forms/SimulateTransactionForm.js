import { useEffect, useState } from "react";

import { useForm, Controller } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import * as yup from "yup";

import Autocomplete from "@mui/lab/Autocomplete";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import FormGroup from "@mui/material/FormGroup";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import { yupResolver } from "@hookform/resolvers/yup";

import { AssetsApi, AssetTransactionsApi } from "../api";

const SimulateTransactionResponseDialog = ({
  open,
  onClose,
  formData,
  responseData,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="simulate-transaction-response-dialog-title"
    >
      <DialogTitle id="simulate-transaction-response-dialog-title">
        {`Simulação - ${formData.asset?.label}`}
      </DialogTitle>
      <DialogContent>
        {formData.quantity ? (
          <DialogContentText>{`${formData.quantity?.toLocaleString(
            "pt-br",
          )} ativos por ${formData.currency} ${formData.price?.toLocaleString(
            "pt-br",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            },
          )} (${formData.currency} ${(
            formData.price * formData.quantity
          )?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })})`}</DialogContentText>
        ) : (
          <DialogContentText>{`Total de ${
            formData.currency
          } ${formData.total?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })} por ${formData.currency} ${formData.price?.toLocaleString(
            "pt-br",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            },
          )}  (${(formData.total / formData.price)?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })} ativos)`}</DialogContentText>
        )}

        <TableContainer>
          <Table size="small" aria-label="a dense table">
            <TableHead>
              <TableRow>
                <TableCell>Situação</TableCell>
                <TableCell align="right">PM</TableCell>
                <TableCell align="right">ROI</TableCell>
                <TableCell align="right">ROI %</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow key="old">
                <TableCell component="th" scope="row">
                  Atual
                </TableCell>
                <TableCell align="right">
                  {`${
                    formData.currency
                  } ${responseData.old?.adjusted_avg_price?.toLocaleString(
                    "pt-br",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    },
                  )}`}
                </TableCell>
                <TableCell align="right">
                  {`R$ ${responseData.old?.roi?.toLocaleString("pt-br", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                </TableCell>
                <TableCell align="right">
                  {`${responseData.old?.roi_percentage?.toLocaleString(
                    "pt-br",
                    {
                      minimumFractionDigits: 2,
                    },
                  )}%`}
                </TableCell>
                <TableCell align="right">
                  {`R$ ${responseData.old?.normalized_total_invested?.toLocaleString(
                    "pt-br",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}`}
                </TableCell>
              </TableRow>
              <TableRow key="new">
                <TableCell component="th" scope="row">
                  Simulada
                </TableCell>
                <TableCell align="right">
                  {`${
                    formData.currency
                  } ${responseData.new?.adjusted_avg_price?.toLocaleString(
                    "pt-br",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    },
                  )}`}
                </TableCell>
                <TableCell align="right">
                  {`R$ ${responseData.new?.roi?.toLocaleString("pt-br", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                </TableCell>
                <TableCell align="right">
                  {`${responseData.new?.roi_percentage?.toLocaleString(
                    "pt-br",
                    {
                      minimumFractionDigits: 2,
                    },
                  )}%`}
                </TableCell>
                <TableCell align="right">
                  {`R$ ${responseData.new?.normalized_total_invested?.toLocaleString(
                    "pt-br",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}`}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

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
      decimalScale={8}
      allowNegative={false}
      valueIsNumericString
    />
  );
}

const schema = yup.object().shape(
  {
    asset: yup
      .object()
      .shape({
        label: yup.string().required("O ativo é obrigatório"),
        value: yup.string().required("O ativo é obrigatório"),
      })
      .required("O ativo é obrigatório")
      .nullable(),
    price: yup
      .number()
      .required("O preço é obrigatório")
      .positive("Apenas números positivos"),
    quantity: yup.number().when("total", {
      to: (total) => !total,
      then: (schema) =>
        schema
          .required("Se 'Total' não for inserido, 'Quantidade' é obrigatório")
          .positive("Apenas números positivos"),
      otherwise: (schema) => schema.positive("Apenas números positivos"),
    }),
    total: yup.number().when("quantity", {
      to: (quantity) => !quantity,
      then: (schema) =>
        schema
          .required("Se 'Quantidade' não for inserido, 'Total' é obrigatório")
          .positive("Apenas números positivos"),
      otherwise: (schema) => schema.positive("Apenas números positivos"),
    }),
  },
  [["total", "quantity"]],
);

export const SimulateTransactionForm = ({ handleClose }) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [responseDialogIsOpened, setResponseDialogIsOpened] = useState(false);
  const [codes, setCodes] = useState([]);
  const [responseData, setResponseData] = useState({});
  const [formData, setFormData] = useState({});

  useEffect(
    () => {
      new AssetsApi().getMinimalData().then((response) => {
        setCodes(
          response.data.map((asset) => ({
            label: asset.code,
            value: asset.pk,
            currency: asset.currency
              ? asset.currency === "BRL"
                ? "R$"
                : "$"
              : "",
          })),
        );
      });
    },
    // .catch((error) => {})
    [],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    mode: "all",
    resolver: yupResolver(schema),
  });

  const onSubmit = (data) => {
    setFormData(data);
    const { asset, ...result } = data;
    new AssetTransactionsApi(asset.value)
      .simulate(result)
      .then((response) => {
        setResponseData(response.data);
        setResponseDialogIsOpened(true);
      })
      // .catch((error) => {})
      .finally(() => setIsLoaded(true));
  };

  let assetObj = watch("asset");
  return (
    <>
      <form>
        <FormGroup row>
          <FormControl
            style={{ width: "48%", marginRight: "2%" }}
            error={!!errors.asset}
          >
            <Controller
              name="asset"
              control={control}
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
          <FormControl style={{ width: "48%" }}>
            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  label="Preço"
                  InputProps={{
                    inputComponent: NumberFormatCustom,
                    inputProps: { prefix: assetObj?.currency },
                  }}
                  style={{ width: "100%" }}
                  error={!!errors.price}
                  helperText={errors.price?.message}
                />
              )}
            />
          </FormControl>
        </FormGroup>
        <FormGroup row style={{ marginTop: "10px" }}>
          <FormControl style={{ width: "48%", marginRight: "2%" }}>
            <Controller
              name="quantity"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Quantidade"
                  InputProps={{
                    inputComponent: NumberFormatCustom,
                  }}
                  error={!!errors.quantity}
                  helperText={errors.quantity?.message}
                />
              )}
            />
          </FormControl>
          <FormControl style={{ width: "48%" }}>
            <Controller
              name="total"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Total"
                  InputProps={{
                    inputComponent: NumberFormatCustom,
                    inputProps: { prefix: assetObj?.currency },
                  }}
                  error={!!errors.total}
                  helperText={errors.total?.message}
                />
              )}
            />
          </FormControl>
        </FormGroup>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit(onSubmit)} color="primary">
            {!isLoaded ? <CircularProgress size={24} /> : "Simular"}
          </Button>
        </DialogActions>
      </form>
      <SimulateTransactionResponseDialog
        open={responseDialogIsOpened}
        onClose={() => setResponseDialogIsOpened(false)}
        responseData={responseData}
        formData={{ ...formData, currency: assetObj?.currency }}
      />
    </>
  );
};
