import { useState } from "react";

import { useForm, Controller } from "react-hook-form";
import NumberFormat from "react-number-format";
import * as yup from "yup";

import DateFnsUtils from "@date-io/date-fns";
import { MuiPickersUtilsProvider, KeyboardDatePicker } from "@material-ui/pickers";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import DialogActions from "@material-ui/core/DialogActions";
import FormControl from "@material-ui/core/FormControl";
import FormGroup from "@material-ui/core/FormGroup";
import FormHelperText from "@material-ui/core/FormHelperText";
import FormLabel from "@material-ui/core/FormLabel";
import Grid from "@material-ui/core/Grid";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import Switch from "@material-ui/core/Switch";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import { yupResolver } from "@hookform/resolvers/yup";

import { ExpensesCategoriesMapping, ExpensesSourcesMapping } from "../consts.js";
import { ExpenseApi } from "../api/core.js";
import { FormFeedback } from "../components/FormFeedback";

function NumberFormatCustom(props) {
    const { inputRef, onChange, ...other } = props;

    return (
        <NumberFormat
            {...other}
            getInputRef={inputRef}
            onValueChange={values => onChange({
                target: {
                    value: values.floatValue
                }
            })}
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
    price: yup.number().required("O preço é obrigatório").positive("Apenas números positivos"),
    created_at: yup.date().required("A data é obrigatória").typeError("Data inválida"),
    is_fixed: yup.boolean().default(false),
    category: yup.string().required("A categoria é obrigatória"),
    source: yup.string().required("A fonte é obrigatória")
})

export const ExpenseForm = ({ initialData, handleClose, showSuccessFeedbackForm, reloadTable }) => {
    const [isLoaded, setIsLoaded] = useState(true);
    const [showAlert, setShowAlert] = useState(false);
    const [alertInfos, setAlertInfos] = useState({});
    // console.log("initialData =", initialData)

    const { control, handleSubmit, formState: { errors, isDirty } } = useForm({
        mode: "all",
        resolver: yupResolver(schema),
    });
    const isCreateForm = Object.keys(initialData).length === 0
    const onSubmit = data => {
        let api = new ExpenseApi(initialData.id)
        const method = isCreateForm ? "post" : "put"
        const actionVerb = isCreateForm ? "criada" : "editada"
        if (isDirty) {
            setIsLoaded(false);
            api[method]({ ...data, created_at: data.created_at.toLocaleDateString("pt-br") })
                .then(() => {
                    showSuccessFeedbackForm(`Despesa ${actionVerb} com sucesso!`);
                    reloadTable();
                    handleClose();
                })
                .catch(error => {
                    setAlertInfos({
                        message: JSON.stringify(error.response.data),
                        severity: "error"
                    });
                    setShowAlert(true);
                })
                .finally(() => {
                    setIsLoaded(true);
                })
            return
        }
        setAlertInfos({
            message: "Você precisa alterar pelo menos um campo!",
            severity: "error"
        });
        setShowAlert(true);
    }

    const expenseCategories = []
    Object.entries(ExpensesCategoriesMapping).forEach(
        ([key, value]) => expenseCategories.push(<MenuItem value={value}>{key}</MenuItem>)
    )

    const expenseSources = []
    Object.entries(ExpensesSourcesMapping).forEach(
        ([key, value]) => expenseSources.push(<MenuItem value={value}>{key}</MenuItem>)
    )

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
                            />)}
                    />
                    <MuiPickersUtilsProvider utils={DateFnsUtils}>
                        <Controller
                            name="created_at"
                            control={control}
                            defaultValue={initialData.date || null}
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
                                    disableFuture
                                    required
                                    format="dd/MM/yyyy"
                                    style={{ width: "30%", marginRight: "7%" }}
                                    error={!!errors.date}
                                    helperText={errors.date?.message}
                                />)}
                        />
                    </MuiPickersUtilsProvider>
                    <FormControl required style={{ width: "30%" }}>
                        <Typography component="div">
                            <FormLabel>Fixo?</FormLabel>
                            <Grid component="label" container alignItems="center" spacing={1}>
                                <Grid item>Não</Grid>
                                <Grid item>
                                    <Controller
                                        name="is_fixed"
                                        control={control}
                                        render={({ field }) => (
                                            <Switch {...field} checked={initialData.isFixed} />
                                        )}
                                    />
                                </Grid>
                                <Grid item>Sim</Grid>
                            </Grid>
                        </Typography>
                    </FormControl>
                </FormGroup>
                <FormGroup row style={{ marginTop: "5px" }}>
                    <FormControl required style={{ width: "48%", marginRight: "2%" }} error={!!errors.category}>
                        <InputLabel id="demo-simple-select-label">Categoria</InputLabel>
                        <Controller
                            name="category"
                            labelId="demo-simple-select-label"
                            control={control}
                            defaultValue={ExpensesCategoriesMapping[initialData.category]}
                            render={({ field }) => (
                                <>
                                    <Select {...field}>{expenseCategories}</Select>
                                    {errors.category?.message && <FormHelperText>{errors.category?.message}</FormHelperText>}
                                </>
                            )}
                        />
                    </FormControl>
                    <FormControl required style={{ width: "48%" }} error={!!errors.category}>
                        <InputLabel id="demo-select-label">Fonte</InputLabel>
                        <Controller
                            name="source"
                            labelId="demo-select-label"
                            control={control}
                            defaultValue={ExpensesSourcesMapping[initialData.source]}
                            render={({ field }) => (
                                <>
                                    <Select {...field}>{expenseSources}</Select>
                                    {errors.source?.message && <FormHelperText>{errors.source?.message}</FormHelperText>}
                                </>
                            )}
                        />
                    </FormControl>
                </FormGroup>
                <DialogActions>
                    <Button onClick={handleClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit(onSubmit)} color="primary">
                        {!isLoaded ? <CircularProgress size={24} /> : isCreateForm ? "Adicionar" : "Editar"}
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
    )
}