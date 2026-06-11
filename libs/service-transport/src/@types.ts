export type ServiceResponse<T = any> = {
  message: string;
  code: string;
  data?: T;
};
