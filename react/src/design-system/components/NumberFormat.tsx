import { type InputBaseComponentProps } from "@mui/material/InputBase";
import { NumericFormat } from "react-number-format";

const NumberFormat = (props: InputBaseComponentProps) => {
  const { onChange, defaultValue, ...other } = props;

  return (
    <NumericFormat
      onValueChange={(values, sourceInfo) => {
        // Only propagate user-driven edits. `react-number-format` also fires
        // onValueChange when the `value` prop changes programmatically (it
        // reformats), which would otherwise loop back through the parent and
        // overwrite a just-reset value.
        if (sourceInfo.source !== "event") return;
        (onChange as (...event: any[]) => void)({
          target: {
            value: values.floatValue,
          },
        });
      }}
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={8}
      allowNegative={false}
      valueIsNumericString
      {...other}
    />
  );
};

export default NumberFormat;
