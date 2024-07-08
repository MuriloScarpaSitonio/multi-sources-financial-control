export type FormData = {
  asset: {
    label: string;
    value: string;
    currency: string;
  };
  price: number;
  quantity?: number;
  total?: number;
};
