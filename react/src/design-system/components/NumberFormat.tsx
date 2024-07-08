import { type InputBaseComponentProps } from "@mui/material/InputBase";
import { NumericFormat } from "react-number-format";

const NumberFormat = (props: InputBaseComponentProps) => {
  const { onChange, defaultValue, ...other } = props;

  return (
    <NumericFormat
      onValueChange={(values) =>
        (onChange as (...event: any[]) => void)({
          target: {
            value: values.floatValue,
          },
        })
      }
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
