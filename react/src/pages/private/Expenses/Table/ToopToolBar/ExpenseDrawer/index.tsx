import { FormDrawer } from "../../../../../../design-system";
import ExpenseForm from "./ExpenseForm";

const ExpenseDrawer = ({
  open,
  isAdding,
  onClose,
}: {
  open: boolean;
  isAdding: boolean;
  onClose: () => void;
}) => (
  <FormDrawer
    title={`${isAdding ? "Adicionar" : "Atualizar"} despesa`}
    formId="expense-form-id"
    open={open}
    onClose={onClose}
    FormComponent={ExpenseForm}
  />
);

export default ExpenseDrawer;
