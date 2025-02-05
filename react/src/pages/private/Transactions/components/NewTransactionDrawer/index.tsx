import { FormDrawer } from "../../../../../design-system";
import NewTransactionForm from "./NewTransactionForm";

const NewTransactionDrawer = ({
  open,
  onClose,
  variant,
}: {
  open: boolean;
  onClose: () => void;
  variant: string;
}) => (
  <FormDrawer
    title="Adicionar transação"
    formId="new-transaction-form-id"
    open={open}
    onClose={onClose}
    FormComponent={NewTransactionForm}
    variant={variant}
  />
);

export default NewTransactionDrawer;
