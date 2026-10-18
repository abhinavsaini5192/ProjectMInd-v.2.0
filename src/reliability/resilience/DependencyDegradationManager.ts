export type DependencyCriticality = 'CRITICAL' | 'OPTIONAL' | 'DEGRADABLE';

export interface DependencyStatus {
  readonly name: string;
  readonly criticality: DependencyCriticality;
  readonly isAvailable: boolean;
  readonly isDegraded: boolean;
  readonly lastError?: string | undefined;
  readonly lastFailureAt?: number | undefined;
}

export class DependencyDegradationManager {
  private readonly dependencies = new Map<
    string,
    { criticality: DependencyCriticality; isAvailable: boolean; lastError?: string | undefined; lastFailureAt?: number | undefined }
  >();

  public register(name: string, criticality: DependencyCriticality): void {
    this.dependencies.set(name, {
      criticality,
      isAvailable: true,
    });
  }

  public recordFailure(name: string, error: unknown): DependencyStatus {
    const existing = this.dependencies.get(name) ?? {
      criticality: 'OPTIONAL' as DependencyCriticality,
      isAvailable: true,
    };

    const errorMessage = error instanceof Error ? error.message : String(error);
    const updated = {
      ...existing,
      isAvailable: false,
      lastError: errorMessage,
      lastFailureAt: Date.now(),
    };

    this.dependencies.set(name, updated);
    return this.getStatus(name)!;
  }

  public recordSuccess(name: string): void {
    const existing = this.dependencies.get(name);
    if (existing) {
      existing.isAvailable = true;
      existing.lastError = undefined;
    }
  }

  public getStatus(name: string): DependencyStatus | undefined {
    const dep = this.dependencies.get(name);
    if (!dep) return undefined;

    return {
      name,
      criticality: dep.criticality,
      isAvailable: dep.isAvailable,
      isDegraded: !dep.isAvailable && dep.criticality !== 'CRITICAL',
      lastError: dep.lastError,
      lastFailureAt: dep.lastFailureAt,
    };
  }

  public isCriticalFailure(): boolean {
    for (const dep of this.dependencies.values()) {
      if (dep.criticality === 'CRITICAL' && !dep.isAvailable) {
        return true;
      }
    }
    return false;
  }

  public getActiveDegradations(): DependencyStatus[] {
    const list: DependencyStatus[] = [];
    for (const [name, dep] of this.dependencies.entries()) {
      if (!dep.isAvailable) {
        list.push({
          name,
          criticality: dep.criticality,
          isAvailable: false,
          isDegraded: dep.criticality !== 'CRITICAL',
          lastError: dep.lastError,
          lastFailureAt: dep.lastFailureAt,
        });
      }
    }
    return list;
  }
}
