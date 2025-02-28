import { Income } from "../../types";
import { FormDrawer } from "../../../../../design-system";
import CreateOrEditIncomeForm from "./CreateOrEditIncomeForm";

const CreateOrEditIncomeDrawer = ({
  open,
  onClose,
  variant,
  income,
}: {
  open: boolean;
  onClose: () => void;
  variant: string;
  income?: Income;
}) => (
  <FormDrawer
    title={income ? "Editar rendimento" : "Adicionar rendimento"}
    formId="create-or-edit-income-form-id"
    open={open}
    onClose={onClose}
    FormComponent={CreateOrEditIncomeForm}
    variant={variant}
    initialData={income}
  />
);

export default CreateOrEditIncomeDrawer;
