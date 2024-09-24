import { FormDrawer } from "../../../../../../design-system";
import { Expense } from "../../../api/models";
import ExpenseForm from "./ExpenseForm";

const ExpenseDrawer = ({
  open,
  onClose,
  expense,
}: {
  open: boolean;
  onClose: () => void;
  expense?: Expense;
}) => (
  <FormDrawer
    title={`${expense ? "Editar" : "Adicionar"} despesa`}
    formId="expense-form-id"
    open={open}
    onClose={onClose}
    FormComponent={ExpenseForm}
    initialData={expense}
  />
);

export default ExpenseDrawer;
