import { FormDrawer } from "../../../../../../design-system";
import NewIncomeForm from "./NewIncomeForm";

const NewIncomeDrawer = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => (
  <FormDrawer
    title="Adicionar rendimento"
    formId="new-income-form-id"
    open={open}
    onClose={onClose}
    FormComponent={NewIncomeForm}
  />
);

export default NewIncomeDrawer;
