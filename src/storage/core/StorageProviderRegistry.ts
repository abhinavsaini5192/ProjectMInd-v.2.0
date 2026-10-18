import type { IStorageProvider } from '../interfaces/IStorageProvider';
import { StorageProviderType } from '../types/StorageTypes';
import { ProviderRegistrationError } from '../types/StorageErrors';

export class StorageProviderRegistry {
  private providersByName = new Map<string, IStorageProvider>();
  private defaultProvidersByType = new Map<StorageProviderType, IStorageProvider>();

  register(provider: IStorageProvider, isDefault: boolean = false): void {
    if (this.providersByName.has(provider.name)) {
      throw new ProviderRegistrationError(`Provider with name '${provider.name}' is already registered.`);
    }

    this.providersByName.set(provider.name, provider);

    // If it's the first of its type, or marked as default, set it as the default for that type.
    if (isDefault || !this.defaultProvidersByType.has(provider.type)) {
      this.defaultProvidersByType.set(provider.type, provider);
    }
  }

  getByName(name: string): IStorageProvider | undefined {
    return this.providersByName.get(name);
  }

  getByType(type: StorageProviderType): IStorageProvider | undefined {
    return this.defaultProvidersByType.get(type);
  }

  getAll(): IStorageProvider[] {
    return Array.from(this.providersByName.values());
  }
}

export const IStorageProviderRegistryToken = Symbol('StorageProviderRegistry');
