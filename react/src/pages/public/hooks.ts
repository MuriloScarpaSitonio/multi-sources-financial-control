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
}: {
  mutationFn: MutationFunction;
  schema: AnyObjectSchema;
  defaultValues: Record<string, any>;
  onSuccess: (data: unknown, variable: unknown, context: unknown) => void;
  onError?: (error: unknown) => void;
}) => {
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: defaultValues,
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  console.log(schema);
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
    (fieldName: string) => !!errors[fieldName] || !!apiErrors[fieldName],
    [errors, apiErrors],
  );
  const getErrorMessage = useCallback(
    (fieldName: string): string =>
      (errors[fieldName]?.message || apiErrors[fieldName]) as string,
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
  };
};
