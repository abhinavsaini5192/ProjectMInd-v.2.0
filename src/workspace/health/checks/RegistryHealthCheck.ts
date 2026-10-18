import type { IHealthCheck } from '../IHealthCheck.js';
import type { IRegistryStore } from '../../interfaces/storage/IRegistryStore.js';
import type { ILogger } from '../../interfaces/ILogger.js';

export class RegistryHealthCheck implements IHealthCheck {
  name = 'RegistryHealthCheck';
  private errors: any[] = [];

  constructor(private registryStore: IRegistryStore, private logger: ILogger) {}

  async execute(): Promise<boolean> {
    this.errors = [];
    try {
      const all = await this.registryStore.listAll();
      if (!all) {
         this.errors.push({ code: 'REG_01', message: 'Registry returned null', severity: 'critical' });
         return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error({ component: this.name, operation: 'execute', message: err.message, severity: 'ERROR' });
      this.errors.push({ code: 'REG_02', message: `Registry query failed: ${err.message}`, severity: 'critical' });
      return false;
    }
  }

  getErrors() {
    return this.errors;
  }
}
