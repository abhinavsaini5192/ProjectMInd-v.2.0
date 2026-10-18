import type { SecurityPrincipal, AuthenticationMethod } from './SecurityPrincipal.js';

export interface AuthenticationResult {
  readonly success: boolean;
  readonly principal?: SecurityPrincipal | undefined;
  readonly authenticationMethod?: AuthenticationMethod | undefined;
  readonly expiresAt?: string | undefined;
  readonly warnings: readonly string[];
  readonly errorCode?: string | undefined;
  readonly errorMessage?: string | undefined;
}

export function createAuthSuccess(
  principal: SecurityPrincipal,
  method: AuthenticationMethod,
  options?: { expiresAt?: string; warnings?: string[] }
): AuthenticationResult {
  return {
    success: true,
    principal,
    authenticationMethod: method,
    expiresAt: options?.expiresAt,
    warnings: options?.warnings ?? [],
  };
}

export function createAuthFailure(
  errorCode: string,
  errorMessage: string,
  warnings: string[] = []
): AuthenticationResult {
  return {
    success: false,
    errorCode,
    errorMessage,
    warnings,
  };
}
