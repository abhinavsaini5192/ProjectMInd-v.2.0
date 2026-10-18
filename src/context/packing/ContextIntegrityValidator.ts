import type { ContextPackage } from '../models/ContextPackage.js';
import type { ContextWarning } from '../models/ContextWarning.js';

export class ContextIntegrityValidator {
  private static readonly SECRET_REGEX =
    /(password|passwd|secret|token|api[_-]?key|access[_-]?token|auth[_-]?token|bearer)\s*[:=]\s*['"][^'"]+['"]/gi;
  private static readonly BEARER_REGEX = /Bearer\s+[A-Za-z0-9_\-\.]{20,}/gi;

  public static sanitizeString(input: string): string {
    if (!input) return input;
    return input
      .replace(this.SECRET_REGEX, '$1="[REDACTED_SECRET]"')
      .replace(this.BEARER_REGEX, 'Bearer [REDACTED_SECRET]');
  }

  public static sanitizePackage(pkg: ContextPackage): void {
    // Sanitize task text
    if (pkg.task.text) {
      pkg.task.text = this.sanitizeString(pkg.task.text);
    }

    // Sanitize features
    for (const f of pkg.features) {
      f.description = this.sanitizeString(f.description);
      for (const res of f.resources) {
        if (res.snippet) {
          res.snippet = this.sanitizeString(res.snippet);
        }
      }
    }

    // Sanitize loose resources
    for (const r of pkg.resources) {
      if (r.snippet) {
        r.snippet = this.sanitizeString(r.snippet);
      }
    }
  }

  public static validateGraphIntegrity(
    features: Array<{ featureId: string; dependencies?: any[] }>,
    warnings: ContextWarning[]
  ): void {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (currId: string, adjMap: Map<string, string[]>): boolean => {
      visited.add(currId);
      recStack.add(currId);

      const neighbors = adjMap.get(currId) ?? [];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          if (checkCycle(n, adjMap)) return true;
        } else if (recStack.has(n)) {
          return true;
        }
      }

      recStack.delete(currId);
      return false;
    };

    const adjMap = new Map<string, string[]>();
    for (const f of features) {
      const deps = (f.dependencies ?? []).map((d) => (typeof d === 'string' ? d : d.featureId || d.targetFeatureId)).filter(Boolean);
      adjMap.set(f.featureId, deps);
    }

    for (const f of features) {
      if (!visited.has(f.featureId)) {
        if (checkCycle(f.featureId, adjMap)) {
          warnings.push({
            type: 'CIRCULAR_DEPENDENCY',
            message: `Detected circular dependency cycle involving feature '${f.featureId}'.`,
            section: 'DEPENDENCIES',
            targetId: f.featureId,
          });
          break;
        }
      }
    }
  }
}
