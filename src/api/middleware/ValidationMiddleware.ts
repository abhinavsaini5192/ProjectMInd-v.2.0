import type { ApiMiddleware } from './ApiMiddleware.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import { ApiError } from '../errors/ApiError.js';

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors?: Array<{ readonly field: string; readonly message: string }> | undefined;
}

export type RequestValidator = (request: ApiRequest) => ValidationResult | Promise<ValidationResult>;

export function createValidationMiddleware(validator: RequestValidator): ApiMiddleware {
  return async (request, next) => {
    const result = await validator(request);
    if (!result.valid) {
      throw ApiError.badRequest('Request validation failed', 'One or more fields failed validation', result.errors);
    }
    return next();
  };
}
