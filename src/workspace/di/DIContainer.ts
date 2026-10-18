import { DIError } from '../errors';

export type ServiceLifetime = 'Singleton' | 'Transient' | 'Scoped';

export interface ServiceDescriptor<T = any> {
  token: symbol;
  implementation?: new (...args: any[]) => T;
  factory?: (container: DIContainer) => T;
  dependencies: symbol[];
  lifetime: ServiceLifetime;
  instance?: T;
}

export class DIContainer {
  private services = new Map<symbol, ServiceDescriptor>();
  private resolving = new Set<symbol>(); // For circular dependency detection

  registerSingleton<T>(
    token: symbol,
    implementation: (new (...args: any[]) => T) | ((container: DIContainer) => T),
    dependencies: symbol[] = []
  ): void {
    const isClass = typeof implementation === 'function' && implementation.prototype && implementation.prototype.constructor === implementation && implementation.toString().startsWith('class');
    if (!isClass && typeof implementation === 'function') {
      this.services.set(token, { token, factory: implementation as (container: DIContainer) => T, dependencies: [], lifetime: 'Singleton' });
    } else {
      this.services.set(token, { token, implementation: implementation as new (...args: any[]) => T, dependencies, lifetime: 'Singleton' });
    }
  }

  hasRegistration(token: symbol): boolean {
    return this.services.has(token);
  }

  registerTransient<T>(token: symbol, implementation: new (...args: any[]) => T, dependencies: symbol[] = []): void {
    this.services.set(token, { token, implementation, dependencies, lifetime: 'Transient' });
  }

  registerScoped<T>(token: symbol, implementation: new (...args: any[]) => T, dependencies: symbol[] = []): void {
    this.services.set(token, { token, implementation, dependencies, lifetime: 'Scoped' });
  }

  registerFactory<T>(token: symbol, factory: (container: DIContainer) => T, lifetime: ServiceLifetime = 'Transient'): void {
    this.services.set(token, { token, factory, dependencies: [], lifetime });
  }

  registerInstance<T>(token: symbol, instance: T): void {
    this.services.set(token, { token, instance, dependencies: [], lifetime: 'Singleton' });
  }

  resolve<T>(token: symbol): T {
    if (this.resolving.has(token)) {
      const cycle = Array.from(this.resolving).map(s => s.description).join(' -> ') + ' -> ' + token.description;
      throw new DIError(`Circular dependency detected: ${cycle}`);
    }

    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new DIError(`Service not registered for token: ${String(token.description)}`);
    }

    if (descriptor.lifetime === 'Singleton' && descriptor.instance) {
      return descriptor.instance as T;
    }

    this.resolving.add(token);

    try {
      let instance: T;
      if (descriptor.factory) {
        instance = descriptor.factory(this);
      } else if (descriptor.implementation) {
        const resolvedArgs = descriptor.dependencies.map(dep => this.resolve(dep));
        instance = new descriptor.implementation(...resolvedArgs);
      } else {
         throw new DIError(`No implementation or factory provided for token: ${String(token.description)}`);
      }

      if (descriptor.lifetime === 'Singleton') {
        descriptor.instance = instance;
      }

      // Scoped services will just act like Transient for now, until scopes are implemented
      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }

  validateStartup(): void {
    // Attempt to resolve every singleton to ensure no missing deps or cycles
    for (const [token, descriptor] of this.services.entries()) {
      if (descriptor.lifetime === 'Singleton') {
        this.resolve(token);
      }
    }
  }

  getDescriptors(): ServiceDescriptor[] {
    return Array.from(this.services.values());
  }
}
