export type ListQuery = {
  from?: number;
  to?: number;
  orders?: string;
  where?: string;
};

export type Response<T = unknown> = {
  data: T;
};
