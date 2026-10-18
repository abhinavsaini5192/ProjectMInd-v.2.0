import type { IStorageValidator } from '../interfaces/IStorageValidator';
import type { IStorageProvider } from '../interfaces/IStorageProvider';
import { StorageValidationError } from '../types/StorageErrors';

export class StorageValidator implements IStorageValidator {
  validateProvider(provider: IStorageProvider): boolean {
    if (!provider.name || provider.name.trim() === '') {
      throw new StorageValidationError('Provider must have a valid name.');
    }
    if (!provider.type) {
      throw new StorageValidationError(`Provider '${provider.name}' must have a valid StorageProviderType.`);
    }
    return true;
  }

  validateConfiguration(provider: IStorageProvider, config: any): boolean {
    if (!config) {
      throw new StorageValidationError(`Configuration for '${provider.name}' cannot be null.`);
    }
    return true;
  }
}

export { IStorageValidatorToken } from '../interfaces/IStorageValidator';
