import { FormDrawer } from "../../../../../design-system";
import { Revenue } from "../../models";
import RevenueForm from "./RevenueForm";

const RevenueDrawer = ({
  open,
  onClose,
  revenue,
}: {
  open: boolean;
  onClose: () => void;
  revenue?: Revenue;
}) => (
  <FormDrawer
    title={`${revenue ? "Editar" : "Adicionar"} receita`}
    formId="revenue-form-id"
    open={open}
    onClose={onClose}
    FormComponent={RevenueForm}
    initialData={revenue}
  />
);

export default RevenueDrawer;
