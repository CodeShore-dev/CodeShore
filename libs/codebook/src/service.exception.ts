import { ServiceCode } from './service-code.enum';

export class ServiceException extends Error {
  readonly code: ServiceCode;
  readonly detail?: Record<string, unknown>;

  constructor(code: ServiceCode, message?: string, detail?: Record<string, unknown>) {
    super(message ?? code);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'ServiceException';
    this.code = code;
    this.detail = detail;
  }
}
