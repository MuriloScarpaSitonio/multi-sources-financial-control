import { FormDrawer } from "../../../../../design-system";
import { Transaction } from "../../types";
import EditTransactionForm from "./EditTransactionForm";

const EditTransactionDrawer = ({
  open,
  onClose,
  transaction,
}: {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | undefined;
}) => (
  <FormDrawer
    title={`Editar transação de ${transaction?.asset?.code}`}
    formId="edit-transaction-form-id"
    open={open}
    onClose={onClose}
    FormComponent={EditTransactionForm}
    initialData={transaction}
  />
);

export default EditTransactionDrawer;
