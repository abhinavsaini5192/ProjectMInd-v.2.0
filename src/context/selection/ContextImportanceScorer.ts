export class ContextImportanceScorer {
  public static scoreFeatureImportance(
    isDirect: boolean,
    dependencyCount: number,
    dependentCount: number,
    hasCriticalRisks: boolean
  ): number {
    let base = isDirect ? 0.8 : 0.4;

    // Features with high fan-in (many depend on it) are architecturally critical
    if (dependentCount > 3) {
      base += 0.15;
    } else if (dependentCount > 0) {
      base += 0.05;
    }

    if (hasCriticalRisks) {
      base += 0.1;
    }

    return Math.min(1.0, Number(base.toFixed(3)));
  }

  public static scoreResourceImportance(
    role: string,
    symbolCount: number = 0
  ): number {
    const rUpper = role.toUpperCase();
    let weight = 0.5;

    if (rUpper === 'PRIMARY' || rUpper === 'ENTRY_POINT') {
      weight = 0.9;
    } else if (rUpper === 'SECONDARY') {
      weight = 0.7;
    } else if (rUpper === 'TEST') {
      weight = 0.5;
    } else {
      weight = 0.3;
    }

    if (symbolCount > 5) {
      weight += 0.1;
    }

    return Math.min(1.0, Number(weight.toFixed(3)));
  }
}
