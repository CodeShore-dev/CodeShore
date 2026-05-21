export type ServiceResponse<T = any> = {
  message: string;
  code: number;
  data: T;
};
