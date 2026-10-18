import type { SelectedContextData } from '../interfaces/IContextSelector.js';
import type { RetrievedContextData } from '../interfaces/IContextRetriever.js';

export class ContextSectionPacker {
  public static packDependencies(retrieved: RetrievedContextData): any[] {
    const deps: any[] = [];
    for (const [featureId, resp] of retrieved.featureKnowledgeMap.entries()) {
      const depData = resp.profile.dependencies?.data;
      if (depData?.dependencies) {
        for (const d of depData.dependencies) {
          deps.push({
            sourceFeatureId: featureId,
            targetFeatureId: d.featureId,
            relationshipType: d.relationshipType,
            confidence: d.confidence,
            direct: d.direct,
          });
        }
      }
    }
    return deps;
  }

  public static packHealth(selected: SelectedContextData, retrieved: RetrievedContextData): Record<string, any> | undefined {
    if (selected.risks.length === 0 && retrieved.featureKnowledgeMap.size === 0) {
      return undefined;
    }

    const featureHealth: Record<string, any> = {};
    for (const [featureId, resp] of retrieved.featureKnowledgeMap.entries()) {
      const hData = resp.profile.health?.data;
      if (hData) {
        featureHealth[featureId] = {
          score: hData.healthScore,
          status: hData.healthStatus,
          criticalityLevel: hData.criticalityLevel,
          risksCount: hData.risks?.length ?? 0,
        };
      }
    }

    return {
      features: featureHealth,
      activeRisks: selected.risks,
    };
  }

  public static packImpact(retrieved: RetrievedContextData): Record<string, any> | undefined {
    if (retrieved.impactMap.size === 0) {
      return undefined;
    }

    const impactData: Record<string, any> = {};
    for (const [featureId, impacts] of retrieved.impactMap.entries()) {
      impactData[featureId] = impacts;
    }
    return impactData;
  }

  public static packArchitecture(retrieved: RetrievedContextData): Record<string, any> | undefined {
    const arch: Record<string, any> = {};
    for (const [featureId, resp] of retrieved.featureKnowledgeMap.entries()) {
      if (resp.profile.architecture?.data) {
        arch[featureId] = resp.profile.architecture.data;
      }
    }
    return Object.keys(arch).length > 0 ? arch : undefined;
  }
}
