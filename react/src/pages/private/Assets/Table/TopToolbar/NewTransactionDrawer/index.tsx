import { FormDrawer } from "../../../../../../design-system";
import NewTransactionForm from "./NewTransactionForm";

const NewTransactionDrawer = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => (
  <FormDrawer
    title="Adicionar transação"
    formId="new-transaction-form-id"
    open={open}
    onClose={onClose}
    FormComponent={NewTransactionForm}
  />
);

export default NewTransactionDrawer;
