import type { ReadinessReport } from './PlatformHealthModels.js';

export type DependencyCheckFn = () => Promise<boolean> | boolean;

export class PlatformReadinessProvider {
  private readonly dependencyChecks = new Map<string, { check: DependencyCheckFn; required: boolean }>();

  public registerDependency(name: string, check: DependencyCheckFn, required: boolean = true): void {
    this.dependencyChecks.set(name, { check, required });
  }

  public async getReadiness(): Promise<ReadinessReport> {
    const dependencies: Record<string, boolean> = {};
    let isReady = true;

    for (const [name, dep] of this.dependencyChecks.entries()) {
      try {
        const passed = await dep.check();
        dependencies[name] = passed;
        if (dep.required && !passed) {
          isReady = false;
        }
      } catch {
        dependencies[name] = false;
        if (dep.required) {
          isReady = false;
        }
      }
    }

    return {
      ready: isReady,
      dependencies,
      timestamp: new Date().toISOString(),
    };
  }
}
