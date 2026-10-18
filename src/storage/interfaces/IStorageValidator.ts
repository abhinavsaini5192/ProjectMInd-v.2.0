import type { IStorageProvider } from './IStorageProvider';

export interface IStorageValidator {
  /**
   * Validates if a provider implementation meets minimum requirements.
   */
  validateProvider(provider: IStorageProvider): boolean;
  
  /**
   * Validates if the configuration is safe for the given provider.
   */
  validateConfiguration(provider: IStorageProvider, config: any): boolean;
}

export const IStorageValidatorToken = Symbol('IStorageValidator');
