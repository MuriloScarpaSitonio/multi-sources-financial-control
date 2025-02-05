export const removeProperties = (
  obj: Record<string, any> | undefined,
  keysToRemove: string[],
): Record<string, any> | undefined => {
  if (!obj) return;
  return keysToRemove.reduce(
    (acc, key) => {
      const { [key]: removed, ...rest } = acc; // Use destructuring to remove the key
      return rest;
    },
    { ...obj },
  );
};
