import { yupResolver } from "@hookform/resolvers/yup";
import { MutationFunction, useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { AnyObjectSchema } from "yup";

export const useFormPlus = ({
  mutationFn,
  schema,
  defaultValues,
  onSuccess = () => {},
  onError = () => {},
  context,
}: {
  mutationFn: MutationFunction<any, any>;
  schema: AnyObjectSchema;
  defaultValues: Record<string, any>;
  onSuccess?: (data: unknown, variable: unknown, context: unknown) => void;
  onError?: (error: unknown) => void;
  context?: object;
}) => {
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});

  const {
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isDirty },
    watch,
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    context,
  });
  const { mutate, isPending } = useMutation({
    mutationFn,
    onSuccess,
    onError: (error: any) => {
      setApiErrors(
        Object.fromEntries(
          Object.entries(error.response.data).map(([key, value]) => [
            key,
            (value as string[]).join("; "),
          ]),
        ),
      );
      onError(error);
    },
  });

  const isFieldInvalid = useCallback(
    (field: { name: string }, otherFieldName?: string): boolean => {
      const invalid = (fieldName: string) =>
        !!errors[fieldName] || !!apiErrors[fieldName];
      return otherFieldName
        ? invalid(field.name) || invalid(otherFieldName)
        : invalid(field.name);
    },
    [errors, apiErrors],
  );
  const getFieldHasError = useCallback(
    (fieldName: string): boolean =>
      !!errors[fieldName] || !!apiErrors[fieldName],
    [errors, apiErrors],
  );
  const getErrorMessage = useCallback(
    (fieldName: string): string => {
      const [name, propName] = fieldName.split(".");
      const fieldError = errors[name];
      const error =
        fieldError && propName
          ? (fieldError as { [propName: string]: { message: string } })[
              propName
            ]
          : fieldError;
      return (error?.message || apiErrors[fieldName]) as string;
    },
    [errors, apiErrors],
  );

  return {
    control,
    handleSubmit,
    mutate,
    isPending,
    isFieldInvalid,
    getFieldHasError,
    getErrorMessage,
    isDirty,
    getValues,
    reset,
    watch,
  };
};

export default useFormPlus;
